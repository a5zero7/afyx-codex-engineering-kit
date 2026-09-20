#!/usr/bin/env bash
set -euo pipefail

skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
config="$HOME/.codex/config.toml"

check() { local label="$1"; shift; if "$@"; then printf '✓ %s\n' "$label"; else printf '✗ %s\n' "$label"; fi; }
skill_ok() { [[ -f "$skills_root/$1/SKILL.md" ]] && [[ "$(head -n 1 "$skills_root/$1/SKILL.md")" == '---' ]]; }
command_ok() { command -v "$1" >/dev/null 2>&1; }
config_ok() { [[ -f "$config" ]] && grep -Fq "$1" "$config"; }

printf 'Afyx Codex Engineering Kit — verification (Linux/macOS Bash)\n'
check 'Codex CLI' command_ok codex
check 'Efficient Coding skill' skill_ok efficient-coding
check 'Odoo Engineering skill (10-20)' skill_ok odoo-engineering
check 'Prompt Master skill' skill_ok prompt-master
check 'CodeGraph executable' command_ok codegraph
check 'Headroom executable' command_ok headroom
check 'CodeGraph MCP configured' config_ok '[mcp_servers.codegraph]'
check 'Headroom MCP configured' config_ok '[mcp_servers.headroom]'

command -v headroom >/dev/null 2>&1 && headroom --version
