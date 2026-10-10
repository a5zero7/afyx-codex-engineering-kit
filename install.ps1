[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [string]$PromptMasterRepository = 'https://github.com/nidhinjs/prompt-master.git',
    [switch]$Force,
    [switch]$ValidateOnly,
    [string[]]$ComponentAction = @(),
    [switch]$UpdateInstalled,
    [switch]$Offline,
    [switch]$NoBuildFallback,
    [switch]$AllowDirtySource,
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
$graphRuntimeRoot = if ($env:AFYX_GRAPH_RUNTIME_ROOT) { $env:AFYX_GRAPH_RUNTIME_ROOT } else { Join-Path $env:USERPROFILE '.afyx\graph' }
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }

if ($InstallUsageTracker -and $SkipUsageTracker) { throw '-InstallUsageTracker and -SkipUsageTracker cannot be used together.' }

# One component truth: scripts/components.json, read through the shared module.
Import-Module (Join-Path $packageRoot 'scripts\lib\AfyxComponents.psm1') -Force
$componentContext = New-AfyxComponentContext -SkillsRoot $SkillsRoot -GraphRoot $graphRuntimeRoot -CodexHome $codexHome
$componentStates = @{}
foreach ($componentState in (Get-AfyxComponentStates -Context $componentContext)) { $componentStates[$componentState.Id] = $componentState }
$componentActions = @{}
foreach ($specification in $ComponentAction) {
    if ($specification -notmatch '^([a-z0-9-]+)=(skip|install|update|repair)$') {
        throw "Invalid -ComponentAction '$specification'. Use component-id=skip|install|update|repair."
    }
    $componentActions[$Matches[1]] = $Matches[2]
}
$knownSelectable = @('efficient-coding', 'odoo-engineering', 'prompt-master', 'afyx-graph', 'codex-usage-tracking')
foreach ($id in $componentActions.Keys) { if ($id -notin $knownSelectable) { throw "Unknown selectable component: $id" } }

function Get-AvailableVersion([string]$Id) {
    switch ($Id) {
        'efficient-coding' { return Get-AfyxSkillVersion -Directory $bundledEfficientCoding }
        'odoo-engineering' { return Get-AfyxSkillVersion -Directory $bundledOdooEngineering }
        'afyx-graph' { return (Get-Content -Raw -LiteralPath $graphMetadataPath | ConvertFrom-Json).product_version }
        default { return '' }
    }
}

function Compare-AfyxVersion([string]$Installed, [string]$Available) {
    if (-not $Installed -or -not $Available) { return 0 }
    try { return ([version]$Installed).CompareTo([version]$Available) }
    catch { return [string]::Compare($Installed, $Available, $true) }
}

function Get-ComponentAction([string]$Id, [string]$Label) {
    $state = $componentStates[$Id]
    if ($componentActions.ContainsKey($Id)) { $action = $componentActions[$Id] }
    elseif ($Force) {
        $action = if ($state.State -eq 'NOT INSTALLED') { 'install' } elseif ($state.State -in @('INCOMPLETE', 'INVALID')) { 'repair' } else { 'update' }
    } elseif ($UpdateInstalled) {
        $available = Get-AvailableVersion $Id
        if ($state.State -in @('INCOMPLETE', 'INVALID')) { $action = 'repair' }
        elseif ($state.State -eq 'HEALTHY' -and $available -and (Compare-AfyxVersion $state.Version $available) -lt 0) { $action = 'update' }
        else { $action = 'skip' }
    } elseif ($WhatIfPreference -or $env:CI -or [Console]::IsInputRedirected) { $action = 'skip' }
    else {
        $available = Get-AvailableVersion $Id
        $versionDetail = if ($state.Version -or $available) { " installed=$($state.Version) available=$available" } else { '' }
        if ($state.State -eq 'NOT INSTALLED') {
            do { $answer = (Read-Host "$Label is not installed.$versionDetail [I] Install / [S] Skip [S]").Trim() } until ($answer -match '(?i)^(|i|install|s|skip)$')
            $action = if ($answer -match '(?i)^(i|install)$') { 'install' } else { 'skip' }
        } elseif ($state.State -eq 'HEALTHY') {
            $default = if ($available -and (Compare-AfyxVersion $state.Version $available) -lt 0) { 'U' } else { 'S' }
            do { $answer = (Read-Host "$Label is healthy.$versionDetail [U] Update / [S] Skip [$default]").Trim() } until ($answer -match '(?i)^(|u|update|s|skip)$')
            $action = if ($answer -match '(?i)^(u|update)$' -or (-not $answer -and $default -eq 'U')) { 'update' } else { 'skip' }
        } elseif ($state.State -in @('INCOMPLETE', 'INVALID')) {
            do { $answer = (Read-Host "$Label is $($state.State): $($state.Detail) [R] Repair / [S] Skip [S]").Trim() } until ($answer -match '(?i)^(|r|repair|s|skip)$')
            $action = if ($answer -match '(?i)^(r|repair)$') { 'repair' } else { 'skip' }
        } else { Write-Warning "$Label ownership/health is unknown; it will not be overwritten."; $action = 'skip' }
    }
    $allowed = switch ($state.State) {
        'NOT INSTALLED' { @('install', 'skip') }
        'HEALTHY' { @('update', 'skip') }
        { $_ -in @('INCOMPLETE', 'INVALID') } { @('repair', 'skip') }
        default { @('skip') }
    }
    if ($action -notin $allowed) { throw "$Label state $($state.State) does not permit '$action' (allowed: $($allowed -join ', '))." }
    return $action
}

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
$graphMetadata = Get-Content -Raw -LiteralPath $graphMetadataPath | ConvertFrom-Json
$graphReleaseChannel = (Get-Content -Raw -LiteralPath (Join-Path $packageRoot 'afyx-graph\engine\scripts\distribution-product.json') | ConvertFrom-Json).releaseChannel
$states = [ordered]@{
    'Efficient Coding' = $componentStates['efficient-coding'].State
    'Odoo Engineering' = $componentStates['odoo-engineering'].State
    'Prompt Master' = $componentStates['prompt-master'].State
    'Afyx Graph' = $componentStates['afyx-graph'].State
    'Usage Tracking' = $componentStates['codex-usage-tracking'].State
}
Write-Host ''
Write-Host 'Component Inventory'
foreach ($entry in $states.GetEnumerator()) {
    $id = switch ($entry.Key) { 'Efficient Coding' { 'efficient-coding' } 'Odoo Engineering' { 'odoo-engineering' } 'Prompt Master' { 'prompt-master' } 'Afyx Graph' { 'afyx-graph' } default { 'codex-usage-tracking' } }
    $installed = $componentStates[$id].Version
    $available = Get-AvailableVersion $id
    Write-Host ("{0}: {1}; installed={2}; available={3}; ownership={4}" -f $entry.Key, $entry.Value, $(if ($installed) { $installed } else { 'n/a' }), $(if ($available) { $available } else { 'external/n/a' }), $componentStates[$id].Ownership)
}
Write-Host "Headroom: $(if (Get-Command headroom -ErrorAction SilentlyContinue) { 'externally managed; detected' } else { 'externally managed; not detected' })"
Write-Host ''
Write-Host 'Prerequisite Inventory'
$gitVersion = try { (& git --version 2>$null) -join ' ' } catch { '' }
$nodeVersion = try { (& node --version 2>$null) -join ' ' } catch { '' }
$npmVersion = try { (& npm --version 2>$null) -join ' ' } catch { '' }
Write-Host "[REQUIRED] OS/architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription) / $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
Write-Host "[REQUIRED] Platform shell: PowerShell $($PSVersionTable.PSVersion)"
Write-Host "[REQUIRED] Git: $(if ($gitVersion) { $gitVersion } else { 'MISSING — install Git for Windows from https://git-scm.com/' })"
Write-Host "[REQUIRED] Codex host: $(if ($codexCliDetected -or $vscodeExtensionDetected) { 'detected' } else { 'MISSING — install Codex CLI or the supported VS Code extension' })"
Write-Host "[COMPONENT_REQUIRED:Afyx Graph] Node.js >=22.5.0: $(if ($nodeVersion) { $nodeVersion } else { 'MISSING — install from https://nodejs.org/' })"
Write-Host "[BUILD_ONLY:Afyx Graph] npm: $(if ($npmVersion) { $npmVersion } else { 'MISSING — needed only for automatic local fallback' })"
Write-Host '[COMPONENT_REQUIRED:Afyx Graph] Archive/checksum: Expand-Archive + Get-FileHash available'
$sourceBranch = if ($gitVersion) { (& git -C $packageRoot branch --show-current 2>$null) -join '' } else { 'unavailable' }
$sourceCommit = if ($gitVersion) { (& git -C $packageRoot rev-parse HEAD 2>$null) -join '' } else { 'unavailable' }
Write-Host "Source: branch=$sourceBranch; commit=$sourceCommit; channel=$graphReleaseChannel"

if ($ValidateOnly) {
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
        InstalledUsageTracker = $states['Usage Tracking'] -eq 'HEALTHY'
        UsageTrackerState = $states['Usage Tracking']
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
    @{ Id = 'efficient-coding'; Name = 'Efficient Coding'; Source = $bundledEfficientCoding; Target = $efficientTarget },
    @{ Id = 'odoo-engineering'; Name = 'Odoo Engineering'; Source = $bundledOdooEngineering; Target = $odooTarget }
)) {
    $action = Get-ComponentAction $component.Id $component.Name
    if ($action -eq 'skip') { $summary[$component.Name] = 'skipped'; continue }
    $summary[$component.Name] = Install-SkillSafely $component.Name $component.Source $component.Target ($action -in @('update', 'repair'))
}

$promptAction = Get-ComponentAction 'prompt-master' 'Prompt Master'
if ($Offline -and $promptAction -ne 'skip') {
    throw 'Offline mode cannot install or update upstream-owned Prompt Master. Choose prompt-master=skip or retry with network access.'
}
if (Test-Path -LiteralPath $promptTarget) {
    if ($promptAction -eq 'skip') { $summary['Prompt Master'] = 'skipped' }
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
} elseif ($promptAction -eq 'skip') { $summary['Prompt Master'] = 'skipped' }
elseif ($WhatIfPreference) { Write-Host 'WhatIf: would clone Prompt Master'; $summary['Prompt Master'] = 'planned' }
else {
    & git clone --depth 1 $PromptMasterRepository $promptTarget
    if ($LASTEXITCODE -ne 0 -or -not (Test-SkillManifest $promptTarget)) { throw 'Prompt Master installation failed.' }
    $summary['Prompt Master'] = 'installed'
}

$graphState = $states['Afyx Graph']
$graphAction = Get-ComponentAction 'afyx-graph' 'Afyx Graph'
if ($graphAction -eq 'skip') { $summary['Afyx Graph'] = 'skipped' }
else {
    $arguments = if ($graphState -eq 'NOT INSTALLED') { @{} } elseif ($graphAction -eq 'update') { @{ Update = $true } } else { @{ Replace = $true } }
    if ($Offline) { $arguments.Offline = $true }
    if ($NoBuildFallback) { $arguments.NoBuildFallback = $true }
    if ($AllowDirtySource) { $arguments.AllowDirtySource = $true }
    & $graphInstaller -Confirm:$false -WhatIf:$WhatIfPreference @arguments
    if (-not $?) { throw 'Afyx Graph installation failed.' }
    $summary['Afyx Graph'] = $graphAction
}

$usageState = $states['Usage Tracking']
$usageAction = if ($InstallUsageTracker) { if ($usageState -eq 'NOT INSTALLED') { 'install' } elseif ($usageState -in @('INCOMPLETE', 'INVALID')) { 'repair' } else { 'update' } }
    elseif ($SkipUsageTracker) { 'skip' }
    else { Get-ComponentAction 'codex-usage-tracking' 'Usage Tracking' }
if ($usageAction -eq 'skip') { $summary['Usage Tracking'] = 'skipped'; Write-Host 'Usage Tracking: skipped' }
else {
    & $usageTrackerInstaller -Confirm:$false -WhatIf:$WhatIfPreference
    if (-not $?) { throw 'Codex Usage Tracking installation failed.' }
    $summary['Usage Tracking'] = $usageAction
}

Write-Host ''
Write-Host 'Installation Summary'
foreach ($entry in $summary.GetEnumerator()) { Write-Host "[$($entry.Value.ToUpperInvariant())] $($entry.Key)" }
Write-Host '[INFO] Headroom — externally managed; unchanged'
if ($WhatIfPreference) { Write-Host 'WhatIf completed; no files or configuration were changed.' }
else { Write-Host 'Start a new Codex session to load installed components.' }
