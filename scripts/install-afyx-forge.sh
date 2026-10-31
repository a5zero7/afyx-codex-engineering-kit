#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ROOT="$PACKAGE_ROOT/afyx-forge"
runtime_root="${AFYX_FORGE_RUNTIME_ROOT:-$HOME/.afyx/forge}"
update=false; repair=false; verify=false; uninstall=false; validate_only=false

while (($#)); do
  case "$1" in
    --runtime-root) (($# >= 2)) || { printf '%s\n' '--runtime-root requires a value.' >&2; exit 2; }; runtime_root="$2"; shift 2 ;;
    --update) update=true; shift ;;
    --repair) repair=true; shift ;;
    --verify) verify=true; shift ;;
    --uninstall) uninstall=true; shift ;;
    --validate-only) validate_only=true; shift ;;
    -h|--help) printf '%s\n' 'Usage: install-afyx-forge.sh [--runtime-root PATH] [--update|--repair|--verify|--uninstall|--validate-only]'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
done

recovery_root="${runtime_root}.afyx-old"

# Path Safety & Canonical Ownership Validation
case "$runtime_root" in
  /*|[A-Za-z]:/*|[A-Za-z]:\\*) ;;
  *) printf '%s\n' 'Afyx Forge runtime root must be absolute.' >&2; exit 1 ;;
esac

case "$runtime_root" in
  /|[A-Za-z]:/|[A-Za-z]:\\|[A-Za-z]:) printf '%s\n' 'Afyx Forge runtime root cannot be a filesystem root.' >&2; exit 1 ;;
esac

case "$runtime_root" in
  *\.\.*|*\\..\\*|*/../*) printf '%s\n' 'Afyx Forge runtime root must not contain traversal segments.' >&2; exit 1 ;;
esac

normalize_path() {
  local p="$1"
  if [[ -d "$p" ]]; then
    (cd "$p" && pwd)
  else
    local parent
    parent="$(dirname "$p")"
    if [[ -d "$parent" ]]; then
      printf '%s/%s\n' "$(cd "$parent" && pwd)" "$(basename "$p")"
    else
      printf '%s\n' "$p"
    fi
  fi
}

CANONICAL_SOURCE="$(normalize_path "$SOURCE_ROOT")"
CANONICAL_RUNTIME="$(normalize_path "$runtime_root")"

case "$CANONICAL_RUNTIME/" in "$CANONICAL_SOURCE/"*) printf '%s\n' 'Afyx Forge runtime root must not overlap bundled source.' >&2; exit 1 ;; esac
case "$CANONICAL_SOURCE/" in "$CANONICAL_RUNTIME/"*) printf '%s\n' 'Afyx Forge runtime root must not contain bundled source.' >&2; exit 1 ;; esac

for candidate in "$runtime_root" "$recovery_root"; do
  probe="$candidate"
  while [[ "$probe" != / && "$probe" != . && -n "$probe" && ! "$probe" =~ ^[A-Za-z]:[/\\]?$ ]]; do
    [[ ! -L "$probe" ]] || { printf 'Afyx Forge runtime path must not traverse a symbolic link: %s\n' "$probe" >&2; exit 1; }
    next_probe="$(dirname "$probe")"
    [[ "$next_probe" != "$probe" ]] || break
    probe="$next_probe"
  done
done

owned_runtime() {
  local root="$1" metadata="$1/metadata.json"
  [[ -f "$metadata" ]] || return 1
  grep -q '"product_name"[[:space:]]*:[[:space:]]*"Afyx Forge Core"' "$metadata" || return 1
  grep -q '"ownership_class"[[:space:]]*:[[:space:]]*"AFYX"' "$metadata" || return 1
  return 0
}

healthy_runtime() {
  local root="$1"
  owned_runtime "$root" || return 1
  [[ -f "$root/current/bin/afyx-forge.js" || -f "$root/current/bin/afyx-forge" ]] || return 1
  [[ -f "$root/bin/afyx-forge" ]] || return 1
  return 0
}

# Transaction Recovery Check
if [[ -e "$recovery_root" ]]; then
  [[ ! -e "$runtime_root" ]] || { printf '%s\n' 'Interrupted Afyx Forge transaction is ambiguous; runtime and recovery both exist.' >&2; exit 1; }
  owned_runtime "$recovery_root" || { printf '%s\n' 'Interrupted Afyx Forge recovery ownership is invalid.' >&2; exit 1; }
  if "$validate_only" || "$verify" || "$uninstall"; then printf '%s\n' 'Afyx Forge recovery is pending; read-only/uninstall operation will not mutate it.' >&2; exit 1; fi
  mv -- "$recovery_root" "$runtime_root"
  printf 'Recovered interrupted Afyx Forge transaction at %s.\n' "$runtime_root"
fi

# Determine Current State
if [[ ! -e "$runtime_root" ]]; then
  state='NOT INSTALLED'
elif healthy_runtime "$runtime_root"; then
  state='HEALTHY'
elif owned_runtime "$runtime_root"; then
  state='BROKEN'
else
  state='UNKNOWN'
fi

if "$validate_only" || "$verify"; then
  printf 'Component: afyx-forge\nState: %s\nRuntimeRoot: %s\nVersion: 0.1.0\n' "$state" "$runtime_root"
  "$verify" && [[ "$state" != HEALTHY ]] && exit 1
  exit 0
fi

if "$uninstall"; then
  [[ "$state" == 'NOT INSTALLED' ]] && { printf '%s\n' 'Afyx Forge Core is already not installed.'; exit 0; }
  [[ "$state" == HEALTHY || "$state" == BROKEN ]] || { printf 'Refusing to uninstall foreign or unverified directory at %s (state: %s).\n' "$runtime_root" "$state" >&2; exit 1; }
  rm -rf -- "$runtime_root"
  printf 'Afyx Forge Core: uninstalled from %s\n' "$runtime_root"
  exit 0
fi

command -v node >/dev/null 2>&1 || { printf '%s\n' 'Node.js is required for Afyx Forge Core.' >&2; exit 1; }

[[ "$state" != UNKNOWN ]] || { printf 'Refusing to replace foreign or unowned directory at %s.\n' "$runtime_root" >&2; exit 1; }
[[ "$state" != HEALTHY || "$update" == true || "$repair" == true ]] || { printf 'Afyx Forge Core: already installed and HEALTHY at %s. Use --update or --repair to reinstall.\n' "$runtime_root"; exit 0; }
if [[ "$state" == 'NOT INSTALLED' ]] && { "$update" || "$repair"; }; then
  printf '%s\n' 'Update/repair requires an existing Afyx Forge runtime.' >&2
  exit 1
fi

parent="$(dirname "$runtime_root")"
mkdir -p -- "$parent"
prepared="$(mktemp -d "$parent/.forge-stage.XXXXXX")"
swapped=false

cleanup() {
  local status=$?
  if [[ -e "$prepared" ]]; then
    rm -rf -- "$prepared" || true
  fi
  return "$status"
}
trap cleanup EXIT

mkdir -p -- "$prepared/current"
cp -R "$SOURCE_ROOT/"* "$prepared/current/"

mkdir -p -- "$prepared/bin"
cat << 'EOF' > "$prepared/bin/afyx-forge"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/../current/bin/afyx-forge.js" "$@"
EOF
chmod +x "$prepared/bin/afyx-forge"

cat << EOF > "$prepared/metadata.json"
{
  "product_name": "Afyx Forge Core",
  "product_version": "0.1.0",
  "ownership_class": "AFYX",
  "release_channel": "technical-alpha",
  "installed_at": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}
EOF

# Pre-swap verification
healthy_runtime "$prepared" || { printf '%s\n' 'Staged Afyx Forge runtime failed integrity validation.' >&2; exit 1; }

# Swap with fail-closed recovery
if [[ -e "$runtime_root" ]]; then
  mv -- "$runtime_root" "$recovery_root"
fi

if mv -- "$prepared" "$runtime_root"; then
  swapped=true
  prepared="$parent/.forge-stage-consumed"
else
  [[ ! -e "$recovery_root" ]] || mv -- "$recovery_root" "$runtime_root"
  printf '%s\n' 'Failed to swap staged Afyx Forge runtime into destination.' >&2
  exit 1
fi

# Post-swap verification
if ! healthy_runtime "$runtime_root"; then
  "$swapped" && rm -rf -- "$runtime_root"
  [[ ! -e "$recovery_root" ]] || mv -- "$recovery_root" "$runtime_root"
  printf '%s\n' 'Installed Afyx Forge runtime failed post-swap verification; previous state preserved.' >&2
  exit 1
fi

[[ ! -e "$recovery_root" ]] || rm -rf -- "$recovery_root"

printf 'Afyx Forge Core 0.1.0: successfully installed at %s\n' "$runtime_root"
exit 0
