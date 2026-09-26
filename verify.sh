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

# One component truth: scripts/components.json, read through the shared library.
# shellcheck source=scripts/lib/afyx-components.sh
. "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/scripts/lib/afyx-components.sh"

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

for component_id in efficient-coding odoo-engineering prompt-master; do
  afyx_component_evaluate "$component_id"
  component_name="$(afyx_component_field "$component_id" name)"
  if [[ "$AFYX_STATE" == HEALTHY ]]; then result OK "$component_name" "$AFYX_DETAIL"
  else result FAIL "$component_name" "$AFYX_STATE: $AFYX_DETAIL"; core_failure=true; fi
done

afyx_component_evaluate afyx-graph
case "$AFYX_STATE" in
  'NOT INSTALLED') result INFO 'Afyx Graph' 'not installed (optional)' ;;
  HEALTHY) result OK 'Afyx Graph' "$AFYX_VERSION" ;;
  INCOMPLETE) result WARN 'Afyx Graph' 'incomplete Afyx-owned runtime (optional)' ;;
  INVALID) result WARN 'Afyx Graph' 'invalid metadata (optional)' ;;
  *) result WARN 'Afyx Graph' "state $AFYX_STATE: $AFYX_DETAIL (optional)" ;;
esac
if mcp_configured afyx_graph; then result OK 'Afyx Graph MCP' 'configured explicitly'; else result INFO 'Afyx Graph MCP' 'not configured; installation does not mutate MCP config'; fi
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
