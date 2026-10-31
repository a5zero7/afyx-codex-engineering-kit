#!/usr/bin/env bash
set -euo pipefail

RUNTIME_ROOT="${AFYX_FORGE_RUNTIME_ROOT:-$HOME/.afyx/forge}"
UPDATE=false
REPAIR=false
VERIFY=false
UNINSTALL=false
VALIDATE_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update) UPDATE=true; shift ;;
    --repair) REPAIR=true; shift ;;
    --verify) VERIFY=true; shift ;;
    --uninstall) UNINSTALL=true; shift ;;
    --validate-only) VALIDATE_ONLY=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_ROOT="$PACKAGE_ROOT/afyx-forge"
RECOVERY_ROOT="${RUNTIME_ROOT}.afyx-old"

get_state() {
  if [[ ! -d "$RUNTIME_ROOT" ]]; then
    echo "NOT INSTALLED"
  elif [[ -f "$RUNTIME_ROOT/metadata.json" && -f "$RUNTIME_ROOT/current/bin/afyx-forge" ]]; then
    echo "HEALTHY"
  else
    echo "BROKEN"
  fi
}

CURRENT_STATE=$(get_state)

if [[ "$VALIDATE_ONLY" == true || "$VERIFY" == true ]]; then
  echo "Component: afyx-forge"
  echo "State: $CURRENT_STATE"
  echo "RuntimeRoot: $RUNTIME_ROOT"
  echo "Version: 0.1.0"
  exit 0
fi

if [[ "$UNINSTALL" == true ]]; then
  if [[ "$CURRENT_STATE" == "NOT INSTALLED" ]]; then
    echo "Afyx Forge: already not installed."
    exit 0
  fi
  rm -rf "$RUNTIME_ROOT"
  echo "Afyx Forge: uninstalled from $RUNTIME_ROOT"
  exit 0
fi

if [[ "$CURRENT_STATE" == "HEALTHY" && "$UPDATE" == false && "$REPAIR" == false ]]; then
  echo "Afyx Forge: already installed and HEALTHY at $RUNTIME_ROOT."
  exit 0
fi

# Stage and atomic install
PARENT_DIR="$(dirname "$RUNTIME_ROOT")"
mkdir -p "$PARENT_DIR"
STAGE_DIR="$PARENT_DIR/.forge-stage-$RANDOM"
mkdir -p "$STAGE_DIR/current"
cp -R "$SOURCE_ROOT/"* "$STAGE_DIR/current/"

mkdir -p "$STAGE_DIR/bin"
cat << 'EOF' > "$STAGE_DIR/bin/afyx-forge"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/../current/bin/afyx-forge.js" "$@"
EOF
chmod +x "$STAGE_DIR/bin/afyx-forge"

cat << EOF > "$STAGE_DIR/metadata.json"
{
  "product_name": "Afyx Forge Core",
  "product_version": "0.1.0",
  "ownership_class": "AFYX",
  "release_channel": "technical-alpha",
  "installed_at": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}
EOF

if [[ -d "$RUNTIME_ROOT" ]]; then
  rm -rf "$RECOVERY_ROOT"
  mv "$RUNTIME_ROOT" "$RECOVERY_ROOT"
fi

mv "$STAGE_DIR" "$RUNTIME_ROOT"
rm -rf "$RECOVERY_ROOT"

echo "Afyx Forge Core 0.1.0: successfully installed at $RUNTIME_ROOT"
exit 0

