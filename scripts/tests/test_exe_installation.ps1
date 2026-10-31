# Verification test for AfyxSetup.exe direct execution
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
$exePath = Join-Path $repoRoot 'dist\AfyxSetup.exe'

Write-Host "=== Testing AfyxSetup.exe Direct 7-Component Installation ===" -ForegroundColor Cyan
Write-Host "Executable: $exePath"

$disposable = "D:\Project\workspace\test-exe-disposable-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$skills = Join-Path $disposable 'skills'
$context = Join-Path $disposable 'context'
$forge = Join-Path $disposable 'forge'
$codex = Join-Path $disposable 'codex'
$graph = Join-Path $disposable 'graph'

try {
    New-Item -ItemType Directory -Path $codex -Force | Out-Null
    
    # Write valid TOML without shell escaping issues
    $tomlContent = @"
model = "gpt-5-preview"

[user_custom]
keep_this_setting = true
my_custom_env = "production"
"@
    Set-Content -LiteralPath (Join-Path $codex 'config.toml') -Value $tomlContent -Encoding utf8

    $env:AFYX_GRAPH_RUNTIME_ROOT = $graph
    $env:CODEX_HOME = $codex

    Write-Host "Running AfyxSetup.exe..."
    $allSeven = "efficient-coding,odoo-engineering,afyx-engineering-expert,afyx-graph,afyx-context,afyx-forge,codex-usage-tracking"
    
    & $exePath -Preset custom -CustomComponent $allSeven -SkillsRoot $skills -ContextRuntimeRoot $context -ForgeRuntimeRoot $forge -Offline -Provider codex -SkipGraphPathUpdate
    
    $exitCode = $LASTEXITCODE
    Write-Host "AfyxSetup.exe Exit Code: $exitCode"
    if ($exitCode -ne 0) { throw "AfyxSetup.exe failed with exit code $exitCode" }

    # Verify CLIs and files
    $forgeCmd = Join-Path $forge 'bin\afyx-forge.cmd'
    $contextCmd = Join-Path $context 'current\bin\afyx-context.cmd'
    $graphCmd = Join-Path $graph 'bin\afyx-graph.cmd'
    $usageMod = Join-Path $codex 'tools\CodexUsage.psm1'

    if (-not (Test-Path -LiteralPath $forgeCmd)) { throw "Forge CLI not found: $forgeCmd" }
    if (-not (Test-Path -LiteralPath $contextCmd)) { throw "Context CLI not found: $contextCmd" }
    if (-not (Test-Path -LiteralPath $graphCmd)) { throw "Graph CLI not found: $graphCmd" }
    if (-not (Test-Path -LiteralPath $usageMod)) { throw "Usage tracker not found: $usageMod" }

    $forgeVer = (& $forgeCmd --version 2>&1) -join ' '
    $contextVer = (& $contextCmd --version 2>&1) -join ' '
    $graphVer = (& $graphCmd --version 2>&1) -join ' '

    Write-Host "Forge CLI: $forgeVer" -ForegroundColor Green
    Write-Host "Context CLI: $contextVer" -ForegroundColor Green
    Write-Host "Graph CLI: $graphVer" -ForegroundColor Green

    # Verify foreign configuration preserved
    $codexConfig = Get-Content -Raw -LiteralPath (Join-Path $codex 'config.toml')
    if ($codexConfig -notmatch 'keep_this_setting = true') {
        throw "Foreign configuration was overwritten!"
    }
    Write-Host "Foreign config preserved: OK" -ForegroundColor Green

    Write-Host "`n=== AfyxSetup.exe 7-COMPONENT INSTALLATION TEST PASSED! ===" -ForegroundColor Green
    return $true
}
finally {
    if (Test-Path -LiteralPath $disposable) {
        Remove-Item -LiteralPath $disposable -Recurse -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:AFYX_GRAPH_RUNTIME_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
}

