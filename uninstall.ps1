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

$targets = @(Join-Path $SkillsRoot 'efficient-coding'), (Join-Path $SkillsRoot 'odoo-engineering')
if ($RemovePromptMaster) { $targets += Join-Path $SkillsRoot 'prompt-master' }

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

$graphRoot = Join-Path $env:USERPROFILE '.afyx\graph'
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

Write-Host 'Standalone CodeGraph, project indexes, Headroom, and unrelated Codex configuration were not changed.'
