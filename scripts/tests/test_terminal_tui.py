from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "scripts" / "lib" / "AfyxTerminal.psm1"


def powershell() -> str | None:
    return shutil.which("pwsh") or shutil.which("powershell")


class TerminalPresentationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.shell = powershell()
        if not cls.shell:
            raise unittest.SkipTest("PowerShell is unavailable")

    def run_ps(self, script: str, *, env: dict[str, str] | None = None, expected: int = 0) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            [self.shell, "-NoProfile", "-NonInteractive", "-Command", script],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def test_module_import_is_quiet_and_exports_only_approved_public_verbs(self) -> None:
        result = self.run_ps(
            f"Import-Module '{MODULE}' -Force; "
            "(Get-Command -Module AfyxTerminal | Select-Object -ExpandProperty Name) -join ','"
        )
        self.assertNotIn("unapproved verbs", result.stderr.lower())
        self.assertIn("Read-AfyxSingleChoice", result.stdout)
        self.assertIn("Show-AfyxReceipt", result.stdout)

    @unittest.skipUnless(os.name == "nt", "Windows PowerShell 5.1 is Windows-only")
    def test_module_imports_in_windows_powershell_51(self) -> None:
        windows_powershell = shutil.which("powershell.exe")
        if not windows_powershell:
            self.skipTest("Windows PowerShell 5.1 unavailable")
        result = subprocess.run(
            [
                windows_powershell,
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                f"$ErrorActionPreference='Stop'; Import-Module '{MODULE}' -Force; 'IMPORTED'",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout.strip(), "IMPORTED")

    def test_plain_and_ansi_modes_preserve_identical_facts(self) -> None:
        script = f"""
Import-Module '{MODULE}' -Force
$plain = [pscustomobject]@{{ Ansi = $false; Interactive = $false; Width = 80 }}
$ansi = [pscustomobject]@{{ Ansi = $true; Interactive = $true; Width = 80 }}
$expected = '[HEALTHY] Afyx Graph — version=1.0.0'
$colored = (Get-AfyxStyledText -Text '[HEALTHY]' -Tone Success -Terminal $ansi) + ' Afyx Graph — version=1.0.0'
$stripped = $colored -replace "$([char]27)\\[[0-9;]*m", ''
[pscustomobject]@{{ Expected = $expected; Stripped = $stripped; Plain = (Get-AfyxStyledText -Text $expected -Terminal $plain) }} | ConvertTo-Json -Compress
"""
        result = self.run_ps(script)
        self.assertIn('"Expected":"[HEALTHY] Afyx Graph', result.stdout)
        self.assertIn('"Stripped":"[HEALTHY] Afyx Graph', result.stdout)
        self.assertIn('"Plain":"[HEALTHY] Afyx Graph', result.stdout)

    def test_no_color_disables_ansi(self) -> None:
        env = os.environ.copy()
        env["NO_COLOR"] = "1"
        result = self.run_ps(f"Import-Module '{MODULE}' -Force; Test-AfyxAnsiSupport", env=env)
        self.assertEqual(result.stdout.strip(), "False")

    def test_narrow_width_wrap_is_bounded(self) -> None:
        result = self.run_ps(
            f"Import-Module '{MODULE}' -Force; "
            "$lines=@(Format-AfyxWrappedText -Text ('alpha beta gamma delta epsilon zeta eta theta') -Width 18 -Indent '  '); "
            "if(@($lines|Where-Object{$_.Length -gt 18}).Count){throw 'overflow'}; $lines.Count"
        )
        self.assertGreater(int(result.stdout.strip()), 1)

    def test_arrow_navigation_selects_next_enabled_option(self) -> None:
        script = f"""
Import-Module '{MODULE}' -Force
$terminal=[pscustomobject]@{{Ansi=$false;Interactive=$true;Width=80}}
$options=@(
 [pscustomobject]@{{Id='first';Label='First';Enabled=$true}},
 [pscustomobject]@{{Id='disabled';Label='Disabled';Enabled=$false}},
 [pscustomobject]@{{Id='third';Label='Third';Enabled=$true}}
)
$keys=[Collections.Queue]::new()
$keys.Enqueue([ConsoleKeyInfo]::new([char]0,[ConsoleKey]::DownArrow,$false,$false,$false))
$keys.Enqueue([ConsoleKeyInfo]::new([char]13,[ConsoleKey]::Enter,$false,$false,$false))
Read-AfyxSingleChoice -Prompt test -Options $options -DefaultId first -Terminal $terminal -ReadKey {{$keys.Dequeue()}} -NoRender
"""
        result = self.run_ps(script)
        self.assertEqual(result.stdout.strip(), "third")

    def test_space_toggles_multiple_components(self) -> None:
        script = f"""
Import-Module '{MODULE}' -Force
$terminal=[pscustomobject]@{{Ansi=$false;Interactive=$true;Width=80}}
$options=@([pscustomobject]@{{Id='a';Label='A'}},[pscustomobject]@{{Id='b';Label='B'}})
$keys=[Collections.Queue]::new()
$keys.Enqueue([ConsoleKeyInfo]::new(' ',[ConsoleKey]::Spacebar,$false,$false,$false))
$keys.Enqueue([ConsoleKeyInfo]::new([char]0,[ConsoleKey]::DownArrow,$false,$false,$false))
$keys.Enqueue([ConsoleKeyInfo]::new(' ',[ConsoleKey]::Spacebar,$false,$false,$false))
$keys.Enqueue([ConsoleKeyInfo]::new([char]13,[ConsoleKey]::Enter,$false,$false,$false))
@(Read-AfyxMultiChoice -Prompt test -Options $options -Terminal $terminal -ReadKey {{$keys.Dequeue()}} -NoRender) -join ','
"""
        result = self.run_ps(script)
        self.assertEqual(result.stdout.strip(), "a,b")

    def test_escape_cancels_before_mutation(self) -> None:
        script = f"""
Import-Module '{MODULE}' -Force
$terminal=[pscustomobject]@{{Ansi=$false;Interactive=$true;Width=80}}
$options=@([pscustomobject]@{{Id='a';Label='A'}})
try {{
 Read-AfyxSingleChoice -Prompt test -Options $options -Terminal $terminal -ReadKey {{[ConsoleKeyInfo]::new([char]27,[ConsoleKey]::Escape,$false,$false,$false)}} -NoRender
 throw 'not cancelled'
}} catch [OperationCanceledException] {{ 'CANCELLED' }}
"""
        result = self.run_ps(script)
        self.assertEqual(result.stdout.strip(), "CANCELLED")

    def test_numbered_fallback_works_without_advanced_terminal(self) -> None:
        script = f"""
Import-Module '{MODULE}' -Force
$terminal=[pscustomobject]@{{Ansi=$false;Interactive=$false;Width=60}}
$options=@([pscustomobject]@{{Id='a';Label='A'}},[pscustomobject]@{{Id='b';Label='B'}})
Read-AfyxSingleChoice -Prompt test -Options $options -Terminal $terminal -ReadLine {{'2'}} -NoRender
"""
        result = self.run_ps(script)
        self.assertEqual(result.stdout.strip(), "b")

    def test_outcome_status_distinguishes_healthy_skip_from_uninstalled_skip(self) -> None:
        result = self.run_ps(
            f"Import-Module '{MODULE}' -Force; "
            "@((Get-AfyxOutcomeStatus -ComponentState HEALTHY -Action skipped),"
            "(Get-AfyxOutcomeStatus -ComponentState 'NOT INSTALLED' -Action skipped),"
            "(Get-AfyxOutcomeStatus -ComponentState HEALTHY -Action update -WhatIf)) -join '|'"
        )
        self.assertEqual(result.stdout.strip(), "NO CHANGE|SKIPPED|PLANNED")

    def test_powershell_sources_parse(self) -> None:
        for source in (ROOT / "install.ps1", ROOT / "verify.ps1", MODULE):
            script = (
                "$errors=$null; [Management.Automation.Language.Parser]::ParseFile("
                f"'{source}',[ref]$null,[ref]$errors)|Out-Null; "
                "if($errors.Count){$errors|ForEach-Object{$_.Message};exit 1}"
            )
            self.run_ps(script)

    def test_validate_only_and_whatif_are_plain_noninteractive_and_immutable(self) -> None:
        with tempfile.TemporaryDirectory(prefix="afyx-tui-readonly-") as raw:
            root = Path(raw)
            env = os.environ.copy()
            env.update(
                {
                    "USERPROFILE": str(root / "profile"),
                    "HOME": str(root / "profile"),
                    "APPDATA": str(root / "appdata"),
                    "CODEX_HOME": str(root / "codex"),
                    "AFYX_GRAPH_RUNTIME_ROOT": str(root / "graph"),
                    "AFYX_CONTEXT_RUNTIME_ROOT": str(root / "context"),
                    "NO_COLOR": "1",
                }
            )
            validate = subprocess.run(
                [self.shell, "-NoProfile", "-NonInteractive", "-File", str(ROOT / "install.ps1"),
                 "-ValidateOnly", "-Preset", "custom", "-Provider", "codex", "-SkipProviderConfiguration"],
                cwd=ROOT, env=env, text=True, capture_output=True, timeout=90,
            )
            self.assertEqual(validate.returncode, 0, validate.stdout + validate.stderr)
            self.assertNotIn("\x1b[", validate.stdout + validate.stderr)
            self.assertNotIn("Selection", validate.stdout + validate.stderr)

            whatif = subprocess.run(
                [self.shell, "-NoProfile", "-NonInteractive", "-File", str(ROOT / "install.ps1"),
                 "-WhatIf", "-Preset", "minimal", "-Provider", "codex", "-SkipProviderConfiguration",
                 "-SkillsRoot", str(root / "skills"), "-Confirm:$false"],
                cwd=ROOT, env=env, text=True, capture_output=True, timeout=90,
            )
            self.assertEqual(whatif.returncode, 0, whatif.stdout + whatif.stderr)
            self.assertIn("no files or configuration were changed", whatif.stdout)
            self.assertFalse((root / "skills").exists())
            self.assertFalse((root / "graph").exists())
            self.assertFalse((root / "context").exists())
            self.assertFalse((root / "codex").exists())

    def test_installer_keeps_wizard_separate_from_lifecycle_engine(self) -> None:
        source = (ROOT / "install.ps1").read_text(encoding="utf-8")
        self.assertIn("AfyxTerminal.psm1", source)
        self.assertIn("Read-AfyxSingleChoice", source)
        self.assertIn("Read-AfyxMultiChoice", source)
        self.assertLess(source.index("Read-AfyxConfirmation"), source.index("$summary = [ordered]@{}"))
        self.assertIn("Get-AfyxControlPlan", source)
        self.assertIn("Install-AfyxSkillTransaction", source)
        self.assertNotIn("Spectre", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
