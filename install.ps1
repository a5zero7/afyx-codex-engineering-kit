[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$Force,
    [switch]$ValidateOnly,
    [string[]]$ComponentAction = @(),
    [string]$Preset = '',
    [string[]]$CustomComponent = @(),
    [switch]$UpdateInstalled,
    [switch]$Offline,
    [switch]$NoBuildFallback,
    [switch]$AllowDirtySource,
    [switch]$InstallUsageTracker,
    [switch]$SkipUsageTracker,
    [switch]$SkipGraphMcp,
    [switch]$SkipGraphPathUpdate,
    [string]$ContextRuntimeRoot = $(if ($env:AFYX_CONTEXT_RUNTIME_ROOT) { $env:AFYX_CONTEXT_RUNTIME_ROOT } else { Join-Path $env:USERPROFILE '.afyx\context' })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Write-Host 'Afyx Codex Engineering Kit — Windows installer (PowerShell)'

$packageRoot = $PSScriptRoot
$bundledEfficientCoding = Join-Path $packageRoot 'skills\efficient-coding'
$bundledOdooEngineering = Join-Path $packageRoot 'skills\odoo-engineering'
$bundledEngineeringExpert = Join-Path $packageRoot 'skills\afyx-engineering-expert'
$efficientTarget = Join-Path $SkillsRoot 'efficient-coding'
$odooTarget = Join-Path $SkillsRoot 'odoo-engineering'
$expertTarget = Join-Path $SkillsRoot 'afyx-engineering-expert'
$usageTrackerInstaller = Join-Path $packageRoot 'scripts\install-codex-usage-tracker.ps1'
$graphInstaller = Join-Path $packageRoot 'scripts\install-afyx-graph.ps1'
$graphMetadataPath = Join-Path $packageRoot 'afyx-graph\afyx-graph.json'
$contextInstaller = Join-Path $packageRoot 'scripts\install-afyx-context.ps1'
$contextMetadataPath = Join-Path $packageRoot 'afyx-context\afyx-context.json'
$graphRuntimeRoot = if ($env:AFYX_GRAPH_RUNTIME_ROOT) { $env:AFYX_GRAPH_RUNTIME_ROOT } else { Join-Path $env:USERPROFILE '.afyx\graph' }
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }

if ($InstallUsageTracker -and $SkipUsageTracker) { throw '-InstallUsageTracker and -SkipUsageTracker cannot be used together.' }

# One component truth: scripts/components.json, read through the shared module.
Import-Module (Join-Path $packageRoot 'scripts\lib\AfyxComponents.psm1') -Force
Import-Module (Join-Path $packageRoot 'scripts\lib\AfyxSkillLifecycle.psm1') -Force
$componentContext = New-AfyxComponentContext -SkillsRoot $SkillsRoot -GraphRoot $graphRuntimeRoot -ContextRoot $ContextRuntimeRoot -CodexHome $codexHome
$componentStates = @{}
foreach ($componentState in (Get-AfyxComponentStates -Context $componentContext)) { $componentStates[$componentState.Id] = $componentState }
foreach ($component in (Get-AfyxComponentContract | Where-Object { $_.type -eq 'skill' })) {
    $state = $componentStates[[string]$component.id]
    if ($state.State -eq 'NOT INSTALLED') { continue }
    $installedOwnership = Get-AfyxSkillOwnership -Target $state.Path -Component ([string]$component.id) -ExpectedOwner ([string]$component.ownership)
    if ($installedOwnership -eq 'AFYX_OWNED_MODIFIED') {
        $state.State = 'DRIFTED'
        $state.Detail = 'Afyx ownership verified but installed content was modified'
    } elseif ($installedOwnership -notin @('AFYX_OWNED_UNMODIFIED', 'EXTERNAL_UPSTREAM')) {
        $state.State = 'UNKNOWN'
        $state.Detail = "installed ownership is $installedOwnership"
    }
}
$componentActions = @{}
$retiredComponentIds = @('prompt-master', 'headroom')
function Assert-ActiveComponentId([string]$Id) {
    if ($Id -in $retiredComponentIds) {
        throw "Component '$Id' is retired from Afyx Kit and remains externally/user managed; no changes were made."
    }
}
foreach ($specification in $ComponentAction) {
    if ($specification -notmatch '^([a-z0-9-]+)=(skip|install|update|repair|adopt)$') {
        throw "Invalid -ComponentAction '$specification'. Use component-id=skip|install|update|repair|adopt."
    }
    Assert-ActiveComponentId $Matches[1]
    $componentActions[$Matches[1]] = $Matches[2]
}
$knownSelectable = @('efficient-coding', 'odoo-engineering', 'afyx-engineering-expert', 'afyx-graph', 'afyx-context', 'codex-usage-tracking')
foreach ($id in $componentActions.Keys) { if ($id -notin $knownSelectable) { throw "Unknown selectable component: $id" } }
if ($Preset -and $Preset -notin @('minimal', 'recommended', 'full', 'custom')) { throw "Unknown preset: $Preset" }
if (-not $Preset -and $CustomComponent.Count) { throw '-CustomComponent requires -Preset custom.' }
foreach ($id in $CustomComponent) { Assert-ActiveComponentId $id }
if ($Preset -and ($ComponentAction.Count -or $Force -or $InstallUsageTracker -or $SkipUsageTracker)) {
    throw 'A preset is immutable for one operation; do not combine it with ComponentAction, Force, InstallUsageTracker, or SkipUsageTracker.'
}
$controlPlan = if ($Preset) { Get-AfyxControlPlan -Preset $Preset -CustomComponent $CustomComponent -Context $componentContext -StateById $componentStates } else { $null }

function Get-AvailableVersion([string]$Id) {
    switch ($Id) {
        'efficient-coding' { return Get-AfyxSkillVersion -Directory $bundledEfficientCoding }
        'odoo-engineering' { return Get-AfyxSkillVersion -Directory $bundledOdooEngineering }
        'afyx-engineering-expert' { return Get-AfyxSkillVersion -Directory $bundledEngineeringExpert }
        'afyx-graph' { return (Get-Content -Raw -LiteralPath $graphMetadataPath | ConvertFrom-Json).product_version }
        'afyx-context' { return (Get-Content -Raw -LiteralPath $contextMetadataPath | ConvertFrom-Json).product_version }
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
    elseif ($controlPlan) {
        $planItem = @($controlPlan.Components | Where-Object { $_.Id -eq $Id })[0]
        if (-not $planItem.Desired -or $planItem.Drift -eq 'NOT_APPLICABLE') { $action = 'skip' }
        elseif ($planItem.Repair -eq 'BLOCKED') { throw "$Label drift is $($planItem.Drift) with actual ownership $($planItem.ActualOwnership); automatic takeover is forbidden." }
        elseif ($planItem.Repair -eq 'INSTALL') { $action = 'install' }
        elseif ($planItem.Repair -eq 'REPAIR') { $action = 'repair' }
        elseif ($Id -eq 'afyx-context' -and $state.State -eq 'HEALTHY') { $action = 'update' }
        else {
            $available = Get-AvailableVersion $Id
            $action = if ($state.State -eq 'HEALTHY' -and $available -and (Compare-AfyxVersion $state.Version $available) -lt 0) { 'update' } else { 'skip' }
        }
    }
    elseif ($Force) {
        if ($state.State -eq 'UNKNOWN') { throw "$Label ownership is unknown; -Force cannot take ownership." }
        $action = if ($state.State -eq 'NOT INSTALLED') { 'install' } elseif ($state.State -in @('INCOMPLETE', 'INVALID', 'DRIFTED')) { 'repair' } else { 'update' }
    } elseif ($UpdateInstalled) {
        $available = Get-AvailableVersion $Id
        if ($state.State -in @('INCOMPLETE', 'INVALID', 'DRIFTED')) { $action = 'repair' }
        elseif ($Id -eq 'afyx-context' -and $state.State -eq 'HEALTHY') { $action = 'update' }
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
        } elseif ($state.State -in @('INCOMPLETE', 'INVALID', 'DRIFTED')) {
            do { $answer = (Read-Host "$Label is $($state.State): $($state.Detail) [R] Repair / [S] Skip [S]").Trim() } until ($answer -match '(?i)^(|r|repair|s|skip)$')
            $action = if ($answer -match '(?i)^(r|repair)$') { 'repair' } else { 'skip' }
        } else {
            do { $answer = (Read-Host "$Label ownership/health is unknown. [A] Adopt verified legacy install / [S] Skip [S]").Trim() } until ($answer -match '(?i)^(|a|adopt|s|skip)$')
            $action = if ($answer -match '(?i)^(a|adopt)$') { 'adopt' } else { 'skip' }
        }
    }
    $allowed = switch ($state.State) {
        'NOT INSTALLED' { @('install', 'skip') }
        'HEALTHY' { @('update', 'adopt', 'skip') }
        { $_ -in @('INCOMPLETE', 'INVALID', 'DRIFTED') } { @('repair', 'skip') }
        'UNKNOWN' { @('adopt', 'skip') }
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

function Install-ManagedSkillSafely([string]$Component, [string]$Name, [string]$Source, [string]$Target, [bool]$ReplaceExisting) {
    if ((Test-Path -LiteralPath $Target) -and -not $ReplaceExisting) { return 'skipped' }
    if ($WhatIfPreference) { Write-Host "WhatIf: would stage and install $Name at $Target"; return 'planned' }
    Assert-AfyxSkillTarget -SkillsRoot $SkillsRoot -Target $Target
    $parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $stage = Join-Path $parent ".$((Split-Path -Leaf $Target))-stage-$([guid]::NewGuid().ToString('N'))"
    try {
        Copy-Item -LiteralPath $Source -Destination $stage -Recurse -Force -ErrorAction Stop
        if (-not (Test-SkillManifest $stage)) { throw "$Name staged manifest is invalid." }
        $planRepair = $controlPlan -and @($controlPlan.Components | Where-Object { $_.Id -eq $Component -and $_.Repair -eq 'REPAIR' }).Count -eq 1
        $authorized = $Force -or $componentActions.ContainsKey($Component) -or $planRepair
        Install-AfyxSkillTransaction -SkillsRoot $SkillsRoot -Component $Component -Name $Name -Stage $stage -Target $Target -Owner afyx -Version (Get-AfyxSkillVersion -Directory $Source) -AuthorizeUnproven:$authorized
    } finally {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
    }
    return $(if ($ReplaceExisting) { 'replaced' } else { 'installed' })
}

function Adopt-LegacySkillSafely([string]$Component, [string]$Name, [string]$Target) {
    $contract = @(Get-AfyxComponentContract | Where-Object { $_.id -eq $Component })[0]
    $legacyVersion = if ($contract.PSObject.Properties['legacy_version']) { [string]$contract.legacy_version } else { '' }
    $legacyDigest = if ($contract.PSObject.Properties['legacy_content_digest']) { [string]$contract.legacy_content_digest } else { '' }
    $repository = if ($contract.PSObject.Properties['source']) { [string]$contract.source } else { '' }
    $revision = if ($contract.PSObject.Properties['source_revision']) { [string]$contract.source_revision } else { '' }
    $current = Get-AfyxSkillOwnership -Target $Target -Component $Component -ExpectedOwner ([string]$contract.ownership)
    if ($current -in @('AFYX_OWNED_UNMODIFIED', 'EXTERNAL_UPSTREAM')) { return 'already adopted' }
    $provenance = Get-AfyxLegacySkillProvenance -Target $Target -Component $Component -Owner ([string]$contract.ownership) `
        -LegacyVersion $legacyVersion -LegacyContentSha256 $legacyDigest -SourceRepository $repository -SourceRevision $revision
    if ($provenance -ne 'MATCH') { throw "Refusing to adopt $Name because legacy provenance is $provenance." }
    if ($WhatIfPreference) { Write-Host "WhatIf: would adopt verified legacy $Name at $Target after durable backup"; return 'planned adoption' }
    return Adopt-AfyxLegacySkill -SkillsRoot $SkillsRoot -Target $Target -Component $Component -Owner ([string]$contract.ownership) `
        -Version $legacyVersion -LegacyVersion $legacyVersion -LegacyContentSha256 $legacyDigest `
        -SourceRepository $repository -SourceRevision $revision
}

if (-not (Test-SkillManifest $bundledEfficientCoding)) { throw 'Bundled Efficient Coding is invalid or missing.' }
if (-not (Test-SkillManifest $bundledOdooEngineering)) { throw 'Bundled Odoo Engineering is invalid or missing.' }
if (-not (Test-SkillManifest $bundledEngineeringExpert)) { throw 'Bundled Afyx Engineering Expert is invalid or missing.' }
if (-not (Test-Path -LiteralPath $graphMetadataPath -PathType Leaf)) { throw 'Bundled Afyx Graph metadata is missing.' }
if (-not (Test-Path -LiteralPath $contextMetadataPath -PathType Leaf)) { throw 'Bundled Afyx Context metadata is missing.' }

$codexCliDetected = [bool](Get-Command codex -ErrorAction SilentlyContinue)
$vscodeExtensionDetected = [bool](Get-ChildItem -Path (Join-Path $env:USERPROFILE '.vscode\extensions\openai.chatgpt-*') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
$graphMetadata = Get-Content -Raw -LiteralPath $graphMetadataPath | ConvertFrom-Json
$graphReleaseChannel = (Get-Content -Raw -LiteralPath (Join-Path $packageRoot 'afyx-graph\engine\scripts\distribution-product.json') | ConvertFrom-Json).releaseChannel
$states = [ordered]@{
    'Efficient Coding' = $componentStates['efficient-coding'].State
    'Odoo Engineering' = $componentStates['odoo-engineering'].State
    'Afyx Engineering Expert' = $componentStates['afyx-engineering-expert'].State
    'Afyx Graph' = $componentStates['afyx-graph'].State
    'Afyx Context Engine' = $componentStates['afyx-context'].State
    'Usage Tracking' = $componentStates['codex-usage-tracking'].State
}
Write-Host ''
Write-Host 'Component Inventory'
foreach ($entry in $states.GetEnumerator()) {
    $id = switch ($entry.Key) { 'Efficient Coding' { 'efficient-coding' } 'Odoo Engineering' { 'odoo-engineering' } 'Afyx Engineering Expert' { 'afyx-engineering-expert' } 'Afyx Graph' { 'afyx-graph' } 'Afyx Context Engine' { 'afyx-context' } default { 'codex-usage-tracking' } }
    $installed = $componentStates[$id].Version
    $available = Get-AvailableVersion $id
    Write-Host ("{0}: {1}; installed={2}; available={3}; ownership={4}" -f $entry.Key, $entry.Value, $(if ($installed) { $installed } else { 'n/a' }), $(if ($available) { $available } else { 'external/n/a' }), $componentStates[$id].Ownership)
}
if ($controlPlan) {
    Write-Host ''
    Write-Host "Desired State Plan: $($controlPlan.Identity)"
    foreach ($item in $controlPlan.Components) {
        Write-Host ("{0}: desired={1}; actual={2}; drift={3}; ownership={4}; repair={5}" -f $item.Id, $item.Desired, $item.ActualState, $item.Drift, $item.ActualOwnership, $item.Repair)
    }
}
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
Write-Host "[COMPONENT_REQUIRED:Afyx Context] Node.js >=22.5.0: $(if ($nodeVersion) { $nodeVersion } else { 'MISSING — install from https://nodejs.org/' })"
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
        BundledAfyxEngineeringExpert = Test-SkillManifest $bundledEngineeringExpert
        InstalledAfyxEngineeringExpert = $states['Afyx Engineering Expert'] -eq 'HEALTHY'
        AfyxEngineeringExpertState = $states['Afyx Engineering Expert']
        AfyxEngineeringExpertVersion = $componentStates['afyx-engineering-expert'].Version
        BundledAfyxGraphSource = Test-Path -LiteralPath (Join-Path $packageRoot 'afyx-graph\engine\package.json')
        InstalledAfyxGraph = $states['Afyx Graph'] -eq 'HEALTHY'
        AfyxGraphState = $states['Afyx Graph']
        AfyxGraphVersion = $graphMetadata.product_version
        AfyxGraphRuntimeRoot = $graphRuntimeRoot
        BundledAfyxContextSource = Test-Path -LiteralPath (Join-Path $packageRoot 'afyx-context\package.json')
        InstalledAfyxContext = $states['Afyx Context Engine'] -eq 'HEALTHY'
        AfyxContextState = $states['Afyx Context Engine']
        AfyxContextVersion = (Get-Content -Raw -LiteralPath $contextMetadataPath | ConvertFrom-Json).product_version
        AfyxContextRuntimeRoot = $ContextRuntimeRoot
        InstalledUsageTracker = $states['Usage Tracking'] -eq 'HEALTHY'
        UsageTrackerState = $states['Usage Tracking']
        CodexCliDetected = $codexCliDetected
        VsCodeExtensionDetected = $vscodeExtensionDetected
        ControlPlanIdentity = if ($controlPlan) { $controlPlan.Identity } else { 'LEGACY_INTERACTIVE' }
        ControlPlanDrift = if ($controlPlan) { @($controlPlan.Components | Where-Object { $_.Desired -and $_.Drift -ne 'IN_SYNC' -and $_.Drift -ne 'NOT_APPLICABLE' }).Count } else { 0 }
    } | Format-List
    exit 0
}

if ($controlPlan) {
    $blockedPlanItems = @($controlPlan.Components | Where-Object { $_.Desired -and $_.Repair -eq 'BLOCKED' })
    if ($blockedPlanItems.Count) {
        $blockedSummary = ($blockedPlanItems | ForEach-Object { "$($_.Id):$($_.Drift):$($_.ActualOwnership)" }) -join ', '
        throw "Desired-state plan is blocked before mutation: $blockedSummary"
    }
}

if (-not $codexCliDetected -and -not $vscodeExtensionDetected) { throw 'Neither Codex CLI nor the ChatGPT/Codex VS Code extension was detected. Install one before installing skills.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required for Afyx source validation and lifecycle updates.' }

$summary = [ordered]@{}
foreach ($component in @(
    @{ Id = 'efficient-coding'; Name = 'Efficient Coding'; Source = $bundledEfficientCoding; Target = $efficientTarget },
    @{ Id = 'odoo-engineering'; Name = 'Odoo Engineering'; Source = $bundledOdooEngineering; Target = $odooTarget },
    @{ Id = 'afyx-engineering-expert'; Name = 'Afyx Engineering Expert'; Source = $bundledEngineeringExpert; Target = $expertTarget }
)) {
    $action = Get-ComponentAction $component.Id $component.Name
    if ($action -eq 'skip') { $summary[$component.Name] = 'skipped'; continue }
    if ($action -eq 'adopt') { $summary[$component.Name] = Adopt-LegacySkillSafely $component.Id $component.Name $component.Target }
    else { $summary[$component.Name] = Install-ManagedSkillSafely $component.Id $component.Name $component.Source $component.Target ($action -in @('update', 'repair')) }
}

$graphState = $states['Afyx Graph']
$graphAction = Get-ComponentAction 'afyx-graph' 'Afyx Graph'
if ($graphAction -eq 'skip') { $summary['Afyx Graph'] = 'skipped' }
else {
    $arguments = if ($graphState -eq 'NOT INSTALLED') { @{} } elseif ($graphAction -eq 'update') { @{ Update = $true } } else { @{ Replace = $true } }
    $arguments.RuntimeRoot = $graphRuntimeRoot
    if ($Offline) { $arguments.Offline = $true }
    if ($NoBuildFallback) { $arguments.NoBuildFallback = $true }
    if ($AllowDirtySource) { $arguments.AllowDirtySource = $true }
    if ($SkipGraphPathUpdate) { $arguments.SkipPathUpdate = $true }
    if ($SkipGraphMcp) { $arguments.SkipMcp = $true } else { $arguments.ConfigureMcp = $true }
    & $graphInstaller -Confirm:$false -WhatIf:$WhatIfPreference @arguments
    if (-not $?) { throw 'Afyx Graph installation failed.' }
    $summary['Afyx Graph'] = $graphAction
}

$contextState = $states['Afyx Context Engine']
$contextAction = Get-ComponentAction 'afyx-context' 'Afyx Context Engine'
if ($contextAction -eq 'skip') { $summary['Afyx Context Engine'] = 'skipped' }
else {
    $contextArguments = @{ RuntimeRoot = $ContextRuntimeRoot }
    if ($contextAction -eq 'update') { $contextArguments.Update = $true }
    elseif ($contextAction -eq 'repair') { $contextArguments.Repair = $true }
    & $contextInstaller -Confirm:$false -WhatIf:$WhatIfPreference @contextArguments
    if (-not $?) { throw 'Afyx Context installation failed.' }
    $summary['Afyx Context Engine'] = $contextAction
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
if ($WhatIfPreference) { Write-Host 'WhatIf completed; no files or configuration were changed.' }
else { Write-Host 'Start a new Codex session to load installed components.' }
