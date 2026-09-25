#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
METADATA="$PACKAGE_ROOT/afyx-graph/afyx-graph.json"
RUNTIME_ROOT="${AFYX_GRAPH_RUNTIME_ROOT:-$HOME/.afyx/graph}"
BIN_DIR="${AFYX_GRAPH_BIN_DIR:-$HOME/.local/bin}"
mode=install
archive_path=

usage() {
  printf '%s\n' 'Usage: scripts/install-afyx-graph.sh [--replace|--update|--validate-only|--uninstall] [--archive PATH]'
}

while (($#)); do
  case "$1" in
    --replace) mode=replace; shift ;;
    --update) mode=update; shift ;;
    --validate-only) mode=validate; shift ;;
    --uninstall) mode=uninstall; shift ;;
    --archive) archive_path="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

json_value() {
  sed -n 's/^[[:space:]]*"'"$1"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$METADATA" | head -n 1
}

VERSION="$(json_value afyx_graph_version)"
ENGINE_VERSION="$(json_value codegraph_upstream_version)"

graph_state() {
  if [[ ! -e "$RUNTIME_ROOT" ]]; then printf '%s' 'NOT INSTALLED'; return; fi
  if [[ ! -f "$RUNTIME_ROOT/metadata.json" || ! -x "$RUNTIME_ROOT/current/bin/afyx-graph" || ! -x "$RUNTIME_ROOT/current/node" ]]; then
    printf '%s' 'INCOMPLETE'; return
  fi
  if ! grep -q '"product_name"[[:space:]]*:[[:space:]]*"Afyx Graph"' "$RUNTIME_ROOT/metadata.json"; then
    printf '%s' 'INVALID'; return
  fi
  printf '%s' 'HEALTHY'
}

graph_owned() {
  [[ -f "$RUNTIME_ROOT/metadata.json" ]] &&
    grep -q '"product_name"[[:space:]]*:[[:space:]]*"Afyx Graph"' "$RUNTIME_ROOT/metadata.json"
}

state="$(graph_state)"
if [[ "$mode" == validate ]]; then
  printf 'Product: Afyx Graph\nState: %s\nRuntimeRoot: %s\nVersion: %s\nEngineVersion: %s\n' "$state" "$RUNTIME_ROOT" "$VERSION" "$ENGINE_VERSION"
  [[ "$state" != INCOMPLETE && "$state" != INVALID ]]
  exit $?
fi

if [[ "$mode" == uninstall ]]; then
  if [[ "$state" == 'NOT INSTALLED' ]]; then printf 'Afyx Graph: not installed\n'; exit 0; fi
  graph_owned || { printf 'Refusing to remove %s because Afyx Graph ownership cannot be verified.\n' "$RUNTIME_ROOT" >&2; exit 1; }
  rm -rf -- "$RUNTIME_ROOT"
  if [[ -L "$BIN_DIR/afyx-graph" ]]; then
    link_target="$(readlink "$BIN_DIR/afyx-graph")"
    case "$link_target" in "$RUNTIME_ROOT"/*) rm -f -- "$BIN_DIR/afyx-graph" ;; esac
  fi
  printf 'Afyx Graph: removed; project .afyx-graph and .codegraph indexes were not changed.\n'
  exit 0
fi

if [[ "$state" != 'NOT INSTALLED' && "$mode" == install ]]; then
  printf 'Afyx Graph already exists at %s. Use --replace after inspecting it.\n' "$RUNTIME_ROOT" >&2
  exit 1
fi
if [[ "$state" != 'NOT INSTALLED' ]] && ! graph_owned; then
  printf 'Refusing to replace %s because Afyx Graph ownership cannot be verified.\n' "$RUNTIME_ROOT" >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) printf 'Unsupported operating system: %s\n' "$(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x64 ;;
  arm64|aarch64) arch=arm64 ;;
  *) printf 'Unsupported architecture: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
target="$os-$arch"
asset="afyx-graph-$target.tar.gz"

parent="$(dirname "$RUNTIME_ROOT")"
mkdir -p "$parent"
transaction="$(mktemp -d "$parent/.graph-stage.XXXXXX")"
backup="$parent/.graph-backup.$$"
cleanup() { rm -rf -- "$transaction"; }
trap cleanup EXIT

if [[ -z "$archive_path" ]]; then
  local_archive="$PACKAGE_ROOT/afyx-graph/engine/release/$asset"
  if [[ -f "$local_archive" ]]; then
    archive_path="$local_archive"
  else
    archive_path="$transaction/$asset"
    url="https://github.com/a5zero7/afyx-codex-engineering-kit/releases/download/afyx-graph-v$VERSION/$asset"
    curl -fsSL "$url" -o "$archive_path"
    curl -fsSL "https://github.com/a5zero7/afyx-codex-engineering-kit/releases/download/afyx-graph-v$VERSION/SHA256SUMS" -o "$transaction/SHA256SUMS"
  fi
fi
[[ -f "$archive_path" ]] || { printf 'Archive not found: %s\n' "$archive_path" >&2; exit 1; }
sums="$(dirname "$archive_path")/SHA256SUMS"
[[ -f "$sums" ]] || { printf 'SHA256SUMS is required beside %s\n' "$archive_path" >&2; exit 1; }
expected="$(awk -v asset="$asset" '$2 == asset || $2 == "*" asset { print $1; exit }' "$sums")"
[[ ${#expected} -eq 64 && "$expected" != *[!0-9a-fA-F]* ]] || { printf 'No valid SHA256SUMS entry for %s\n' "$asset" >&2; exit 1; }
if command -v shasum >/dev/null 2>&1; then actual="$(shasum -a 256 "$archive_path" | awk '{print $1}')"; else actual="$(sha256sum "$archive_path" | awk '{print $1}')"; fi
actual_lower="$(printf '%s' "$actual" | tr '[:upper:]' '[:lower:]')"
expected_lower="$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')"
[[ "$actual_lower" == "$expected_lower" ]] || { printf 'Checksum mismatch for %s\n' "$asset" >&2; exit 1; }

mkdir -p "$transaction/extract" "$transaction/prepared"
tar -xzf "$archive_path" -C "$transaction/extract"
bundle="$transaction/extract/afyx-graph-$target"
for required in node bin/afyx-graph bin/codegraph metadata.json licenses/CodeGraph-MIT.txt; do
  [[ -f "$bundle/$required" ]] || { printf 'Staged Afyx Graph bundle is incomplete: %s\n' "$required" >&2; exit 1; }
done
grep -q '"afyx_graph_version"[[:space:]]*:[[:space:]]*"'"$VERSION"'"' "$bundle/metadata.json" || {
  printf 'Staged Afyx Graph version does not match metadata.\n' >&2; exit 1;
}
mv "$bundle" "$transaction/prepared/current"
cp "$transaction/prepared/current/metadata.json" "$transaction/prepared/metadata.json"

had_existing=false
if [[ -e "$RUNTIME_ROOT" ]]; then mv "$RUNTIME_ROOT" "$backup"; had_existing=true; fi
if ! mv "$transaction/prepared" "$RUNTIME_ROOT"; then
  "$had_existing" && mv "$backup" "$RUNTIME_ROOT"
  exit 1
fi
if [[ "$(graph_state)" != HEALTHY ]]; then
  rm -rf -- "$RUNTIME_ROOT"
  "$had_existing" && mv "$backup" "$RUNTIME_ROOT"
  printf 'Installed Afyx Graph failed post-swap validation; previous runtime restored.\n' >&2
  exit 1
fi
"$had_existing" && rm -rf -- "$backup"

mkdir -p "$BIN_DIR"
destination="$BIN_DIR/afyx-graph"
if [[ -e "$destination" && ! -L "$destination" ]]; then
  printf 'Existing afyx-graph executable left untouched at %s\n' "$destination"
elif [[ -L "$destination" ]]; then
  link_target="$(readlink "$destination")"
  case "$link_target" in
    "$RUNTIME_ROOT"/*) ln -sfn "$RUNTIME_ROOT/current/bin/afyx-graph" "$destination" ;;
    *) printf 'External afyx-graph symlink left untouched at %s\n' "$destination" ;;
  esac
else
  ln -s "$RUNTIME_ROOT/current/bin/afyx-graph" "$destination"
fi

printf 'Afyx Graph %s: installed at %s\nCLI: %s/afyx-graph\nMCP configuration was not changed.\n' "$VERSION" "$RUNTIME_ROOT" "$BIN_DIR"
