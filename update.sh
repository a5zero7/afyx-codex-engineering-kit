#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
printf 'Afyx Codex Engineering Kit — Linux/macOS updater (Bash)\n'
skip_self_update=false
args=()
while (($#)); do
  case "$1" in
    --skip-self-update) skip_self_update=true; shift ;;
    *) args+=("$1"); shift ;;
  esac
done
if "$skip_self_update"; then
  printf 'Self-update skipped by --skip-self-update.\n'
elif git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ -n "$(git -C "$root" status --porcelain)" ]]; then
    printf 'Self-update skipped: repository has local changes.\n' >&2
  else
    printf 'Updating repository (fast-forward only)...\n'
    git -C "$root" pull --ff-only || { printf 'Self-update failed; no installer changes were run.\n' >&2; exit 1; }
  fi
else
  printf 'Self-update unavailable: source is not a Git repository. Continuing with current source.\n'
fi
exec "$root/install.sh" --force "${args[@]}"
