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
