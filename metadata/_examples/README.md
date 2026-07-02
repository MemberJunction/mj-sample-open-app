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
| Register schema metadata via sync (alt.)       | This template seeds `__mj.SchemaInfo` in its **baseline migration** instead — pick ONE approach |

NOTE: this template's `sample_app` SchemaInfo row is inserted by
`migrations/V202602120001__v1.0.0_Initial_Schema.sql`. Do NOT also add a
schema-info metadata folder for the same schema — you'd create a duplicate row.
