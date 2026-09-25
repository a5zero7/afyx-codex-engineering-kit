#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUNDLED_EFFICIENT="$PACKAGE_ROOT/skills/efficient-coding"
BUNDLED_ODOO="$PACKAGE_ROOT/skills/odoo-engineering"
PROMPT_MASTER_REPOSITORY="https://github.com/nidhinjs/prompt-master.git"
skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
graph_root="${AFYX_GRAPH_RUNTIME_ROOT:-$HOME/.afyx/graph}"
force=false
validate_only=false
dry_run=false

usage() {
  printf '%s\n' 'Usage: ./install.sh [--skills-root PATH] [--force] [--validate-only] [--dry-run]'
}

while (($#)); do
  case "$1" in
    --skills-root) skills_root="$2"; shift 2 ;;
    --force) force=true; shift ;;
    --validate-only) validate_only=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

printf 'Afyx Codex Engineering Kit — Linux/macOS installer (Bash)\n'

valid_manifest() { [[ -s "$1/SKILL.md" ]] && [[ "$(head -n 1 "$1/SKILL.md")" == '---' ]]; }
skill_state() { if [[ ! -e "$1" ]]; then printf 'NOT INSTALLED'; elif valid_manifest "$1"; then printf HEALTHY; else printf INVALID; fi; }
skill_version() { sed -n 's/^[[:space:]]*version:[[:space:]]*"\{0,1\}\([^"[:space:]]*\).*/\1/p' "$1/SKILL.md" 2>/dev/null | head -n 1; }
graph_state() {
  if [[ ! -e "$graph_root" ]]; then printf 'NOT INSTALLED'
  elif [[ ! -s "$graph_root/metadata.json" || ! -x "$graph_root/current/bin/afyx-graph" ]]; then printf INCOMPLETE
  elif grep -q '"product_name"[[:space:]]*:[[:space:]]*"Afyx Graph"' "$graph_root/metadata.json"; then printf HEALTHY
  else printf INVALID; fi
}
run() { if "$dry_run"; then printf '+ '; printf '%q ' "$@"; printf '\n'; else "$@"; fi; }
interactive=false
if [[ -t 0 && -z "${CI:-}" ]] && ! "$dry_run"; then interactive=true; fi

replace_choice() {
  local label="$1" answer
  if "$force"; then printf Replace; return; fi
  if ! "$interactive"; then printf Skip; return; fi
  while :; do
    read -r -p "$label [S] Skip / [R] Replace [S]: " answer || answer=
    case "$answer" in ''|[sS]|[sS][kK][iI][pP]) printf Skip; return ;; [rR]|[rR][eE][pP][lL][aA][cC][eE]) printf Replace; return ;; esac
  done
}

install_choice() {
  local label="$1" answer
  if ! "$interactive"; then return 1; fi
  while :; do
    read -r -p "$label [Y/N] [N]: " answer || answer=
    case "$answer" in [yY]|[yY][eE][sS]) return 0 ;; ''|[nN]|[nN][oO]) return 1 ;; esac
  done
}

safe_skill_install() {
  local label="$1" source="$2" target="$3" replace="$4" parent stage old backup
  if [[ -e "$target" && "$replace" != true ]]; then printf skipped; return; fi
  if "$dry_run"; then printf 'planned'; return; fi
  parent="$(dirname "$target")"; mkdir -p "$parent"
  stage="$(mktemp -d "$parent/.skill-stage.XXXXXX")"; old="$parent/.skill-old.$$"
  cp -a "$source/." "$stage/"
  valid_manifest "$stage" || { rm -rf -- "$stage"; printf '%s staged manifest is invalid.\n' "$label" >&2; return 1; }
  if [[ -e "$target" ]]; then
    mkdir -p "$PACKAGE_ROOT/backups"
    backup="$PACKAGE_ROOT/backups/$(basename "$target")-$(date +%Y%m%d-%H%M%S)"
    cp -a "$target" "$backup"
    mv "$target" "$old"
  fi
  if ! mv "$stage" "$target"; then [[ -e "$old" ]] && mv "$old" "$target"; return 1; fi
  if ! valid_manifest "$target"; then rm -rf -- "$target"; [[ -e "$old" ]] && mv "$old" "$target"; return 1; fi
  [[ -e "$old" ]] && rm -rf -- "$old"
  if [[ "$replace" == true ]]; then printf replaced; else printf installed; fi
}

valid_manifest "$BUNDLED_EFFICIENT" || { printf 'Bundled Efficient Coding is invalid.\n' >&2; exit 1; }
valid_manifest "$BUNDLED_ODOO" || { printf 'Bundled Odoo Engineering is invalid.\n' >&2; exit 1; }
[[ -s "$PACKAGE_ROOT/afyx-codegraph/afyx-graph.json" ]] || { printf 'Bundled Afyx Graph metadata is missing.\n' >&2; exit 1; }

efficient_target="$skills_root/efficient-coding"
odoo_target="$skills_root/odoo-engineering"
prompt_target="$skills_root/prompt-master"
efficient_state="$(skill_state "$efficient_target")"
odoo_state="$(skill_state "$odoo_target")"
prompt_state="$(skill_state "$prompt_target")"
afyx_graph_state="$(graph_state)"

printf '\nComponent Inventory\n'
printf 'Efficient Coding: %s\nOdoo Engineering: %s\nPrompt Master: %s\nAfyx Graph: %s\n' "$efficient_state" "$odoo_state" "$prompt_state" "$afyx_graph_state"
printf 'Codex Usage Tracking: NOT INSTALLED (Windows-only runtime)\n'
if command -v headroom >/dev/null 2>&1; then printf 'Headroom: externally managed; detected\n'; else printf 'Headroom: externally managed; not detected\n'; fi
if command -v codegraph >/dev/null 2>&1; then printf 'Upstream CodeGraph: externally managed; detected\n'; else printf 'Upstream CodeGraph: externally managed; not detected\n'; fi

codex_cli_detected=false; command -v codex >/dev/null 2>&1 && codex_cli_detected=true
vscode_extension_detected=false
for extension in "$HOME"/.vscode/extensions/openai.chatgpt-*; do [[ -d "$extension" ]] && { vscode_extension_detected=true; break; }; done

if "$validate_only"; then
  graph_version="$(sed -n 's/.*"afyx_graph_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PACKAGE_ROOT/afyx-codegraph/afyx-graph.json")"
  engine_version="$(sed -n 's/.*"codegraph_upstream_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PACKAGE_ROOT/afyx-codegraph/afyx-graph.json")"
  printf 'BundledEfficientCoding: true\nInstalledEfficientCoding: %s\nEfficientCodingState: %s\nEfficientCodingVersion: %s\n' "$([[ "$efficient_state" == HEALTHY ]] && echo true || echo false)" "$efficient_state" "$(skill_version "$efficient_target")"
  printf 'BundledOdooEngineering: true\nInstalledOdooEngineering: %s\nOdooEngineeringState: %s\nOdooEngineeringVersion: %s\n' "$([[ "$odoo_state" == HEALTHY ]] && echo true || echo false)" "$odoo_state" "$(skill_version "$odoo_target")"
  printf 'InstalledPromptMaster: %s\nPromptMasterState: %s\n' "$([[ "$prompt_state" == HEALTHY ]] && echo true || echo false)" "$prompt_state"
  printf 'BundledAfyxGraphSource: true\nInstalledAfyxGraph: %s\nAfyxGraphState: %s\nAfyxGraphVersion: %s\nAfyxGraphEngineVersion: %s\n' "$([[ "$afyx_graph_state" == HEALTHY ]] && echo true || echo false)" "$afyx_graph_state" "$graph_version" "$engine_version"
  printf 'InstalledUsageTracker: false\nUsageTrackerState: NOT INSTALLED\nCodexCliDetected: %s\nVsCodeExtensionDetected: %s\n' "$codex_cli_detected" "$vscode_extension_detected"
  exit 0
fi

if ! "$codex_cli_detected" && ! "$vscode_extension_detected"; then printf 'Neither Codex CLI nor the ChatGPT/Codex VS Code extension was detected.\n' >&2; exit 1; fi
command -v git >/dev/null 2>&1 || { printf 'Git is required for Prompt Master.\n' >&2; exit 1; }
run mkdir -p "$skills_root"

efficient_replace=false; [[ "$efficient_state" != 'NOT INSTALLED' && "$(replace_choice 'Efficient Coding')" == Replace ]] && efficient_replace=true
odoo_replace=false; [[ "$odoo_state" != 'NOT INSTALLED' && "$(replace_choice 'Odoo Engineering')" == Replace ]] && odoo_replace=true
efficient_result="$(safe_skill_install 'Efficient Coding' "$BUNDLED_EFFICIENT" "$efficient_target" "$efficient_replace")"
odoo_result="$(safe_skill_install 'Odoo Engineering' "$BUNDLED_ODOO" "$odoo_target" "$odoo_replace")"

prompt_result=skipped
if [[ "$prompt_state" == 'NOT INSTALLED' ]]; then
  if "$dry_run"; then prompt_result=planned; else git clone --depth 1 "$PROMPT_MASTER_REPOSITORY" "$prompt_target"; valid_manifest "$prompt_target"; prompt_result=installed; fi
elif [[ "$(replace_choice 'Prompt Master')" == Replace ]]; then
  if "$dry_run"; then prompt_result=planned
  else
    if [[ -d "$prompt_target/.git" && -n "$(git -C "$prompt_target" status --porcelain)" ]]; then printf 'Prompt Master has local changes; backup will be preserved.\n'; fi
    prompt_stage="$(mktemp -d "$(dirname "$prompt_target")/.prompt-stage.XXXXXX")"; rm -rf -- "$prompt_stage"
    git clone --depth 1 "$PROMPT_MASTER_REPOSITORY" "$prompt_stage"; valid_manifest "$prompt_stage"
    mkdir -p "$PACKAGE_ROOT/backups"; cp -a "$prompt_target" "$PACKAGE_ROOT/backups/prompt-master-$(date +%Y%m%d-%H%M%S)"
    prompt_old="${prompt_target}.old.$$"; mv "$prompt_target" "$prompt_old"
    if mv "$prompt_stage" "$prompt_target"; then rm -rf -- "$prompt_old"; else mv "$prompt_old" "$prompt_target"; exit 1; fi
    prompt_result=replaced
  fi
fi

graph_result=skipped
install_graph=false
if [[ "$afyx_graph_state" == 'NOT INSTALLED' ]]; then install_choice 'Install Afyx Graph?' && install_graph=true
elif [[ "$(replace_choice 'Afyx Graph')" == Replace ]]; then install_graph=true; fi
if "$install_graph"; then
  graph_args=(); [[ "$afyx_graph_state" != 'NOT INSTALLED' ]] && graph_args+=(--replace); "$dry_run" && graph_args+=(--validate-only)
  "$PACKAGE_ROOT/scripts/install-afyx-graph.sh" "${graph_args[@]}"
  if [[ "$afyx_graph_state" == 'NOT INSTALLED' ]]; then graph_result=installed; else graph_result=replaced; fi
fi

printf '\nInstallation Summary\n[%s] Efficient Coding\n[%s] Odoo Engineering\n[%s] Prompt Master\n[%s] Afyx Graph\n[SKIPPED] Codex Usage Tracking\n' "$efficient_result" "$odoo_result" "$prompt_result" "$graph_result"
printf '[INFO] Headroom — externally managed; unchanged\n[INFO] Upstream CodeGraph — externally managed; unchanged\n'
"$dry_run" && printf 'Dry-run completed; no files or configuration were changed.\n' || printf 'Start a new Codex session to load installed components.\n'
