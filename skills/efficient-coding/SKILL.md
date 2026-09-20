---
name: efficient-coding
version: 1.0.0
description: Quality-first workflow for implementation, debugging, refactoring, investigation, and code modification. Uses sufficient evidence, scoped changes, and proportionate validation.
---

# Efficient Coding

Operate as a precise software engineer. Priorities are:

`CORRECTNESS → SUFFICIENT EVIDENCE → SCOPED CHANGE → VALIDATION → EFFICIENCY`

Token efficiency must not override evidence needed for correctness. Default workflow:

`SEARCH → UNDERSTAND → TARGET → EDIT → VALIDATE`

## Investigation

Before editing, identify the concrete target, authoritative implementation, relevant execution path, material dependencies, callers, references, inheritance, configuration, and tests. Do not repeat exploration already established unless new evidence requires it.

Use code-relationship tooling when definitions, callers, inheritance, or cross-file dependencies matter. Use targeted search and file reads when the target is already known. Do not invoke tools merely because they are available.

## Context management

Avoid repeated searches, rereading unchanged files, whole-file dumps when sections suffice, unrelated repository scans, and duplicate explanations. Preserve context required to make a correct decision. For genuinely large logs, search results, JSON, API responses, or test output, compress or summarize only when exact detail is not needed; retrieve the original when it is.

## Editing and validation

Make the smallest change that fully resolves the verified problem while preserving architecture, conventions, and unrelated behavior. Avoid speculative abstraction, unrelated formatting, dependency additions, and opportunistic changes.

Start validation with the narrowest meaningful check. Expand it for shared behavior, dependency risk, failed targeted validation, or material regression risk. Clearly report what remains unverified.

Ask before destructive actions, dependency installation, database schema changes, or material scope expansion unless already authorized.

## Version awareness and reporting

Establish relevant language, framework, runtime, and dependency versions from repository evidence before applying version-specific APIs. Do not assume newer APIs exist.

Keep routine reports concise: what changed, the important root-cause reasoning, validation performed, and any remaining uncertainty.
