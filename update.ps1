[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$SkipSelfUpdate
)

$installer = Join-Path $PSScriptRoot 'install.ps1'
Write-Host 'Afyx Codex Engineering Kit — Windows updater (PowerShell)'
$root = $PSScriptRoot
if (-not $SkipSelfUpdate) {
    $git = Get-Command git -ErrorAction SilentlyContinue
    $inside = $false
    if ($git) { & git -C $root rev-parse --is-inside-work-tree 2>$null; $inside = ($LASTEXITCODE -eq 0) }
    if (-not $inside) {
        Write-Warning 'Self-update unavailable: source is not a Git repository. Continuing with current source.'
    } else {
        $status = (& git -C $root status --porcelain)
        if ($status) { Write-Warning 'Self-update skipped: repository has local changes.' }
        else {
            Write-Host 'Updating repository (fast-forward only)...'
            & git -C $root pull --ff-only
            if ($LASTEXITCODE -ne 0) { throw 'Self-update failed; no installer changes were run.' }
        }
    }
} else { Write-Host 'Self-update skipped by -SkipSelfUpdate.' }
& $installer -SkillsRoot $SkillsRoot -Force -Confirm:$false
exit $LASTEXITCODE
