# Odoo 20

Status: stable
Last verified: 2026-09-23

## Runtime baseline

- Official `20.0/odoo/release.py` reports `version_info` 20.0 at `FINAL`, `MIN_PY_VERSION = (3, 12)`, `MAX_PY_VERSION = (3, 14)`, and `MIN_PG_VERSION = 16`.
- Treat those constants as release metadata, not as a substitute for checking the target deployment and repository configuration.

## Runtime / assets

- Exact `20.0/addons/web/__manifest__.py` declares the manifest `assets` key. Inspect exact bundle declarations and source before changing frontend loading.

## High-risk version traps

Odoo 20 is a stable target for this project, but exact 20.0 source and documentation remain authoritative. Do not carry Odoo 19 assumptions forward without checking the target branch, especially for runtime, ORM, views, frontend/assets, reports, and upgrades.

## Validation

Validate Python/runtime prerequisites, affected module loading, inherited XML, and relevant frontend/assets under the target Odoo 20 environment.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/20.0/odoo/release.py`
- Official source: `https://github.com/odoo/odoo/blob/20.0/addons/web/__manifest__.py`
- Official documentation: `https://www.odoo.com/documentation/20.0/administration/on_premise/source.html`
