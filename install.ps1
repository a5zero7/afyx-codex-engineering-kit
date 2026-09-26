[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [string]$PromptMasterRepository = 'https://github.com/nidhinjs/prompt-master.git',
    [switch]$Force,
    [switch]$ValidateOnly,
    [switch]$InstallUsageTracker,
    [switch]$SkipUsageTracker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Write-Host 'Afyx Codex Engineering Kit — Windows installer (PowerShell)'

$packageRoot = $PSScriptRoot
$bundledEfficientCoding = Join-Path $packageRoot 'skills\efficient-coding'
$bundledOdooEngineering = Join-Path $packageRoot 'skills\odoo-engineering'
$efficientTarget = Join-Path $SkillsRoot 'efficient-coding'
$odooTarget = Join-Path $SkillsRoot 'odoo-engineering'
$promptTarget = Join-Path $SkillsRoot 'prompt-master'
$backupRoot = Join-Path $packageRoot 'backups'
$usageTrackerInstaller = Join-Path $packageRoot 'scripts\install-codex-usage-tracker.ps1'
$graphInstaller = Join-Path $packageRoot 'scripts\install-afyx-graph.ps1'
$graphMetadataPath = Join-Path $packageRoot 'afyx-graph\afyx-graph.json'
$graphRuntimeRoot = Join-Path $env:USERPROFILE '.afyx\graph'
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }

if ($InstallUsageTracker -and $SkipUsageTracker) { throw '-InstallUsageTracker and -SkipUsageTracker cannot be used together.' }

# One component truth: scripts/components.json, read through the shared module.
Import-Module (Join-Path $packageRoot 'scripts\lib\AfyxComponents.psm1') -Force
$componentContext = New-AfyxComponentContext -SkillsRoot $SkillsRoot -GraphRoot $graphRuntimeRoot -CodexHome $codexHome
$componentStates = @{}
foreach ($componentState in (Get-AfyxComponentStates -Context $componentContext)) { $componentStates[$componentState.Id] = $componentState }

function Test-SkillManifest([string]$SkillDirectory) {
    $manifest = Join-Path $SkillDirectory 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return $false }
    return (Get-Content -LiteralPath $manifest -TotalCount 1 -Encoding utf8) -eq '---'
}

function Read-ReplaceChoice([string]$Label) {
    if ($Force) { return 'Replace' }
    if ($WhatIfPreference -or $env:CI -or [Console]::IsInputRedirected) { return 'Skip' }
    do { $answer = (Read-Host "$Label [S] Skip / [R] Replace [S]").Trim() } until ($answer -match '(?i)^(|s|skip|r|replace)$')
    if ($answer -match '(?i)^(r|replace)$') { return 'Replace' }
    return 'Skip'
}

function Read-InstallChoice([string]$Label) {
    if ($WhatIfPreference -or $env:CI -or [Console]::IsInputRedirected) { return $false }
    do { $answer = (Read-Host "$Label [Y/N] [N]").Trim() } until ($answer -match '(?i)^(|y|yes|n|no)$')
    return $answer -match '(?i)^(y|yes)$'
}

function Install-SkillSafely([string]$Name, [string]$Source, [string]$Target, [bool]$ReplaceExisting) {
    if ((Test-Path -LiteralPath $Target) -and -not $ReplaceExisting) { return 'skipped' }
    if ($WhatIfPreference) { Write-Host "WhatIf: would stage and install $Name at $Target"; return 'planned' }
    $parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $stage = Join-Path $parent ".$((Split-Path -Leaf $Target))-stage-$([guid]::NewGuid().ToString('N'))"
    $old = Join-Path $parent ".$((Split-Path -Leaf $Target))-old-$([guid]::NewGuid().ToString('N'))"
    try {
        Copy-Item -LiteralPath $Source -Destination $stage -Recurse -Force
        if (-not (Test-SkillManifest $stage)) { throw "$Name staged manifest is invalid." }
        if (Test-Path -LiteralPath $Target) {
            New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
            $backup = Join-Path $backupRoot "$(Split-Path -Leaf $Target)-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item -LiteralPath $Target -Destination $backup -Recurse -Force
            Move-Item -LiteralPath $Target -Destination $old
        }
        try { Move-Item -LiteralPath $stage -Destination $Target }
        catch {
            if (Test-Path -LiteralPath $old) { Move-Item -LiteralPath $old -Destination $Target }
            throw
        }
        if (-not (Test-SkillManifest $Target)) { throw "$Name installed manifest is invalid." }
        if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Recurse -Force }
    } finally {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
        if ((Test-Path -LiteralPath $old) -and -not (Test-Path -LiteralPath $Target)) { Move-Item -LiteralPath $old -Destination $Target }
    }
    return $(if ($ReplaceExisting) { 'replaced' } else { 'installed' })
}

if (-not (Test-SkillManifest $bundledEfficientCoding)) { throw 'Bundled Efficient Coding is invalid or missing.' }
if (-not (Test-SkillManifest $bundledOdooEngineering)) { throw 'Bundled Odoo Engineering is invalid or missing.' }
if (-not (Test-Path -LiteralPath $graphMetadataPath -PathType Leaf)) { throw 'Bundled Afyx Graph metadata is missing.' }

$codexCliDetected = [bool](Get-Command codex -ErrorAction SilentlyContinue)
$vscodeExtensionDetected = [bool](Get-ChildItem -Path (Join-Path $env:USERPROFILE '.vscode\extensions\openai.chatgpt-*') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
$states = [ordered]@{
    'Efficient Coding' = $componentStates['efficient-coding'].State
    'Odoo Engineering' = $componentStates['odoo-engineering'].State
    'Prompt Master' = $componentStates['prompt-master'].State
    'Afyx Graph' = $componentStates['afyx-graph'].State
    'Codex Usage Tracking' = $componentStates['codex-usage-tracking'].State
}
Write-Host ''
Write-Host 'Component Inventory'
foreach ($entry in $states.GetEnumerator()) { Write-Host ("{0}: {1}" -f $entry.Key, $entry.Value) }
Write-Host "Headroom: $(if (Get-Command headroom -ErrorAction SilentlyContinue) { 'externally managed; detected' } else { 'externally managed; not detected' })"

if ($ValidateOnly) {
    $graphMetadata = Get-Content -Raw -LiteralPath $graphMetadataPath | ConvertFrom-Json
    [pscustomobject]@{
        BundledEfficientCoding = Test-SkillManifest $bundledEfficientCoding
        InstalledEfficientCoding = $states['Efficient Coding'] -eq 'HEALTHY'
        EfficientCodingState = $states['Efficient Coding']
        EfficientCodingVersion = $componentStates['efficient-coding'].Version
        BundledOdooEngineering = Test-SkillManifest $bundledOdooEngineering
        InstalledOdooEngineering = $states['Odoo Engineering'] -eq 'HEALTHY'
        OdooEngineeringState = $states['Odoo Engineering']
        OdooEngineeringVersion = $componentStates['odoo-engineering'].Version
        InstalledPromptMaster = $states['Prompt Master'] -eq 'HEALTHY'
        PromptMasterState = $states['Prompt Master']
        BundledAfyxGraphSource = Test-Path -LiteralPath (Join-Path $packageRoot 'afyx-graph\engine\package.json')
        InstalledAfyxGraph = $states['Afyx Graph'] -eq 'HEALTHY'
        AfyxGraphState = $states['Afyx Graph']
        AfyxGraphVersion = $graphMetadata.product_version
        InstalledUsageTracker = $states['Codex Usage Tracking'] -eq 'HEALTHY'
        UsageTrackerState = $states['Codex Usage Tracking']
        HeadroomAvailable = [bool](Get-Command headroom -ErrorAction SilentlyContinue)
        CodexCliDetected = $codexCliDetected
        VsCodeExtensionDetected = $vscodeExtensionDetected
    } | Format-List
    exit 0
}

if (-not $codexCliDetected -and -not $vscodeExtensionDetected) { throw 'Neither Codex CLI nor the ChatGPT/Codex VS Code extension was detected. Install one before installing skills.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required to install Prompt Master.' }

$summary = [ordered]@{}
foreach ($component in @(
    @{ Name = 'Efficient Coding'; Source = $bundledEfficientCoding; Target = $efficientTarget },
    @{ Name = 'Odoo Engineering'; Source = $bundledOdooEngineering; Target = $odooTarget }
)) {
    $exists = Test-Path -LiteralPath $component.Target
    $replace = $exists -and ((Read-ReplaceChoice $component.Name) -eq 'Replace')
    $summary[$component.Name] = Install-SkillSafely $component.Name $component.Source $component.Target $replace
}

if (Test-Path -LiteralPath $promptTarget) {
    $choice = Read-ReplaceChoice 'Prompt Master'
    if ($choice -eq 'Skip') { $summary['Prompt Master'] = 'skipped' }
    elseif ($WhatIfPreference) { Write-Host 'WhatIf: would stage and replace Prompt Master'; $summary['Prompt Master'] = 'planned' }
    else {
        if (Test-Path -LiteralPath (Join-Path $promptTarget '.git')) {
            $dirty = & git -C $promptTarget status --porcelain
            if ($dirty) { Write-Warning 'Prompt Master has local changes; the explicit Replace choice was accepted and a backup will be preserved.' }
        }
        $parent = Split-Path -Parent $promptTarget
        $stage = Join-Path $parent ".prompt-master-stage-$([guid]::NewGuid().ToString('N'))"
        & git clone --depth 1 $PromptMasterRepository $stage
        if ($LASTEXITCODE -ne 0 -or -not (Test-SkillManifest $stage)) { throw 'Prompt Master staging failed.' }
        New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
        $backup = Join-Path $backupRoot "prompt-master-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item -LiteralPath $promptTarget -Destination $backup -Recurse -Force
        $old = "$promptTarget.old-$([guid]::NewGuid().ToString('N'))"
        Move-Item $promptTarget $old
        try { Move-Item $stage $promptTarget; Remove-Item $old -Recurse -Force }
        catch { if (Test-Path $old) { Move-Item $old $promptTarget }; throw }
        $summary['Prompt Master'] = 'replaced'
    }
} elseif ($WhatIfPreference) { Write-Host 'WhatIf: would clone Prompt Master'; $summary['Prompt Master'] = 'planned' }
else {
    & git clone --depth 1 $PromptMasterRepository $promptTarget
    if ($LASTEXITCODE -ne 0 -or -not (Test-SkillManifest $promptTarget)) { throw 'Prompt Master installation failed.' }
    $summary['Prompt Master'] = 'installed'
}

$graphState = $states['Afyx Graph']
$installGraph = $false
if ($graphState -eq 'NOT INSTALLED') { $installGraph = Read-InstallChoice 'Install Afyx Graph?'; if (-not $installGraph) { $summary['Afyx Graph'] = 'skipped' } }
else { $installGraph = (Read-ReplaceChoice 'Afyx Graph') -eq 'Replace'; if (-not $installGraph) { $summary['Afyx Graph'] = 'skipped' } }
if ($installGraph) {
    $arguments = if ($graphState -eq 'NOT INSTALLED') { @{} } else { @{ Replace = $true } }
    & $graphInstaller -Confirm:$false -WhatIf:$WhatIfPreference @arguments
    if (-not $?) { throw 'Afyx Graph installation failed.' }
    $summary['Afyx Graph'] = $(if ($graphState -eq 'NOT INSTALLED') { 'installed' } else { 'replaced' })
}

$usageState = $states['Codex Usage Tracking']
$installUsage = $false
if ($InstallUsageTracker) { $installUsage = $true }
elseif ($SkipUsageTracker) { $summary['Codex Usage Tracking'] = 'skipped'; Write-Host 'Codex Usage Tracking: skipped' }
elseif ($usageState -eq 'NOT INSTALLED') { $installUsage = Read-InstallChoice 'Install Codex Usage Tracking?'; if (-not $installUsage) { $summary['Codex Usage Tracking'] = 'skipped'; Write-Host 'Codex Usage Tracking: skipped' } }
else { $installUsage = (Read-ReplaceChoice 'Codex Usage Tracking') -eq 'Replace'; if (-not $installUsage) { $summary['Codex Usage Tracking'] = 'skipped'; Write-Host 'Codex Usage Tracking: skipped' } }
if ($installUsage) {
    & $usageTrackerInstaller -Confirm:$false -WhatIf:$WhatIfPreference
    if (-not $?) { throw 'Codex Usage Tracking installation failed.' }
    $summary['Codex Usage Tracking'] = $(if ($usageState -eq 'NOT INSTALLED') { 'installed' } else { 'replaced' })
}

Write-Host ''
Write-Host 'Installation Summary'
foreach ($entry in $summary.GetEnumerator()) { Write-Host "[$($entry.Value.ToUpperInvariant())] $($entry.Key)" }
Write-Host '[INFO] Headroom — externally managed; unchanged'
if ($WhatIfPreference) { Write-Host 'WhatIf completed; no files or configuration were changed.' }
else { Write-Host 'Start a new Codex session to load installed components.' }
