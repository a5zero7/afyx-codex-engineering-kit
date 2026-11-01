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

## Windows daemon project identity

Daemon registry names and comparisons use one canonical project identity.
Existing Windows roots resolve through the native real path and compare
case-insensitively, while the historical named-pipe hash remains unchanged.
External-state location remains part of the identity, so two state bindings
cannot be mixed.

Legacy duplicate records are collapsed in memory only when canonical project,
PID, version, socket, and start identity all agree. Different or forged records
remain untrusted and must still pass the existing pipe-hello verification.
Path equivalence alone never authorizes shutdown, and discovery does not
broadly delete legacy records.
