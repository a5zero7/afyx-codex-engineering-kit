#!/usr/bin/env bash
set -euo pipefail

skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
codex_home="${CODEX_HOME:-$HOME/.codex}"
config="$codex_home/config.toml"
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
case "$(uname -s)" in Darwin) verify_os=macOS ;; Linux) verify_os=Linux ;; *) verify_os="$(uname -s)"; core_failure=true ;; esac
result OK 'OS/architecture [REQUIRED]' "$verify_os / $(uname -m)"
result OK 'Platform shell [REQUIRED]' "Bash ${BASH_VERSION}"
if command -v git >/dev/null 2>&1; then result OK 'Git [REQUIRED]' "$(git --version)"; else result FAIL 'Git [REQUIRED]' 'missing; install Git with the documented OS package manager'; core_failure=true; fi
if command -v node >/dev/null 2>&1; then
  node_text="$(node --version 2>/dev/null || true)"; node_number="${node_text#v}"; node_major="${node_number%%.*}"; node_tail="${node_number#*.}"; node_minor="${node_tail%%.*}"
  if [[ "$node_major" =~ ^[0-9]+$ && "$node_minor" =~ ^[0-9]+$ ]] && ((node_major > 22 || (node_major == 22 && node_minor >= 5))); then result OK 'Node.js [COMPONENT_REQUIRED:Afyx Graph]' "$node_text"
  else result WARN 'Node.js [COMPONENT_REQUIRED:Afyx Graph]' "$node_text; requires >=22.5.0"; fi
else result INFO 'Node.js [COMPONENT_REQUIRED:Afyx Graph]' 'missing; install from https://nodejs.org/ before selecting Afyx Graph'; fi
if command -v npm >/dev/null 2>&1; then result OK 'npm [BUILD_ONLY:Afyx Graph]' "$(npm --version)"; else result INFO 'npm [BUILD_ONLY:Afyx Graph]' 'missing; required only for local artifact fallback'; fi
if command -v tar >/dev/null 2>&1 && { command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1; }; then result OK 'Archive/checksum [COMPONENT_REQUIRED:Afyx Graph]' 'tar and SHA-256 tool available'; else result WARN 'Archive/checksum [COMPONENT_REQUIRED:Afyx Graph]' 'tar or SHA-256 tool missing'; fi
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
  HEALTHY)
    graph_cli="$AFYX_PATH/current/bin/afyx-graph"
    if graph_reported="$($graph_cli --version 2>/dev/null)" && [[ "$graph_reported" == *"$AFYX_VERSION"* ]] && "$graph_cli" help >/dev/null 2>&1; then
      result OK 'Afyx Graph' "$graph_reported; executable verification passed"
    else result FAIL 'Afyx Graph' 'metadata is healthy but executable verification failed'; core_failure=true; fi
    ;;
  INCOMPLETE) result WARN 'Afyx Graph' 'incomplete Afyx-owned runtime (optional)' ;;
  INVALID) result WARN 'Afyx Graph' 'invalid metadata (optional)' ;;
  *) result WARN 'Afyx Graph' "state $AFYX_STATE: $AFYX_DETAIL (optional)" ;;
esac
if [[ "$AFYX_STATE" == HEALTHY ]] && command -v node >/dev/null 2>&1 && command -v codex >/dev/null 2>&1; then
  set +e
  integration_json="$(node "$PACKAGE_ROOT/scripts/afyx-mcp-integration.mjs" --node "$(command -v node)" --entry "$AFYX_PATH/current/lib/dist/bin/afyx-graph.js" --codex "$(command -v codex)" --codex-home "$codex_home" 2>/dev/null)"
  set -e
  integration_state="$(printf '%s' "$integration_json" | sed -n 's/.*"mcp":"\([^"]*\)".*/\1/p')"
  integration_detail="$(printf '%s' "$integration_json" | sed -n 's/.*"detail":"\([^"]*\)".*/\1/p')"
  case "$integration_state" in MCP_REACHABLE) level=OK ;; MCP_NOT_CONFIGURED) level=INFO ;; *) level=WARN ;; esac
  result "$level" 'Afyx Graph MCP' "${integration_state:-MCP_BLOCKED}: ${integration_detail:-integration status unavailable}"
elif ! command -v codex >/dev/null 2>&1; then result INFO 'Afyx Graph MCP' 'MCP_BLOCKED: Codex CLI unavailable'
elif [[ "$AFYX_STATE" != HEALTHY ]]; then result INFO 'Afyx Graph MCP' 'MCP_BLOCKED: Graph runtime unavailable'
else result INFO 'Afyx Graph MCP' 'MCP_NOT_CONFIGURED'; fi
result INFO 'Usage Tracking' 'not installed; Windows-only runtime'
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
