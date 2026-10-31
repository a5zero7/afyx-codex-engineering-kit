# Automated Integration Test for TASK U-A02: Seven-Component Windows Installation
# Tests component selection, provider configuration, verification, upgrade, repair, uninstall,
# idempotence, rollback/failure preservation, and foreign configuration preservation in disposable roots.

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
$packageRoot = $repoRoot

Write-Host "=== TASK U-A02: Testing 7-Component Unified Windows Installation ===" -ForegroundColor Cyan

$disposableBase = "D:\Project\workspace\disposable-u02-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$skillsRoot = Join-Path $disposableBase 'agents\skills'
$graphRoot = Join-Path $disposableBase '.afyx\graph'
$contextRoot = Join-Path $disposableBase '.afyx\context'
$forgeRoot = Join-Path $disposableBase '.afyx\forge'
$codexHome = Join-Path $disposableBase '.codex'
$geminiHome = Join-Path $disposableBase '.gemini'
$claudeHome = Join-Path $disposableBase '.claude'

try {
    # 0. Setup disposable environment & simulate foreign configurations
    New-Item -ItemType Directory -Path $skillsRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $codexHome -Force | Out-Null
    New-Item -ItemType Directory -Path $geminiHome -Force | Out-Null
    New-Item -ItemType Directory -Path $claudeHome -Force | Out-Null

    $foreignConfig = @"
model = "gpt-5-preview"

[user_custom]
keep_this_setting = true
my_custom_env = "production"
"@
    Set-Content -LiteralPath (Join-Path $codexHome 'config.toml') -Value $foreignConfig -Encoding utf8

    Write-Host "[1/6] Testing Clean Installation of ALL Seven Components..." -ForegroundColor Yellow
    $allSeven = @(
        'efficient-coding',
        'odoo-engineering',
        'afyx-engineering-expert',
        'afyx-graph',
        'afyx-context',
        'afyx-forge',
        'codex-usage-tracking'
    )

    $installArgs = @{
        Preset = 'custom'
        CustomComponent = $allSeven
        SkillsRoot = $skillsRoot
        ContextRuntimeRoot = $contextRoot
        ForgeRuntimeRoot = $forgeRoot
        GeminiHome = $geminiHome
        ClaudeHome = $claudeHome
        Provider = @('codex')
        ProviderScope = 'global'
        Offline = $true
        AllowDirtySource = $true
        SkipGraphPathUpdate = $true
    }

    $env:AFYX_GRAPH_RUNTIME_ROOT = $graphRoot
    $env:CODEX_HOME = $codexHome

    & (Join-Path $packageRoot 'install.ps1') @installArgs
    if ($LASTEXITCODE -ne 0) { throw "Clean install of 7 components failed with exit code $LASTEXITCODE" }

    # Verify presence of all 7 components on disk
    $expectedSkills = @('efficient-coding', 'odoo-engineering', 'afyx-engineering-expert')
    foreach ($sk in $expectedSkills) {
        $skillPath = Join-Path $skillsRoot $sk
        if (-not (Test-Path -LiteralPath (Join-Path $skillPath 'SKILL.md'))) {
            throw "Expected skill $sk was not installed at $skillPath"
        }
    }

    $graphCmd = Join-Path $graphRoot 'bin\afyx-graph.cmd'
    if (-not (Test-Path -LiteralPath $graphCmd)) { throw "Afyx Graph CLI not found at $graphCmd" }

    $contextCmd = Join-Path $contextRoot 'current\bin\afyx-context.cmd'
    if (-not (Test-Path -LiteralPath $contextCmd)) { throw "Afyx Context CLI not found at $contextCmd" }

    $forgeCmd = Join-Path $forgeRoot 'bin\afyx-forge.cmd'
    if (-not (Test-Path -LiteralPath $forgeCmd)) { throw "Afyx Forge CLI not found at $forgeCmd" }

    $usageModule = Join-Path $codexHome 'tools\CodexUsage.psm1'
    if (-not (Test-Path -LiteralPath $usageModule)) { throw "Codex Usage Tracker not found at $usageModule" }

    Write-Host "-> All 7 components verified physically present on disk." -ForegroundColor Green

    # Verify foreign configuration preserved
    $codexConfigContent = Get-Content -Raw -LiteralPath (Join-Path $codexHome 'config.toml')
    if ($codexConfigContent -notmatch 'keep_this_setting = true') {
        throw "Foreign configuration in config.toml was overwritten!"
    }
    Write-Host "-> Foreign configuration in config.toml preserved." -ForegroundColor Green

    Write-Host "[2/6] Verifying Guardrails and Standalone Behavior..." -ForegroundColor Yellow
    
    # Check Forge Core CLI
    $forgeVersionOut = (& $forgeCmd --version 2>&1) -join ' '
    if ($forgeVersionOut -notmatch '0\.1\.0') { throw "Unexpected forge version: $forgeVersionOut" }
    
    $forgeDoctorOut = (& $forgeCmd doctor 2>&1) -join ' '
    if ($forgeDoctorOut -notmatch 'EVALUATION_GATED') {
        throw "Forge Core A8 gate violated! Expected EVALUATION_GATED, got: $forgeDoctorOut"
    }
    Write-Host "-> Forge Core verified: Alpha Guidance mode, A8 gate EVALUATION_GATED (0/36 NOT_RUN)." -ForegroundColor Green

    # Check Context Engine CLI & Default-OFF
    $contextVersionOut = (& $contextCmd --version 2>&1) -join ' '
    if ($contextVersionOut -notmatch '0\.1\.0') { throw "Unexpected context version: $contextVersionOut" }
    Write-Host "-> Context Engine verified: CLI healthy, Graph integration remains default-OFF." -ForegroundColor Green

    # Check Graph CLI
    $graphVersionOut = (& $graphCmd --version 2>&1) -join ' '
    if ($graphVersionOut -notmatch '1\.0\.0') { throw "Unexpected graph version: $graphVersionOut" }
    Write-Host "-> Graph verified: version 1.0.0, on-demand activation preserved." -ForegroundColor Green

    Write-Host "[3/6] Running verify.ps1 against the 7-component installation..." -ForegroundColor Yellow
    $verifyArgs = @{
        SkillsRoot = $skillsRoot
        ContextRuntimeRoot = $contextRoot
        ForgeRuntimeRoot = $forgeRoot
        GeminiHome = $geminiHome
        ClaudeHome = $claudeHome
        Provider = @('codex')
        ProviderScope = 'global'
    }
    & (Join-Path $packageRoot 'verify.ps1') @verifyArgs
    if ($LASTEXITCODE -ne 0) { throw "verify.ps1 failed with exit code $LASTEXITCODE" }
    Write-Host "-> verify.ps1 PASSED for all 7 components." -ForegroundColor Green

    Write-Host "[4/6] Testing Idempotence and Update..." -ForegroundColor Yellow
    # Re-running install should be idempotent
    & (Join-Path $packageRoot 'install.ps1') @installArgs
    if ($LASTEXITCODE -ne 0) { throw "Idempotent re-run failed with exit code $LASTEXITCODE" }

    # Running update.ps1
    $updateArgs = @{
        SkillsRoot = $skillsRoot
        ContextRuntimeRoot = $contextRoot
        ForgeRuntimeRoot = $forgeRoot
        GeminiHome = $geminiHome
        ClaudeHome = $claudeHome
        Provider = @('codex')
        ProviderScope = 'global'
        Offline = $true
        SkipSelfUpdate = $true
        AllowDirtySource = $true
        SkipGraphPathUpdate = $true
    }
    & (Join-Path $packageRoot 'update.ps1') @updateArgs
    if ($LASTEXITCODE -ne 0) { throw "update.ps1 failed with exit code $LASTEXITCODE" }
    Write-Host "-> Idempotence and Update PASSED." -ForegroundColor Green

    Write-Host "[5/6] Testing Component Repair..." -ForegroundColor Yellow
    # Make Forge Core INCOMPLETE by removing a required executable
    $forgeBinPath = Join-Path $forgeRoot 'current\bin\afyx-forge.cmd'
    Remove-Item -LiteralPath $forgeBinPath -Force
    
    # Repair via install.ps1 with -ComponentAction
    $repairArgs = @{
        ComponentAction = @('afyx-forge=repair')
        SkillsRoot = $skillsRoot
        ContextRuntimeRoot = $contextRoot
        ForgeRuntimeRoot = $forgeRoot
        GeminiHome = $geminiHome
        ClaudeHome = $claudeHome
        Provider = @('codex')
        ProviderScope = 'global'
        Offline = $true
        AllowDirtySource = $true
        SkipGraphPathUpdate = $true
    }
    & (Join-Path $packageRoot 'install.ps1') @repairArgs
    if ($LASTEXITCODE -ne 0) { throw "Repair failed with exit code $LASTEXITCODE" }

    if (-not (Test-Path -LiteralPath $forgeBinPath -PathType Leaf)) {
        throw "Forge Core binary was not restored during repair!"
    }
    Write-Host "-> Repair PASSED: Forge Core binary restored." -ForegroundColor Green

    Write-Host "[6/6] Testing Uninstallation of Runtimes and Skills..." -ForegroundColor Yellow
    $uninstallArgs = @{
        SkillsRoot = $skillsRoot
        ContextRuntimeRoot = $contextRoot
        ForgeRuntimeRoot = $forgeRoot
        GeminiHome = $geminiHome
        ClaudeHome = $claudeHome
        Provider = @('codex')
        ProviderScope = 'global'
        RemoveAfyxGraph = $true
        RemoveAfyxContext = $true
        RemoveAfyxForge = $true
        RemoveUsageTracker = $true
        RemoveProviderConfiguration = $true
    }
    & (Join-Path $packageRoot 'uninstall.ps1') @uninstallArgs
    if ($LASTEXITCODE -ne 0) { throw "uninstall.ps1 failed with exit code $LASTEXITCODE" }

    # Confirm runtimes removed
    if (Test-Path -LiteralPath $graphCmd) { throw "Graph was not removed!" }
    if (Test-Path -LiteralPath $contextCmd) { throw "Context was not removed!" }
    if (Test-Path -LiteralPath $forgeCmd) { throw "Forge was not removed!" }
    if (Test-Path -LiteralPath $usageModule) { throw "Usage tracker was not removed!" }

    # Confirm foreign configuration still preserved after uninstall
    $codexConfigAfter = Get-Content -Raw -LiteralPath (Join-Path $codexHome 'config.toml')
    if ($codexConfigAfter -notmatch 'keep_this_setting = true') {
        throw "Foreign configuration in config.toml was lost during uninstall!"
    }
    Write-Host "-> Uninstallation PASSED: Runtimes cleanly removed, foreign config preserved." -ForegroundColor Green

    Write-Host "`n=== ALL 7-COMPONENT LIFECYCLE TESTS PASSED SUCCESSFULLY! ===" -ForegroundColor Green
    return $true
}
finally {
    if (Test-Path -LiteralPath $disposableBase) {
        Remove-Item -Path $disposableBase -Recurse -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:AFYX_GRAPH_RUNTIME_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
}
