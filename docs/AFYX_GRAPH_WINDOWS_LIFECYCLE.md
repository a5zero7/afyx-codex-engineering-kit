# Afyx Graph Windows lifecycle reliability

## Full rebuild ownership

`afyx-graph index` uses the existing project `writer.pid` authority before
`AfyxGraph.recreate()` removes SQLite database files. The exact claim remains
owned until indexing and database close complete. A live, unreadable, invalid,
or otherwise ambiguous owner is refused without database mutation; only a
valid record for a demonstrably dead process may be recovered.

The CLI never stops or kills a daemon automatically. An operator must perform
an explicit identity-verified graceful daemon shutdown before retrying a full
rebuild. Incremental sync and normal shared-daemon MCP operation retain their
existing ownership paths.
