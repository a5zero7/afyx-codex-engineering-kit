[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills')
)

$installer = Join-Path $PSScriptRoot 'install.ps1'
Write-Host 'Afyx Codex Engineering Kit — Windows updater (PowerShell)'
& $installer -SkillsRoot $SkillsRoot -Force -Confirm:$false
exit $LASTEXITCODE
