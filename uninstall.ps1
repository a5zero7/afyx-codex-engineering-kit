[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$RemovePromptMaster,
    [switch]$RemoveUsageTracker,
    [switch]$RemoveAfyxGraph
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Afyx Codex Engineering Kit — Windows uninstaller (PowerShell)'

# One component truth: scripts/components.json. Afyx-owned skills are always removed;
# the upstream-owned skill (Prompt Master) only on explicit request.
Import-Module (Join-Path $PSScriptRoot 'scripts\lib\AfyxComponents.psm1') -Force
$componentContext = New-AfyxComponentContext -SkillsRoot $SkillsRoot
$targets = @()
foreach ($component in (Get-AfyxComponentContract)) {
    if ($component.type -ne 'skill') { continue }
    if ($component.ownership -eq 'afyx' -or ($component.ownership -eq 'upstream' -and $RemovePromptMaster)) {
        $targets += Get-AfyxComponentRoot -Component $component -Context $componentContext
    }
}

foreach ($target in $targets) {
    if ((Test-Path -LiteralPath $target) -and $PSCmdlet.ShouldProcess($target, 'Delete installed skill')) {
        Remove-Item -LiteralPath $target -Recurse -Force
        Write-Host "Removed: $target"
    }
}

if ($RemoveUsageTracker) {
    $trackerInstaller = Join-Path $PSScriptRoot 'scripts\install-codex-usage-tracker.ps1'
    & $trackerInstaller -Uninstall -Confirm:$false -WhatIf:$WhatIfPreference
    if (-not $?) { throw 'Codex Usage Tracking removal failed.' }
}

$graphRoot = $componentContext.GraphRoot
if (Test-Path -LiteralPath $graphRoot) {
    $removeGraph = $RemoveAfyxGraph
    if (-not $removeGraph -and -not $WhatIfPreference -and -not $env:CI -and -not [Console]::IsInputRedirected) {
        do { $answer = (Read-Host 'Afyx Graph detected. Remove Afyx Graph? [Y/N] [N]').Trim() } until ($answer -match '(?i)^(|y|yes|n|no)$')
        $removeGraph = $answer -match '(?i)^(y|yes)$'
    }
    if ($removeGraph) {
        & (Join-Path $PSScriptRoot 'scripts\install-afyx-graph.ps1') -Uninstall -Confirm:$false -WhatIf:$WhatIfPreference
        if (-not $?) { throw 'Afyx Graph removal failed.' }
    } else { Write-Host 'Afyx Graph: kept' }
}

Write-Host 'Project indexes, Headroom, and unrelated Codex configuration were not changed.'
