#!/usr/bin/env bash
set -euo pipefail

readonly ENGINE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly CONTRACT="$ENGINE_ROOT/scripts/distribution-contract.mjs"
readonly TARGET="${1:?usage: build-bundle.sh <target>}"
readonly RELEASE_ROOT="$ENGINE_ROOT/release"
readonly TEMP_ROOT="$(mktemp -d)"
readonly FAMILY="${TARGET%-*}"
readonly BUNDLE_NAME="$(node "$CONTRACT" plan --target "$TARGET" --field bundleName)"
readonly STAGE="$TEMP_ROOT/$BUNDLE_NAME"
ARCHIVE=""

cleanup() { rm -rf "$TEMP_ROOT"; }
trap cleanup EXIT

validate_target() {
  node "$CONTRACT" plan --target "$TARGET" >/dev/null
}

build_application() { echo "[bundle] building app"; (cd "$ENGINE_ROOT" && npm run build >/dev/null); }

stage_application() {
  mkdir -p "$STAGE/lib" "$STAGE/bin"
  cp -R "$ENGINE_ROOT/dist" "$STAGE/lib/dist"
  cp "$ENGINE_ROOT/package.json" "$STAGE/lib/"
  cp "$ENGINE_ROOT/../afyx-graph.json" "$STAGE/metadata.json"
  # Required attribution contract is owned by the artifact plan.
  while IFS='|' read -r source destination; do
    mkdir -p "$STAGE/$(dirname "$destination")"
    cp "$ENGINE_ROOT/$source" "$STAGE/$destination"
  done < <(node "$CONTRACT" legal-files)
}

write_launcher() {
  if [ "$FAMILY" = "win32" ]; then
    printf '@echo off\r\nwhere node >nul 2>&1\r\nif errorlevel 1 (\r\n  echo [Afyx Graph] Node.js was not found on PATH. Install Node.js 22.5.0 or newer: https://nodejs.org/ 1>&2\r\n  exit /b 1\r\n)\r\nnode --disable-warning=ExperimentalWarning "%%~dp0..\\lib\\dist\\bin\\afyx-graph.js" %%*\r\nexit /b %%ERRORLEVEL%%\r\n' > "$STAGE/bin/afyx-graph.cmd"
    return
  fi
  cat > "$STAGE/bin/afyx-graph" <<'LAUNCHER'
#!/bin/sh
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '[Afyx Graph] Node.js was not found on PATH. Install Node.js 22.5.0 or newer: https://nodejs.org/' >&2
  exit 1
fi
SELF="$0"
while [ -L "$SELF" ]; do
  link="$(readlink "$SELF")"
  case "$link" in /*) SELF="$link" ;; *) SELF="$(dirname "$SELF")/$link" ;; esac
done
BUNDLE_DIR="$(cd "$(dirname "$SELF")/.." && pwd)"
AFYX_GRAPH_HOST_PPID="${AFYX_GRAPH_HOST_PPID:-$PPID}"
export AFYX_GRAPH_HOST_PPID
exec node --disable-warning=ExperimentalWarning "$BUNDLE_DIR/lib/dist/bin/afyx-graph.js" "$@"
LAUNCHER
  chmod +x "$STAGE/bin/afyx-graph"
}

archive_bundle() {
  mkdir -p "$RELEASE_ROOT"
  if [ "$FAMILY" = "win32" ]; then
    ARCHIVE="$RELEASE_ROOT/$BUNDLE_NAME.zip"
    rm -f "$ARCHIVE"
    if command -v zip >/dev/null 2>&1; then (cd "$TEMP_ROOT" && zip -rqX "$ARCHIVE" "$BUNDLE_NAME")
    elif command -v python3 >/dev/null 2>&1; then
      python3 -c 'import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); source=root/sys.argv[2]; out=zipfile.ZipFile(sys.argv[3],"w",zipfile.ZIP_DEFLATED); [out.write(p,p.relative_to(root)) for p in sorted(source.rglob("*"))]; out.close()' "$TEMP_ROOT" "$BUNDLE_NAME" "$ARCHIVE"
    else echo "[bundle] zip or python3 is required for Windows archives" >&2; exit 1; fi
  else
    ARCHIVE="$RELEASE_ROOT/$BUNDLE_NAME.tar.gz"
    rm -f "$ARCHIVE"
    case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) tar --no-xattrs --mode=755 -czf "$ARCHIVE" -C "$TEMP_ROOT" "$BUNDLE_NAME" ;; *) tar --no-xattrs -czf "$ARCHIVE" -C "$TEMP_ROOT" "$BUNDLE_NAME" ;; esac
  fi
  echo "[bundle] wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
}

validate_target
echo "[bundle] target=$TARGET runtime=external-node"
build_application
stage_application
write_launcher
node "$CONTRACT" verify-bundle --root "$STAGE" --target "$TARGET" >/dev/null
archive_bundle
