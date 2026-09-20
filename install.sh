#!/usr/bin/env bash
set -euo pipefail

readonly PACKAGE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly BUNDLED_EFFICIENT="$PACKAGE_ROOT/skills/efficient-coding"
readonly DEFAULT_SKILLS_ROOT="${CODEX_SKILLS_ROOT:-$HOME/.agents/skills}"
readonly PROMPT_MASTER_REPOSITORY="https://github.com/nidhinjs/prompt-master.git"

printf 'Afyx Codex Engineering Kit — Linux/macOS installer (Bash)\n'

skills_root="$DEFAULT_SKILLS_ROOT"
force=false
validate_only=false
dry_run=false

usage() {
  cat <<'EOF'
Usage: ./install.sh [--skills-root PATH] [--force] [--validate-only] [--dry-run]

Installs Efficient Coding and Prompt Master without changing Codex config,
authentication, providers, MCP servers, or plugins.
EOF
}

run() {
  if "$dry_run"; then
    printf '+ '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

valid_manifest() {
  [[ -f "$1/SKILL.md" ]] && [[ "$(head -n 1 "$1/SKILL.md")" == '---' ]]
}

backup_directory() {
  local source="$1"
  local backup_root="$PACKAGE_ROOT/backups"
  local stamp destination
  stamp="$(date +%Y%m%d-%H%M%S)"
  destination="$backup_root/$(basename "$source")-$stamp"
  run mkdir -p "$backup_root"
  run cp -a "$source" "$destination"
  printf 'Backup created: %s\n' "$destination"
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

command -v git >/dev/null || { printf 'Git is required for Prompt Master.\n' >&2; exit 1; }
codex_cli_detected=false
command -v codex >/dev/null && codex_cli_detected=true
vscode_extension_detected=false
for extension in "$HOME"/.vscode/extensions/openai.chatgpt-*; do
  [[ -d "$extension" ]] && { vscode_extension_detected=true; break; }
done
if ! "$codex_cli_detected" && ! "$vscode_extension_detected"; then
  printf 'Neither Codex CLI nor the ChatGPT/Codex VS Code extension was detected.\n' >&2
  exit 1
fi
if "$codex_cli_detected" && "$vscode_extension_detected"; then
  printf 'Environment: Codex CLI and VS Code extension detected\n'
elif "$codex_cli_detected"; then
  printf 'Environment: Codex CLI detected\n'
else
  printf 'Environment: VS Code extension detected\n'
fi
valid_manifest "$BUNDLED_EFFICIENT" || { printf 'Bundled Efficient Coding is invalid.\n' >&2; exit 1; }

efficient_target="$skills_root/efficient-coding"
prompt_target="$skills_root/prompt-master"

if "$validate_only"; then
  printf 'Bundled Efficient Coding: %s\n' "$(valid_manifest "$BUNDLED_EFFICIENT" && echo yes || echo no)"
  printf 'Installed Efficient Coding: %s\n' "$(valid_manifest "$efficient_target" && echo yes || echo no)"
  printf 'Installed Prompt Master: %s\n' "$(valid_manifest "$prompt_target" && echo yes || echo no)"
  printf 'Headroom available: %s\n' "$(command -v headroom >/dev/null && echo yes || echo no)"
  printf 'CodeGraph available: %s\n' "$(command -v codegraph >/dev/null && echo yes || echo no)"
  printf 'Codex CLI detected: %s\n' "$codex_cli_detected"
  printf 'VS Code extension detected: %s\n' "$vscode_extension_detected"
  exit 0
fi

run mkdir -p "$skills_root"

if [[ -e "$efficient_target" ]]; then
  "$force" || { printf 'Efficient Coding already exists: %s. Re-run with --force to back it up and replace it.\n' "$efficient_target" >&2; exit 1; }
  backup_directory "$efficient_target"
  run rm -rf -- "$efficient_target"
fi
run mkdir -p "$efficient_target"
run cp -a "$BUNDLED_EFFICIENT/." "$efficient_target/"

if [[ -e "$prompt_target" ]]; then
  if [[ -d "$prompt_target/.git" ]]; then
    run git -C "$prompt_target" pull --ff-only
  elif "$force"; then
    backup_directory "$prompt_target"
    run rm -rf -- "$prompt_target"
    run git clone --depth 1 "$PROMPT_MASTER_REPOSITORY" "$prompt_target"
  else
    printf 'Prompt Master exists but is not a Git checkout: %s. Re-run with --force to back it up and replace it.\n' "$prompt_target" >&2
    exit 1
  fi
else
  run git clone --depth 1 "$PROMPT_MASTER_REPOSITORY" "$prompt_target"
fi

if ! "$dry_run"; then
  valid_manifest "$efficient_target" || { printf 'Installed Efficient Coding validation failed.\n' >&2; exit 1; }
  valid_manifest "$prompt_target" || { printf 'Installed Prompt Master validation failed.\n' >&2; exit 1; }
fi

printf 'Efficient Coding: installed\nPrompt Master: installed\n'
if command -v headroom >/dev/null; then
  printf 'Headroom: detected (configuration unchanged)\n'
else
  printf 'Headroom: not found; see https://github.com/headroomlabs-ai/headroom\n'
fi
printf 'Start a new Codex session to load the skills.\n'
