[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$RemovePromptMaster,
    [switch]$RemoveUsageTracker
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

Write-Host 'Headroom and unrelated Codex configuration were not changed.'
