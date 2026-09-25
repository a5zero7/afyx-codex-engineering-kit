[CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = 'Install')]
param(
    [Parameter(ParameterSetName = 'Install')][switch]$Replace,
    [Parameter(ParameterSetName = 'Install')][switch]$Update,
    [Parameter(ParameterSetName = 'Validate')][switch]$ValidateOnly,
    [Parameter(ParameterSetName = 'Uninstall')][switch]$Uninstall,
    [string]$ArchivePath,
    [string]$RuntimeRoot = (Join-Path $env:USERPROFILE '.afyx\graph'),
    [switch]$SkipPathUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$kitRoot = Split-Path -Parent $PSScriptRoot
$metadataPath = Join-Path $kitRoot 'afyx-graph\afyx-graph.json'
$metadata = Get-Content -Raw -LiteralPath $metadataPath -Encoding utf8 | ConvertFrom-Json
$architecture = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
    'Arm64' { 'arm64' }
    'X64' { 'x64' }
    default { throw "Unsupported Windows architecture: $_" }
}
$target = "win32-$architecture"
$assetName = "afyx-graph-$target.zip"
$current = Join-Path $RuntimeRoot 'current'
$rootMetadata = Join-Path $RuntimeRoot 'metadata.json'
$launcher = Join-Path $current 'bin\afyx-graph.cmd'
$legacyLauncher = Join-Path $current 'bin\codegraph.cmd'
$publicBin = Join-Path $RuntimeRoot 'bin'
$publicLauncher = Join-Path $publicBin 'afyx-graph.cmd'

function Update-UserPath([switch]$Remove) {
    if ($SkipPathUpdate) { return }
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($userPath -split ';' | Where-Object { $_ })
    $present = $entries | Where-Object { $_.TrimEnd('\') -ieq $publicBin.TrimEnd('\') }
    if ($Remove) {
        if ($present -and $PSCmdlet.ShouldProcess('User PATH', "Remove $publicBin")) {
            $updated = ($entries | Where-Object { $_.TrimEnd('\') -ine $publicBin.TrimEnd('\') }) -join ';'
            [Environment]::SetEnvironmentVariable('Path', $updated, 'User')
        }
    } elseif (-not $present -and $PSCmdlet.ShouldProcess('User PATH', "Add $publicBin")) {
        $updated = (@($entries) + $publicBin) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $updated, 'User')
    }
}

function Get-State {
    if (-not (Test-Path -LiteralPath $RuntimeRoot)) { return 'NOT INSTALLED' }
    if (-not (Test-Path -LiteralPath $rootMetadata -PathType Leaf) -or
        -not (Test-Path -LiteralPath $launcher -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $current 'node.exe') -PathType Leaf)) { return 'INCOMPLETE' }
    try {
        $installed = Get-Content -Raw -LiteralPath $rootMetadata -Encoding utf8 | ConvertFrom-Json
        if ($installed.product_name -ne 'Afyx Graph' -or -not $installed.afyx_graph_version) { return 'INVALID' }
    } catch { return 'INVALID' }
    return 'HEALTHY'
}

function Test-AfyxOwnership {
    if (-not (Test-Path -LiteralPath $rootMetadata -PathType Leaf)) { return $false }
    try {
        return (Get-Content -Raw -LiteralPath $rootMetadata -Encoding utf8 | ConvertFrom-Json).product_name -eq 'Afyx Graph'
    } catch { return $false }
}

function Resolve-Archive {
    if ($ArchivePath) {
        $resolved = Resolve-Path -LiteralPath $ArchivePath -ErrorAction Stop
        return $resolved.Path
    }
    $local = Join-Path $kitRoot "afyx-graph\engine\release\$assetName"
    if (Test-Path -LiteralPath $local -PathType Leaf) { return $local }
    $downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) "afyx-graph-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $downloadRoot | Out-Null
    $download = Join-Path $downloadRoot $assetName
    $tag = "afyx-graph-v$($metadata.afyx_graph_version)"
    $url = "https://github.com/a5zero7/afyx-codex-engineering-kit/releases/download/$tag/$assetName"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $download
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/a5zero7/afyx-codex-engineering-kit/releases/download/$tag/SHA256SUMS" -OutFile (Join-Path $downloadRoot 'SHA256SUMS')
    return $download
}

function Test-ArchiveChecksum([string]$Path) {
    $sumsPath = Join-Path (Split-Path -Parent $Path) 'SHA256SUMS'
    if (-not (Test-Path -LiteralPath $sumsPath -PathType Leaf)) { throw "SHA256SUMS is required beside $Path." }
    $line = Get-Content -LiteralPath $sumsPath | Where-Object { $_ -match "(?i)^([0-9a-f]{64})\s+\*?$([regex]::Escape((Split-Path -Leaf $Path)))$" } | Select-Object -First 1
    if (-not $line) { throw "SHA256SUMS has no entry for $(Split-Path -Leaf $Path)." }
    $expected = ([regex]::Match($line, '^[0-9a-fA-F]{64}')).Value.ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Checksum mismatch for $(Split-Path -Leaf $Path)." }
}

function Test-StagedBundle([string]$Path) {
    $required = @('node.exe', 'bin\afyx-graph.cmd', 'bin\codegraph.cmd', 'metadata.json', 'licenses\CodeGraph-MIT.txt')
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $Path $relative) -PathType Leaf)) {
            throw "Afyx Graph staged bundle is incomplete: $relative is missing."
        }
    }
    $stagedMetadata = Get-Content -Raw -LiteralPath (Join-Path $Path 'metadata.json') -Encoding utf8 | ConvertFrom-Json
    if ($stagedMetadata.afyx_graph_version -ne $metadata.afyx_graph_version) {
        throw "Afyx Graph version mismatch: expected $($metadata.afyx_graph_version), got $($stagedMetadata.afyx_graph_version)."
    }
}

$state = Get-State
if ($ValidateOnly) {
    [pscustomobject]@{
        Product = 'Afyx Graph'
        State = $state
        RuntimeRoot = $RuntimeRoot
        Version = if (Test-Path -LiteralPath $rootMetadata) { (Get-Content -Raw $rootMetadata | ConvertFrom-Json).afyx_graph_version } else { $null }
        EngineVersion = if (Test-Path -LiteralPath $rootMetadata) { (Get-Content -Raw $rootMetadata | ConvertFrom-Json).codegraph_upstream_version } else { $null }
    } | Format-List
    if ($state -in @('INCOMPLETE', 'INVALID')) { exit 1 }
    exit 0
}

if ($Uninstall) {
    if ($state -eq 'NOT INSTALLED') { Write-Host 'Afyx Graph: not installed'; exit 0 }
    if (-not (Test-AfyxOwnership)) { throw "Refusing to remove $RuntimeRoot because Afyx Graph ownership cannot be verified." }
    if ($PSCmdlet.ShouldProcess($RuntimeRoot, 'Remove Afyx-owned Graph runtime')) {
        Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force
        Update-UserPath -Remove
    }
    Write-Host 'Afyx Graph: removed; project .afyx-graph and .codegraph indexes were not changed.'
    exit 0
}

if ($state -ne 'NOT INSTALLED' -and -not ($Replace -or $Update)) {
    throw "Afyx Graph already exists at $RuntimeRoot. Use -Replace after inspecting the installation."
}
if ($state -ne 'NOT INSTALLED' -and -not (Test-AfyxOwnership)) {
    throw "Refusing to replace $RuntimeRoot because Afyx Graph ownership cannot be verified."
}
if ($WhatIfPreference) {
    Write-Host "WhatIf: would stage, validate, and install $assetName to $RuntimeRoot"
    exit 0
}

$archive = Resolve-Archive
Test-ArchiveChecksum -Path $archive
$parent = Split-Path -Parent $RuntimeRoot
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$transaction = Join-Path $parent ".graph-stage-$([guid]::NewGuid().ToString('N'))"
$extract = Join-Path $transaction 'extract'
$prepared = Join-Path $transaction 'prepared'
$backup = Join-Path $parent ".graph-backup-$([guid]::NewGuid().ToString('N'))"
$swapped = $false
try {
    New-Item -ItemType Directory -Force -Path $extract, $prepared | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $extract
    $bundle = Get-ChildItem -LiteralPath $extract -Directory | Where-Object Name -eq "afyx-graph-$target" | Select-Object -First 1
    if (-not $bundle) { throw "Archive does not contain afyx-graph-$target." }
    Test-StagedBundle -Path $bundle.FullName
    Move-Item -LiteralPath $bundle.FullName -Destination (Join-Path $prepared 'current')
    Copy-Item -LiteralPath (Join-Path $prepared 'current\metadata.json') -Destination (Join-Path $prepared 'metadata.json')
    $stagedPublicBin = Join-Path $prepared 'bin'
    New-Item -ItemType Directory -Force -Path $stagedPublicBin | Out-Null
    @"
@echo off
@call "%~dp0..\current\bin\afyx-graph.cmd" %*
"@ | Set-Content -LiteralPath (Join-Path $stagedPublicBin 'afyx-graph.cmd') -Encoding ascii
    if (Test-Path -LiteralPath $RuntimeRoot) { Move-Item -LiteralPath $RuntimeRoot -Destination $backup }
    try {
        Move-Item -LiteralPath $prepared -Destination $RuntimeRoot
        $swapped = $true
        if ((Get-State) -ne 'HEALTHY') { throw 'Installed Afyx Graph failed post-swap validation.' }
    } catch {
        if (Test-Path -LiteralPath $RuntimeRoot) { Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force }
        if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $RuntimeRoot }
        throw
    }
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
} finally {
    if (Test-Path -LiteralPath $transaction) { Remove-Item -LiteralPath $transaction -Recurse -Force }
    if (-not $swapped -and (Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $RuntimeRoot)) {
        Move-Item -LiteralPath $backup -Destination $RuntimeRoot
    }
}

Update-UserPath

Write-Host "Afyx Graph $($metadata.afyx_graph_version): installed at $RuntimeRoot"
Write-Host "CLI: $publicLauncher"
Write-Host 'MCP configuration was not changed.'
