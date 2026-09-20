#!/usr/bin/env bash
set -euo pipefail

skills_root="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
remove_prompt_master=false
dry_run=false

usage() {
  printf '%s\n' 'Usage: ./uninstall.sh [--skills-root PATH] [--remove-prompt-master] [--dry-run]'
}

while (($#)); do
  case "$1" in
    --skills-root) skills_root="$2"; shift 2 ;;
    --remove-prompt-master) remove_prompt_master=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

remove_target() {
  local target="$1"
  [[ -e "$target" ]] || return 0
  if "$dry_run"; then
    printf '+ rm -rf -- %q\n' "$target"
  else
    rm -rf -- "$target"
    printf 'Removed: %s\n' "$target"
  fi
}

remove_target "$skills_root/efficient-coding"
if "$remove_prompt_master"; then
  remove_target "$skills_root/prompt-master"
fi
printf 'Headroom and Codex configuration were not changed.\n'
