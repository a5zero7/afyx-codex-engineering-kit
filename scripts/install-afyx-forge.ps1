[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$RuntimeRoot = $(if ($env:AFYX_FORGE_RUNTIME_ROOT) { $env:AFYX_FORGE_RUNTIME_ROOT } else { Join-Path $env:USERPROFILE '.afyx\forge' }),
    [switch]$Update,
    [switch]$Repair,
    [switch]$Verify,
    [switch]$Uninstall,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $packageRoot 'afyx-forge'
$recoveryRoot = "$RuntimeRoot.afyx-old"

function Resolve-Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path) }
function Test-IsFullyQualified([string]$Path) {
    if (-not [System.IO.Path]::IsPathRooted($Path)) { return $false }
    $root = [System.IO.Path]::GetPathRoot($Path)
    if (-not $root -or $root -eq '\' -or $root -eq '/') { return $false }
    return $true
}

function Assert-SafeRoot {
    if (-not (Test-IsFullyQualified $RuntimeRoot)) { throw 'Afyx Forge RuntimeRoot must be absolute.' }
    if (($RuntimeRoot -split '[\\/]') -contains '..') { throw 'Afyx Forge RuntimeRoot must not contain traversal segments.' }
    $resolved = Resolve-Full $RuntimeRoot
    $root = [System.IO.Path]::GetPathRoot($resolved)
    if ($resolved.TrimEnd('\','/') -eq $root.TrimEnd('\','/')) { throw 'Afyx Forge RuntimeRoot cannot be a filesystem root.' }
    $source = (Resolve-Full $sourceRoot).TrimEnd('\','/')
    if ($resolved.TrimEnd('\','/') -eq $source -or $resolved.StartsWith("$source\", [System.StringComparison]::OrdinalIgnoreCase) -or $source.StartsWith("$($resolved.TrimEnd('\','/'))\", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Afyx Forge RuntimeRoot must not overlap the bundled source.'
    }
}

function Test-OwnedRuntime([string]$Root) {
    try {
        $metadataPath = Join-Path $Root 'metadata.json'
        if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { return $false }
        $metadata = Get-Content -Raw -LiteralPath $metadataPath -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
        return ($metadata.product_name -eq 'Afyx Forge Core' -and $metadata.ownership_class -eq 'AFYX')
    } catch {
        return $false
    }
}

function Get-State {
    if (-not (Test-Path -LiteralPath $RuntimeRoot)) { return 'NOT INSTALLED' }
    if (-not (Test-OwnedRuntime $RuntimeRoot)) { return 'DRIFTED' }
    $launcher = Join-Path $RuntimeRoot 'current\bin\afyx-forge.cmd'
    $packageJson = Join-Path $RuntimeRoot 'current\package.json'
    if ((Test-Path -LiteralPath $launcher -PathType Leaf) -and (Test-Path -LiteralPath $packageJson -PathType Leaf)) {
        return 'HEALTHY'
    }
    return 'BROKEN'
}

Assert-SafeRoot
$currentState = Get-State

if ($ValidateOnly -or $Verify) {
    $metadataPath = Join-Path $RuntimeRoot 'metadata.json'
    $metadata = if (Test-Path -LiteralPath $metadataPath) { Get-Content -Raw -LiteralPath $metadataPath -Encoding utf8 | ConvertFrom-Json } else { $null }
    [pscustomobject]@{
        Component   = 'afyx-forge'
        State       = $currentState
        RuntimeRoot = $RuntimeRoot
        Version     = if ($metadata) { $metadata.product_version } else { '0.1.0' }
        Ownership   = 'afyx'
    }
    exit 0
}

if ($Uninstall) {
    if ($currentState -eq 'NOT INSTALLED') {
        Write-Host 'Afyx Forge: already not installed.'
        exit 0
    }
    if ($currentState -eq 'DRIFTED') {
        throw "Refusing to uninstall $($RuntimeRoot): Afyx Forge ownership could not be verified."
    }
    if ($WhatIfPreference) {
        Write-Host "WhatIf: would uninstall Afyx Forge at $RuntimeRoot"
        exit 0
    }
    Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force
    Write-Host "Afyx Forge: uninstalled from $RuntimeRoot"
    exit 0
}

if ($currentState -eq 'DRIFTED') {
    throw "Refusing to replace or modify unowned directory at $($RuntimeRoot): Afyx Forge ownership could not be verified."
}

if ($currentState -eq 'NOT INSTALLED' -and ($Update -or $Repair)) {
    throw "Update or repair requires an existing Afyx Forge runtime at $RuntimeRoot."
}

if ($currentState -eq 'HEALTHY' -and -not $Update -and -not $Repair) {
    Write-Host "Afyx Forge: already installed and HEALTHY at $RuntimeRoot. Use -Update or -Repair to reinstall."
    exit 0
}

if ($WhatIfPreference) {
    Write-Host "WhatIf: would stage and install Afyx Forge Core at $RuntimeRoot"
    exit 0
}

# Transactional Installation
$parentDir = Split-Path -Parent $RuntimeRoot
New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
$transactionId = [guid]::NewGuid().ToString('N')
$stageDir = Join-Path $parentDir ".forge-stage-$transactionId"
$preparedCurrent = Join-Path $stageDir 'current'

try {
    New-Item -ItemType Directory -Force -Path $preparedCurrent | Out-Null
    Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $preparedCurrent -Recurse -Force

    $stagedBin = Join-Path $stageDir 'bin'
    New-Item -ItemType Directory -Force -Path $stagedBin | Out-Null
    $publicLauncherCmd = Join-Path $stagedBin 'afyx-forge.cmd'
    $cmdContent = "@echo off`r`nnode `"%~dp0..\current\bin\afyx-forge.js`" %*`r`n"
    [System.IO.File]::WriteAllText($publicLauncherCmd, $cmdContent, [System.Text.Encoding]::ASCII)

    $metadataContent = @{
        product_name         = 'Afyx Forge Core'
        product_version      = '0.1.0'
        ownership_class      = 'AFYX'
        release_channel      = 'technical-alpha'
        installed_at         = (Get-Date).ToString('o')
    } | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $stageDir 'metadata.json'), $metadataContent, [System.Text.Encoding]::UTF8)

    # Atomic swap
    $swapped = $false
    if (Test-Path -LiteralPath $RuntimeRoot) {
        if (Test-Path -LiteralPath $recoveryRoot) { Remove-Item -LiteralPath $recoveryRoot -Recurse -Force }
        Move-Item -LiteralPath $RuntimeRoot -Destination $recoveryRoot
    }
    try {
        Move-Item -LiteralPath $stageDir -Destination $RuntimeRoot
        $swapped = $true

        if ((Get-State) -ne 'HEALTHY') {
            throw 'Installed Afyx Forge failed post-installation health check.'
        }
        $verifyOutput = (& (Join-Path $RuntimeRoot 'bin\afyx-forge.cmd') --version 2>&1) -join ' '
        if ($LASTEXITCODE -ne 0 -or $verifyOutput -notmatch 'afyx-forge 0\.1\.0') {
            throw "Installed Afyx Forge CLI verification failed: $verifyOutput"
        }
    } catch {
        if (Test-Path -LiteralPath $RuntimeRoot) { Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force }
        if (Test-Path -LiteralPath $recoveryRoot) { Move-Item -LiteralPath $recoveryRoot -Destination $RuntimeRoot }
        throw
    }
    if (Test-Path -LiteralPath $recoveryRoot) { Remove-Item -LiteralPath $recoveryRoot -Recurse -Force }
    Write-Host "Afyx Forge Core 0.1.0: successfully installed at $RuntimeRoot"
} finally {
    if (Test-Path -LiteralPath $stageDir) { Remove-Item -LiteralPath $stageDir -Recurse -Force }
}
