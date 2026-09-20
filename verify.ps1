[CmdletBinding()]
param(
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'),
    [switch]$Full
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$coreFailure = $false
$optionalFailure = $false
$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'

function Write-Result([string]$State, [string]$Name, [string]$Detail = '') {
    $suffix = if ($Detail) { " — $Detail" } else { '' }
    Write-Host "$State $Name$suffix"
}
function Test-Skill([string]$Name, [string[]]$RequiredReferences = @()) {
    $directory = Join-Path $SkillsRoot $Name
    $manifest = Join-Path $directory 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { return @{ Ok=$false; Detail='SKILL.md missing' } }
    try { $text = Get-Content -Raw -LiteralPath $manifest -Encoding utf8 } catch { return @{ Ok=$false; Detail='not readable as UTF-8' } }
    if (-not $text.StartsWith("---")) { return @{ Ok=$false; Detail='frontmatter delimiter missing or escaped' } }
    if ($text -notmatch '(?m)^name:\s*[a-z0-9-]+\s*$') { return @{ Ok=$false; Detail='valid name missing' } }
    if ($text -notmatch '(?m)^description:\s*.+$') { return @{ Ok=$false; Detail='description missing' } }
    foreach ($reference in $RequiredReferences) { if (-not (Test-Path -LiteralPath (Join-Path $directory $reference))) { return @{ Ok=$false; Detail="reference missing: $reference" } } }
    return @{ Ok=$true; Detail='frontmatter and required references valid' }
}
function Test-McpConfigured([string]$Name) {
    return (Test-Path -LiteralPath $configPath) -and ((Get-Content -Raw -LiteralPath $configPath) -match [regex]::Escape("[mcp_servers.$Name]"))
}

Write-Host 'Afyx Codex Engineering Kit — readiness verification (Windows PowerShell)'
$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) { try { $version = (& codex --version 2>$null); Write-Result 'OK' 'Codex CLI' $version } catch { Write-Result 'FAIL' 'Codex CLI' 'version command failed'; $coreFailure = $true } } else { Write-Result 'FAIL' 'Codex CLI' 'not found'; $coreFailure = $true }

$checks = @(
    @{ Name='Efficient Coding'; Refs=@('references/token-efficiency.md') },
    @{ Name='Odoo Engineering (10–20)'; Refs=@('references/common.md','references/odoo-10.md','references/odoo-20.md') },
    @{ Name='Prompt Master'; Refs=@() }
)
foreach ($check in $checks) { $result = Test-Skill $check.Name.Replace(' (10–20)','').Replace(' ','-').ToLower() $check.Refs; if ($result.Ok) { Write-Result 'OK' $check.Name $result.Detail } else { Write-Result 'FAIL' $check.Name $result.Detail; $coreFailure = $true } }

foreach ($component in @(@{Name='CodeGraph'; Command='codegraph'}, @{Name='Headroom'; Command='headroom'})) {
    $command = Get-Command $component.Command -ErrorAction SilentlyContinue
    $configured = Test-McpConfigured $component.Command
    if ($command -and $configured) { Write-Result 'OK' "$($component.Name) enhancement" 'executable and MCP block found' }
    elseif ($command -or $configured) { Write-Result 'WARN' "$($component.Name) enhancement" 'partially configured' ; $optionalFailure = $true }
    else { Write-Result 'WARN' "$($component.Name) enhancement" 'not installed/configured (optional)' ; $optionalFailure = $true }
}

if (Test-Path -LiteralPath $configPath) { Write-Result 'OK' 'Codex config' 'present and read successfully' } else { Write-Result 'WARN' 'Codex config' 'not found; optional integrations cannot be configured' }

if ($coreFailure) { Write-Result 'FAIL' 'Core readiness'; exit 1 }
if ($Full -and $optionalFailure) { Write-Result 'FAIL' 'Full readiness'; exit 2 }
if ($optionalFailure) { Write-Result 'WARN' 'Core readiness' 'ready; optional enhancements incomplete'; exit 0 }
Write-Result 'OK' 'Full readiness' 'all requested components ready'
