[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [string]$PromptMasterRepository = 'https://github.com/nidhinjs/prompt-master.git',
    [switch]$Force,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Afyx Codex Engineering Kit — Windows installer (PowerShell)'

$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledEfficientCoding = Join-Path $packageRoot 'skills\efficient-coding'
$bundledOdooEngineering = Join-Path $packageRoot 'skills\odoo-engineering'
$efficientTarget = Join-Path $SkillsRoot 'efficient-coding'
$odooTarget = Join-Path $SkillsRoot 'odoo-engineering'
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
if (-not (Test-SkillManifest -SkillDirectory $bundledOdooEngineering)) {
    throw 'Bundled odoo-engineering skill is invalid or missing.'
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required to install Prompt Master from its upstream repository.'
}
$codexCliDetected = [bool](Get-Command codex -ErrorAction SilentlyContinue)
$vscodeExtensionDetected = [bool](Get-ChildItem -Path (Join-Path $env:USERPROFILE '.vscode\extensions\openai.chatgpt-*') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $codexCliDetected -and -not $vscodeExtensionDetected) {
    throw 'Neither Codex CLI nor the ChatGPT/Codex VS Code extension was detected. Install one of them before installing skills.'
}
if ($codexCliDetected -and $vscodeExtensionDetected) { Write-Host 'Environment: Codex CLI and VS Code extension detected' }
elseif ($codexCliDetected) { Write-Host 'Environment: Codex CLI detected' }
else { Write-Host 'Environment: VS Code extension detected' }

if ($ValidateOnly) {
    [pscustomobject]@{
        BundledEfficientCoding = Test-SkillManifest -SkillDirectory $bundledEfficientCoding
        BundledOdooEngineering = Test-SkillManifest -SkillDirectory $bundledOdooEngineering
        InstalledEfficientCoding = Test-SkillManifest -SkillDirectory $efficientTarget
        InstalledOdooEngineering = Test-SkillManifest -SkillDirectory $odooTarget
        InstalledPromptMaster = Test-SkillManifest -SkillDirectory $promptTarget
        HeadroomAvailable = [bool](Get-Command headroom -ErrorAction SilentlyContinue)
        CodeGraphAvailable = [bool](Get-Command codegraph -ErrorAction SilentlyContinue)
        CodexCliDetected = $codexCliDetected
        VsCodeExtensionDetected = $vscodeExtensionDetected
    } | Format-List
    exit 0
}

if ($PSCmdlet.ShouldProcess($SkillsRoot, 'Create skill root')) {
    New-Item -ItemType Directory -Force -Path $SkillsRoot | Out-Null
}

if (Test-Path -LiteralPath $efficientTarget) {
    if (-not $Force) { throw "Efficient Coding already exists: $efficientTarget. Re-run with -Force to replace it after backup." }
    if (-not $WhatIfPreference) { Backup-Directory -Path $efficientTarget }
    if ($PSCmdlet.ShouldProcess($efficientTarget, 'Replace Efficient Coding skill')) {
        Remove-Item -LiteralPath $efficientTarget -Recurse -Force
    }
}
if ($PSCmdlet.ShouldProcess($efficientTarget, 'Install Efficient Coding skill')) {
    Copy-Item -LiteralPath $bundledEfficientCoding -Destination $efficientTarget -Recurse -Force
}

if (Test-Path -LiteralPath $odooTarget) {
    if (-not $Force) { throw "Odoo Engineering already exists: $odooTarget. Re-run with -Force to replace it after backup." }
    if (-not $WhatIfPreference) { Backup-Directory -Path $odooTarget }
    if ($PSCmdlet.ShouldProcess($odooTarget, 'Replace Odoo Engineering skill')) {
        Remove-Item -LiteralPath $odooTarget -Recurse -Force
    }
}
if ($PSCmdlet.ShouldProcess($odooTarget, 'Install Odoo Engineering skill')) {
    Copy-Item -LiteralPath $bundledOdooEngineering -Destination $odooTarget -Recurse -Force
}

if (Test-Path -LiteralPath $promptTarget) {
    if (Test-Path -LiteralPath (Join-Path $promptTarget '.git')) {
        if ($PSCmdlet.ShouldProcess($promptTarget, 'Fast-forward Prompt Master from upstream')) {
            & git -C $promptTarget pull --ff-only
            if ($LASTEXITCODE -ne 0) { throw 'Prompt Master update failed.' }
        }
    } elseif ($Force) {
        if (-not $WhatIfPreference) { Backup-Directory -Path $promptTarget }
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

if ($WhatIfPreference) {
    Write-Host 'WhatIf completed; no files or configuration were changed.'
    return
}


if (-not (Test-SkillManifest -SkillDirectory $efficientTarget)) { throw 'Installed Efficient Coding manifest failed validation.' }
if (-not (Test-SkillManifest -SkillDirectory $odooTarget)) { throw 'Installed Odoo Engineering manifest failed validation.' }
if (-not (Test-SkillManifest -SkillDirectory $promptTarget)) { throw 'Installed Prompt Master manifest failed validation.' }

Write-Host 'Efficient Coding: installed'
Write-Host 'Odoo Engineering: installed (stable refs 10–19; Odoo 20 preview)'
Write-Host 'Prompt Master: installed'
if (Get-Command headroom -ErrorAction SilentlyContinue) { Write-Host 'Headroom: detected (configuration unchanged)' } else { Write-Warning 'Headroom was not found. See https://github.com/headroomlabs-ai/headroom' }
Write-Host 'Start a new Codex session to load the skills.'
