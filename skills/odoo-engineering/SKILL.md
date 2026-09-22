---
name: odoo-engineering
version: 1.0.0
description: Version-aware Odoo engineering with stable references for Odoo 10 through 19 and preview reference support for Odoo 20. Activates only for Odoo repositories, modules, ORM, views, reports, security, migrations, or Odoo debugging.
---

# Odoo Engineering

Apply this skill only to Odoo work. Determine the actual Odoo major version from repository evidence before applying version-specific behavior. Preferred evidence is the server version metadata, `odoo/release.py`, `odoo-bin --version`, manifest conventions, dependency files, and established code patterns.

Never import an API, JavaScript framework, Python feature, view syntax, or migration convention from another Odoo release without evidence it is supported by the target repository.

## Routing

1. Read `references/common.md` for all Odoo tasks.
2. Identify one target version from 10 through 20; treat Odoo 10–19 as stable and Odoo 20 as preview/emerging requiring repository evidence.
3. Read exactly `references/odoo-<version>.md` before relying on version-specific behavior.
4. Inspect the actual module inheritance, manifest dependencies, model/view references, and local patterns needed for the task.

For an Odoo upgrade spanning versions, treat each source and target version separately. Do not convert an existing module merely because a newer pattern exists.

## Scope and validation

Search before editing. For model behavior inspect inheritance, fields, compute/onchange/constraint methods, access rules, domains, and callers when material. For views inspect external IDs, parent views, inheritance chains, xpath targets, and module dependencies.

Prefer a targeted module update or test first. Do not run a full database update, alter production data, change schema, or perform a migration without explicit authorization.
