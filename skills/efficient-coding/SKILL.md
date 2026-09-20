---
name: efficient-coding
version: 1.0.0
description: Quality-first workflow for software implementation, debugging, refactoring, and code investigation. Uses sufficient evidence, scoped changes, appropriate validation, CodeGraph when relationships matter, and Headroom for genuinely large context.
---

# Efficient Coding

Apply to software engineering work; not prompt engineering, general conversation, or document writing.

## Core contract

Prioritize: **correctness → sufficient evidence → scoped change → validation → efficiency**. Token efficiency never justifies omitting material investigation or validation.

Use: **SEARCH → UNDERSTAND → TARGET → EDIT → VALIDATE**.

## Investigation and tools

Identify the concrete target or failure, locate its authoritative implementation, and understand the relevant execution path before editing. Inspect callers, dependencies, inheritance, configuration, tests, and framework behavior when they can materially affect correctness. Establish the applicable framework, runtime, and dependency versions from repository evidence before relying on version-specific behavior.

Use CodeGraph when structural relationships such as references, callers, inheritance, dependencies, or cross-file/module paths matter. When the target is already known, use direct search or focused reads instead. Do not use a tool only because it is available.

For unusually large repository exploration or tool output, read `references/token-efficiency.md`. Use Headroom only when large context materially benefits from compression; retrieve the original evidence when exact details matter.

## Editing and validation

Make the smallest change that fully resolves the evidenced problem while preserving relevant architecture, conventions, compatibility, and public behavior. Avoid unrelated refactors, speculative abstractions, dependencies, and formatting changes. Seek authorization before destructive actions, dependency installation, schema changes, or material scope expansion unless already authorized.

Start validation with the most relevant targeted check. Expand it when shared behavior, dependencies, inheritance, configuration, failed checks, or regression risk warrant it. State clearly what remains unverified.

## Output contract

Report concisely: what changed, important reasoning or root cause, validation performed, and remaining uncertainty.
