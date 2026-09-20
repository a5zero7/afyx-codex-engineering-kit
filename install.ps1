[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [string]$PromptMasterRepository = 'https://github.com/nidhinjs/prompt-master.git',
    [switch]$Force,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Afyx Codex Engineering Kit'

$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledEfficientCoding = Join-Path $packageRoot 'skills\efficient-coding'
$efficientTarget = Join-Path $SkillsRoot 'efficient-coding'
$promptTarget = Join-Path $SkillsRoot 'prompt-master'
$backupRoot = Join-Path $packageRoot 'backups'

function Test-SkillManifest {
    param([Parameter(Mandatory)][string]$SkillDirectory)
    $manifest = Join-Path $SkillDirectory 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return $false }
    $firstLine = Get-Content -LiteralPath $manifest -TotalCount 1 -Encoding utf8
    return $firstLine -eq '---'
}

function Backup-Directory {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $destination = Join-Path $backupRoot "$(Split-Path -Leaf $Path)-$stamp"
    Copy-Item -LiteralPath $Path -Destination $destination -Recurse -Force
    Write-Host "Backup created: $destination"
}

if (-not (Test-SkillManifest -SkillDirectory $bundledEfficientCoding)) {
    throw 'Bundled efficient-coding skill is invalid or missing.'
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required to install Prompt Master from its upstream repository.'
}
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw 'Codex CLI was not found on PATH. Install Codex before installing its skills.'
}

if ($ValidateOnly) {
    [pscustomobject]@{
        BundledEfficientCoding = Test-SkillManifest -SkillDirectory $bundledEfficientCoding
        InstalledEfficientCoding = Test-SkillManifest -SkillDirectory $efficientTarget
        InstalledPromptMaster = Test-SkillManifest -SkillDirectory $promptTarget
        HeadroomAvailable = [bool](Get-Command headroom -ErrorAction SilentlyContinue)
        CodeGraphAvailable = [bool](Get-Command codegraph -ErrorAction SilentlyContinue)
    } | Format-List
    exit 0
}

if ($PSCmdlet.ShouldProcess($SkillsRoot, 'Create skill root')) {
    New-Item -ItemType Directory -Force -Path $SkillsRoot | Out-Null
}

if (Test-Path -LiteralPath $efficientTarget) {
    if (-not $Force) { throw "Efficient Coding already exists: $efficientTarget. Re-run with -Force to replace it after backup." }
    Backup-Directory -Path $efficientTarget
    if ($PSCmdlet.ShouldProcess($efficientTarget, 'Replace Efficient Coding skill')) {
        Remove-Item -LiteralPath $efficientTarget -Recurse -Force
    }
}
if ($PSCmdlet.ShouldProcess($efficientTarget, 'Install Efficient Coding skill')) {
    Copy-Item -LiteralPath $bundledEfficientCoding -Destination $efficientTarget -Recurse -Force
}

if (Test-Path -LiteralPath $promptTarget) {
    if (Test-Path -LiteralPath (Join-Path $promptTarget '.git')) {
        if ($PSCmdlet.ShouldProcess($promptTarget, 'Fast-forward Prompt Master from upstream')) {
            & git -C $promptTarget pull --ff-only
            if ($LASTEXITCODE -ne 0) { throw 'Prompt Master update failed.' }
        }
    } elseif ($Force) {
        Backup-Directory -Path $promptTarget
        if ($PSCmdlet.ShouldProcess($promptTarget, 'Replace non-Git Prompt Master directory')) {
            Remove-Item -LiteralPath $promptTarget -Recurse -Force
            & git clone --depth 1 $PromptMasterRepository $promptTarget
            if ($LASTEXITCODE -ne 0) { throw 'Prompt Master clone failed.' }
        }
    } else {
        throw "Prompt Master exists but is not a Git checkout: $promptTarget. Re-run with -Force to back it up and replace it."
    }
} elseif ($PSCmdlet.ShouldProcess($promptTarget, 'Clone Prompt Master upstream')) {
    & git clone --depth 1 $PromptMasterRepository $promptTarget
    if ($LASTEXITCODE -ne 0) { throw 'Prompt Master clone failed.' }
}

if (-not (Test-SkillManifest -SkillDirectory $efficientTarget)) { throw 'Installed Efficient Coding manifest failed validation.' }
if (-not (Test-SkillManifest -SkillDirectory $promptTarget)) { throw 'Installed Prompt Master manifest failed validation.' }

Write-Host 'Efficient Coding: installed'
Write-Host 'Prompt Master: installed'
if (Get-Command headroom -ErrorAction SilentlyContinue) { Write-Host 'Headroom: detected (configuration unchanged)' } else { Write-Warning 'Headroom was not found. See https://github.com/headroomlabs-ai/headroom' }
Write-Host 'Start a new Codex session to load the skills.'
