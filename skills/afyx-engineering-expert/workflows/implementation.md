# Workflow: Bounded Implementation and Validation

Use only when implementation or file changes are requested and permitted.

1. **Preflight:** inspect repository instructions, relevant files, actual versions, current behavior, tests, worktree status, baseline source revision, and requested scope. Check that source revision matches baseline and verify authorized file scope and excluded scope before changes. Avoid overwriting unrelated local work.
2. **Plan:** state the desired behavior, primary domain, explicit boundaries (allowed operations, allowed files, excluded scope, expected outcomes, authorization level), other impacted components, security/data risks, minimal change, and matching validation. For high-risk changes, note rollback and authorization boundary.
3. **Implement:** change the smallest coherent surface strictly within allowed files, following existing conventions. Never touch excluded scope or unrelated files. Preserve backward compatibility unless explicitly changed. For schema/data/security changes, validate impacts across callers/roles/versions.
4. **Validate:** run the available targeted checks; cover intended result and negative/regression scenarios based on risk. Classify evidence rigorously (`DIRECT_EXECUTION`, `VERIFIED_SOURCE`, `INFERENCE`); distinguish real execution from mock execution. Never award `PASS` to unsupported claims, inferences, or skipped checks. Report exact commands, test counts, and actual output status (`PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`).
5. **Review:** inspect final diff against the approved file scope; check for stray files or secrets; verify that no excluded or out-of-scope files were modified; note migration/config/documentation impact and remaining gaps. Do not silently deploy, push, publish, or alter production.
6. **Close:** short summary of changes, exact file locations, evidence classification matching `AfyxEngineeringResult/v1` standards, validation PASS/FAIL/NOT_RUN, limitations, and reviewer-ready test instructions where useful.

Recommended division of labor: Software Engineer primary; BA/System Analyst for acceptance; QA for evidence; Security/DBA/SRE/ERP/AI/UX if truly impacted.
