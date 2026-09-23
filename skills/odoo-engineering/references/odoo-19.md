# Odoo 19

Status: stable
Last verified: 2026-09-23

## Runtime baseline and assets

- Official `19.0/odoo/release.py` declares `MIN_PY_VERSION = (3, 10)`, `MAX_PY_VERSION = (3, 14)`, and `MIN_PG_VERSION = 13`.
- Exact `19.0/addons/web/__manifest__.py` declares the manifest `assets` key.

## High-risk version traps

Confirm the release and installed addons before changing model inheritance, frontend assets, views, or deployment-facing configuration. Do not carry Odoo 20 runtime assumptions backward.

## Validation

Validate affected ORM/module, inherited views, and relevant frontend/assets under the target Odoo 19 runtime.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/19.0/odoo/release.py`
- Official source: `https://github.com/odoo/odoo/blob/19.0/addons/web/__manifest__.py`
