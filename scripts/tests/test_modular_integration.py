#!/usr/bin/env python3
"""Permanent acceptance regression tests for Afyx Product Identity and Modular Integration Foundation (TASK K01).

Covers:
1. Canonical Product Identity & Branding Preservation
2. Standalone Operation
3. Modular Integration & 8 Capability Lifecycle States
4. Representative Task Routing & Redundancy Suppression
5. Safety, Degradation, and User Override Priority
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULAR_MODULE = ROOT / "scripts/afyx-modular-integration.mjs"
REGISTRY = ROOT / "scripts/components.json"
ARCHITECTURE_DOC = ROOT / "docs/AFYX_MODULAR_INTEGRATION_CONTRACT.md"


def run_node(source: str) -> dict:
    """Executes a small ES module snippet with Node.js and returns JSON output."""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(f"Node execution failed (code {result.returncode}):\n{result.stdout}\n{result.stderr}")
    return json.loads(result.stdout)


class ModularIntegrationFoundationTests(unittest.TestCase):
    """Test suite for Afyx Modular Integration Foundation and Product Identity."""

    def setUp(self) -> None:
        self.registry_data = json.loads(REGISTRY.read_text(encoding="utf-8"))

    # -------------------------------------------------------------------------
    # 1. Product Identity & Branding Tests
    # -------------------------------------------------------------------------

    def test_canonical_product_display_names_are_consistent(self) -> None:
        """Verifies that all 7 Afyx-owned products expose their canonical display names."""
        source = f"""
import {{ PRODUCT_INVENTORY }} from {json.dumps(MODULAR_MODULE.as_uri())};
console.log(JSON.stringify(PRODUCT_INVENTORY));
"""
        inventory = run_node(source)

        expected_names = {
            "afyx-graph": "Afyx Graph",
            "afyx-context": "Afyx Context Engine",
            "afyx-engineering-expert": "Afyx Engineering Expert",
            "odoo-engineering": "Afyx Odoo Engineering",
            "efficient-coding": "Afyx Efficient Coding",
            "codex-usage-tracking": "Afyx Codex Usage Tracking",
            "afyx-forge": "Afyx Forge",
        }

        for comp_id, expected_name in expected_names.items():
            self.assertIn(comp_id, inventory, f"Missing component {comp_id} in product inventory")
            self.assertEqual(
                inventory[comp_id]["canonicalName"],
                expected_name,
                f"Mismatch canonical name for {comp_id}",
            )

    def test_registry_metadata_exposes_canonical_display_names_and_retains_stable_ids(self) -> None:
        """Verifies scripts/components.json preserves stable IDs while exposing canonical display names."""
        components = {c["id"]: c for c in self.registry_data["components"]}

        expected_display_names = {
            "efficient-coding": "Afyx Efficient Coding",
            "odoo-engineering": "Afyx Odoo Engineering",
            "afyx-engineering-expert": "Afyx Engineering Expert",
            "afyx-graph": "Afyx Graph",
            "afyx-context": "Afyx Context Engine",
            "codex-usage-tracking": "Afyx Codex Usage Tracking",
        }

        for comp_id, expected_name in expected_display_names.items():
            self.assertIn(comp_id, components, f"Stable ID {comp_id} missing in components.json")
            self.assertEqual(
                components[comp_id]["display_name"],
                expected_name,
                f"Display name mismatch for {comp_id}",
            )

    def test_third_party_dependencies_retain_proper_identity(self) -> None:
        """Confirms that external tools and platforms are not rebranded as Afyx products."""
        providers = {p["provider"]: p for p in self.registry_data["providers"]}
        self.assertEqual(providers["codex"]["name"], "Codex")
        self.assertEqual(providers["antigravity"]["name"], "Antigravity")
        self.assertEqual(providers["claude"]["name"], "Claude Code")
        self.assertEqual(providers["codex"]["ownership_class"], "USER")

        prereqs = {p["key"]: p for p in self.registry_data["prerequisites"]}
        self.assertIn("git", prereqs)
        self.assertIn("node", prereqs)
        self.assertIn("platform-shell", prereqs)

    # -------------------------------------------------------------------------
    # 2. Standalone Operation Tests
    # -------------------------------------------------------------------------

    def test_components_operate_independently_when_others_absent(self) -> None:
        """Verifies that an installed component functions without requiring other Afyx products."""
        source = f"""
import {{ resolveModularCapabilityPlan }} from {json.dumps(MODULAR_MODULE.as_uri())};

// Case A: Only Efficient Coding is installed
const planA = resolveModularCapabilityPlan(
  {{ taskType: 'simple-fix', intent: 'Fix typo in string' }},
  {{ 'efficient-coding': {{ installed: true, healthy: true }} }}
);

// Case B: Only Graph is installed for impact query
const planB = resolveModularCapabilityPlan(
  {{ taskType: 'impact-analysis', needsRelationalEvidence: true }},
  {{ 'afyx-graph': {{ installed: true, healthy: true }} }}
);

// Case C: Only Odoo Engineering is installed on an Odoo project
const planC = resolveModularCapabilityPlan(
  {{ taskType: 'odoo-issue', project: {{ isOdoo: true }} }},
  {{ 'odoo-engineering': {{ installed: true, healthy: true }} }}
);

console.log(JSON.stringify({{ planA, planB, planC }}));
"""
        res = run_node(source)

        # Plan A: Efficient Coding succeeds standalone
        self.assertIn("efficient-coding", res["planA"]["selectedComponents"])
        self.assertEqual(res["planA"]["componentStates"]["afyx-graph"], "UNAVAILABLE")

        # Plan B: Graph succeeds standalone
        self.assertIn("afyx-graph", res["planB"]["selectedComponents"])
        self.assertEqual(res["planB"]["componentStates"]["afyx-context"], "UNAVAILABLE")

        # Plan C: Odoo Engineering succeeds standalone
        self.assertIn("odoo-engineering", res["planC"]["selectedComponents"])
        self.assertEqual(res["planC"]["componentStates"]["afyx-engineering-expert"], "UNAVAILABLE")

    # -------------------------------------------------------------------------
    # 3. Modular Integration & Lifecycle State Tests
    # -------------------------------------------------------------------------

    def test_eight_lifecycle_states_are_explicit_and_distinguished(self) -> None:
        """Verifies the 8 canonical lifecycle states from discovery to execution."""
        source = f"""
import {{ CAPABILITY_LIFECYCLE_STATES }} from {json.dumps(MODULAR_MODULE.as_uri())};
console.log(JSON.stringify(CAPABILITY_LIFECYCLE_STATES));
"""
        states = run_node(source)
        expected = [
            "INSTALLED",
            "AVAILABLE",
            "ELIGIBLE",
            "SELECTED",
            "ACTIVATED",
            "EXECUTED",
            "DEGRADED",
            "UNAVAILABLE",
        ]
        self.assertEqual(states, expected)

    def test_safe_degradation_when_optional_component_is_absent(self) -> None:
        """Verifies safe degradation to DIRECT_SOURCE when an optional helper like Graph is missing."""
        source = f"""
import {{ resolveModularCapabilityPlan }} from {json.dumps(MODULAR_MODULE.as_uri())};

// Task requires relational evidence, but Graph is not installed
const plan = resolveModularCapabilityPlan(
  {{ taskType: 'impact-analysis', needsRelationalEvidence: true, project: {{ isOdoo: true }} }},
  {{ 'odoo-engineering': {{ installed: true, healthy: true }} }}
);

console.log(JSON.stringify(plan));
"""
        plan = run_node(source)
        self.assertIn("odoo-engineering", plan["selectedComponents"])
        self.assertNotIn("afyx-graph", plan["selectedComponents"])

        # Check degradation record
        degradations = [d for d in plan["degradations"] if d["component"] == "afyx-graph"]
        self.assertTrue(len(degradations) > 0, "Missing safe degradation entry for afyx-graph")
        self.assertEqual(degradations[0]["fallback"], "DIRECT_SOURCE")

    # -------------------------------------------------------------------------
    # 4. Representative Routing & Anti-Redundancy Tests
    # -------------------------------------------------------------------------

    def test_simple_fix_suppresses_deep_orchestration_and_graph_overhead(self) -> None:
        """Simple code fix selects only Efficient Coding; suppresses Expert persona and Graph indexing."""
        source = f"""
import {{ resolveModularCapabilityPlan }} from {json.dumps(MODULAR_MODULE.as_uri())};

const allInstalled = {{
  'efficient-coding': {{ installed: true, healthy: true }},
  'odoo-engineering': {{ installed: true, healthy: true }},
  'afyx-engineering-expert': {{ installed: true, healthy: true }},
  'afyx-graph': {{ installed: true, healthy: true }},
  'afyx-context': {{ installed: true, healthy: true }},
  'codex-usage-tracking': {{ installed: true, healthy: true }},
}};

const plan = resolveModularCapabilityPlan(
  {{ taskType: 'simple-fix', intent: 'Fix integer overflow in calculator.py', project: {{ isOdoo: false }} }},
  allInstalled
);

console.log(JSON.stringify(plan));
"""
        plan = run_node(source)
        self.assertEqual(plan["selectedComponents"], ["efficient-coding"])

        # Verify expert and graph were suppressed to save tokens
        suppressed = {s["component"]: s["reason"] for s in plan["suppressedRedundancies"]}
        self.assertIn("afyx-engineering-expert", suppressed)
        self.assertEqual(suppressed["afyx-engineering-expert"], "SIMPLE_FIX_DISCIPLINE")
        self.assertIn("afyx-graph", suppressed)
        self.assertEqual(suppressed["afyx-graph"], "EXACT_SOURCE_SUFFICIENT")

    def test_non_odoo_project_suppresses_odoo_engineering_activation(self) -> None:
        """In a non-Odoo repository, Odoo Engineering is deterministically suppressed."""
        source = f"""
import {{ resolveModularCapabilityPlan }} from {json.dumps(MODULAR_MODULE.as_uri())};

const plan = resolveModularCapabilityPlan(
  {{ taskType: 'generic-coding', intent: 'Add REST endpoint in FastAPI', project: {{ isOdoo: false }} }},
  {{
    'efficient-coding': {{ installed: true, healthy: true }},
    'odoo-engineering': {{ installed: true, healthy: true }},
  }}
);

console.log(JSON.stringify(plan));
"""
        plan = run_node(source)
        self.assertNotIn("odoo-engineering", plan["selectedComponents"])
        self.assertEqual(plan["componentStates"]["odoo-engineering"], "UNAVAILABLE")

        suppressed = {s["component"]: s["reason"] for s in plan["suppressedRedundancies"]}
        self.assertIn("odoo-engineering", suppressed)
        self.assertEqual(suppressed["odoo-engineering"], "NON_ODOO_WORKSPACE")

    def test_context_engine_preserves_default_off_policy(self) -> None:
        """Context Engine remains inactive unless explicitly opted-in by the user."""
        source = f"""
import {{ resolveModularCapabilityPlan }} from {json.dumps(MODULAR_MODULE.as_uri())};

const installed = {{
  'efficient-coding': {{ installed: true, healthy: true }},
  'afyx-context': {{ installed: true, healthy: true }},
}};

// Case 1: Default task without opt-in
const planDefault = resolveModularCapabilityPlan(
  {{ taskType: 'generic-coding', optInContextEngine: false }},
  installed
);

// Case 2: Explicit opt-in
const planOptIn = resolveModularCapabilityPlan(
  {{ taskType: 'generic-coding', optInContextEngine: true }},
  installed
);

console.log(JSON.stringify({{ planDefault, planOptIn }}));
"""
        res = run_node(source)
        self.assertNotIn("afyx-context", res["planDefault"]["selectedComponents"])
        self.assertIn("afyx-context", res["planOptIn"]["selectedComponents"])

    def test_forge_production_activation_remains_unavailable_pending_a8(self) -> None:
        """Verifies Afyx Forge cannot be activated in production prior to formal A8 gate approval."""
        source = f"""
import {{ resolveModularCapabilityPlan, PRODUCT_INVENTORY }} from {json.dumps(MODULAR_MODULE.as_uri())};

const plan = resolveModularCapabilityPlan(
  {{ taskType: 'architecture', intent: 'Run autonomous evaluation' }},
  {{ 'afyx-forge': {{ installed: true, healthy: true }} }}
);

console.log(JSON.stringify({{
  plan,
  forgeMeta: PRODUCT_INVENTORY['afyx-forge']
}}));
"""
        res = run_node(source)
        self.assertEqual(res["plan"]["componentStates"]["afyx-forge"], "UNAVAILABLE")
        self.assertFalse(res["forgeMeta"]["productionReady"])
        self.assertEqual(res["forgeMeta"]["gateStatus"], "UNAVAILABLE_PENDING_A8")

    def test_user_override_takes_precedence_over_automatic_routing(self) -> None:
        """User explicit preference (e.g. forceDirectSource) overrides Graph selection."""
        source = f"""
import {{ resolveModularCapabilityPlan }} from {json.dumps(MODULAR_MODULE.as_uri())};

const plan = resolveModularCapabilityPlan(
  {{ taskType: 'impact-analysis', needsRelationalEvidence: true }},
  {{
    'efficient-coding': {{ installed: true, healthy: true }},
    'afyx-graph': {{ installed: true, healthy: true }}
  }},
  {{ forceDirectSource: true }} // Explicit user override
);

console.log(JSON.stringify(plan));
"""
        plan = run_node(source)
        self.assertNotIn("afyx-graph", plan["selectedComponents"])
        self.assertIn("User explicitly requested direct source", plan["reasons"]["afyx-graph"])

    # -------------------------------------------------------------------------
    # 5. Architecture Documentation Consistency
    # -------------------------------------------------------------------------

    def test_canonical_architecture_contract_document_exists_and_matches(self) -> None:
        """Verifies docs/AFYX_MODULAR_INTEGRATION_CONTRACT.md is present and contains required principles."""
        self.assertTrue(ARCHITECTURE_DOC.is_file(), "Contract document missing")
        content = ARCHITECTURE_DOC.read_text(encoding="utf-8")

        self.assertIn("Standalone by Design, Integrated by Contract, Activated by Need.", content)
        self.assertIn("AfyxModularIntegration/v1", content)
        self.assertIn("Afyx Graph", content)
        self.assertIn("Afyx Context Engine", content)
        self.assertIn("Afyx Engineering Expert", content)
        self.assertIn("Afyx Odoo Engineering", content)
        self.assertIn("Afyx Efficient Coding", content)
        self.assertIn("Afyx Codex Usage Tracking", content)
        self.assertIn("Afyx Forge", content)
        self.assertIn("UNAVAILABLE_PENDING_A8", content)


if __name__ == "__main__":
    unittest.main()

