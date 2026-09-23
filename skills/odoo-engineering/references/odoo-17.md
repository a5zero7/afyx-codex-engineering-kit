# Odoo 17

Status: stable
Last verified: 2026-09-23

## Runtime baseline and assets

- Official `17.0/setup.py` declares `python_requires >=3.10`.
- Exact `17.0/addons/web/__manifest__.py` declares the manifest `assets` key.

## High-risk version traps

Keep Odoo 17 server and client implementation checks separate when a task crosses the UI boundary. Validate inherited views and assets narrowly before changing frontend code; do not carry 18–20 assumptions backward.

## Validation

Use targeted Python/module, XML view, and asset/client checks under the target Odoo 17 runtime.

## Evidence

- Official source: `https://github.com/odoo/odoo/blob/17.0/setup.py`
- Official source: `https://github.com/odoo/odoo/blob/17.0/addons/web/__manifest__.py`
