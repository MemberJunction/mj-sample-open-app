---
'@mj-sample-app/server': patch
---

Split the release into a version step and a publish step, so neither writes directly to a branch,
and adopt the family's evolved publish gates.

`version.yml` (new, on `next`) turns pending changesets into a reviewable "Version Packages" PR.
`release-readiness.yml` (new) gates the version PR and any PR to `main`. `publish.yml` keeps only
the publish half, is guarded so the template can never publish its own sample packages, and gains
a gate requiring every publishable package to declare `files` and `publishConfig.access` — which
none of them did.
