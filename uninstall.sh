#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
remove_prompt_master=false
remove_afyx_graph=false
dry_run=false
selected_components=()

printf 'Afyx Codex Engineering Kit — Linux/macOS uninstaller (Bash)\n'

usage() {
  printf '%s\n' 'Usage: ./uninstall.sh [--skills-root PATH] [--component AFYX-SKILL-ID] [--remove-prompt-master] [--remove-afyx-graph] [--dry-run]'
}

while (($#)); do
  case "$1" in
    --skills-root) (($# >= 2)) || { printf '%s\n' '--skills-root requires a value.' >&2; exit 2; }; skills_root="$2"; shift 2 ;;
    --component) (($# >= 2)) || { printf '%s\n' '--component requires a value.' >&2; exit 2; }; selected_components+=("$2"); shift 2 ;;
    --remove-prompt-master) remove_prompt_master=true; shift ;;
    --remove-afyx-graph) remove_afyx_graph=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

# One component truth: scripts/components.json. Afyx-owned skills are always removed;
# the upstream-owned skill (Prompt Master) only on explicit request.
# shellcheck source=scripts/lib/afyx-components.sh
. "$root/scripts/lib/afyx-components.sh"
. "$root/scripts/lib/afyx-skill-lifecycle.sh"
component_selected() {
  local wanted="$1" selected
  ((${#selected_components[@]} == 0)) && return 0
  for selected in "${selected_components[@]}"; do [[ "$selected" == "$wanted" ]] && return 0; done
  return 1
}
for selected in "${selected_components[@]}"; do
  [[ "$(afyx_component_field "$selected" type)" == skill && "$(afyx_component_field "$selected" ownership)" == afyx ]] || {
    printf 'Unknown or non-removable Afyx skill component: %s\n' "$selected" >&2
    exit 2
  }
done
for component_id in $(afyx_component_ids); do
  [[ "$(afyx_component_field "$component_id" type)" == skill ]] || continue
  ownership="$(afyx_component_field "$component_id" ownership)"
  if { [[ "$ownership" == afyx ]] && component_selected "$component_id"; } || { [[ "$ownership" == upstream ]] && "$remove_prompt_master"; }; then
    target="$(afyx_component_root "$component_id")"
    if "$dry_run"; then
      afyx_classify_skill "$target" "$component_id" "$ownership"
      case "$AFYX_OWNERSHIP_STATE" in
        NOT_INSTALLED) ;;
        AFYX_OWNED_UNMODIFIED|EXTERNAL_UPSTREAM) printf '+ ownership-verified remove %q\n' "$target" ;;
        *) printf 'Refusing to remove %s because installed ownership is %s.\n' "$target" "$AFYX_OWNERSHIP_STATE" >&2; exit 1 ;;
      esac
    else
      afyx_remove_skill "$component_id" "$target" "$ownership"
    fi
  fi
done
if [[ -e "$graph_root" ]]; then
  if ! "$remove_afyx_graph" && [[ -t 0 && -z "${CI:-}" ]] && ! "$dry_run"; then
    read -r -p 'Afyx Graph detected. Remove Afyx Graph? [Y/N] [N]: ' answer || answer=
    case "$answer" in [yY]|[yY][eE][sS]) remove_afyx_graph=true ;; esac
  fi
  if "$remove_afyx_graph"; then
    if "$dry_run"; then printf '+ scripts/install-afyx-graph.sh --uninstall\n'; else "$root/scripts/install-afyx-graph.sh" --uninstall; fi
  else printf 'Afyx Graph: kept\n'; fi
fi
printf 'Project indexes, Headroom, and Codex configuration were not changed.\n'
