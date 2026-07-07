# metadata/

MJ metadata authored as files and pushed with `mj sync` — the dev-time source
of truth (installs receive it as `V*_Metadata_Sync.sql` migrations instead).

**How to format and write metadata records:**
[`docs/template-docs/metadata.md`](../docs/template-docs/metadata.md).

Live folders: `schema-info/` registers this app's schema in `__mj.SchemaInfo`
on first push — keep it (rename its contents when you rename the app; the
sync loop needs at least one entity folder here).

Only dot-prefixed `.json` files inside folders listed in `.mj-sync.json`
`directoryOrder` are treated as records — don't park drafts in this tree.
