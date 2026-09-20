[CmdletBinding()]
param([string]$SkillsRoot = (Join-Path $env:USERPROFILE '.agents\skills'))

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-Skill([string]$Name) {
    $manifest = Join-Path (Join-Path $SkillsRoot $Name) 'SKILL.md'
    return (Test-Path -LiteralPath $manifest -PathType Leaf) -and ((Get-Content -LiteralPath $manifest -TotalCount 1 -Encoding utf8) -eq '---')
}
function Show-Check([string]$Name, [bool]$Passed) {
    Write-Host ("{0} {1}" -f $(if ($Passed) {'✓'} else {'✗'}), $Name)
}

Write-Host 'Afyx Codex Engineering Kit — verification (Windows PowerShell)'
$config = Join-Path $env:USERPROFILE '.codex\config.toml'
Show-Check 'Codex CLI' ([bool](Get-Command codex -ErrorAction SilentlyContinue))
Show-Check 'Efficient Coding skill' (Test-Skill 'efficient-coding')
Show-Check 'Odoo Engineering skill (10–20)' (Test-Skill 'odoo-engineering')
Show-Check 'Prompt Master skill' (Test-Skill 'prompt-master')
Show-Check 'CodeGraph executable' ([bool](Get-Command codegraph -ErrorAction SilentlyContinue))
Show-Check 'Headroom executable' ([bool](Get-Command headroom -ErrorAction SilentlyContinue))
Show-Check 'CodeGraph MCP configured' ((Test-Path -LiteralPath $config) -and ((Get-Content -Raw -LiteralPath $config) -match '\[mcp_servers\.codegraph\]'))
Show-Check 'Headroom MCP configured' ((Test-Path -LiteralPath $config) -and ((Get-Content -Raw -LiteralPath $config) -match '\[mcp_servers\.headroom\]'))

if (Get-Command headroom -ErrorAction SilentlyContinue) { & headroom --version }
