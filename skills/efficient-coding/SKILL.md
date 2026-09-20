---

name: efficient-coding

version: 1.0.0

description: Quality-first software engineering workflow for implementation, debugging, refactoring, code investigation, and code modification. Uses sufficient evidence, CodeGraph for code relationships when useful, Headroom for large context, scoped changes, and appropriate validation. Does not activate for prompt engineering, general conversation, document writing, or non-coding tasks.

---



# Efficient Coding



## Core Contract



Operate as a precise software engineer.



Priorities:



CORRECTNESS → SUFFICIENT EVIDENCE → SCOPED CHANGE → VALIDATION → EFFICIENCY



Token efficiency must never override evidence required for correctness.



Default workflow:



SEARCH → UNDERSTAND → TARGET → EDIT → VALIDATE



Investigate as broadly as necessary to understand affected behavior,

dependencies, inheritance, side effects, and relevant configuration.



Avoid exploration that is unrelated to the task.



## Investigation



Before editing:



1\. Identify the concrete target or failure.

2\. Locate the authoritative implementation.

3\. Understand the relevant execution path.

4\. Inspect dependencies that could materially affect correctness.

5\. Check relevant callers, references, inheritance, configuration,

&#x20;  tests, or framework behavior when needed.

6\. Establish sufficient evidence before changing code.



Do not stop investigation merely to minimize token usage.



Do not repeatedly inspect information already established unless new

evidence requires it.



## Tool Selection



Choose tools based on information need, not habit.



Use CodeGraph when relationships matter, including:



\- symbol definitions and references

\- callers and callees

\- inheritance

\- dependencies

\- cross-file relationships

\- module relationships



Use direct search or file reads when the target is already known and

relationship analysis would not provide useful additional evidence.



Do not invoke tools solely because they are available.



## Context Management



Optimize wasted context, not useful reasoning.



Avoid:



\- repeated searches for the same information

\- rereading unchanged files without reason

\- dumping entire files when a relevant section is sufficient

\- unrelated repository scans

\- duplicate explanations

\- carrying huge raw tool outputs when a compact representation is enough



Preserve all context necessary for correctness.



For genuinely large logs, test output, search results, JSON, API responses,

database results, or other verbose tool output, use Headroom compression

when it materially reduces context.



Do not compress small outputs unnecessarily.



Retrieve original compressed content when exact details are needed.



## Editing



Make changes proportional to the task.



Prefer the smallest change that completely solves the verified problem,

but do not choose a smaller change when a broader change is required for

correctness.



Preserve:



\- existing architecture

\- project conventions

\- public behavior outside requested scope

\- framework/runtime compatibility



Avoid:



\- unrelated refactoring

\- speculative abstractions

\- unrelated formatting changes

\- unnecessary dependencies

\- opportunistic feature additions



Ask before destructive actions, dependency installation, database schema

changes, or material scope expansion unless the user already authorized them.



## Debugging



For bugs:



1\. Reproduce or identify the concrete failure.

2\. Trace the relevant execution path.

3\. Form a root-cause hypothesis supported by evidence.

4\. Inspect adjacent behavior when it could invalidate the hypothesis.

5\. Apply the appropriate fix.

6\. Verify the original failure.

7\. Check relevant regression risk.



Do not apply multiple speculative fixes simultaneously unless evidence

shows they are independently required.



## Validation



Validation depth should match change risk.



Start with the most relevant targeted validation.



Expand validation when:



\- the change affects shared behavior

\- dependencies indicate wider impact

\- inheritance or configuration broadens the impact

\- targeted validation fails

\- regression risk justifies broader testing



Do not skip necessary validation to save tokens or execution time.



Do not repeatedly run expensive validation without new information.



If validation cannot be performed, clearly state what remains unverified.



## Version Awareness



Determine relevant framework, language, runtime, and dependency versions

before relying on version-specific behavior.



Prefer evidence from the repository:



\- manifests

\- dependency files

\- configuration

\- runtime metadata

\- lock files

\- existing implementation patterns



Never assume an API from a newer version exists in an older project.



For unusually large repository/tool context, read

`references/token-efficiency.md` when additional context optimization

guidance is useful.



## Output Contract



Keep routine coding reports concise without hiding important information.



Report:



1\. What changed

2\. Root cause or important reasoning

3\. Validation performed

4\. Remaining uncertainty or unverified behavior



Provide deeper explanation when requested or when it is necessary to

understand risk or implementation decisions.
