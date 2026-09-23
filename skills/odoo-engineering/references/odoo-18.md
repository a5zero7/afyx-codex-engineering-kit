# Odoo 18

Status: stable
Last verified: 2026-09-23

## Runtime baseline and assets

- Official `18.0/setup.py` declares `python_requires >=3.10`.
- Exact `18.0/addons/web/__manifest__.py` declares the manifest `assets` key.

## High-risk version traps

Select Odoo 18 APIs and conventions from the target repository and exact source. Do not apply generic latest-version guidance or assume Odoo 17/19 behavior is identical.

## Validation

Validate affected ORM, inherited XML, and relevant frontend/asset paths under Odoo 18.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/18.0/setup.py`
- Official source: `https://github.com/odoo/odoo/blob/18.0/addons/web/__manifest__.py`

## ORM / Python

The official 18.0 ORM documentation includes `JSONB` translation storage terminology, `aggregator`, and access/query APIs such as `search_count`. Treat storage/API changes as migration-sensitive; do not mechanically replace existing custom access logic without checking call-site semantics.

## Views / XML

The official 18.0 view architecture names the root element of list views `list` and identifies `tree` as its previous name. Before changing XML, inspect view type identifiers, inheritance XPath targets, and external inherited views; do not assume `tree` is rejected solely from the documentation wording.

## Frontend / JavaScript

Odoo 18 documentation describes files under `/static/src` and `/static/tests` as automatically transpiled into Odoo modules. Do not blindly add or remove `@odoo-module`; inspect local source and aliases first.

## Evidence

- Official documentation: `https://www.odoo.com/documentation/18.0/developer/reference/backend/orm.html`
- Official documentation: `https://www.odoo.com/documentation/18.0/developer/reference/frontend/javascript_modules.html`
- Official documentation: `https://www.odoo.com/documentation/18.0/developer/reference/user_interface/view_architectures.html`
