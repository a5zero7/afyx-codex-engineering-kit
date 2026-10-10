# shellcheck shell=bash
# Transactional skill lifecycle helpers for Bash 3.2+.

AFYX_SKILL_MARKER='.afyx-install.json'
afyx_backup_root="${AFYX_BACKUP_ROOT:-$HOME/.afyx/backups}"
afyx_backup_limit="${AFYX_BACKUP_LIMIT:-20}"

afyx_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else printf 'A SHA-256 utility is required.\n' >&2; return 1
  fi
}

afyx_skill_digest() {
  local directory="$1" listing relative digest
  listing="$(mktemp "${TMPDIR:-/tmp}/afyx-skill-digest.XXXXXX")" || return 1
  if ! (
    cd "$directory" || exit 1
    find . -type f ! -path './.git/*' ! -name "$AFYX_SKILL_MARKER" -print |
      LC_ALL=C sort |
      while IFS= read -r relative; do
        digest="$(afyx_sha256 "$relative")" || exit 1
        printf '%s  %s\n' "$digest" "$relative"
      done
  ) >"$listing"; then
    rm -f -- "$listing"
    return 1
  fi
  afyx_sha256 "$listing"
  local status=$?
  rm -f -- "$listing"
  return "$status"
}

afyx_assert_skill_target() {
  local root="$1" target="$2" root_real parent_real
  [[ -n "$root" && -n "$target" && "$target" != "$root" ]] || { printf 'Unsafe empty or root skill target.\n' >&2; return 1; }
  [[ ! -L "$root" && ! -L "$target" ]] || { printf 'Refusing symlinked skill path: %s\n' "$target" >&2; return 1; }
  mkdir -p "$root" || return 1
  root_real="$(cd "$root" && pwd -P)" || return 1
  parent_real="$(cd "$(dirname "$target")" && pwd -P)" || return 1
  [[ "$parent_real" == "$root_real" ]] || { printf 'Skill target escapes configured root: %s\n' "$target" >&2; return 1; }
}

afyx_recover_skill_transaction() {
  local target="$1" old
  old="$(dirname "$target")/.$(basename "$target").afyx-old"
  if [[ -e "$old" && ! -e "$target" ]]; then
    mv "$old" "$target" || return 1
    printf 'Recovered interrupted skill transaction: %s\n' "$target" >&2
  elif [[ -e "$old" && -e "$target" ]]; then
    printf 'Ambiguous interrupted skill transaction; preserve both %s and %s for manual recovery.\n' "$target" "$old" >&2
    return 1
  fi
}

afyx_marker_value() {
  local marker="$1" field="$2"
  sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$marker" | head -n 1
}

# Sets AFYX_OWNERSHIP_STATE to NOT_INSTALLED, AFYX_OWNED_UNMODIFIED,
# AFYX_OWNED_MODIFIED, EXTERNAL_UPSTREAM, FOREIGN_UNPROVEN, or UNSAFE.
afyx_classify_skill() {
  local target="$1" component="$2" expected_owner="$3" marker owner marked_component recorded actual repository revision head remote dirty
  AFYX_OWNERSHIP_STATE=FOREIGN_UNPROVEN
  [[ -e "$target" || -L "$target" ]] || { AFYX_OWNERSHIP_STATE=NOT_INSTALLED; return 0; }
  [[ ! -L "$target" && -d "$target" ]] || { AFYX_OWNERSHIP_STATE=UNSAFE; return 0; }
  marker="$target/$AFYX_SKILL_MARKER"
  [[ -f "$marker" && ! -L "$marker" ]] || return 0
  owner="$(afyx_marker_value "$marker" owner)"
  marked_component="$(afyx_marker_value "$marker" component)"
  [[ "$owner" == "$expected_owner" && "$marked_component" == "$component" ]] || return 0
  if [[ "$owner" == afyx ]]; then
    recorded="$(afyx_marker_value "$marker" content_sha256)"
    [[ ${#recorded} -eq 64 && "$recorded" != *[!0-9a-fA-F]* ]] || return 0
    actual="$(afyx_skill_digest "$target")" || { AFYX_OWNERSHIP_STATE=UNSAFE; return 0; }
    if [[ "$actual" == "$recorded" ]]; then AFYX_OWNERSHIP_STATE=AFYX_OWNED_UNMODIFIED
    else AFYX_OWNERSHIP_STATE=AFYX_OWNED_MODIFIED; fi
    return 0
  fi
  repository="$(afyx_marker_value "$marker" source_repository)"
  revision="$(afyx_marker_value "$marker" source_revision)"
  [[ -d "$target/.git" && ${#revision} -eq 40 ]] || return 0
  head="$(git -C "$target" rev-parse HEAD 2>/dev/null)" || return 0
  remote="$(git -C "$target" remote get-url origin 2>/dev/null)" || return 0
  dirty="$(git -C "$target" status --porcelain 2>/dev/null)" || return 0
  if [[ "$head" == "$revision" && "$remote" == "$repository" && -z "$dirty" ]]; then
    AFYX_OWNERSHIP_STATE=EXTERNAL_UPSTREAM
  else
    AFYX_OWNERSHIP_STATE=FOREIGN_UNPROVEN
  fi
}

afyx_write_skill_marker() {
  local target="$1" component="$2" owner="$3" version="$4" repository="${5:-}" revision="${6:-}" digest
  digest=''
  if [[ "$owner" == afyx ]]; then digest="$(afyx_skill_digest "$target")" || return 1; fi
  cat >"$target/$AFYX_SKILL_MARKER" <<EOF
{
  "schema": 1,
  "product": "Afyx Codex Engineering Kit",
  "component": "$component",
  "owner": "$owner",
  "version": "$version",
  "content_sha256": "$digest",
  "source_repository": "$repository",
  "source_revision": "$revision"
}
EOF
  if [[ "$owner" == upstream && -d "$target/.git" ]]; then
    mkdir -p "$target/.git/info" || return 1
    grep -qxF "/$AFYX_SKILL_MARKER" "$target/.git/info/exclude" 2>/dev/null || printf '/%s\n' "$AFYX_SKILL_MARKER" >>"$target/.git/info/exclude"
  fi
}

afyx_backup_skill() {
  local component="$1" target="$2" destination count
  mkdir -p "$afyx_backup_root/$component" || return 1
  count="$(find "$afyx_backup_root/$component" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$count" -ge "$afyx_backup_limit" ]]; then
    printf 'Backup retention limit (%s) reached for %s; no historical backup was deleted.\n' "$afyx_backup_limit" "$component" >&2
    return 1
  fi
  destination="$afyx_backup_root/$component/$(date +%Y%m%d-%H%M%S)-$$"
  cp -a "$target" "$destination" || return 1
  printf '%s' "$destination"
}

afyx_promote_skill() {
  local component="$1" label="$2" stage="$3" target="$4" owner="$5" version="$6" repository="${7:-}" revision="${8:-}" authorize="${9:-false}"
  local parent old='' backup='' expected state
  expected="$owner"
  afyx_assert_skill_target "$skills_root" "$target" || return 1
  afyx_recover_skill_transaction "$target" || return 1
  [[ -d "$stage" && ! -L "$stage" ]] || { printf '%s staging directory is unsafe.\n' "$label" >&2; return 1; }
  afyx_skill_manifest_check "$stage" "$(afyx_component_field "$component" version_required)" || { printf '%s staged manifest is invalid: %s.\n' "$label" "$AFYX_DETAIL" >&2; return 1; }
  afyx_write_skill_marker "$stage" "$component" "$owner" "$version" "$repository" "$revision" || return 1
  afyx_classify_skill "$target" "$component" "$expected"; state="$AFYX_OWNERSHIP_STATE"
  if [[ "$state" != NOT_INSTALLED ]]; then
    case "$state" in
      AFYX_OWNED_UNMODIFIED|EXTERNAL_UPSTREAM) ;;
      AFYX_OWNED_MODIFIED|FOREIGN_UNPROVEN)
        [[ "$authorize" == true ]] || { printf 'Refusing to replace %s (%s) without explicit authorization.\n' "$target" "$state" >&2; return 1; } ;;
      *) printf 'Refusing unsafe skill target %s (%s).\n' "$target" "$state" >&2; return 1 ;;
    esac
    backup="$(afyx_backup_skill "$component" "$target")" || return 1
    parent="$(dirname "$target")"; old="$parent/.$(basename "$target").afyx-old"
    [[ ! -e "$old" ]] || { printf 'Transaction recovery path already exists: %s\n' "$old" >&2; return 1; }
    mv "$target" "$old" || return 1
  fi
  if ! mv "$stage" "$target"; then
    [[ -n "$old" && -e "$old" && ! -e "$target" ]] && mv "$old" "$target"
    return 1
  fi
  afyx_classify_skill "$target" "$component" "$expected"
  if [[ "$AFYX_OWNERSHIP_STATE" != AFYX_OWNED_UNMODIFIED && "$AFYX_OWNERSHIP_STATE" != EXTERNAL_UPSTREAM ]]; then
    rm -rf -- "$target"
    [[ -n "$old" && -e "$old" ]] && mv "$old" "$target"
    printf '%s post-install ownership verification failed.\n' "$label" >&2
    return 1
  fi
  if [[ -n "$old" && -e "$old" ]]; then rm -rf -- "$old"; fi
  if [[ -n "$backup" ]]; then printf 'Backup: %s\n' "$backup" >&2; fi
  return 0
}

afyx_remove_skill() {
  local component="$1" target="$2" expected_owner="$3" state backup
  afyx_assert_skill_target "$skills_root" "$target" || return 1
  afyx_recover_skill_transaction "$target" || return 1
  afyx_classify_skill "$target" "$component" "$expected_owner"; state="$AFYX_OWNERSHIP_STATE"
  [[ "$state" == NOT_INSTALLED ]] && return 0
  [[ "$state" == AFYX_OWNED_UNMODIFIED || "$state" == EXTERNAL_UPSTREAM ]] || {
    printf 'Refusing to remove %s because installed ownership is %s.\n' "$target" "$state" >&2; return 1;
  }
  backup="$(afyx_backup_skill "$component" "$target")" || return 1
  rm -rf -- "$target" || return 1
  printf 'Removed: %s (backup: %s)\n' "$target" "$backup"
}
