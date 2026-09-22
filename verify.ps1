[CmdletBinding()]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$coreFailure = $false
$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'

function Write-Result([string]$State, [string]$Name, [string]$Detail = '') {
    $suffix = if ($Detail) { " — $Detail" } else { '' }
    Write-Host "[$State] $Name$suffix"
}

function Test-Skill([string]$Name, [string[]]$RequiredReferences = @()) {
    $directory = Join-Path $SkillsRoot $Name
    $manifest = Join-Path $directory 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return @{ Ok = $false; Detail = 'SKILL.md missing' } }
    try { $text = Get-Content -Raw -LiteralPath $manifest -Encoding utf8 } catch { return @{ Ok = $false; Detail = 'not readable as UTF-8' } }
    if ([string]::IsNullOrWhiteSpace($text)) { return @{ Ok = $false; Detail = 'SKILL.md is empty' } }
    if ($text -notmatch '\A---\r?\n[\s\S]*?\r?\n---\r?\n') { return @{ Ok = $false; Detail = 'frontmatter delimiters missing or malformed' } }
    if ($text -notmatch '(?m)^name:\s*[a-z0-9-]+\s*$') { return @{ Ok = $false; Detail = 'valid name missing' } }
    if ($text -notmatch '(?m)^description:\s*\S.+$') { return @{ Ok = $false; Detail = 'description missing' } }
    foreach ($reference in $RequiredReferences) {
        $referencePath = Join-Path $directory $reference
        if (-not (Test-Path -LiteralPath $referencePath -PathType Leaf)) { return @{ Ok = $false; Detail = "reference missing: $reference" } }
        if ([string]::IsNullOrWhiteSpace((Get-Content -Raw -LiteralPath $referencePath -Encoding utf8))) { return @{ Ok = $false; Detail = "reference empty: $reference" } }
    }
    return @{ Ok = $true; Detail = 'frontmatter and required references valid' }
}

function Test-McpEntry([string]$Name) {
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return $false }
    try { return (Get-Content -Raw -LiteralPath $configPath -Encoding utf8) -match "(?m)^\[mcp_servers\.$([regex]::Escape($Name))\]\s*$" } catch { return $false }
}

Write-Host 'Afyx Codex Engineering Kit — readiness verification (Windows PowerShell)'
$codex = Get-Command codex -ErrorAction SilentlyContinue
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

$odooReferences = @('references/common.md') + (10..20 | ForEach-Object { "references/odoo-$_.md" })
$checks = @(
    @{ Name = 'efficient-coding'; Label = 'Efficient Coding'; Refs = @('references/token-efficiency.md') },
    @{ Name = 'odoo-engineering'; Label = 'Odoo Engineering (stable refs 10–19; Odoo 20 preview)'; Refs = $odooReferences },
    @{ Name = 'prompt-master'; Label = 'Prompt Master'; Refs = @() }
)
foreach ($check in $checks) {
    $result = Test-Skill $check.Name $check.Refs
    if ($result.Ok) { Write-Result 'OK' $check.Label $result.Detail }
    else { Write-Result 'FAIL' $check.Label $result.Detail; $coreFailure = $true }
}

foreach ($component in @(@{ Label = 'CodeGraph'; Command = 'codegraph' })) {
    $executable = [bool](Get-Command $component.Command -ErrorAction SilentlyContinue)
    $configured = Test-McpEntry $component.Command
    if ($executable -and $configured) { Write-Result 'OK' "$($component.Label) enhancement" 'executable and MCP entry found' }
    elseif ($executable -or $configured) { Write-Result 'WARN' "$($component.Label) enhancement" 'partially available (optional)' }
    else { Write-Result 'WARN' "$($component.Label) enhancement" 'not installed or configured (optional)' }
}
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

if ($coreFailure) { Write-Result 'FAIL' 'Core readiness'; exit 1 }
Write-Result 'OK' 'Core readiness' 'ready; optional enhancement warnings do not affect this result'
