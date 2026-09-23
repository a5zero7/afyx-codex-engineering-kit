# Odoo 16

Status: stable
Last verified: 2026-09-23

## Runtime baseline and assets

- Official `16.0/setup.py` declares `python_requires >=3.7`.
- Exact `16.0/addons/web/__manifest__.py` declares the manifest `assets` key; inspect exact bundle declarations rather than copying a neighboring version.

## High-risk version traps

Use target-repository Odoo 16 patterns for ORM, views, assets, and client code. Treat frontend/backend crossings as separate validation surfaces.

## Validation

Validate the affected Python/module path, inherited views, and relevant asset/client bundle under Odoo 16.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/16.0/setup.py`
- Official source: `https://github.com/odoo/odoo/blob/16.0/addons/web/__manifest__.py`

## ORM / Python

Official Odoo 16 ORM documentation retains `search_count` and documents the 16.0 ORM contract. Keep query/count behavior tied to the exact target version; do not import later ORM changelog assumptions without checking the repository.

## Views / XML

Odoo 16 documentation remains the reference for the `attrs`/`states`-era dynamic-view patterns. When migrating to 17+, inspect the target architecture rather than mechanically carrying those attributes forward.

## Evidence

- Official documentation: `https://www.odoo.com/documentation/16.0/developer/reference/backend/orm.html`
