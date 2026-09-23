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

## ORM / Python

The exact 19.0 ORM source contains `search_fetch`, `fetch`, `_search_display_name`, access helpers, and `read_group`; the official 19.0 ORM documentation also covers domain manipulation. Prefer the exact target API and inspect deprecation guidance before introducing older helpers into new code.

## High-risk version traps

Do not treat deprecated as removed. For custom modules, inspect exact 19.0 source/docs and existing callers before replacing access, domain, controller, or aggregation APIs.

## Validation

Validate affected ORM calls, access behavior, domains, controllers, and views against the target 19.0 runtime.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/19.0/odoo/orm/models.py`
- Official source: `https://github.com/odoo/odoo/blob/19.0/odoo/http.py`
- Official documentation: `https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html`
