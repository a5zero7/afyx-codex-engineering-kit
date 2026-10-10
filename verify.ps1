[CmdletBinding()]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$coreFailure = $false
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$configPath = Join-Path $codexHome 'config.toml'
$graphRoot = if ($env:AFYX_GRAPH_RUNTIME_ROOT) { $env:AFYX_GRAPH_RUNTIME_ROOT } else { Join-Path $env:USERPROFILE '.afyx\graph' }

function Write-Result([string]$State, [string]$Name, [string]$Detail = '') {
    $suffix = if ($Detail) { " — $Detail" } else { '' }
    Write-Host "[$State] $Name$suffix"
}

# One component truth: scripts/components.json, read through the shared module.
Import-Module (Join-Path $PSScriptRoot 'scripts\lib\AfyxComponents.psm1') -Force
$componentContext = New-AfyxComponentContext -SkillsRoot $SkillsRoot -GraphRoot $graphRoot -CodexHome $codexHome
$componentStates = @{}
foreach ($componentState in (Get-AfyxComponentStates -Context $componentContext)) { $componentStates[$componentState.Id] = $componentState }

function Test-McpEntry([string]$Name) {
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return $false }
    try { return (Get-Content -Raw -LiteralPath $configPath -Encoding utf8) -match "(?m)^\[mcp_servers\.$([regex]::Escape($Name))\]\s*$" } catch { return $false }
}

Write-Host 'Afyx Codex Engineering Kit — readiness verification (Windows PowerShell)'
$git = Get-Command git -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
Write-Result 'OK' 'OS/architecture [REQUIRED]' "$([System.Runtime.InteropServices.RuntimeInformation]::OSDescription) / $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
Write-Result 'OK' 'Platform shell [REQUIRED]' "PowerShell $($PSVersionTable.PSVersion)"
if ($git) { Write-Result 'OK' 'Git [REQUIRED]' ((& git --version 2>$null) -join ' ') } else { Write-Result 'FAIL' 'Git [REQUIRED]' 'missing; install Git for Windows from https://git-scm.com/'; $coreFailure = $true }
if ($node) {
    $nodeText = (& node --version 2>$null) -join ' '
    $match = [regex]::Match($nodeText, '(\d+)\.(\d+)\.(\d+)')
    if ($match.Success -and [version]$match.Value -ge [version]'22.5.0') { Write-Result 'OK' 'Node.js [COMPONENT_REQUIRED:Afyx Graph]' $nodeText }
    else { Write-Result 'WARN' 'Node.js [COMPONENT_REQUIRED:Afyx Graph]' "$nodeText; requires >=22.5.0" }
} else { Write-Result 'INFO' 'Node.js [COMPONENT_REQUIRED:Afyx Graph]' 'missing; install from https://nodejs.org/ before selecting Afyx Graph' }
if ($npm) { Write-Result 'OK' 'npm [BUILD_ONLY:Afyx Graph]' ((& npm --version 2>$null) -join ' ') } else { Write-Result 'INFO' 'npm [BUILD_ONLY:Afyx Graph]' 'missing; required only for local artifact fallback' }
Write-Result 'OK' 'Archive/checksum [COMPONENT_REQUIRED:Afyx Graph]' 'Expand-Archive and Get-FileHash available'
$codex = Get-Command codex.exe -ErrorAction SilentlyContinue
if (-not $codex) { $codex = Get-Command codex.cmd -ErrorAction SilentlyContinue }
$extension = [bool](Get-ChildItem -Path (Join-Path $env:USERPROFILE '.vscode\extensions\openai.chatgpt-*') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
if ($codex) {
    try {
        $version = (& codex --version 2>$null) -join ' '
        if ($LASTEXITCODE -ne 0) { throw 'version command returned a non-zero exit code' }
        Write-Result 'OK' 'Codex CLI' $version
    }
    catch { Write-Result 'FAIL' 'Codex CLI' 'version command failed'; $coreFailure = $true }
} else { Write-Result 'INFO' 'Codex CLI' 'not found' }
if ($extension) { Write-Result 'OK' 'VS Code extension' 'detected' } else { Write-Result 'INFO' 'VS Code extension' 'not detected' }
if (-not $codex -and -not $extension) { $coreFailure = $true }

foreach ($component in ($componentStates.Values | Where-Object { $_.Tier -eq 'core' } | Sort-Object { @('efficient-coding', 'odoo-engineering', 'prompt-master').IndexOf($_.Id) })) {
    if ($component.State -eq 'HEALTHY') { Write-Result 'OK' $component.Name $component.Detail }
    else { Write-Result 'FAIL' $component.Name "$($component.State): $($component.Detail)"; $coreFailure = $true }
}

$graph = $componentStates['afyx-graph']
switch ($graph.State) {
    'NOT INSTALLED' { Write-Result 'INFO' 'Afyx Graph' 'not installed (optional)' }
    'HEALTHY' {
        $graphCli = Join-Path $graph.Path 'bin\afyx-graph.cmd'
        try {
            $reported = (& $graphCli --version 2>$null) -join ' '
            if ($LASTEXITCODE -ne 0 -or $reported -notmatch [regex]::Escape([string]$graph.Version)) { throw 'version mismatch' }
            & $graphCli help *> $null
            if ($LASTEXITCODE -ne 0) { throw 'help command failed' }
            Write-Result 'OK' 'Afyx Graph' "$reported; executable verification passed"
        } catch { Write-Result 'FAIL' 'Afyx Graph' "metadata is healthy but executable verification failed: $($_.Exception.Message)"; $coreFailure = $true }
    }
    'INCOMPLETE' { Write-Result 'WARN' 'Afyx Graph' 'incomplete Afyx-owned runtime (optional)' }
    'INVALID' { Write-Result 'WARN' 'Afyx Graph' 'invalid metadata (optional)' }
    default { Write-Result 'WARN' 'Afyx Graph' "state $($graph.State): $($graph.Detail) (optional)" }
}
if ($graph.State -eq 'HEALTHY' -and $node -and $codex) {
    $entry = Join-Path $graph.Path 'current\lib\dist\bin\afyx-graph.js'
    $integrationTool = Join-Path $PSScriptRoot 'scripts\afyx-mcp-integration.mjs'
    $integrationJson = (& $node.Source $integrationTool --node $node.Source --entry $entry --codex $codex.Source --codex-home $codexHome 2>$null) -join ''
    try {
        $integration = $integrationJson | ConvertFrom-Json
        $level = if ($integration.mcp -eq 'MCP_REACHABLE') { 'OK' } elseif ($integration.mcp -eq 'MCP_NOT_CONFIGURED') { 'INFO' } else { 'WARN' }
        Write-Result $level 'Afyx Graph MCP' "$($integration.mcp): $($integration.detail)"
    } catch { Write-Result 'WARN' 'Afyx Graph MCP' 'MCP_BLOCKED: integration status unavailable' }
} elseif (-not $codex) { Write-Result 'INFO' 'Afyx Graph MCP' 'MCP_BLOCKED: Codex CLI unavailable' }
elseif ($graph.State -ne 'HEALTHY') { Write-Result 'INFO' 'Afyx Graph MCP' 'MCP_BLOCKED: Graph runtime unavailable' }
else { Write-Result 'INFO' 'Afyx Graph MCP' 'MCP_NOT_CONFIGURED' }
$headroom = [bool](Get-Command headroom -ErrorAction SilentlyContinue)
$configText = if (Test-Path -LiteralPath $configPath -PathType Leaf) { Get-Content -Raw -LiteralPath $configPath -Encoding utf8 } else { '' }
$headroomProvider = $configText -match '(?im)^\s*model_provider\s*=\s*["'']headroom["'']\s*$' -or
    $configText -match '(?im)^\s*\[model_providers\.headroom\]\s*$'
$headroomProxy = $headroomProvider -or
    $configText -match '(?im)^\s*headroom_(endpoint|base_url|proxy_url)\s*='
if ($headroom) { Write-Result 'OK' 'Headroom CLI' 'detected' } else { Write-Result 'INFO' 'Headroom CLI' 'not found' }
if ($headroomProxy) { Write-Result 'OK' 'Headroom proxy/provider' ($(if ($headroomProvider) { 'provider routing configured' } else { 'endpoint configured' })) } else { Write-Result 'INFO' 'Headroom proxy/provider' 'not configured' }
if (Test-McpEntry 'headroom') { Write-Result 'OK' 'Headroom MCP' 'configured (optional)' } else { Write-Result 'INFO' 'Headroom MCP' 'not configured; optional for proxy mode' }

if (Test-Path -LiteralPath $configPath -PathType Leaf) { Write-Result 'OK' 'Codex config' 'read-only check completed' }
else { Write-Result 'WARN' 'Codex config' 'not found; optional MCP entries unavailable' }

$usageComponent = $componentStates['codex-usage-tracking']
$hooksPath = Join-Path $codexHome 'hooks.json'
$tasksPath = Join-Path $env:APPDATA 'Code\User\tasks.json'
$usagePresent = $usageComponent.State -notin @('NOT INSTALLED', 'UNKNOWN')
if (-not $usagePresent -and (Test-Path -LiteralPath $hooksPath -PathType Leaf)) {
    try { $usagePresent = (Get-Content -Raw -LiteralPath $hooksPath) -match '(?i)(Afyx Codex Usage Tracking|codex-usage-stop\.ps1)' } catch { }
}
if (-not $usagePresent -and (Test-Path -LiteralPath $tasksPath -PathType Leaf)) {
    try { $usagePresent = (Get-Content -Raw -LiteralPath $tasksPath) -match 'Codex: Watch Token Usage' } catch { }
}
if (-not $usagePresent) {
    Write-Result 'INFO' 'Codex Usage Tracker' 'optional; not installed'
} else {
    if ($usageComponent.State -eq 'HEALTHY') { Write-Result 'OK' 'Codex Usage Tracker' 'runtime files installed' }
    else { Write-Result 'WARN' 'Codex Usage Tracker' 'runtime files incomplete (optional)' }

    $hookConfigured = $false
    if (Test-Path -LiteralPath $hooksPath -PathType Leaf) {
        try {
            $hooksDocument = Get-Content -Raw -LiteralPath $hooksPath | ConvertFrom-Json -Depth 50 -ErrorAction Stop
            $hookConfigured = [bool](@($hooksDocument.hooks.Stop | ForEach-Object { $_.hooks } | Where-Object {
                ([string]$_.statusMessage -eq 'Afyx Codex Usage Tracking') -or
                ([string]$_.commandWindows -match '(?i)codex-usage-stop\.ps1') -or
                ([string]$_.command -match '(?i)codex-usage-stop\.ps1')
            }).Count)
        } catch { Write-Result 'WARN' 'Codex Usage Hook' 'hooks.json is invalid JSON' }
    }
    if ($hookConfigured) { Write-Result 'OK' 'Codex Usage Hook' 'global Stop hook configured' }
    else { Write-Result 'WARN' 'Codex Usage Hook' 'global Stop hook not configured (optional)' }

    try {
        $pricing = Get-Content -Raw -LiteralPath (Join-Path $codexHome 'tools\codex-usage-pricing.json') | ConvertFrom-Json -Depth 20 -ErrorAction Stop
        if ($pricing.unit_tokens -and $pricing.models) { Write-Result 'OK' 'Codex Usage Pricing' 'valid' }
        else { throw 'required pricing fields missing' }
    } catch { Write-Result 'WARN' 'Codex Usage Pricing' 'missing or invalid (optional)' }

    $taskConfigured = $false
    if (Test-Path -LiteralPath $tasksPath -PathType Leaf) {
        try {
            $taskDocument = Get-Content -Raw -LiteralPath $tasksPath | ConvertFrom-Json -Depth 30 -ErrorAction Stop
            $taskConfigured = [bool](@($taskDocument.tasks | Where-Object { $_.label -eq 'Codex: Watch Token Usage' }).Count)
        } catch { }
    }
    if ($taskConfigured) { Write-Result 'OK' 'Codex Usage VS Code Task' 'configured' }
    else { Write-Result 'WARN' 'Codex Usage VS Code Task' 'not configured (optional fallback)' }
    Write-Result 'INFO' 'Codex Usage Hook trust' 'verify with /hooks'
}

if ($coreFailure) { Write-Result 'FAIL' 'Core readiness'; exit 1 }
Write-Result 'OK' 'Core readiness' 'ready; optional enhancement warnings do not affect this result'
