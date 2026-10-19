#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUNDLED_EFFICIENT="$PACKAGE_ROOT/skills/efficient-coding"
BUNDLED_ODOO="$PACKAGE_ROOT/skills/odoo-engineering"
BUNDLED_EXPERT="$PACKAGE_ROOT/skills/afyx-engineering-expert"
PROMPT_MASTER_REPOSITORY="${AFYX_PROMPT_MASTER_REPOSITORY:-https://github.com/nidhinjs/prompt-master.git}"
skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
graph_root="${AFYX_GRAPH_RUNTIME_ROOT:-$HOME/.afyx/graph}"
force=false
validate_only=false
dry_run=false
update_installed=false
component_actions=()
component_action_count=0
preset=
custom_component_list=
offline=false
no_build_fallback=false
allow_dirty_source=false
skip_graph_mcp=false

usage() {
  printf '%s\n' 'Usage: ./install.sh [--skills-root PATH] [--preset minimal|recommended|full|custom] [--custom-component ID] [--component ID=skip|install|update|repair|adopt] [--update-installed] [--force] [--validate-only] [--dry-run]'
}

while (($#)); do
  case "$1" in
    --skills-root) (($# >= 2)) || { printf '%s\n' '--skills-root requires a value.' >&2; exit 2; }; skills_root="$2"; shift 2 ;;
    --force) force=true; shift ;;
    --component) (($# >= 2)) || { printf '%s\n' '--component requires a value.' >&2; exit 2; }; component_actions+=("$2"); component_action_count=$((component_action_count + 1)); shift 2 ;;
    --preset) (($# >= 2)) || { printf '%s\n' '--preset requires a value.' >&2; exit 2; }; preset="$2"; shift 2 ;;
    --custom-component) (($# >= 2)) || { printf '%s\n' '--custom-component requires a value.' >&2; exit 2; }; custom_component_list="${custom_component_list:+$custom_component_list;}$2"; shift 2 ;;
    --update-installed) update_installed=true; shift ;;
    --offline) offline=true; shift ;;
    --no-build-fallback) no_build_fallback=true; shift ;;
    --allow-dirty-source) allow_dirty_source=true; shift ;;
    --skip-graph-mcp) skip_graph_mcp=true; shift ;;
    --validate-only) validate_only=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

printf 'Afyx Codex Engineering Kit — Linux/macOS installer (Bash)\n'

valid_manifest() { [[ -s "$1/SKILL.md" ]] && [[ "$(head -n 1 "$1/SKILL.md")" == '---' ]]; }
# One component truth: scripts/components.json, read through the shared library.
# shellcheck source=scripts/lib/afyx-components.sh
. "$PACKAGE_ROOT/scripts/lib/afyx-components.sh"
# shellcheck source=scripts/lib/afyx-skill-lifecycle.sh
. "$PACKAGE_ROOT/scripts/lib/afyx-skill-lifecycle.sh"
PROMPT_MASTER_REVISION="$(afyx_component_field prompt-master source_revision)"
if [[ -n "$preset" ]] && ! afyx_preset_valid "$preset"; then printf 'Unknown preset: %s\n' "$preset" >&2; exit 2; fi
if [[ -n "$custom_component_list" && "$preset" != custom ]]; then printf '%s\n' '--custom-component requires --preset custom.' >&2; exit 2; fi
if [[ -n "$preset" ]] && { ((component_action_count)) || [[ "$force" == true ]]; }; then
  printf '%s\n' 'A preset is immutable for one operation; do not combine it with --component or --force.' >&2; exit 2
fi
old_ifs=$IFS; IFS=';'
for custom_id in $custom_component_list; do
  case "$custom_id" in efficient-coding|odoo-engineering|afyx-engineering-expert|prompt-master|afyx-graph|codex-usage-tracking) ;; *) printf 'Unknown custom component: %s\n' "$custom_id" >&2; exit 2 ;; esac
done
IFS=$old_ifs
component_state() {
  local id="$1" owner target
  afyx_component_evaluate "$id"
  if [[ "$(afyx_component_field "$id" type)" == skill && "$AFYX_STATE" != 'NOT INSTALLED' ]]; then
    owner="$(afyx_component_field "$id" ownership)"; target="$(afyx_component_root "$id")"
    afyx_classify_skill "$target" "$id" "$owner"
    case "$AFYX_OWNERSHIP_STATE" in
      AFYX_OWNED_UNMODIFIED|EXTERNAL_UPSTREAM) ;;
      AFYX_OWNED_MODIFIED) AFYX_STATE=DRIFTED; AFYX_DETAIL='Afyx ownership verified but installed content was modified' ;;
      *) AFYX_STATE=UNKNOWN; AFYX_DETAIL="installed ownership is $AFYX_OWNERSHIP_STATE" ;;
    esac
  fi
  printf '%s' "$AFYX_STATE"
}
component_version() { afyx_component_evaluate "$1"; printf '%s' "$AFYX_VERSION"; }
run() { if "$dry_run"; then printf '+ '; printf '%q ' "$@"; printf '\n'; else "$@"; fi; }
interactive=false
if [[ -t 0 && -z "${CI:-}" ]] && ! "$dry_run"; then interactive=true; fi

available_version() {
  case "$1" in
    efficient-coding) afyx_skill_version "$BUNDLED_EFFICIENT" ;;
    odoo-engineering) afyx_skill_version "$BUNDLED_ODOO" ;;
    afyx-engineering-expert) afyx_skill_version "$BUNDLED_EXPERT" ;;
    afyx-graph) sed -n 's/.*"product_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PACKAGE_ROOT/afyx-graph/afyx-graph.json" ;;
    *) printf '' ;;
  esac
}

version_lt() {
  awk -v left="$1" -v right="$2" 'BEGIN {
    split(left, l, "."); split(right, r, ".");
    for (i=1; i<=4; i++) { if ((l[i]+0) < (r[i]+0)) exit 0; if ((l[i]+0) > (r[i]+0)) exit 1 }
    exit 1
  }'
}

explicit_action() {
  local wanted="$1" specification id action
  for specification in ${component_actions[@]+"${component_actions[@]}"}; do
    case "$specification" in *=*) id="${specification%%=*}"; action="${specification#*=}" ;; *) printf 'Invalid --component value: %s\n' "$specification" >&2; return 2 ;; esac
    case "$id" in efficient-coding|odoo-engineering|afyx-engineering-expert|prompt-master|afyx-graph|codex-usage-tracking) ;; *) printf 'Unknown selectable component: %s\n' "$id" >&2; return 2 ;; esac
    case "$action" in skip|install|update|repair|adopt) ;; *) printf 'Invalid action for %s: %s\n' "$id" "$action" >&2; return 2 ;; esac
    [[ "$id" == "$wanted" ]] && { printf '%s' "$action"; return 0; }
  done
  return 1
}

component_action() {
  local id="$1" label="$2" state="$3" installed="$4" available action= answer default
  available="$(available_version "$id")"
  if action="$(explicit_action "$id")"; then :
  elif [[ -n "$preset" ]]; then
    afyx_control_classify "$id" "$state" "$preset" "$custom_component_list"
    if [[ "$AFYX_DESIRED" != true || "$AFYX_DRIFT" == NOT_APPLICABLE ]]; then action=skip
    elif [[ "$AFYX_REPAIR" == BLOCKED ]]; then printf '%s drift is %s with actual ownership %s; automatic takeover is forbidden.\n' "$label" "$AFYX_DRIFT" "$AFYX_ACTUAL_OWNERSHIP" >&2; return 2
    elif [[ "$AFYX_REPAIR" == INSTALL ]]; then action=install
    elif [[ "$AFYX_REPAIR" == REPAIR ]]; then action=repair
    elif [[ "$state" == HEALTHY && -n "$available" && -n "$installed" ]] && version_lt "$installed" "$available"; then action=update
    else action=skip; fi
  elif [[ "$id" == prompt-master ]]; then action=skip
  elif "$force"; then
    if [[ "$state" == UNKNOWN ]]; then printf '%s ownership is unknown; --force cannot take ownership.\n' "$label" >&2; return 2
    elif [[ "$state" == 'NOT INSTALLED' ]]; then action=install
    elif [[ "$state" == INCOMPLETE || "$state" == INVALID || "$state" == DRIFTED ]]; then action=repair
    else action=update; fi
  elif "$update_installed"; then
    if [[ "$state" == INCOMPLETE || "$state" == INVALID || "$state" == DRIFTED ]]; then action=repair
    elif [[ "$state" == HEALTHY && -n "$available" && -n "$installed" ]] && version_lt "$installed" "$available"; then action=update
    else action=skip; fi
  elif ! "$interactive" || "$dry_run"; then action=skip
  elif [[ "$state" == 'NOT INSTALLED' ]]; then
    read -r -p "$label is not installed. installed=$installed available=$available [I] Install / [S] Skip [S]: " answer || answer=
    case "$answer" in [iI]|[iI][nN][sS][tT][aA][lL][lL]) action=install ;; *) action=skip ;; esac
  elif [[ "$state" == HEALTHY ]]; then
    default=S; [[ -n "$available" && -n "$installed" ]] && version_lt "$installed" "$available" && default=U
    read -r -p "$label is healthy. installed=$installed available=$available [U] Update / [S] Skip [$default]: " answer || answer=
    case "$answer" in [uU]|[uU][pP][dD][aA][tT][eE]) action=update ;; '') [[ "$default" == U ]] && action=update || action=skip ;; *) action=skip ;; esac
  elif [[ "$state" == INCOMPLETE || "$state" == INVALID || "$state" == DRIFTED ]]; then
    read -r -p "$label is $state [R] Repair / [S] Skip [S]: " answer || answer=
    case "$answer" in [rR]|[rR][eE][pP][aA][iI][rR]) action=repair ;; *) action=skip ;; esac
  else
    read -r -p "$label ownership/health is unknown. [A] Adopt verified legacy install / [S] Skip [S]: " answer || answer=
    case "$answer" in [aA]|[aA][dD][oO][pP][tT]) action=adopt ;; *) action=skip ;; esac
  fi
  case "$state:$action" in
    'NOT INSTALLED':install|'NOT INSTALLED':skip|HEALTHY:update|HEALTHY:adopt|HEALTHY:skip|INCOMPLETE:repair|INCOMPLETE:skip|INVALID:repair|INVALID:skip|DRIFTED:repair|DRIFTED:skip|UNKNOWN:adopt|UNKNOWN:skip) ;;
    *) printf '%s state %s does not permit action %s.\n' "$label" "$state" "$action" >&2; return 2 ;;
  esac
  printf '%s' "$action"
}

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

replacement_authorized() {
  local id="$1" specification
  "$force" && return 0
  if [[ -n "$preset" ]] && afyx_component_desired "$id" "$preset" "$custom_component_list"; then return 0; fi
  for specification in ${component_actions[@]+"${component_actions[@]}"}; do
    [[ "$specification" == "$id="* && "$specification" != "$id=skip" ]] && return 0
  done
  return 1
}

safe_skill_install() {
  local component="$1" label="$2" source="$3" target="$4" replace="$5" parent stage version authorize=false
  if [[ -e "$target" && "$replace" != true ]]; then printf skipped; return; fi
  if "$dry_run"; then printf 'planned'; return; fi
  parent="$(dirname "$target")"; afyx_assert_skill_target "$skills_root" "$target"
  stage="$(mktemp -d "$parent/.skill-stage.XXXXXX")"
  if ! cp -a "$source/." "$stage/"; then rm -rf -- "$stage"; return 1; fi
  version="$(afyx_skill_version "$source")"
  replacement_authorized "$component" && authorize=true
  if ! afyx_promote_skill "$component" "$label" "$stage" "$target" afyx "$version" '' '' "$authorize"; then
    [[ -e "$stage" ]] && rm -rf -- "$stage"
    return 1
  fi
  if [[ "$replace" == true ]]; then printf replaced; else printf installed; fi
}

adopt_legacy_skill() {
  local component="$1" label="$2" target="$3" owner legacy_version legacy_digest repository revision provenance
  owner="$(afyx_component_field "$component" ownership)"
  legacy_version="$(afyx_component_field "$component" legacy_version)"
  legacy_digest="$(afyx_component_field "$component" legacy_content_digest_bash)"
  repository="$(afyx_component_field "$component" source)"
  revision="$(afyx_component_field "$component" source_revision)"
  afyx_classify_skill "$target" "$component" "$owner"
  if [[ "$AFYX_OWNERSHIP_STATE" == AFYX_OWNED_UNMODIFIED || "$AFYX_OWNERSHIP_STATE" == EXTERNAL_UPSTREAM ]]; then
    printf 'already adopted'; return 0
  fi
  afyx_legacy_skill_provenance "$target" "$component" "$owner" "$legacy_digest" "$legacy_version" "$repository" "$revision"
  provenance="$AFYX_LEGACY_PROVENANCE"
  [[ "$provenance" == MATCH ]] || { printf 'Refusing to adopt %s because legacy provenance is %s.\n' "$label" "$provenance" >&2; return 1; }
  if "$dry_run"; then printf 'planned adoption'; return 0; fi
  afyx_adopt_legacy_skill "$component" "$target" "$owner" "$legacy_version" "$legacy_digest" "$legacy_version" "$repository" "$revision"
}

stage_prompt_master() {
  local stage="$1" head
  git init -q "$stage" || return 1
  git -C "$stage" remote add origin "$PROMPT_MASTER_REPOSITORY" || return 1
  git -C "$stage" fetch -q --depth 1 origin "$PROMPT_MASTER_REVISION" || return 1
  git -C "$stage" checkout -q --detach FETCH_HEAD || return 1
  head="$(git -C "$stage" rev-parse HEAD)" || return 1
  [[ "$head" == "$PROMPT_MASTER_REVISION" ]] || { printf 'Prompt Master revision verification failed.\n' >&2; return 1; }
  afyx_skill_manifest_check "$stage" false
}

valid_manifest "$BUNDLED_EFFICIENT" || { printf 'Bundled Efficient Coding is invalid.\n' >&2; exit 1; }
valid_manifest "$BUNDLED_ODOO" || { printf 'Bundled Odoo Engineering is invalid.\n' >&2; exit 1; }
valid_manifest "$BUNDLED_EXPERT" || { printf 'Bundled Afyx Engineering Expert is invalid.\n' >&2; exit 1; }
[[ -s "$PACKAGE_ROOT/afyx-graph/afyx-graph.json" ]] || { printf 'Bundled Afyx Graph metadata is missing.\n' >&2; exit 1; }

efficient_target="$skills_root/efficient-coding"
odoo_target="$skills_root/odoo-engineering"
prompt_target="$skills_root/prompt-master"
expert_target="$skills_root/afyx-engineering-expert"
efficient_state="$(component_state efficient-coding)"
odoo_state="$(component_state odoo-engineering)"
prompt_state="$(component_state prompt-master)"
expert_state="$(component_state afyx-engineering-expert)"
afyx_graph_state="$(component_state afyx-graph)"

printf '\nComponent Inventory\n'
printf 'Efficient Coding: %s; installed=%s; available=%s; ownership=afyx\n' "$efficient_state" "$(component_version efficient-coding)" "$(available_version efficient-coding)"
printf 'Odoo Engineering: %s; installed=%s; available=%s; ownership=afyx\n' "$odoo_state" "$(component_version odoo-engineering)" "$(available_version odoo-engineering)"
printf 'Afyx Engineering Expert: %s; installed=%s; available=%s; ownership=afyx\n' "$expert_state" "$(component_version afyx-engineering-expert)" "$(available_version afyx-engineering-expert)"
printf 'Prompt Master: %s; installed=%s; available=external; ownership=upstream\n' "$prompt_state" "$(component_version prompt-master)"
printf 'Afyx Graph: %s; installed=%s; available=%s; ownership=afyx\n' "$afyx_graph_state" "$(component_version afyx-graph)" "$(available_version afyx-graph)"
printf 'Usage Tracking: NOT INSTALLED (Windows-only runtime)\n'
if command -v headroom >/dev/null 2>&1; then printf 'Headroom: externally managed; detected\n'; else printf 'Headroom: externally managed; not detected\n'; fi
if [[ -n "$preset" ]]; then
  printf '\nDesired State Plan: %s\n' "$(afyx_control_plan_identity "$preset" "$custom_component_list")"
  for plan_id in $(afyx_component_ids); do
    plan_state="$(component_state "$plan_id")"
    afyx_control_classify "$plan_id" "$plan_state" "$preset" "$custom_component_list"
    printf '%s: desired=%s; actual=%s; drift=%s; ownership=%s; repair=%s\n' "$plan_id" "$AFYX_DESIRED" "$plan_state" "$AFYX_DRIFT" "$AFYX_ACTUAL_OWNERSHIP" "$AFYX_REPAIR"
  done
fi

codex_cli_detected=false; command -v codex >/dev/null 2>&1 && codex_cli_detected=true
vscode_extension_detected=false
for extension in "$HOME"/.vscode/extensions/openai.chatgpt-*; do [[ -d "$extension" ]] && { vscode_extension_detected=true; break; }; done

printf '\nPrerequisite Inventory\n'
printf '[REQUIRED] OS/architecture: %s / %s\n' "$(uname -s)" "$(uname -m)"
printf '[REQUIRED] Platform shell: Bash %s\n' "$BASH_VERSION"
if command -v git >/dev/null 2>&1; then printf '[REQUIRED] Git: %s\n' "$(git --version)"; else printf '[REQUIRED] Git: MISSING — install Git with the documented OS package manager\n'; fi
if "$codex_cli_detected" || "$vscode_extension_detected"; then printf '[REQUIRED] Codex host: detected\n'; else printf '[REQUIRED] Codex host: MISSING — install Codex CLI or the supported VS Code extension\n'; fi
if command -v node >/dev/null 2>&1; then printf '[COMPONENT_REQUIRED:Afyx Graph] Node.js >=22.5.0: %s\n' "$(node --version)"; else printf '[COMPONENT_REQUIRED:Afyx Graph] Node.js >=22.5.0: MISSING — install from https://nodejs.org/\n'; fi
if command -v npm >/dev/null 2>&1; then printf '[BUILD_ONLY:Afyx Graph] npm: %s\n' "$(npm --version)"; else printf '[BUILD_ONLY:Afyx Graph] npm: MISSING — needed only for automatic local fallback\n'; fi
printf '[COMPONENT_REQUIRED:Afyx Graph] Archive/checksum: tar + SHA-256 tool required\n'
if command -v git >/dev/null 2>&1 && git -C "$PACKAGE_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  graph_channel="$(sed -n 's/^[[:space:]]*"releaseChannel"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PACKAGE_ROOT/afyx-graph/engine/scripts/distribution-product.json" | head -n 1)"
  printf 'Source: branch=%s; commit=%s; channel=%s\n' "$(git -C "$PACKAGE_ROOT" branch --show-current)" "$(git -C "$PACKAGE_ROOT" rev-parse HEAD)" "$graph_channel"
fi

if "$validate_only"; then
  graph_version="$(sed -n 's/.*"product_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PACKAGE_ROOT/afyx-graph/afyx-graph.json")"
  printf 'BundledEfficientCoding: true\nInstalledEfficientCoding: %s\nEfficientCodingState: %s\nEfficientCodingVersion: %s\n' "$([[ "$efficient_state" == HEALTHY ]] && echo true || echo false)" "$efficient_state" "$(component_version efficient-coding)"
  printf 'BundledOdooEngineering: true\nInstalledOdooEngineering: %s\nOdooEngineeringState: %s\nOdooEngineeringVersion: %s\n' "$([[ "$odoo_state" == HEALTHY ]] && echo true || echo false)" "$odoo_state" "$(component_version odoo-engineering)"
  printf 'BundledAfyxEngineeringExpert: true\nInstalledAfyxEngineeringExpert: %s\nAfyxEngineeringExpertState: %s\nAfyxEngineeringExpertVersion: %s\n' "$([[ "$expert_state" == HEALTHY ]] && echo true || echo false)" "$expert_state" "$(component_version afyx-engineering-expert)"
  printf 'InstalledPromptMaster: %s\nPromptMasterState: %s\n' "$([[ "$prompt_state" == HEALTHY ]] && echo true || echo false)" "$prompt_state"
  printf 'BundledAfyxGraphSource: true\nInstalledAfyxGraph: %s\nAfyxGraphState: %s\nAfyxGraphVersion: %s\n' "$([[ "$afyx_graph_state" == HEALTHY ]] && echo true || echo false)" "$afyx_graph_state" "$graph_version"
  printf 'InstalledUsageTracker: false\nUsageTrackerState: NOT INSTALLED\nCodexCliDetected: %s\nVsCodeExtensionDetected: %s\n' "$codex_cli_detected" "$vscode_extension_detected"
  exit 0
fi

if [[ -n "$preset" ]]; then
  blocked_plan=
  for plan_id in $(afyx_component_ids); do
    plan_state="$(component_state "$plan_id")"
    afyx_control_classify "$plan_id" "$plan_state" "$preset" "$custom_component_list"
    if [[ "$AFYX_DESIRED" == true && "$AFYX_REPAIR" == BLOCKED ]]; then
      blocked_plan="${blocked_plan:+$blocked_plan, }$plan_id:$AFYX_DRIFT:$AFYX_ACTUAL_OWNERSHIP"
    fi
  done
  [[ -z "$blocked_plan" ]] || { printf 'Desired-state plan is blocked before mutation: %s\n' "$blocked_plan" >&2; exit 1; }
fi

if ! "$codex_cli_detected" && ! "$vscode_extension_detected"; then printf 'Neither Codex CLI nor the ChatGPT/Codex VS Code extension was detected.\n' >&2; exit 1; fi
command -v git >/dev/null 2>&1 || { printf 'Git is required for Afyx source validation and lifecycle updates.\n' >&2; exit 1; }
run mkdir -p "$skills_root"

efficient_action="$(component_action efficient-coding 'Efficient Coding' "$efficient_state" "$(component_version efficient-coding)")"
odoo_action="$(component_action odoo-engineering 'Odoo Engineering' "$odoo_state" "$(component_version odoo-engineering)")"
expert_action="$(component_action afyx-engineering-expert 'Afyx Engineering Expert' "$expert_state" "$(component_version afyx-engineering-expert)")"
efficient_result=skipped
odoo_result=skipped
expert_result=skipped
if [[ "$efficient_action" == adopt ]]; then efficient_result="$(adopt_legacy_skill efficient-coding 'Efficient Coding' "$efficient_target")"
elif [[ "$efficient_action" != skip ]]; then efficient_result="$(safe_skill_install efficient-coding 'Efficient Coding' "$BUNDLED_EFFICIENT" "$efficient_target" "$([[ "$efficient_action" == install ]] && printf false || printf true)")"; fi
if [[ "$odoo_action" == adopt ]]; then odoo_result="$(adopt_legacy_skill odoo-engineering 'Odoo Engineering' "$odoo_target")"
elif [[ "$odoo_action" != skip ]]; then odoo_result="$(safe_skill_install odoo-engineering 'Odoo Engineering' "$BUNDLED_ODOO" "$odoo_target" "$([[ "$odoo_action" == install ]] && printf false || printf true)")"; fi
if [[ "$expert_action" == adopt ]]; then
  printf 'Afyx Engineering Expert has no trusted legacy provenance and cannot be adopted.\n' >&2
  exit 1
elif [[ "$expert_action" != skip ]]; then expert_result="$(safe_skill_install afyx-engineering-expert 'Afyx Engineering Expert' "$BUNDLED_EXPERT" "$expert_target" "$([[ "$expert_action" == install ]] && printf false || printf true)")"; fi

prompt_result=skipped
prompt_action="$(component_action prompt-master 'Prompt Master' "$prompt_state" "$(component_version prompt-master)")"
if [[ "$offline" == true && "$prompt_action" != skip && "$prompt_action" != adopt ]]; then
  printf 'Offline mode cannot install or update upstream-owned Prompt Master. Choose prompt-master=skip or retry with network access.\n' >&2
  exit 1
fi
if [[ "$prompt_action" == skip ]]; then :
elif [[ "$prompt_action" == adopt ]]; then
  prompt_result="$(adopt_legacy_skill prompt-master 'Prompt Master' "$prompt_target")"
elif [[ "$prompt_state" == 'NOT INSTALLED' ]]; then
  if "$dry_run"; then prompt_result=planned
  else
    afyx_assert_skill_target "$skills_root" "$prompt_target"
    prompt_stage="$(mktemp -d "$(dirname "$prompt_target")/.prompt-stage.XXXXXX")"
    if ! stage_prompt_master "$prompt_stage" || ! afyx_promote_skill prompt-master 'Prompt Master' "$prompt_stage" "$prompt_target" upstream '' "$PROMPT_MASTER_REPOSITORY" "$PROMPT_MASTER_REVISION" false; then
      [[ -e "$prompt_stage" ]] && rm -rf -- "$prompt_stage"
      exit 1
    fi
    prompt_result=installed
  fi
else
  if "$dry_run"; then prompt_result=planned
  else
    afyx_assert_skill_target "$skills_root" "$prompt_target"
    prompt_stage="$(mktemp -d "$(dirname "$prompt_target")/.prompt-stage.XXXXXX")"
    authorize=false; replacement_authorized prompt-master && authorize=true
    if ! stage_prompt_master "$prompt_stage" || ! afyx_promote_skill prompt-master 'Prompt Master' "$prompt_stage" "$prompt_target" upstream '' "$PROMPT_MASTER_REPOSITORY" "$PROMPT_MASTER_REVISION" "$authorize"; then
      [[ -e "$prompt_stage" ]] && rm -rf -- "$prompt_stage"
      exit 1
    fi
    prompt_result=replaced
  fi
fi

graph_result=skipped
graph_action="$(component_action afyx-graph 'Afyx Graph' "$afyx_graph_state" "$(component_version afyx-graph)")"
if [[ "$graph_action" != skip ]]; then
  graph_args=()
  [[ "$graph_action" == update ]] && graph_args+=(--update)
  [[ "$graph_action" == repair ]] && graph_args+=(--replace)
  "$offline" && graph_args+=(--offline)
  "$no_build_fallback" && graph_args+=(--no-build-fallback)
  "$allow_dirty_source" && graph_args+=(--allow-dirty-source)
  if "$skip_graph_mcp"; then graph_args+=(--skip-mcp); else graph_args+=(--configure-mcp); fi
  "$dry_run" && graph_args+=(--validate-only)
  "$PACKAGE_ROOT/scripts/install-afyx-graph.sh" "${graph_args[@]}"
  graph_result="$graph_action"
fi

printf '\nInstallation Summary\n[%s] Efficient Coding\n[%s] Odoo Engineering\n[%s] Afyx Engineering Expert\n[%s] Prompt Master\n[%s] Afyx Graph\n[SKIPPED] Usage Tracking (Windows-only)\n' "$efficient_result" "$odoo_result" "$expert_result" "$prompt_result" "$graph_result"
printf '[INFO] Headroom — externally managed; unchanged\n'
"$dry_run" && printf 'Dry-run completed; no files or configuration were changed.\n' || printf 'Start a new Codex session to load installed components.\n'
