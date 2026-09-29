#!/usr/bin/env bash
set -euo pipefail

readonly ENGINE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly CRATE_ROOT="$ENGINE_ROOT/afyx-graph-kernel"
TARGET=""
PLATFORM=""

need_value() { [ $# -ge 2 ] && [ -n "$2" ] || { echo "missing value for $1" >&2; exit 2; }; }

while [ $# -gt 0 ]; do
  case "$1" in
    --target) need_value "$@"; TARGET="$2"; shift 2 ;;
    --platform) need_value "$@"; PLATFORM="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

platform_for_target() {
  case "$1" in
    aarch64-apple-darwin) echo darwin-arm64 ;;
    x86_64-apple-darwin) echo darwin-x64 ;;
    x86_64-unknown-linux-gnu) echo linux-x64 ;;
    aarch64-unknown-linux-gnu) echo linux-arm64 ;;
    x86_64-pc-windows-msvc) echo win32-x64 ;;
    aarch64-pc-windows-msvc) echo win32-arm64 ;;
    *) return 1 ;;
  esac
}

platform_for_host() {
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) echo darwin-arm64 ;;
    Darwin-x86_64) echo darwin-x64 ;;
    Linux-x86_64) echo linux-x64 ;;
    Linux-aarch64) echo linux-arm64 ;;
    MINGW*-x86_64|MSYS*-x86_64) echo win32-x64 ;;
    MINGW*-aarch64|MSYS*-aarch64) echo win32-arm64 ;;
    *) return 1 ;;
  esac
}

if [ -z "$PLATFORM" ]; then
  if [ -n "$TARGET" ]; then
    PLATFORM="$(platform_for_target "$TARGET")" || { echo "cannot map rust target '$TARGET'; pass --platform" >&2; exit 2; }
  else
    PLATFORM="$(platform_for_host)" || { echo "unrecognized host; pass --platform" >&2; exit 2; }
  fi
fi

case "$PLATFORM" in darwin-arm64|darwin-x64|linux-arm64|linux-x64|win32-arm64|win32-x64) ;; *) echo "unsupported platform: $PLATFORM" >&2; exit 2 ;; esac

echo "[kernel] building afyx-graph-kernel for ${PLATFORM}${TARGET:+ (target $TARGET)}"
if [ -n "$TARGET" ]; then
  rustup target add "$TARGET" >/dev/null 2>&1 || true
  (cd "$CRATE_ROOT" && cargo build --release --target "$TARGET")
  BUILD_ROOT="$CRATE_ROOT/target/$TARGET/release"
else
  (cd "$CRATE_ROOT" && cargo build --release)
  BUILD_ROOT="$CRATE_ROOT/target/release"
fi

case "$PLATFORM" in
  darwin-*) LIBRARY="$BUILD_ROOT/libafyx_graph_kernel.dylib" ;;
  linux-*) LIBRARY="$BUILD_ROOT/libafyx_graph_kernel.so" ;;
  win32-*) LIBRARY="$BUILD_ROOT/afyx_graph_kernel.dll" ;;
esac
[ -f "$LIBRARY" ] || { echo "[kernel] built library missing: $LIBRARY" >&2; exit 1; }

DESTINATION="$CRATE_ROOT/prebuilds/$PLATFORM/afyx-graph-kernel.node"
mkdir -p "$(dirname "$DESTINATION")"
# A fresh inode avoids stale macOS code-signature cache entries.
rm -f "$DESTINATION"
cp "$LIBRARY" "$DESTINATION"
echo "[kernel] staged $DESTINATION ($(du -h "$DESTINATION" | cut -f1))"
