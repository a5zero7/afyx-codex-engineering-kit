#!/usr/bin/env python3
"""Focused AFYX-259 tests for the cross-platform artifact identity seam."""

from __future__ import annotations

import json
import hashlib
import os
import platform
import shutil
import stat
import subprocess
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/afyx-graph-artifact.mjs"


def host_target() -> tuple[str, str]:
    machine = platform.machine().lower()
    arch = "arm64" if machine in {"arm64", "aarch64"} else "x64"
    family = "win32" if os.name == "nt" else ("darwin" if platform.system() == "Darwin" else "linux")
    return family, f"{family}-{arch}"


def write(path: Path, text: str, executable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    if executable:
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def create_bundle(release: Path, revision: str) -> Path:
    family, target = host_target()
    name = f"afyx-graph-{target}"
    stage = release / "stage" / name
    metadata = {
        "product_name": "Afyx Graph",
        "product_version": "1.0.0",
        "cli": "afyx-graph",
        "release_channel": "technical-alpha",
        "supported_platforms": [target],
        "artifact_identity_schema": 1,
        "artifact_target": target,
        "source_revision": revision,
        "build_identity": f"git:{revision}",
        "extraction_version": 27,
    }
    write(stage / "metadata.json", json.dumps(metadata))
    write(stage / "LICENSE", "Synthetic MIT fixture\n")
    write(stage / "lib/package.json", json.dumps({"name": "@a5zero7/afyx-graph", "bin": {"afyx-graph": "./dist/bin/afyx-graph.js"}}))
    write(stage / "lib/dist/bin/afyx-graph.js", "console.log(process.argv[2] === '--version' ? '1.0.0' : 'help');\n")
    write(stage / "lib/dist/index.js", "exports.ok = true;\n")
    write(stage / "lib/dist/index.js.map", "{}\n")
    write(stage / "lib/dist/ui/shimmer-progress.js", "exports.ok = true;\n")
    write(stage / "lib/dist/extraction/extraction-version.js", "exports.EXTRACTION_VERSION = 27;\n")
    html = '<!doctype html><html><body><div id="app"></div><script src="./assets/index.js"></script>' + (" " * 180) + "</body></html>"
    write(stage / "lib/dist/viewer/index.html", html)
    write(stage / "lib/dist/viewer/assets/index.js", "console.log('fixture');\n")
    if family == "win32":
        write(stage / "bin/afyx-graph.cmd", '@echo off\r\nwhere node >nul 2>&1\r\nif errorlevel 1 echo Node.js was not found on PATH\r\nnode "%~dp0..\\lib\\dist\\bin\\afyx-graph.js" %*\r\n')
        archive = release / f"{name}.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            for path in sorted(stage.rglob("*")):
                if path.is_file():
                    bundle.write(path, path.relative_to(stage.parent))
    else:
        write(stage / "bin/afyx-graph", '#!/bin/sh\ncommand -v node >/dev/null 2>&1 || { echo "Node.js was not found on PATH" >&2; exit 1; }\nBUNDLE_DIR="$(cd "$(dirname "$0")/.." && pwd)"\nexec node "$BUNDLE_DIR/lib/dist/bin/afyx-graph.js" "$@"\n', executable=True)
        archive = release / f"{name}.tar.gz"
        with tarfile.open(archive, "w:gz") as bundle:
            bundle.add(stage, arcname=name)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    write(release / "SHA256SUMS", f"{digest}  {archive.name}\n")
    shutil.rmtree(release / "stage")
    return archive


def write_identity_metadata(path: Path, revision: str) -> None:
    _, target = host_target()
    write(path, json.dumps({
        "product_name": "Afyx Graph", "product_version": "1.0.0",
        "release_channel": "technical-alpha", "artifact_identity_schema": 1,
        "artifact_target": target, "source_revision": revision,
        "build_identity": f"git:{revision}", "extraction_version": 27,
    }))


class ArtifactIdentityTests(unittest.TestCase):
    def run_tool(self, *args: str, expected: int = 0) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            ["node", str(SCRIPT), *args], cwd=ROOT, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def prepare_retained(self, release: Path, archive: Path, revision: str) -> tuple[Path, Path, Path]:
        metadata = release / "metadata.json"
        candidate = release / "ALPHA-CANDIDATE-MANIFEST.json"
        release_manifest = release / "RELEASE-MANIFEST.json"
        checksums = release / "SHA256SUMS"
        write_identity_metadata(metadata, revision)
        self.run_tool(
            "create-release-manifest", "--directory", str(release), "--output", str(candidate),
            "--revision", revision, "--version", "1.0.0", "--tag", f"alpha-0.1-{revision}",
        )
        self.run_tool(
            "prepare-retained-artifact", "--candidate-manifest", str(candidate),
            "--release-manifest", str(release_manifest), "--checksums", str(checksums),
            "--archive", str(archive), "--metadata", str(metadata),
        )
        return candidate, release_manifest, checksums

    def test_stamp_match_mismatch_unknown_and_install_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            metadata = root / "metadata.json"
            archive = root / "bundle.zip"
            metadata.write_text(
                json.dumps({"product_name": "Afyx Graph", "product_version": "1.0.0", "release_channel": "technical-alpha"}),
                encoding="utf-8",
            )
            archive.write_bytes(b"synthetic-afyx-artifact")
            revision_a = "a" * 40
            revision_b = "b" * 40

            self.run_tool("stamp", "--metadata", str(metadata), "--target", "win32-x64", "--revision", revision_a, "--extraction-version", "27")
            match = self.run_tool("require-revision", "--metadata", str(metadata), "--requested-revision", revision_a)
            self.assertEqual(json.loads(match.stdout)["revisionStatus"], "MATCH")
            mismatch = self.run_tool("require-revision", "--metadata", str(metadata), "--requested-revision", revision_b, expected=3)
            self.assertEqual(json.loads(mismatch.stdout)["revisionStatus"], "REVISION_MISMATCH")

            self.run_tool("record-install", "--metadata", str(metadata), "--archive", str(archive), "--provenance", "explicit-archive", "--requested-revision", revision_b)
            installed = json.loads(metadata.read_text(encoding="utf-8"))
            self.assertEqual(installed["source_revision"], revision_a)
            self.assertEqual(installed["requested_checkout_revision"], revision_b)
            self.assertEqual(installed["revision_status"], "REVISION_MISMATCH")
            self.assertEqual(len(installed["archive_sha256"]), 64)

            installed.pop("source_revision")
            metadata.write_text(json.dumps(installed), encoding="utf-8")
            unknown = self.run_tool("require-revision", "--metadata", str(metadata), "--requested-revision", revision_b, expected=4)
            self.assertEqual(json.loads(unknown.stdout)["revisionStatus"], "UNKNOWN")

    def test_release_manifest_binds_digest_target_revision_and_version(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            release = Path(raw)
            revision = "c" * 40
            archive = create_bundle(release, revision)
            family, target = host_target()
            metadata = release / "metadata.json"
            write(metadata, json.dumps({
                "product_name": "Afyx Graph", "product_version": "1.0.0",
                "release_channel": "technical-alpha", "artifact_identity_schema": 1,
                "artifact_target": target, "source_revision": revision,
                "build_identity": f"git:{revision}", "extraction_version": 27,
            }))
            manifest = release / "RELEASE-MANIFEST.json"
            self.run_tool(
                "create-release-manifest", "--directory", str(release), "--output", str(manifest),
                "--revision", revision, "--version", "1.0.0", "--tag", "afyx-graph-v1.0.0",
            )
            verified = self.run_tool(
                "verify-release-manifest", "--manifest", str(manifest), "--archive", str(archive), "--metadata", str(metadata)
            )
            self.assertEqual(json.loads(verified.stdout)["status"], "VERIFIED")

            archive.write_bytes(archive.read_bytes() + b"tampered")
            failed = self.run_tool(
                "verify-release-manifest", "--manifest", str(manifest), "--archive", str(archive), "--metadata", str(metadata), expected=1
            )
            self.assertIn("digest mismatch", failed.stderr)

    def test_retained_artifact_sidecars_are_complete_and_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            release = Path(raw)
            revision = "d" * 40
            archive = create_bundle(release, revision)
            candidate, release_manifest, checksums = self.prepare_retained(release, archive, revision)
            metadata = release / "metadata.json"

            self.assertEqual(candidate.read_bytes(), release_manifest.read_bytes())
            self.run_tool(
                "verify-retained-artifact", "--candidate-manifest", str(candidate),
                "--release-manifest", str(release_manifest), "--checksums", str(checksums),
                "--archive", str(archive), "--metadata", str(metadata),
            )

            checksums.unlink()
            missing = self.run_tool(
                "verify-retained-artifact", "--candidate-manifest", str(candidate),
                "--release-manifest", str(release_manifest), "--checksums", str(checksums),
                "--archive", str(archive), "--metadata", str(metadata), expected=1,
            )
            self.assertIn("SHA256SUMS", missing.stderr)

            _, release_manifest, checksums = self.prepare_retained(release, archive, revision)
            archive.write_bytes(archive.read_bytes() + b"tampered")
            tampered = self.run_tool(
                "verify-retained-artifact", "--candidate-manifest", str(candidate),
                "--release-manifest", str(release_manifest), "--checksums", str(checksums),
                "--archive", str(archive), "--metadata", str(metadata), expected=1,
            )
            self.assertIn("digest mismatch", tampered.stderr)

            archive = create_bundle(release, revision)
            candidate, release_manifest, checksums = self.prepare_retained(release, archive, revision)
            release_manifest.write_text(release_manifest.read_text(encoding="utf-8") + " ", encoding="utf-8")
            wrong_manifest = self.run_tool(
                "verify-retained-artifact", "--candidate-manifest", str(candidate),
                "--release-manifest", str(release_manifest), "--checksums", str(checksums),
                "--archive", str(archive), "--metadata", str(metadata), expected=1,
            )
            self.assertIn("byte-identical", wrong_manifest.stderr)

            candidate, release_manifest, checksums = self.prepare_retained(release, archive, revision)
            write_identity_metadata(metadata, "e" * 40)
            wrong_revision = self.run_tool(
                "verify-retained-artifact", "--candidate-manifest", str(candidate),
                "--release-manifest", str(release_manifest), "--checksums", str(checksums),
                "--archive", str(archive), "--metadata", str(metadata), expected=1,
            )
            self.assertIn("revision", wrong_revision.stderr)

            write_identity_metadata(metadata, revision)
            changed = json.loads(metadata.read_text(encoding="utf-8"))
            changed["artifact_target"] = "darwin-arm64" if changed["artifact_target"] != "darwin-arm64" else "linux-x64"
            write(metadata, json.dumps(changed))
            wrong_target = self.run_tool(
                "verify-retained-artifact", "--candidate-manifest", str(candidate),
                "--release-manifest", str(release_manifest), "--checksums", str(checksums),
                "--archive", str(archive), "--metadata", str(metadata), expected=1,
            )
            self.assertIn("target", wrong_target.stderr)

    def test_matching_cache_installs_and_stale_cache_preserves_existing_runtime(self) -> None:
        current = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        installer = ROOT / "scripts" / ("install-afyx-graph.ps1" if os.name == "nt" else "install-afyx-graph.sh")
        shell = shutil.which("pwsh") if os.name == "nt" else (shutil.which("bash") or "/bin/bash")
        if not shell:
            self.skipTest("host lifecycle shell is unavailable")
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            release, runtime, public_bin = base / "release", base / "runtime", base / "bin"
            release.mkdir()
            archive = create_bundle(release, current)
            self.prepare_retained(release, archive, current)
            env = os.environ.copy()
            env.update({
                "AFYX_GRAPH_RELEASE_ROOT": str(release),
                "AFYX_GRAPH_RUNTIME_ROOT": str(runtime),
                "AFYX_GRAPH_BIN_DIR": str(public_bin),
            })
            command = ([shell, "-NoProfile", "-NonInteractive", "-File", str(installer), "-RuntimeRoot", str(runtime), "-SkipPathUpdate", "-Offline", "-NoBuildFallback"]
                       if os.name == "nt" else [shell, str(installer), "--offline", "--no-build-fallback"])
            installed = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertEqual(installed.returncode, 0, installed.stdout + installed.stderr)
            metadata = json.loads((runtime / "metadata.json").read_text(encoding="utf-8-sig"))
            self.assertEqual(metadata["source_revision"], current)
            self.assertEqual(metadata["extraction_version"], 27)
            self.assertEqual(metadata["artifact_provenance"], "local-release-cache")
            self.assertEqual(metadata["revision_status"], "MATCH")
            self.assertEqual(metadata["release_manifest_status"], "VERIFIED")
            self.assertEqual(metadata["publisher_authenticity"], "UNVERIFIED")
            self.assertEqual(metadata["build_provenance"], "COMMIT_BOUND_MANIFEST")
            self.assertEqual(len(metadata["archive_sha256"]), 64)

            metadata["source_revision"] = "b" * 40
            write(runtime / "metadata.json", json.dumps(metadata))
            validate = ([shell, "-NoProfile", "-NonInteractive", "-File", str(installer), "-RuntimeRoot", str(runtime), "-SkipPathUpdate", "-ValidateOnly"]
                        if os.name == "nt" else [shell, str(installer), "--validate-only"])
            drift = subprocess.run(validate, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertEqual(drift.returncode, 0, drift.stdout + drift.stderr)
            self.assertIn("REVISION MISMATCH", drift.stdout)
            self.assertIn("UpdateAvailable", drift.stdout)

            old_metadata = {"product_name": "Afyx Graph", "product_version": "0.9.0", "sentinel": "preserve-me"}
            write(runtime / "metadata.json", json.dumps(old_metadata))
            create_bundle(release, "b" * 40)
            stale_command = command[:-1] + (["-Replace", "-NoBuildFallback"] if os.name == "nt" else ["--replace", "--no-build-fallback"])
            stale = subprocess.run(stale_command, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertNotEqual(stale.returncode, 0)
            self.assertIn("valid but stale", (stale.stdout + stale.stderr).lower())
            preserved = json.loads((runtime / "metadata.json").read_text(encoding="utf-8-sig"))
            self.assertEqual(preserved["sentinel"], "preserve-me")

    def test_explicit_archive_preserves_unknown_revision_truthfully(self) -> None:
        installer = ROOT / "scripts" / ("install-afyx-graph.ps1" if os.name == "nt" else "install-afyx-graph.sh")
        shell = shutil.which("pwsh") if os.name == "nt" else (shutil.which("bash") or "/bin/bash")
        if not shell:
            self.skipTest("host lifecycle shell is unavailable")
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            release, runtime = base / "release", base / "runtime"
            release.mkdir()
            archive = create_bundle(release, "UNKNOWN")
            env = os.environ.copy()
            env.update({"AFYX_GRAPH_RUNTIME_ROOT": str(runtime), "AFYX_GRAPH_BIN_DIR": str(base / "bin")})
            command = ([shell, "-NoProfile", "-NonInteractive", "-File", str(installer), "-RuntimeRoot", str(runtime), "-SkipPathUpdate", "-Offline", "-ArchivePath", str(archive)]
                       if os.name == "nt" else [shell, str(installer), "--offline", "--archive", str(archive)])
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            installed = json.loads((runtime / "metadata.json").read_text(encoding="utf-8-sig"))
            self.assertEqual(installed["source_revision"], "UNKNOWN")
            self.assertEqual(installed["revision_status"], "UNKNOWN")
            self.assertEqual(installed["artifact_provenance"], "explicit-archive")
            self.assertEqual(installed["release_manifest_status"], "MISSING")
            self.assertEqual(installed["publisher_authenticity"], "UNVERIFIED")
            self.assertEqual(installed["build_provenance"], "UNVERIFIED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
