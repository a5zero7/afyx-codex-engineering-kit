#!/usr/bin/env bash
set -euo pipefail

skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
config="$HOME/.codex/config.toml"
graph_root="${AFYX_GRAPH_RUNTIME_ROOT:-$HOME/.afyx/graph}"
core_failure=false

usage() {
  printf '%s\n' 'Usage: ./verify.sh [--skills-root PATH]'
}

while (($#)); do
  case "$1" in
    --skills-root) skills_root="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

result() {
  local state="$1" label="$2" detail="${3:-}"
  [[ -n "$detail" ]] && printf '[%s] %s — %s\n' "$state" "$label" "$detail" || printf '[%s] %s\n' "$state" "$label"
}

skill_ok() {
  local name="$1" manifest="$skills_root/$1/SKILL.md"
  [[ -f "$manifest" ]] || return 1
  [[ -s "$manifest" ]] || return 1
  [[ "$(head -n 1 "$manifest")" == '---' ]] || return 1
  grep -Eq '^name:[[:space:]]*[a-z0-9-]+[[:space:]]*$' "$manifest" || return 1
  grep -Eq '^description:[[:space:]]*[^[:space:]].*$' "$manifest" || return 1
  if [[ "${2:-false}" == true ]]; then
    grep -Eq '^metadata:[[:space:]]*$' "$manifest" || return 1
    grep -Eq '^[[:space:]]+version:[[:space:]]*[^[:space:]].*$' "$manifest" || return 1
  fi
}

refs_ok() {
  local name="$1"; shift
  local reference
  for reference in "$@"; do [[ -s "$skills_root/$name/$reference" ]] || return 1; done
}

mcp_configured() {
  [[ -f "$config" ]] && grep -Eq "^\\[mcp_servers\\.$1\\][[:space:]]*$" "$config"
}

printf 'Afyx Codex Engineering Kit — readiness verification (Linux/macOS Bash)\n'
codex_detected=false
if command -v codex >/dev/null 2>&1; then
  codex_detected=true
  if version="$(codex --version 2>/dev/null)"; then result OK 'Codex CLI' "$version"; else result FAIL 'Codex CLI' 'version command failed'; core_failure=true; fi
else result INFO 'Codex CLI' 'not found'; fi
extension_detected=false
for extension in "$HOME"/.vscode/extensions/openai.chatgpt-*; do [[ -d "$extension" ]] && { extension_detected=true; break; }; done
if "$extension_detected"; then result OK 'VS Code extension' 'detected'; else result INFO 'VS Code extension' 'not detected'; fi
if ! "$codex_detected" && ! "$extension_detected"; then core_failure=true; fi

if skill_ok efficient-coding true && refs_ok efficient-coding references/investigation.md references/tool-routing.md references/token-efficiency.md; then result OK 'Efficient Coding' 'frontmatter metadata and required references valid'; else result FAIL 'Efficient Coding' 'SKILL.md metadata or required reference invalid'; core_failure=true; fi

odoo_refs=(references/common.md references/version-detection.md)
for version in {10..20}; do odoo_refs+=("references/odoo-$version.md"); done
if skill_ok odoo-engineering true && refs_ok odoo-engineering "${odoo_refs[@]}" references/reference-schema.md; then result OK 'Odoo Engineering' 'frontmatter metadata and stable refs 10-20 valid'; else result FAIL 'Odoo Engineering' 'SKILL.md metadata or required reference invalid'; core_failure=true; fi

if skill_ok prompt-master; then result OK 'Prompt Master' 'frontmatter valid'; else result FAIL 'Prompt Master' 'SKILL.md invalid or missing'; core_failure=true; fi

if [[ ! -e "$graph_root" ]]; then result INFO 'Afyx Graph' 'not installed (optional)'
elif [[ ! -s "$graph_root/metadata.json" || ! -x "$graph_root/current/bin/afyx-graph" ]]; then result WARN 'Afyx Graph' 'incomplete Afyx-owned runtime (optional)'
elif grep -q '"product_name"[[:space:]]*:[[:space:]]*"Afyx Graph"' "$graph_root/metadata.json"; then
  graph_version="$(sed -n 's/.*"afyx_graph_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$graph_root/metadata.json")"
  engine_version="$(sed -n 's/.*"codegraph_upstream_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$graph_root/metadata.json")"
  result OK 'Afyx Graph' "$graph_version (CodeGraph engine $engine_version)"
else result WARN 'Afyx Graph' 'invalid metadata (optional)'; fi
if mcp_configured afyx_graph; then result OK 'Afyx Graph MCP' 'configured explicitly'; else result INFO 'Afyx Graph MCP' 'not configured; installation does not mutate MCP config'; fi
upstream_detected=false
if command -v codegraph >/dev/null 2>&1; then
  codegraph_path="$(command -v codegraph)"
  case "$codegraph_path" in "$graph_root"/*) ;; *) upstream_detected=true ;; esac
fi
if "$upstream_detected" || mcp_configured codegraph; then result INFO 'Upstream CodeGraph' 'detected; externally managed and unchanged'; else result INFO 'Upstream CodeGraph' 'not detected'; fi
headroom_cli=false; command -v headroom >/dev/null 2>&1 && headroom_cli=true
headroom_provider=false; headroom_proxy=false
if [[ -f "$config" ]] && grep -Eiq "^[[:space:]]*model_provider[[:space:]]*=[[:space:]]*['\"]headroom['\"][[:space:]]*$|^[[:space:]]*\[model_providers\.headroom\][[:space:]]*$" "$config"; then headroom_provider=true; fi
if "$headroom_provider" || { [[ -f "$config" ]] && grep -Eiq '^[[:space:]]*headroom_(endpoint|base_url|proxy_url)[[:space:]]*=' "$config"; }; then headroom_proxy=true; fi
if "$headroom_cli"; then result OK 'Headroom CLI' 'detected'; else result INFO 'Headroom CLI' 'not found'; fi
if "$headroom_proxy"; then [[ "$headroom_provider" == true ]] && result OK 'Headroom proxy/provider' 'provider routing configured' || result OK 'Headroom proxy/provider' 'endpoint configured'; else result INFO 'Headroom proxy/provider' 'not configured'; fi
if mcp_configured headroom; then result OK 'Headroom MCP' 'configured (optional)'; else result INFO 'Headroom MCP' 'not configured; optional for proxy mode'; fi

if [[ -f "$config" ]]; then result OK 'Codex config' 'read-only check completed'; else result WARN 'Codex config' 'not found; optional MCP entries unavailable'; fi

if "$core_failure"; then result FAIL 'Core readiness'; exit 1; fi
result OK 'Core readiness' 'ready; optional enhancement warnings do not affect this result'
