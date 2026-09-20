#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
printf 'Afyx Codex Engineering Kit — Linux/macOS updater (Bash)\n'
exec "$root/install.sh" --force "$@"
