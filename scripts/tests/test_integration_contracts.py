#!/usr/bin/env python3
"""Isolated TB3/TB4 provider-neutral contract tests."""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "scripts/afyx-integration-contracts.mjs"
REGISTRY = ROOT / "scripts/components.json"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    return json.loads(result.stdout)


class IntegrationContractTests(unittest.TestCase):
    def test_executable_contract_versions_match_the_canonical_registry(self) -> None:
        source = f"""
import * as contracts from {json.dumps(CONTRACTS.as_uri())};
console.log(JSON.stringify({{
  provider_capability_contract:contracts.PROVIDER_CAPABILITY_CONTRACT,
  provider_negotiation_contract:contracts.PROVIDER_NEGOTIATION_CONTRACT,
  engineering_task_contract:contracts.ENGINEERING_TASK_CONTRACT,
  engineering_result_contract:contracts.ENGINEERING_RESULT_CONTRACT
}}));
"""
        executable = run_node(source)
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        self.assertEqual(executable, {key: registry[key] for key in executable})

    def test_task_contract_is_provider_neutral_and_serializes_deterministically(self) -> None:
        source = f"""
import {{createEngineeringTask,validateEngineeringTask,serializeContract}} from {json.dumps(CONTRACTS.as_uri())};
const first=createEngineeringTask({{
  task:{{id:'task-1',operation:'review'}},
  workspace:{{id:'workspace-1',revision:'abc123'}},
  context:{{sources:[{{id:'repo',type:'repository',completeness:'COMPLETE',provenance:{{source:'git',digest:'abc123'}}}}],completeness:'COMPLETE'}},
  requirements:[{{capability:'mcp',required:true,verification:'RUNTIME'}}]
}});
const second=createEngineeringTask({{
  requirements:[{{verification:'RUNTIME',required:true,capability:'mcp'}}],
  context:{{completeness:'COMPLETE',sources:[{{provenance:{{digest:'abc123',source:'git'}},completeness:'COMPLETE',type:'repository',id:'repo'}}]}},
  workspace:{{revision:'abc123',id:'workspace-1'}},
  task:{{operation:'review',id:'task-1'}}
}});
console.log(JSON.stringify({{
  contract:first.contract,
  deterministic:serializeContract(first)===serializeContract(second),
  valid:serializeContract(validateEngineeringTask(first))===serializeContract(first),
  frozen:Object.isFrozen(first)&&Object.isFrozen(first.context.sources[0]),
  integrations:first.integrations
}}));
"""
        payload = run_node(source)
        self.assertEqual(payload["contract"], "AfyxEngineeringTask/v1")
        self.assertTrue(payload["deterministic"])
        self.assertTrue(payload["valid"])
        self.assertTrue(payload["frozen"])
        self.assertEqual(payload["integrations"], [])

    def test_result_evidence_and_optional_graph_context_references_are_explicit(self) -> None:
        source = f"""
import {{createEngineeringResult,serializeContract}} from {json.dumps(CONTRACTS.as_uri())};
const result=createEngineeringResult({{
  taskId:'task-1',status:'SUCCEEDED',output:{{summary:'ok',count:1}},
  evidence:[
    {{id:'graph-check',type:'component-contract',validation:'PASS',provenance:{{source:'afyx-graph',reference:'run:1'}}}},
    {{id:'context-check',type:'component-contract',validation:'NOT_RUN',provenance:{{source:'afyx-context'}}}}
  ],
  diagnostics:[],
  integrations:[
    {{component:'afyx-graph',contract:'afyx.graph.mcp/v1',status:'AVAILABLE',reference:'graph://local'}},
    {{component:'afyx-context',contract:'ace.integration/v1',status:'NOT_RUN'}}
  ]
}});
console.log(JSON.stringify({{result,serialized:serializeContract(result)}}));
"""
        payload = run_node(source)
        self.assertEqual(payload["result"]["contract"], "AfyxEngineeringResult/v1")
        self.assertEqual(
            [item["validation"] for item in payload["result"]["evidence"]],
            ["PASS", "NOT_RUN"],
        )
        self.assertEqual(
            [item["component"] for item in payload["result"]["integrations"]],
            ["afyx-graph", "afyx-context"],
        )
        self.assertIn('"taskId":"task-1"', payload["serialized"])

    def test_malformed_contracts_fail_closed_with_bounded_diagnostics(self) -> None:
        source = f"""
import {{createEngineeringTask,createEngineeringResult,serializeContract}} from {json.dumps(CONTRACTS.as_uri())};
const capture=(fn)=>{{try{{fn();return null;}}catch(error){{return {{code:error.code,path:error.path,message:error.message}};}}}};
const extra=capture(()=>createEngineeringTask({{task:{{id:'x',operation:'review'}},workspace:{{id:'w'}},context:{{sources:[],completeness:'UNKNOWN'}},requirements:[],unexpected:true}}));
const evidence=capture(()=>createEngineeringResult({{taskId:'x',status:'SUCCEEDED',evidence:[{{id:'e',type:'test',validation:'MAYBE',provenance:{{source:'fixture'}}}}],diagnostics:[]}}));
const nonJson=capture(()=>serializeContract({{unsafe:undefined}}));
console.log(JSON.stringify({{extra,evidence,nonJson}}));
"""
        payload = run_node(source)
        self.assertEqual(payload["extra"]["code"], "INVALID_CONTRACT")
        self.assertEqual(payload["extra"]["path"], "taskContract")
        self.assertEqual(payload["evidence"]["code"], "INVALID_CONTRACT")
        self.assertEqual(payload["nonJson"]["code"], "INVALID_CONTRACT")
        self.assertNotIn("undefined", payload["extra"]["message"])

    def test_optional_components_can_degrade_without_becoming_mandatory(self) -> None:
        source = f"""
import {{createEngineeringTask,createEngineeringResult}} from {json.dumps(CONTRACTS.as_uri())};
const task=createEngineeringTask({{
  task:{{id:'task-degraded',operation:'analyze'}},workspace:{{id:'workspace-1'}},
  context:{{sources:[],completeness:'UNKNOWN'}},requirements:[]
}});
const result=createEngineeringResult({{
  taskId:'task-degraded',status:'NOT_RUN',evidence:[],
  diagnostics:[{{code:'OPTIONAL_CONTEXT_UNAVAILABLE',severity:'WARNING',message:'Optional context was unavailable; no execution was attempted.'}}],
  integrations:[{{component:'afyx-context',contract:'ace.integration/v1',status:'UNAVAILABLE'}}]
}});
console.log(JSON.stringify({{task,result}}));
"""
        payload = run_node(source)
        self.assertEqual(payload["task"]["integrations"], [])
        self.assertEqual(payload["result"]["status"], "NOT_RUN")
        self.assertEqual(
            payload["result"]["integrations"][0]["status"], "UNAVAILABLE"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
