# Odoo 15

Status: stable
Last verified: 2026-09-23

## Runtime baseline and assets

- Official `15.0/setup.py` declares `python_requires >=3.7`.
- Exact `15.0/addons/web/__manifest__.py` is the first inspected branch in this set that declares the manifest `assets` key. Do not backport this loading shape to 14.0 or earlier without evidence.

## High-risk version traps

Confirm Odoo 15 backend/frontend conventions before changing established module APIs. Asset loading is a version boundary; inspect the exact manifest and bundle names.

## Validation

Validate the affected module, XML, asset bundle, and integration surface under Odoo 15.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/15.0/setup.py`
- Official source: `https://github.com/odoo/odoo/blob/15.0/addons/web/__manifest__.py`
