# metadata/ — mj-sync metadata for this app

This directory is the **dev-time source of truth** for MJ metadata records your
app owns (applications + nav items, lookup/reference table seeds, actions,
queries, prompts…). It is processed by `mj sync` during development — the
install engine **never** reads it at install time. Instead, you run
`mj sync push --dir=metadata --format=json` while developing, capture the SQL
it produces, and commit it as a `V*__..._Metadata_Sync.sql` migration so clean
installs replay it. Full flow: `docs/codegen-and-metadata-migrations.md`.

## Layout rules

- Each **entity gets its own subdirectory** containing:
  - `.mj-sync.json` — which entity the folder maps to + pull/push options
  - `.<records>.json` — the records (a JSON array; each item has `fields`;
    `primaryKey` + `sync` blocks are added automatically on first push)
- List every subdirectory in the ROOT `metadata/.mj-sync.json` `directoryOrder`
  so dependencies push in the right order.
- This `_examples/` folder is **inert** (no live `.mj-sync.json` files at paths
  mj-sync walks) — copy an example out, rename the config to `.mj-sync.json`,
  and add the folder to `directoryOrder` to activate it.

## When is each pattern needed? (all OPTIONAL)

| You want to…                                   | Pattern                                   |
|------------------------------------------------|-------------------------------------------|
| Seed a lookup/reference table you created      | `item-types.example/` in this folder       |
| Give your app a UI presence in MJ Explorer     | `application.example.json` (nav items)     |
| Keep `__mj.SchemaInfo` in sync                 | `../schema-info/` (live in this template)  |

NOTE: this template's `sample_app` SchemaInfo row is INSERTED by the baseline
migration (`migrations/V202602120001__v1.0.0_Initial_Schema.sql`) and the live
`metadata/schema-info/` record points at the SAME primary key — so `mj sync
push` idempotently updates that one row rather than duplicating it. If you add
schema-info metadata for your own schema, pin its `primaryKey.ID` to the UUID
your baseline migration uses.
