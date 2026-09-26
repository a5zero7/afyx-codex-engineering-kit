Set-StrictMode -Version Latest

# Canonical component model for the Afyx Codex Engineering Kit (PowerShell).
# The data lives once in scripts/components.json; installer, updater,
# uninstaller, verifier and doctor all ask this module for component state.
# Read-only: nothing here writes, installs, or changes configuration.

$script:ContractPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'components.json'
$script:States = @('NOT INSTALLED', 'HEALTHY', 'INCOMPLETE', 'INVALID', 'UNKNOWN')

function Get-AfyxPlatform {
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        if ($IsWindows) { return 'windows' }
        return 'unix'
    }
    return 'windows'
}

function New-AfyxComponentContext {
    [CmdletBinding()]
    param(
        [string]$SkillsRoot,
        [string]$GraphRoot,
        [string]$CodexHome,
        [string]$Platform
    )
    $userHome = if ($env:USERPROFILE) { $env:USERPROFILE } elseif ($env:HOME) { $env:HOME } else { [Environment]::GetFolderPath('UserProfile') }
    if (-not $SkillsRoot) { $SkillsRoot = Join-Path (Join-Path $userHome '.agents') 'skills' }
    if (-not $GraphRoot) { $GraphRoot = if ($env:AFYX_GRAPH_RUNTIME_ROOT) { $env:AFYX_GRAPH_RUNTIME_ROOT } else { Join-Path (Join-Path $userHome '.afyx') 'graph' } }
    if (-not $CodexHome) { $CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $userHome '.codex' } }
    if (-not $Platform) { $Platform = Get-AfyxPlatform }
    [pscustomobject]@{
        SkillsRoot = $SkillsRoot
        GraphRoot  = $GraphRoot
        CodexHome  = $CodexHome
        Platform   = $Platform
    }
}

function Get-AfyxComponentContract {
    [CmdletBinding()]
    param([string]$Path = $script:ContractPath)
    $document = Get-Content -Raw -LiteralPath $Path -Encoding utf8 | ConvertFrom-Json
    if ($document.schema_version -ne 1) { throw "Unsupported component contract schema_version: $($document.schema_version)" }
    return @($document.components)
}

function Get-AfyxField {
    param($Component, [string]$Name)
    $property = $Component.PSObject.Properties[$Name]
    if ($property -and $null -ne $property.Value) { return [string]$property.Value }
    return ''
}

function Get-AfyxList {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return @() }
    return @($Value -split ';' | Where-Object { $_ })
}

function Get-AfyxComponentRoot {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Component, [Parameter(Mandatory)]$Context)
    $root = switch (Get-AfyxField $Component 'install_root') {
        'skills_root'     { $Context.SkillsRoot }
        'afyx_graph_root' { $Context.GraphRoot }
        'codex_tools'     { Join-Path $Context.CodexHome 'tools' }
        default           { '' }
    }
    if (-not $root) { return '' }
    $relative = Get-AfyxField $Component 'install_path'
    if ($relative) { return Join-Path $root $relative }
    return $root
}

function Test-AfyxSkillManifest {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Directory, [bool]$RequireVersion = $false)
    $manifest = Join-Path $Directory 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return @{ Ok = $false; Detail = 'SKILL.md missing' } }
    try { $text = Get-Content -Raw -LiteralPath $manifest -Encoding utf8 } catch { return @{ Ok = $false; Detail = 'not readable as UTF-8' } }
    if ([string]::IsNullOrWhiteSpace($text)) { return @{ Ok = $false; Detail = 'SKILL.md is empty' } }
    if ($text -notmatch '\A---\r?\n[\s\S]*?\r?\n---\r?\n') { return @{ Ok = $false; Detail = 'frontmatter delimiters missing or malformed' } }
    if ($text -notmatch '(?m)^name:\s*[a-z0-9-]+\s*$') { return @{ Ok = $false; Detail = 'valid name missing' } }
    if ($text -notmatch '(?m)^description:\s*\S.+$') { return @{ Ok = $false; Detail = 'description missing' } }
    if ($RequireVersion -and $text -notmatch '(?ms)^metadata:\s*\r?\n\s+version:\s*["''][^"'']+["'']\s*$') { return @{ Ok = $false; Detail = 'metadata.version missing' } }
    return @{ Ok = $true; Detail = 'frontmatter valid' }
}

function Get-AfyxSkillVersion {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Directory)
    $manifest = Join-Path $Directory 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return $null }
    $text = Get-Content -Raw -LiteralPath $manifest -Encoding utf8
    $match = [regex]::Match($text, '(?m)^[ \t]*version:[ \t]*["'']?([^"''\s]+)')
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

function New-AfyxState {
    param($Component, [string]$State, [string]$Detail, [string]$Version = '', [string]$Path = '')
    [pscustomobject]@{
        Id        = Get-AfyxField $Component 'id'
        Name      = Get-AfyxField $Component 'name'
        Type      = Get-AfyxField $Component 'type'
        Tier      = Get-AfyxField $Component 'tier'
        Ownership = Get-AfyxField $Component 'ownership'
        State     = $State
        Detail    = $Detail
        Version   = $Version
        Path      = $Path
    }
}

function Get-AfyxComponentState {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Component, [Parameter(Mandatory)]$Context)

    $type = Get-AfyxField $Component 'type'
    $platforms = Get-AfyxField $Component 'platforms'

    if ($type -eq 'detected-cli') {
        $command = Get-AfyxField $Component 'detect_command'
        if (Get-Command $command -ErrorAction SilentlyContinue) { return New-AfyxState $Component 'HEALTHY' 'externally managed; detected' }
        return New-AfyxState $Component 'NOT INSTALLED' 'externally managed; not detected'
    }
    if ($platforms -eq 'windows' -and $Context.Platform -ne 'windows') {
        return New-AfyxState $Component 'NOT INSTALLED' 'Windows-only runtime'
    }

    $path = Get-AfyxComponentRoot -Component $Component -Context $Context
    if (-not $path) { return New-AfyxState $Component 'UNKNOWN' 'component root is not defined' }

    $required = @(Get-AfyxList (Get-AfyxField $Component 'required_files'))
    $required += @(Get-AfyxList (Get-AfyxField $Component "required_files_$($Context.Platform)"))

    try {
        switch ($type) {
            'skill' {
                if (-not (Test-Path -LiteralPath $path)) { return New-AfyxState $Component 'NOT INSTALLED' 'not installed' '' $path }
                $requireVersion = (Get-AfyxField $Component 'version_required') -eq 'true'
                $manifest = Test-AfyxSkillManifest -Directory $path -RequireVersion $requireVersion
                if (-not $manifest.Ok) { return New-AfyxState $Component 'INVALID' $manifest.Detail '' $path }
                foreach ($relative in $required) {
                    $file = Join-Path $path $relative
                    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return New-AfyxState $Component 'INCOMPLETE' "reference missing: $relative" '' $path }
                    if ($relative -ne 'SKILL.md' -and [string]::IsNullOrWhiteSpace((Get-Content -Raw -LiteralPath $file -Encoding utf8))) {
                        return New-AfyxState $Component 'INCOMPLETE' "reference empty: $relative" '' $path
                    }
                }
                return New-AfyxState $Component 'HEALTHY' 'frontmatter and required references valid' (Get-AfyxSkillVersion -Directory $path) $path
            }
            'runtime' {
                if (-not (Test-Path -LiteralPath $path)) { return New-AfyxState $Component 'NOT INSTALLED' 'not installed' '' $path }
                foreach ($relative in $required) {
                    if (-not (Test-Path -LiteralPath (Join-Path $path $relative) -PathType Leaf)) { return New-AfyxState $Component 'INCOMPLETE' "missing: $relative" '' $path }
                }
                $markerFile = Join-Path $path (Get-AfyxField $Component 'marker_file')
                try { $document = Get-Content -Raw -LiteralPath $markerFile -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop }
                catch { return New-AfyxState $Component 'INVALID' 'ownership metadata is not valid JSON' '' $path }
                $field = Get-AfyxField $Component 'marker_field'
                $marker = $document.PSObject.Properties[$field]
                if (-not $marker -or [string]$marker.Value -ne (Get-AfyxField $Component 'marker_value')) {
                    return New-AfyxState $Component 'INVALID' 'ownership marker mismatch' '' $path
                }
                $versionField = (Get-AfyxField $Component 'version_source') -replace '^[^#]*#', ''
                $version = $document.PSObject.Properties[$versionField]
                if ((Get-AfyxField $Component 'version_required') -eq 'true' -and (-not $version -or -not $version.Value)) {
                    return New-AfyxState $Component 'INVALID' "$versionField missing from metadata" '' $path
                }
                $versionText = if ($version) { [string]$version.Value } else { '' }
                return New-AfyxState $Component 'HEALTHY' 'Afyx-owned runtime valid' $versionText $path
            }
            'toolset' {
                $present = @($required | Where-Object { Test-Path -LiteralPath (Join-Path $path $_) -PathType Leaf })
                if ($present.Count -eq 0) { return New-AfyxState $Component 'NOT INSTALLED' 'not installed' '' $path }
                if ($present.Count -eq $required.Count) { return New-AfyxState $Component 'HEALTHY' 'runtime files installed' '' $path }
                return New-AfyxState $Component 'INCOMPLETE' "$($present.Count) of $($required.Count) runtime files present" '' $path
            }
            default { return New-AfyxState $Component 'UNKNOWN' "unsupported component type: $type" '' $path }
        }
    }
    catch [System.UnauthorizedAccessException] { return New-AfyxState $Component 'UNKNOWN' 'access denied while inspecting component' '' $path }
    catch { return New-AfyxState $Component 'UNKNOWN' "inspection failed: $($_.Exception.Message)" '' $path }
}

function Get-AfyxComponentStates {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Context, [string]$ContractPath = $script:ContractPath)
    foreach ($component in (Get-AfyxComponentContract -Path $ContractPath)) {
        Get-AfyxComponentState -Component $component -Context $Context
    }
}

Export-ModuleMember -Function Get-AfyxPlatform, New-AfyxComponentContext, Get-AfyxComponentContract, Get-AfyxComponentRoot, Test-AfyxSkillManifest, Get-AfyxSkillVersion, Get-AfyxComponentState, Get-AfyxComponentStates
