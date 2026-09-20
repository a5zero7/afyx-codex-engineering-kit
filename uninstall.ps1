[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$RemovePromptMaster
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Afyx Codex Engineering Kit — Windows uninstaller (PowerShell)'

$targets = @(Join-Path $SkillsRoot 'efficient-coding')
if ($RemovePromptMaster) { $targets += Join-Path $SkillsRoot 'prompt-master' }

foreach ($target in $targets) {
    if ((Test-Path -LiteralPath $target) -and $PSCmdlet.ShouldProcess($target, 'Delete installed skill')) {
        Remove-Item -LiteralPath $target -Recurse -Force
        Write-Host "Removed: $target"
    }
}

Write-Host 'Headroom and Codex configuration were not changed.'
