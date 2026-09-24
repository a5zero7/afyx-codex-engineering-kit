[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$SkipSelfUpdate,
    [switch]$InstallUsageTracker,
    [switch]$SkipUsageTracker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot 'install.ps1'
$root = $PSScriptRoot

if ($InstallUsageTracker -and $SkipUsageTracker) {
    Write-Error '-InstallUsageTracker and -SkipUsageTracker cannot be used together.'
    exit 1
}

Write-Host 'Afyx Codex Engineering Kit — Windows updater (PowerShell)'

if (-not $SkipSelfUpdate) {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Error 'Git executable not found. Self-update cannot be performed. Re-run with -SkipSelfUpdate only if using the current checkout intentionally.'
        exit 1
    }
    & git -C $root rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Self-update unavailable: source directory is not a Git repository. Continuing with current source.'
    } else {
        $status = & git -C $root status --porcelain
        if ($LASTEXITCODE -ne 0) { Write-Error 'Unable to inspect Git worktree status; updater aborted.'; exit 1 }
        if ($status) {
            Write-Error 'Local changes detected. Self-update and installation aborted. Run git status to handle local changes, or intentionally use .\update.ps1 -SkipSelfUpdate.'
            exit 1
        }
        if ($WhatIfPreference) {
            Write-Host 'WhatIf: skipping git pull --ff-only; repository will not be modified.'
        } else {
            & git -C $root pull --ff-only
            if ($LASTEXITCODE -ne 0) { Write-Error 'Self-update failed; installer was not run.'; exit 1 }
        }
    }
} else { Write-Host 'Self-update skipped by -SkipSelfUpdate; using current local source intentionally.' }

$usageArguments = @{}
if ($InstallUsageTracker) { $usageArguments.InstallUsageTracker = $true }
elseif ($SkipUsageTracker) { $usageArguments.SkipUsageTracker = $true }
else {
    $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
    if ((Test-Path -LiteralPath (Join-Path $codexHome 'tools\CodexUsage.psm1') -PathType Leaf) -or
        (Test-Path -LiteralPath (Join-Path $codexHome 'tools\codex-usage-stop.ps1') -PathType Leaf)) {
        $usageArguments.InstallUsageTracker = $true
    } else {
        $usageArguments.SkipUsageTracker = $true
    }
}

& $installer -SkillsRoot $SkillsRoot -Force -Confirm:$false -WhatIf:$WhatIfPreference @usageArguments
$installerSucceeded = $?
$installerExitCode = 0
if (Test-Path -LiteralPath variable:LASTEXITCODE) { $installerExitCode = [int]$LASTEXITCODE }
if (-not $installerSucceeded -and $installerExitCode -eq 0) { $installerExitCode = 1 }
if ($installerExitCode -ne 0) { exit $installerExitCode }
exit 0
