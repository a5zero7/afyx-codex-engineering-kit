#!/usr/bin/env bash
set -euo pipefail

readonly ENGINE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly CONTRACT="$ENGINE_ROOT/scripts/distribution-contract.mjs"
readonly TARGET="${1:?usage: build-bundle.sh <target> [node-version]}"
readonly NODE_VERSION="${2:-$(node "$CONTRACT" default-node-version)}"
readonly RELEASE_ROOT="$ENGINE_ROOT/release"
readonly TEMP_ROOT="$(mktemp -d)"
readonly ARCH="${TARGET##*-}"
readonly FAMILY="${TARGET%-*}"
readonly BUNDLE_NAME="$(node "$CONTRACT" plan --target "$TARGET" --node-version "$NODE_VERSION" --field bundleName)"
readonly STAGE="$TEMP_ROOT/$BUNDLE_NAME"
RUNTIME_SOURCE=""
ARCHIVE=""

cleanup() { rm -rf "$TEMP_ROOT"; }
trap cleanup EXIT

validate_target() {
  node "$CONTRACT" plan --target "$TARGET" --node-version "$NODE_VERSION" >/dev/null
}

fetch_runtime() {
  local distribution url archive
  if [ "$FAMILY" = "win32" ]; then
    distribution="node-${NODE_VERSION}-win-${ARCH}"
    archive="$TEMP_ROOT/node.zip"
    url="https://nodejs.org/dist/${NODE_VERSION}/${distribution}.zip"
    echo "[bundle] downloading $url"
    curl -fsSL "$url" -o "$archive"
    if command -v unzip >/dev/null 2>&1; then unzip -q "$archive" -d "$TEMP_ROOT"; else tar -xf "$archive" -C "$TEMP_ROOT"; fi
    RUNTIME_SOURCE="$TEMP_ROOT/$distribution/node.exe"
  else
    distribution="node-${NODE_VERSION}-${TARGET}"
    archive="$TEMP_ROOT/node.tar.gz"
    url="https://nodejs.org/dist/${NODE_VERSION}/${distribution}.tar.gz"
    echo "[bundle] downloading $url"
    curl -fsSL "$url" -o "$archive"
    tar -xzf "$archive" -C "$TEMP_ROOT"
    RUNTIME_SOURCE="$TEMP_ROOT/$distribution/bin/node"
  fi
  [ -f "$RUNTIME_SOURCE" ] || { echo "[bundle] runtime binary missing: $RUNTIME_SOURCE" >&2; exit 1; }
}

build_application() { echo "[bundle] building app"; (cd "$ENGINE_ROOT" && npm run build >/dev/null); }

stage_application() {
  mkdir -p "$STAGE/lib" "$STAGE/bin" "$STAGE/licenses"
  cp -R "$ENGINE_ROOT/dist" "$STAGE/lib/dist"
  cp "$ENGINE_ROOT/package.json" "$ENGINE_ROOT/package-lock.json" "$STAGE/lib/"
  cp "$ENGINE_ROOT/../afyx-graph.json" "$STAGE/metadata.json"
  # Required attribution contract is owned by the artifact plan.
  while IFS='|' read -r source destination; do
    mkdir -p "$STAGE/$(dirname "$destination")"
    cp "$ENGINE_ROOT/$source" "$STAGE/$destination"
  done < <(node "$CONTRACT" legal-files)
  echo "[bundle] installing production dependencies"
  (cd "$STAGE/lib" && npm ci --omit=dev --ignore-scripts >/dev/null 2>&1)
  # The dependency declaration remains until Runtime & Dev/Test Isolation, but
  # native production does not ship the package's unused grammar binaries.
  rm -rf "$STAGE/lib/node_modules/tree-sitter-wasms"
  rm -f "$STAGE/lib/package-lock.json"
}

stage_optional_kernel() {
  local candidate
  for candidate in "$ENGINE_ROOT/release/kernel/$TARGET/afyx-graph-kernel.node" "$ENGINE_ROOT/afyx-graph-kernel/prebuilds/$TARGET/afyx-graph-kernel.node"; do
    if [ -f "$candidate" ]; then
      mkdir -p "$STAGE/lib/kernel"
      cp "$candidate" "$STAGE/lib/kernel/afyx-graph-kernel.node"
      echo "[bundle] native kernel included ($candidate)"
      return
    fi
  done
  echo "[bundle] no optional native kernel for $TARGET — bundle uses the native TypeScript extraction path"
}

write_launcher() {
  if [ "$FAMILY" = "win32" ]; then
    cp "$RUNTIME_SOURCE" "$STAGE/node.exe"
    printf '@echo off\r\n@"%%~dp0..\\node.exe" --liftoff-only --disable-warning=ExperimentalWarning "%%~dp0..\\lib\\dist\\bin\\afyx-graph.js" %%*\r\n' > "$STAGE/bin/afyx-graph.cmd"
    return
  fi
  cp "$RUNTIME_SOURCE" "$STAGE/node"
  chmod +x "$STAGE/node"
  cat > "$STAGE/bin/afyx-graph" <<'LAUNCHER'
#!/bin/sh
SELF="$0"
while [ -L "$SELF" ]; do
  link="$(readlink "$SELF")"
  case "$link" in /*) SELF="$link" ;; *) SELF="$(dirname "$SELF")/$link" ;; esac
done
BUNDLE_DIR="$(cd "$(dirname "$SELF")/.." && pwd)"
AFYX_GRAPH_HOST_PPID="${AFYX_GRAPH_HOST_PPID:-$PPID}"
export AFYX_GRAPH_HOST_PPID
exec "$BUNDLE_DIR/node" --liftoff-only --disable-warning=ExperimentalWarning "$BUNDLE_DIR/lib/dist/bin/afyx-graph.js" "$@"
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
echo "[bundle] target=$TARGET node=$NODE_VERSION"
fetch_runtime
build_application
stage_application
stage_optional_kernel
write_launcher
node "$CONTRACT" verify-bundle --root "$STAGE" --target "$TARGET" >/dev/null
archive_bundle
