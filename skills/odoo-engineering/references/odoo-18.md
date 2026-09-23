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
