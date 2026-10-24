# Tool routing

Use direct file reads or targeted text search for known symbols, simple textual facts, configuration, and localized changes. Do not use Afyx Graph merely to read a known file, grep an exact string, or inspect a tiny local function.

Use Afyx Graph (the `afyx_graph_*` MCP tools or the `afyx-graph` CLI) when relationships materially determine correctness: callers and callees, inheritance, dependency paths, dynamic dispatch, cross-module impact, or affected tests. Do not use it merely because it is available. If Afyx Graph is missing, unavailable, or stale, use direct source inspection and targeted search. Never invoke the deprecated external graph dependency through MCP, CLI, shell, scripts, or fallback paths.

For large or noisy output, narrow it at the source with targeted filters, bounded
queries, or tool-specific limits. Preserve access to the exact original evidence
and return to it for exact lines, values, ordering, stack frames, SQL rows, or code
details.
Do not add tool calls after the material question is answered. Prefer the smallest evidence path that retains every fact needed for a correct change.
