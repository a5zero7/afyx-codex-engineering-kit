# Context and Token Efficiency



Use these rules when repository exploration or tool output becomes large.



The goal is to remove waste without reducing evidence required for

correctness.



## Efficient Exploration



Prefer targeted progression:



known target

→ definition

→ relevant relationships

→ relevant implementation

→ affected behavior

→ edit

→ validation



For unknown targets:



search

→ identify candidates

→ inspect relationships

→ narrow scope

→ investigate sufficiently

→ edit



Repository-wide exploration is acceptable when the task genuinely

requires repository-wide understanding.



## CodeGraph



Use CodeGraph when structural relationships can improve correctness.



Good cases:



\- finding references

\- inheritance analysis

\- call relationships

\- dependency analysis

\- locating implementations across modules



Direct file/search tools may be cheaper when the exact target is already

known.



## Headroom



Use Headroom compression for genuinely large:



\- logs

\- test output

\- search results

\- JSON

\- API responses

\- database output

\- generated tool output



Do not compress small context solely for token reduction.



Retrieve the original when exact lines, values, ordering, or details

become necessary.



## Avoid Waste



Avoid unnecessary:



\- duplicate searches

\- repeated unchanged file reads

\- repeated tool calls with identical inputs

\- unrelated documentation

\- verbose progress narration

\- repeated architecture summaries



Never remove investigation, evidence, or validation that materially

affects correctness.

