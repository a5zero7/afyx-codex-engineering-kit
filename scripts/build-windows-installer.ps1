# Builder for Afyx Unified Windows Installer (TASK U-A02)
# Generates a single lightweight AfyxSetup.exe executable with embedded 7-component offline payload.

[CmdletBinding()]
param(
    [string]$OutputDir = (Join-Path $PSScriptRoot '..\dist'),
    [switch]$SkipPayloadBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path
$toolsDir = Join-Path $repoRoot 'tools\windows-setup'

Write-Host "=== Afyx Unified Windows Installer Builder (TASK U-A02) ===" -ForegroundColor Cyan
Write-Host "Repo Root: $repoRoot"
Write-Host "Output Dir: $OutputDir"

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) "afyx-setup-staging-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$payloadZip = Join-Path $OutputDir 'afyx-kit-payload.zip'
$outputExe = Join-Path $OutputDir 'AfyxSetup.exe'

try {
    Write-Host "[1/4] Preparing Clean 7-Component Distribution Staging..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

    # Root scripts
    foreach ($file in @('install.ps1', 'verify.ps1', 'update.ps1', 'uninstall.ps1')) {
        Copy-Item -LiteralPath (Join-Path $repoRoot $file) -Destination (Join-Path $stagingDir $file) -Force
    }
    $currentRevision = ((& git -C $repoRoot rev-parse HEAD 2>$null) -join '').Trim()
    if ($currentRevision -match '^[0-9a-f]{40}$') {
        Set-Content -LiteralPath (Join-Path $stagingDir '.afyx-source-revision') -Value $currentRevision -Encoding utf8
    }

    # Scripts directory
    $stagedScripts = Join-Path $stagingDir 'scripts'
    New-Item -ItemType Directory -Path $stagedScripts -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts\lib') -Destination $stagedScripts -Recurse -Force
    
    Get-ChildItem -Path (Join-Path $repoRoot 'scripts') -File | Where-Object {
        $_.Name -notin @('build-windows-installer.ps1')
    } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagedScripts $_.Name) -Force
    }

    # Skills directory
    $stagedSkills = Join-Path $stagingDir 'skills'
    New-Item -ItemType Directory -Path $stagedSkills -Force | Out-Null
    foreach ($sk in @('efficient-coding', 'odoo-engineering', 'afyx-engineering-expert', 'afyx-forge')) {
        $skSrc = Join-Path $repoRoot "skills\$sk"
        if (Test-Path -LiteralPath $skSrc) {
            Copy-Item -LiteralPath $skSrc -Destination $stagedSkills -Recurse -Force
        }
    }

    # Afyx Context directory
    $stagedContext = Join-Path $stagingDir 'afyx-context'
    New-Item -ItemType Directory -Path $stagedContext -Force | Out-Null
    Copy-Item -Path (Join-Path $repoRoot 'afyx-context\*') -Destination $stagedContext -Recurse -Force

    # Afyx Forge directory
    $stagedForge = Join-Path $stagingDir 'afyx-forge'
    New-Item -ItemType Directory -Path $stagedForge -Force | Out-Null
    Copy-Item -Path (Join-Path $repoRoot 'afyx-forge\*') -Destination $stagedForge -Recurse -Force

    # Afyx Graph directory
    $stagedGraph = Join-Path $stagingDir 'afyx-graph'
    New-Item -ItemType Directory -Path $stagedGraph -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot 'afyx-graph\afyx-graph.json') -Destination (Join-Path $stagedGraph 'afyx-graph.json') -Force
    
    $distJsonSrc = Join-Path $repoRoot 'afyx-graph\engine\scripts\distribution-product.json'
    $distContractSrc = Join-Path $repoRoot 'afyx-graph\engine\scripts\distribution-contract.mjs'
    if (Test-Path -LiteralPath $distJsonSrc) {
        $stagedGraphScripts = Join-Path $stagedGraph 'engine\scripts'
        New-Item -ItemType Directory -Path $stagedGraphScripts -Force | Out-Null
        Copy-Item -LiteralPath $distJsonSrc -Destination (Join-Path $stagedGraphScripts 'distribution-product.json') -Force
        if (Test-Path -LiteralPath $distContractSrc) {
            Copy-Item -LiteralPath $distContractSrc -Destination (Join-Path $stagedGraphScripts 'distribution-contract.mjs') -Force
        }
    }

    $graphReleaseZip = Join-Path $repoRoot 'afyx-graph\engine\release\afyx-graph-win32-x64.zip'
    if (-not (Test-Path -LiteralPath $graphReleaseZip)) {
        throw "Afyx Graph win32 release artifact not found at $graphReleaseZip. Run graph build first."
    }
    $stagedGraphRelease = Join-Path $stagedGraph 'engine\release'
    New-Item -ItemType Directory -Path $stagedGraphRelease -Force | Out-Null
    Copy-Item -LiteralPath $graphReleaseZip -Destination (Join-Path $stagedGraphRelease 'afyx-graph-win32-x64.zip') -Force
    $graphSums = Join-Path $repoRoot 'afyx-graph\engine\release\SHA256SUMS'
    if (Test-Path -LiteralPath $graphSums) {
        Copy-Item -LiteralPath $graphSums -Destination (Join-Path $stagedGraphRelease 'SHA256SUMS') -Force
    }

    # Tools directory
    $stagedTools = Join-Path $stagingDir 'tools'
    New-Item -ItemType Directory -Path $stagedTools -Force | Out-Null
    Get-ChildItem -Path (Join-Path $repoRoot 'tools') -Directory | Where-Object {
        $_.Name -ne 'windows-setup'
    } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $stagedTools -Recurse -Force
    }

    Write-Host "[2/4] Compressing Clean 7-Component Staging into $payloadZip..." -ForegroundColor Yellow
    if (Test-Path -LiteralPath $payloadZip) { Remove-Item -LiteralPath $payloadZip -Force }
    
    # Use .NET ZipArchive for deterministic, clean compression
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $payloadZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    $zipLengthMB = [math]::Round(((Get-Item -LiteralPath $payloadZip).Length / 1MB), 2)
    Write-Host "-> Payload package created: $zipLengthMB MB" -ForegroundColor Green

    Write-Host "[3/4] Compiling AfyxSetup.exe via .NET C# Compiler..." -ForegroundColor Yellow
    $cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if (-not (Test-Path -LiteralPath $cscPath)) {
        $cscPath = (Get-Command csc.exe -ErrorAction SilentlyContinue).Source
    }
    if (-not $cscPath) { throw "C# compiler csc.exe not found on system." }

    $sourceCs = Join-Path $toolsDir 'SetupBootstrapper.cs'
    $cscArgs = @(
        '/target:exe',
        '/platform:anycpu',
        '/optimize+',
        "/out:$outputExe",
        "/resource:$payloadZip,afyx-kit-payload.zip",
        '/reference:System.IO.Compression.dll',
        '/reference:System.IO.Compression.FileSystem.dll',
        $sourceCs
    )

    & $cscPath $cscArgs
    if ($LASTEXITCODE -ne 0) { throw "csc.exe compilation failed with exit code $LASTEXITCODE" }
    
    $exeLengthMB = [math]::Round(((Get-Item -LiteralPath $outputExe).Length / 1MB), 2)
    Write-Host "-> Executable created: $outputExe ($exeLengthMB MB)" -ForegroundColor Green

    Write-Host "[4/4] Calculating SHA-256 Checksums..." -ForegroundColor Yellow
    $hash = (Get-FileHash -LiteralPath $outputExe -Algorithm SHA256).Hash.ToLowerInvariant()
    $checksumFile = Join-Path $OutputDir 'AfyxSetup.exe.sha256'
    Set-Content -LiteralPath $checksumFile -Value "$hash  AfyxSetup.exe`n" -Encoding utf8
    
    $sumsFile = Join-Path $OutputDir 'SHA256SUMS'
    $zipHash = (Get-FileHash -LiteralPath $payloadZip -Algorithm SHA256).Hash.ToLowerInvariant()
    $sumsContent = @"
$hash  AfyxSetup.exe
$zipHash  afyx-kit-payload.zip
"@
    Set-Content -LiteralPath $sumsFile -Value $sumsContent -Encoding utf8

    Write-Host "`n=== BUILD COMPLETE ===" -ForegroundColor Green
    Write-Host "Installer Executable: $outputExe ($exeLengthMB MB)"
    Write-Host "SHA-256: $hash"
    Write-Host "Checksum file: $checksumFile"

    return [pscustomobject]@{
        Executable = $outputExe
        SizeMB = $exeLengthMB
        SHA256 = $hash
        PayloadZip = $payloadZip
    }
}
finally {
    if (Test-Path -LiteralPath $stagingDir) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
