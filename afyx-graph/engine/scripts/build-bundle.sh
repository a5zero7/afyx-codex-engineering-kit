#!/usr/bin/env bash
#
# Build a self-contained Afyx Graph bundle: an official Node runtime + the
# compiled app + its production deps, so Afyx Graph runs with NO system Node and
# NO native build — node:sqlite is built into the bundled Node. One archive per
# platform.
#
# Because dropping better-sqlite3 left zero native addons, the recipe is pure
# file-packaging (download the target's Node, copy the app, archive) — so any
# platform's bundle can be built on any OS. No cross-compile, no native runners.
#
# Usage:
#   scripts/build-bundle.sh <target> [node-version]
#     target:        darwin-arm64 | darwin-x64 | linux-x64 | linux-arm64
#                  | win32-x64 | win32-arm64
#     node-version:  e.g. v24.16.0 (default below; pin for reproducible builds)
#
# Output:
#   unix:    release/afyx-graph-<target>.tar.gz   (launcher: bin/afyx-graph)
#   windows: release/afyx-graph-<target>.zip      (launcher: bin/afyx-graph.cmd)
set -euo pipefail

TARGET="${1:?usage: build-bundle.sh <target> [node-version]}"
NODE_VERSION="${2:-v24.16.0}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/release"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ARCH="${TARGET##*-}"   # x64 | arm64
OSFAM="${TARGET%-*}"   # darwin | linux | win32

echo "[bundle] target=${TARGET} node=${NODE_VERSION}"

# 1. Download + extract the official Node runtime for the target platform.
if [ "$OSFAM" = "win32" ]; then
  NODE_DIST="node-${NODE_VERSION}-win-${ARCH}"
  NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.zip"
  echo "[bundle] downloading ${NODE_URL}"
  curl -fsSL "$NODE_URL" -o "$WORK/node.zip"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$WORK/node.zip" -d "$WORK"
  else
    tar -xf "$WORK/node.zip" -C "$WORK"   # bsdtar can read zip
  fi
  NODE_BIN="$WORK/${NODE_DIST}/node.exe"
else
  NODE_DIST="node-${NODE_VERSION}-${TARGET}"
  NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.gz"
  echo "[bundle] downloading ${NODE_URL}"
  curl -fsSL "$NODE_URL" -o "$WORK/node.tar.gz"
  tar -xzf "$WORK/node.tar.gz" -C "$WORK"
  NODE_BIN="$WORK/${NODE_DIST}/bin/node"
fi
[ -f "$NODE_BIN" ] || { echo "[bundle] error: node binary not found ($NODE_BIN)" >&2; exit 1; }

# 2. Build the app (compiled JS + copied wasm/schema assets).
echo "[bundle] building app"
( cd "$ROOT" && npm run build >/dev/null )

# 3. Stage: app + production-only deps (pure JS/wasm → portable across platforms).
STAGE="$WORK/afyx-graph-${TARGET}"
mkdir -p "$STAGE/lib" "$STAGE/bin"
cp -R "$ROOT/dist" "$STAGE/lib/dist"
# The browser viewer rides along inside dist/viewer (built by `npm run build`
# above). Fail here rather than shipping a bundle whose `afyx-graph ui` serves
# a 404 — the copy is verified, not assumed.
node "$ROOT/scripts/check-ui-build.mjs" --root "$STAGE/lib"
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$STAGE/lib/"
echo "[bundle] installing production dependencies"
# The staged package.json declares the `ui` workspace but the bundle carries
# no ui/ source — only its build output. That is fine: ui/ has dev
# dependencies only, so --omit=dev skips the workspace outright and no link
# is created. (If a future npm starts erroring on the absent folder, stage a
# stub ui/package.json before this line rather than editing the lock.)
( cd "$STAGE/lib" && npm ci --omit=dev --ignore-scripts >/dev/null 2>&1 )
rm -f "$STAGE/lib/package-lock.json"
mkdir -p "$STAGE/licenses"
cp "$ROOT/../afyx-graph.json" "$STAGE/metadata.json"
cp "$ROOT/../THIRD_PARTY_NOTICES.md" "$STAGE/licenses/THIRD_PARTY_NOTICES.md"
cp "$ROOT/../LICENSES/THIRD_PARTY_ENGINE_MIT.txt" "$STAGE/licenses/THIRD_PARTY_ENGINE_MIT.txt"
for notice in THIRD_PARTY_NOTICES.md THIRD_PARTY_ENGINE_MIT.txt; do
  [ -s "$STAGE/licenses/$notice" ] || { echo "[bundle] required legal file missing from bundle: licenses/$notice" >&2; exit 1; }
done

# 3b. Native extraction kernel (optional). Included when a prebuilt .node for
#     the target exists — release/kernel/<target>/afyx-graph-kernel.node (the
#     release workflow's prebuild artifacts) or the locally staged
#     afyx-graph-kernel/prebuilds/<target>/ (scripts/build-kernel.sh). Absent →
#     the bundle simply runs the wasm extraction path; the kernel is a
#     per-language speedup, never a requirement (see
#     docs/design/rust-kernel-migration-plan.md).
KERNEL_NODE=""
for candidate in "$ROOT/release/kernel/${TARGET}/afyx-graph-kernel.node" \
                 "$ROOT/afyx-graph-kernel/prebuilds/${TARGET}/afyx-graph-kernel.node"; do
  if [ -f "$candidate" ]; then KERNEL_NODE="$candidate"; break; fi
done
if [ -n "$KERNEL_NODE" ]; then
  mkdir -p "$STAGE/lib/kernel"
  cp "$KERNEL_NODE" "$STAGE/lib/kernel/afyx-graph-kernel.node"
  echo "[bundle] native kernel included ($KERNEL_NODE)"
else
  echo "[bundle] no native kernel for ${TARGET} — bundle uses the wasm extraction path"
fi

# 4. Vendored Node + launcher (the launcher uses the bundled Node by relative
#    path, so no system Node is ever needed).
#
# `--liftoff-only`: keep tree-sitter's large WASM grammars on V8's Liftoff
# baseline compiler so they never reach the turboshaft optimizing tier, whose
# per-compilation Zone arena OOMs the whole process (`Fatal process out of
# memory: Zone`) on Node >= 22 — even with tens of GB free. The flag is read at
# V8 engine init so it must be on node's command line; the parse worker inherits
# it. See issues #293/#298 and src/extraction/wasm-runtime-flags.ts. (The CLI
# also self-relaunches with this flag when launched without it, so non-bundled
# runs are covered too; passing it here avoids that extra spawn.)
if [ "$OSFAM" = "win32" ]; then
  cp "$NODE_BIN" "$STAGE/node.exe"
  printf '@echo off\r\n@"%%~dp0..\\node.exe" --liftoff-only --disable-warning=ExperimentalWarning "%%~dp0..\\lib\\dist\\bin\\afyx-graph.js" %%*\r\n' \
    > "$STAGE/bin/afyx-graph.cmd"
else
  cp "$NODE_BIN" "$STAGE/node"
  chmod +x "$STAGE/node"
  cat > "$STAGE/bin/afyx-graph" <<'LAUNCH'
#!/bin/sh
# Resolve symlinks so
# we find the real bundle dir, not the symlink's location.
SELF="$0"
while [ -L "$SELF" ]; do
  target="$(readlink "$SELF")"
  case "$target" in
    /*) SELF="$target" ;;
    *) SELF="$(dirname "$SELF")/$target" ;;
  esac
done
DIR="$(cd "$(dirname "$SELF")/.." && pwd)"
# Thread the MCP host's pid to the server's orphan watchdog (issue #1185).
# $PPID is our parent — the host itself when it launched this script directly;
# an already-threaded value (the npm shim sets the true host pid) wins.
AFYX_GRAPH_HOST_PPID="${AFYX_GRAPH_HOST_PPID:-$PPID}"
export AFYX_GRAPH_HOST_PPID
# --liftoff-only: avoid the V8 turboshaft WASM Zone OOM (issues #293/#298).
# --disable-warning=ExperimentalWarning: mute node:sqlite's per-thread
# "experimental feature" warning that otherwise interleaves with the progress UI.
exec "$DIR/node" --liftoff-only --disable-warning=ExperimentalWarning "$DIR/lib/dist/bin/afyx-graph.js" "$@"
LAUNCH
  chmod +x "$STAGE/bin/afyx-graph"
fi

# 5. Archive (.zip for Windows, .tar.gz otherwise).
mkdir -p "$OUT"
if [ "$OSFAM" = "win32" ]; then
  ARCHIVE="$OUT/afyx-graph-${TARGET}.zip"
  rm -f "$ARCHIVE"
  if command -v zip >/dev/null 2>&1; then
    ( cd "$WORK" && zip -rqX "$ARCHIVE" "afyx-graph-${TARGET}" )
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); source=root/sys.argv[2]; archive=zipfile.ZipFile(sys.argv[3], "w", zipfile.ZIP_DEFLATED); [archive.write(entry, entry.relative_to(root)) for entry in sorted(source.rglob("*"))]; archive.close()' "$WORK" "afyx-graph-${TARGET}" "$ARCHIVE"
  else
    echo "[bundle] error: zip or python3 is required to create Windows archives" >&2
    exit 1
  fi
else
  ARCHIVE="$OUT/afyx-graph-${TARGET}.tar.gz"
  # --no-xattrs: don't embed macOS xattrs that make GNU tar warn on Linux.
  # Git Bash cannot persist POSIX executable bits on NTFS for an extensionless
  # Node binary, so explicitly record executable archive modes when cross-
  # packaging Unix targets on Windows.
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) tar --no-xattrs --mode=755 -czf "$ARCHIVE" -C "$WORK" "afyx-graph-${TARGET}" ;;
    *) tar --no-xattrs -czf "$ARCHIVE" -C "$WORK" "afyx-graph-${TARGET}" ;;
  esac
fi
echo "[bundle] wrote ${ARCHIVE} ($(du -h "$ARCHIVE" | cut -f1))"
