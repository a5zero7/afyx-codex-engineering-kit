# Odoo Engineering



Apply these rules only to Odoo projects.



## Version First



Determine the Odoo version before relying on framework APIs.



Never introduce APIs or patterns from newer Odoo releases without

verifying compatibility with the project's actual version.



Preserve compatibility with the project's Python version.



Legacy code must not be modernized unless requested or required.



## Models



When model behavior is involved, inspect relevant:



\- model definitions

\- `\_inherit`

\- `\_inherits`

\- field definitions

\- compute methods and dependencies

\- related fields

\- constraints

\- domains

\- onchange methods

\- create/write/unlink overrides

\- callers and references



Follow inheritance across addons when it could affect behavior.



Do not assume the first model definition found is the complete

implementation.



## Views and XML



For view/XML problems, investigate relevant:



1\. external ID

2\. model

3\. parent/inherited view

4\. inheritance chain

5\. xpath target

6\. module dependencies

7\. version compatibility



When a view is inherited by multiple modules, inspect the relevant

inheritance chain before changing the base view.



## Business Logic



Consider interactions between:



\- ORM behavior

\- computed fields

\- onchange behavior

\- constraints

\- record rules

\- access rights

\- context

\- domains

\- scheduled actions

\- related modules



Inspect only those relevant to the current behavior.



## Database



Do not modify production data or schema merely to make an application

error disappear.



Establish whether the root cause is code, configuration, migration,

permissions, or data before choosing a fix.



## Validation



Prefer testing/updating the affected module first.



Broaden validation when inheritance or shared models create wider

regression risk.



Avoid `-u all` unless a repository-wide update is genuinely required.



## Legacy Odoo



For Odoo 10 and similar legacy versions:



\- verify APIs against that release

\- preserve Python 2 compatibility where required

\- do not introduce modern ORM APIs without verification

\- preserve legacy XML/API syntax where required

\- account for custom addon inheritance before concluding root cause

