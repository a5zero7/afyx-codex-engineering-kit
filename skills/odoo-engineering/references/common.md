# Common Odoo evidence rules

The repository is the source of truth. Before changing code, establish the Odoo release, Python runtime, module dependencies, and applicable custom inheritance.

For models, inspect `_name`, `_inherit`, `_inherits`, fields, computed dependencies, constraints, create/write/unlink overrides, access rights, record rules, domains, and affected callers as relevant. For XML, resolve external ID, model, parent view, inheritance order, xpath target, and module dependency before editing.

Keep persisted technical names unless a migration is explicitly required and validated. A display-label change is not authorization to rename fields, database columns, XML IDs, context keys, or stored values.

Validate the affected module first. Expand testing only when shared models, inherited views, security, reporting, integrations, or dependencies raise regression risk.
