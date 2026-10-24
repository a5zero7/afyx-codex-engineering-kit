# Installation and Lifecycle Guide

This guide covers supported Kit onboarding on native Windows, Linux, and macOS,
plus standalone Graph and ACE development. Preview first: installation changes
only selected Afyx-owned destinations, but those changes are real.

## Requirements

| Requirement | When needed | Notes |
|---|---|---|
| Git | Always | Clone, source identity, and safe fast-forward update |
| Windows PowerShell 5.1+ or PowerShell 7 | Windows | Native Windows path; WSL is not required |
| Bash 3.2+ | Linux/macOS | `install.sh`, `update.sh`, `verify.sh`, `uninstall.sh` |
| Codex CLI or ChatGPT/Codex VS Code extension | Skill host | At least one supported host |
| Node.js 22.5+ | Graph or ACE | External runtime; not bundled in archives |
| npm | Local build fallback/development | Not required by an already packaged runtime |
| Archive and SHA-256 support | Graph artifact install | Platform package integrity checks |

Headroom and Prompt Master are optional external products. They are not normal
installation prerequisites.

## Presets are desired state

The canonical preset membership comes from
[`scripts/components.json`](../scripts/components.json):

| Preset | Desired components |
|---|---|
| `minimal` | `efficient-coding`, `odoo-engineering` |
| `recommended` | Minimal + `afyx-engineering-expert` |
| `full` | Recommended + `afyx-graph` + Windows-only `codex-usage-tracking` |
| `custom` | Exactly the repeated explicit component IDs |

On Linux/macOS, Windows-only Usage Tracking is `NOT_APPLICABLE`, not a failed
installation. ACE (`afyx-context`) and external Prompt Master are absent from all
implicit presets. Components outside the desired plan are preserved, not removed.

## Windows Native / PowerShell

### Clone and inspect

```powershell
git clone https://github.com/a5zero7/afyx-codex-engineering-kit.git
Set-Location afyx-codex-engineering-kit
git status --short
.\install.ps1 -ValidateOnly
.\install.ps1 -WhatIf -Preset recommended
```

`-ValidateOnly` performs inventory/validation. `-WhatIf` previews the selected
PowerShell plan. Neither is an installation acceptance result.

### Install a preset

```powershell
.\install.ps1 -Preset minimal
.\install.ps1 -Preset recommended
.\install.ps1 -Preset full
```

Run one of these, not all three. Full may configure the Afyx-owned Graph MCP entry
through `codex mcp` and update user PATH for the Graph launcher. Opt out explicitly:

```powershell
.\install.ps1 -Preset full -SkipGraphMcp -SkipGraphPathUpdate
```

### Install selected components

```powershell
.\install.ps1 -Preset custom `
  -CustomComponent efficient-coding `
  -CustomComponent afyx-graph
```

ACE is a managed explicit option:

```powershell
.\install.ps1 -Preset custom -CustomComponent afyx-context -Confirm:$false
```

An equivalent direct lifecycle action is available when not using a preset:

```powershell
.\install.ps1 -ComponentAction afyx-context=install -Confirm:$false
```

A preset is immutable for one operation; do not combine it with component actions
or force replacement.

## Linux / Bash

```bash
git clone https://github.com/a5zero7/afyx-codex-engineering-kit.git
cd afyx-codex-engineering-kit
./install.sh --validate-only
./install.sh --dry-run --preset recommended
./install.sh --preset recommended
```

Explicit selection:

```bash
./install.sh --preset custom \
  --custom-component efficient-coding \
  --custom-component afyx-graph

./install.sh --preset custom --custom-component afyx-context
```

Skip Graph MCP registration when required:

```bash
./install.sh --preset full --skip-graph-mcp
```

## macOS / Bash

Use the same Bash entrypoints as Linux:

```bash
xcode-select -p >/dev/null 2>&1 || echo "Install Apple Command Line Tools first"
git clone https://github.com/a5zero7/afyx-codex-engineering-kit.git
cd afyx-codex-engineering-kit
./install.sh --validate-only
./install.sh --dry-run --preset recommended
./install.sh --preset recommended
```

The scripts remain Bash 3.2 compatible. Graph selects a `darwin-x64` or
`darwin-arm64` artifact from the detected host architecture.

## What installation owns

Default locations:

| Asset | Default location | Override |
|---|---|---|
| Skills | `~/.agents/skills/<component>` | `-SkillsRoot` / `--skills-root` |
| Graph runtime | `~/.afyx/graph` | process environment `AFYX_GRAPH_RUNTIME_ROOT` |
| ACE runtime | `~/.afyx/context` | `-ContextRuntimeRoot`, `--context-runtime-root`, or `AFYX_CONTEXT_RUNTIME_ROOT` |
| Backups | `~/.afyx/backups/<component>` | `AFYX_BACKUP_ROOT` |
| Codex home | `~/.codex` | existing `CODEX_HOME` |

The Kit does not take ownership of credentials, provider/model selection,
Headroom, unrelated MCP entries, existing project indexes, or foreign targets.
Skill ownership is recorded in `.afyx-install.json`; runtime ownership uses
component metadata. Canonical containment, symlinks/reparse points, markers, and
content integrity are checked before replacement/removal.

## Graph installation and project initialization

Graph is installed as a runtime, not a skill. The installer prefers a matching
platform artifact, validates checksum and metadata, and can fall back to a clean
local build from the checked-out source. Use:

```powershell
.\install.ps1 -Offline -ComponentAction afyx-graph=install
.\install.ps1 -NoBuildFallback -ComponentAction afyx-graph=install
```

```bash
./install.sh --offline --component afyx-graph=install
./install.sh --no-build-fallback --component afyx-graph=install
```

Dirty source is rejected for fallback unless the operator explicitly supplies
`-AllowDirtySource` / `--allow-dirty-source`; doing so weakens reproducible
provenance and should be recorded.

After installation, project initialization is a separate operation:

```bash
afyx-graph init /absolute/project --yes
afyx-graph status /absolute/project
```

This creates or updates project state only when requested. Installation itself
does not initialize customer repositories.

### External Graph state

Use an absolute, dedicated external state directory for a read-only corpus:

```powershell
$env:AFYX_GRAPH_STATE_DIR = 'D:\AfyxState\project-a'
afyx-graph init 'D:\Source\project-a' --yes
afyx-graph status 'D:\Source\project-a'
```

```bash
export AFYX_GRAPH_STATE_DIR="$HOME/.local/state/afyx/project-a"
afyx-graph init "$HOME/src/project-a" --yes
afyx-graph status "$HOME/src/project-a"
```

Use the same environment for CLI and MCP. The directory must be outside the
project, non-overlapping, writable, free from alias/symlink/reparse ambiguity,
and empty or already bound to that exact canonical root. Invalid state fails
closed and never falls back to `.afyx-graph/`.

## ACE standalone versus Kit-managed

### Kit-managed runtime

Select `afyx-context` explicitly as shown above. Verify it with a matching Custom
plan:

```powershell
.\verify.ps1 -Preset custom -CustomComponent afyx-context
```

```bash
./verify.sh --preset custom --custom-component afyx-context
```

Installation does not enable Graph–ACE integration. The bridge remains default
OFF until a consumer is explicitly created with `enabled: true` and an owned
absolute state directory.

### Source development

From `afyx-context/`:

```bash
npm ci
npm run build:clean
npm test
npm pack --dry-run
```

This builds/tests source; it is not a managed installation. Use the Kit entrypoint
for runtime lifecycle behavior.

## Verification and result interpretation

```powershell
.\verify.ps1 -Preset full
.\scripts\afyx-doctor.ps1 -ProjectPath C:\src\project
```

```bash
./verify.sh --preset full
./scripts/afyx-doctor.sh --project /src/project
```

`verify` checks component state against a desired plan. Mandatory selected
components that are missing, drifted, or unverified fail. Optional environment
capabilities are reported separately. For Graph MCP, distinguish:

- `MCP_NOT_CONFIGURED`: no Afyx entry was selected.
- `MCP_CONFIGURED`: configuration exists but live reachability was not proved.
- `MCP_REACHABLE`: initialize and tools/list handshake succeeded.
- `MCP_BLOCKED` / `MCP_HANDSHAKE_FAILED`: inspect the reported path/process error.

Doctor is read-only and does not repair or synchronize Graph. Its lightweight
index diagnosis is not a substitute for `afyx-graph status` or a database query.

## Update

```powershell
.\update.ps1 -Preset recommended
.\update.ps1 -SkipSelfUpdate -ComponentAction afyx-context=update
```

```bash
./update.sh --preset recommended
./update.sh --skip-self-update --component afyx-context=update
```

By default the updater requires a clean Kit checkout and uses `git pull --ff-only`
before running the same lifecycle engine. Dirty source stops before installation.
`SkipSelfUpdate` / `--skip-self-update` intentionally uses the current checkout;
it does not reconcile that checkout.

## Uninstall

Uninstall only components whose ownership can be proved:

```powershell
.\uninstall.ps1 -Component afyx-engineering-expert
.\uninstall.ps1 -RemoveAfyxContext
.\uninstall.ps1 -RemoveAfyxGraph
```

```bash
./uninstall.sh --component afyx-engineering-expert
./uninstall.sh --remove-afyx-context
./uninstall.sh --remove-afyx-graph
```

Prompt Master requires its own explicit remove flag. Graph uninstall removes the
managed runtime, not project `.afyx-graph`/external indexes. ACE uninstall retains
independent ACE state; it does not interpret that state as runtime payload.

## Recovery and rollback

Install/update/repair stages a candidate, validates it, backs up the verified old
target, and promotes atomically. A failure attempts rollback. If interruption
leaves a deterministic owned recovery directory and no target, retry may restore
it. Foreign/missing/invalid ownership metadata or an ambiguous target+recovery
combination fails closed for manual inspection.

Backups default to `~/.afyx/backups/<component>` with a default maximum of 20 per
component. Reaching the limit stops instead of silently deleting old evidence.
Do not copy a backup over an existing target; first prove the destination and
ownership boundary.

## Artifact integrity and provenance

SHA-256 proves byte integrity, not publisher identity. A release manifest binds
target, version, source revision, and digest. GitHub attestation can provide an
independent provenance signal when it is actually verified. Otherwise metadata
must continue to report publisher/build authenticity as `UNVERIFIED` rather than
inferring trust from a self-generated checksum.

## Common failures

| Symptom | Safe response |
|---|---|
| `UNKNOWN` or foreign ownership | Stop; inspect target/marker. Force is not proof of ownership. |
| Dirty Kit checkout during update | Review `git status`; commit/stash intentionally or use skip-self-update knowingly. |
| No matching Graph artifact | Permit clean local fallback with npm, or use no-build-fallback to stop. |
| Graph state path rejected | Correct absolute containment/binding; never delete or rebind foreign state automatically. |
| MCP handshake fails | Verify installed Node entrypoint, Codex CLI, and exact Afyx-owned MCP entry. |
| ACE lock recovery unsafe | Preserve lock/state; verify host/PID identity. Lock age alone is insufficient. |
| Interrupted swap is ambiguous | Preserve target and recovery directories and inspect ownership metadata before retry. |
| Full on Linux/macOS reports Usage Tracking N/A | Expected platform classification, not component failure. |

For read-only checks and project-detection semantics, continue with
[Diagnostics](DIAGNOSTICS.md). For feature-specific operation, see the
[Component Guide](COMPONENTS.md).
