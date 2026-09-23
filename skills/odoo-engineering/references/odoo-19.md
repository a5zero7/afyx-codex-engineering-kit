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

## Delta from previous major

- Odoo 19 supports dynamic date values in domains; use them for date/datetime criteria where appropriate rather than replacing explicit dates mechanically.
- `odoo.osv` is deprecated, not removed. Do not introduce it in new Odoo 19 code, and do not rewrite compatible existing code without migration scope.
- `record._cr`, `record._context`, and `record._uid` are deprecated, not removed. Prefer `self.env.cr`, `self.env.context`, and `self.env.uid` where semantically equivalent.

## ORM / Python

The exact 19.0 ORM source contains `search_fetch`, `fetch`, `_search_display_name`, access helpers, and `read_group`; inspect deprecation guidance before introducing older helpers into new code.

### Stable-19 inherited API boundaries

- Controller route `type='json'` was renamed to `type='jsonrpc'` in the Odoo Online 18.1 lineage; this is present in the later stable line, not a 19.0 introduction.
- `read_group` was deprecated in the Odoo Online 18.2 lineage. For new backend code, check `_read_group` or `formatted_read_group` semantics; deprecated does not mean unavailable.
- The same lineage includes `odoo.Domain` and `@api.private`; classify these as inherited online changes when relevant.

### Additional high-risk traps

Do not treat deprecated as removed. For custom modules, inspect exact 19.0 source/docs and existing callers before replacing access, domain, controller, or aggregation APIs.

### Additional validation

Validate affected ORM calls, access behavior, domains, controllers, and views against the target 19.0 runtime.

### Additional evidence

- Official source: `https://github.com/odoo/odoo/blob/19.0/odoo/orm/models.py`
- Official source: `https://github.com/odoo/odoo/blob/19.0/odoo/http.py`
- Official documentation: `https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html`

### Precision guidance

- Dynamic date values are supported in Odoo 19 domains; use them for date/datetime criteria where appropriate.
- `odoo.osv`, `record._cr`, `record._context`, and `record._uid` are deprecated, not removed. Prefer modern environment access in new code where semantically equivalent.
- The `type='json'` → `type='jsonrpc'` controller rename originated in Online 18.1; `read_group` deprecation originated in Online 18.2. These are inherited stable-line boundaries, not 19.0 introductions.
