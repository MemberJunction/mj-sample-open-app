# Authoring metadata

MJ metadata records — applications and nav items, lookup/reference-table
seeds, actions, prompts, queries — are authored as **declarative JSON files**
under `metadata/` and pushed into your dev database with `mj sync`. This doc
is how to format and write them. The lifecycle rule to internalize first:

> `metadata/` is the **dev-time source of truth**. The install engine never
> reads it — consumers receive your metadata through the
> `V*_Metadata_Sync.sql` migrations you capture from it
> (see [codegen-and-metadata-migrations.md](codegen-and-metadata-migrations.md)).

## Directory layout

```
metadata/
├── .mj-sync.json            # ROOT config: push options + directoryOrder
├── schema-info/             # live in this template — registers your schema
│   ├── .mj-sync.json        #   entity: "MJ: Schema Info"
│   └── .schema-info.json    #   the record(s)
└── <one folder per entity>/
    ├── .mj-sync.json        # which entity this folder maps to + options
    └── .<records>.json      # the records (dot-prefixed JSON array)
```

- **One folder per entity.** Every folder you add must be listed in the root
  `.mj-sync.json` `directoryOrder` (dependencies push in order — parents
  before children).
- **Record files are dot-prefixed** (`.item-types.json`) — the default
  `filePattern` is `**/.*.json`.

## The root `.mj-sync.json`

```json
{
  "version": "1.0.0",
  "push": { "autoCreateMissingRecords": true },
  "directoryOrder": ["schema-info", "item-types"]
}
```

`autoCreateMissingRecords: true` lets a record that carries a `primaryKey`
but doesn't exist in the DB be **created** with that exact ID — that's how
this template's `schema-info` row appears on first push.

## A folder's `.mj-sync.json`

```json
{
  "entity": "Sample App: Item Types",
  "filePattern": "**/.*.json",
  "pull": {
    "createNewFileIfNotFound": true,
    "newFileName": ".item-types.json",
    "appendRecordsToExistingFile": true,
    "updateExistingRecords": true,
    "ignoreNullFields": true,
    "ignoreVirtualFields": true
  }
}
```

`entity` is the exact MJ entity name (your entities carry your
`EntityNamePrefix`, e.g. `Sample App: Item Types`; core entities may need the
`MJ: ` prefix — verify names in the generated `entity_subclasses.ts`).

## Record file format

A JSON array; each element is one record with a `fields` object:

```json
[
  { "fields": { "Name": "Standard", "Description": "Default item type", "DefaultRank": 10 } },
  { "fields": { "Name": "Premium",  "Description": "Premium item type",  "DefaultRank": 20 } }
]
```

- **New records: write ONLY `fields`.** On first push, mj-sync writes back a
  `primaryKey` (the generated ID) and a `sync` block (timestamp + checksum) —
  commit that write-back, and never hand-edit either block.
- Pushes are **upserts** — safe to re-run. But note: `mj sync push` is a
  **full reconcile** — it can DELETE rows that exist in the DB for that entity
  scope but not in your files. It is a single-author, dev-time tool.
- Pinning an ID on purpose (like `schema-info/` does) is how you make a
  record deterministic across databases: supply `primaryKey.ID` yourself with
  a hardcoded UUID and keep it stable forever once pushed anywhere.

## Reference syntax

| Ref | Meaning | Example |
|---|---|---|
| `@file:<path>` | Load the value from a separate file — use for any complex/JSON blob | `"FieldSchema": "@file:schemas/api-key.schema.json"` |
| `@lookup:<Entity>.<Field>=<value>` | Resolve a related record's ID by a field value | `"CategoryID": "@lookup:Action Categories.Name=Utilities"` |
| `@parent:<Field>` | The containing parent record's field (in `relatedEntities` nesting) | `"ApplicationID": "@parent:ID"` |
| `@root:<Field>` | The root record's field in a nested structure | — |
| `@template:<path>` | Shared JSON fragment merged into the record | — |

Keep externalized files in typed subfolders (`schemas/`, `templates/`) next to
the records that reference them — never paste escaped-JSON strings inline.

## Worked example 1 — seeding a lookup table

Your migration created `${flyway:defaultSchema}.ItemType` and codegen
registered `Sample App: Item Types`. To seed it: create
`metadata/item-types/` with the folder config + record file shown above, add
`"item-types"` to the root `directoryOrder`, then push (below). Don't seed
lookup tables with hand-written INSERTs as the source of truth — author here,
let the capture step produce the SQL that ships.

## Worked example 2 — an application with nav items

An `Applications` record gives your app a UI presence in MJ Explorer
(folder config: `"entity": "Applications"`):

```json
[
  {
    "fields": {
      "Name": "Sample App",
      "Description": "Sample application installed by this Open App",
      "Icon": "fa-solid fa-cube",
      "DefaultForNewUser": false,
      "Status": "Active",
      "NavigationStyle": "Both",
      "DefaultNavItems": [
        {
          "Label": "Dashboard",
          "Icon": "fa-solid fa-chart-line",
          "ResourceType": "Custom",
          "DriverClass": "SampleAppDashboard",
          "isDefault": true
        }
      ]
    },
    "relatedEntities": { "Application Entities": [] }
  }
]
```

Every `DefaultNavItems` entry with `ResourceType: "Custom"` needs its
`DriverClass` to exactly match an
`@RegisterClass(BaseResourceComponent, '<DriverClass>')` component in your
Angular package. Exactly one `isDefault: true` per app.

## The workflow (edit → push → capture → commit)

```sh
# from the MJ repo root, with this app linked (docs/template-docs/linking-to-mj.md)
npx mj-sync validate --dir=packages/dev-apps/<app>/metadata     # 1. validate
npx mj sync push --dir=packages/dev-apps/<app>/metadata --format=json  # 2. push to YOUR dev DB
# 3. capture the SQL as migrations/V<ts>__v<x.y.x>_Metadata_Sync.sql
#    (hardcoded UUIDs; ${flyway:defaultSchema} for your schema, literal __mj for core rows)
# 4. commit metadata files (incl. write-backs) + the migration + a changeset
```

Teammates and installs get the migration, **not** your sync — never treat
push as a distribution mechanism.

## Gotchas

- The `metadata/` root must contain **at least one entity folder** listed in
  `directoryOrder` — `mj sync push` fails with "No entity directories found"
  on an empty tree (this template's `schema-info/` folder is what keeps the
  setup loop green; don't remove it, rename its contents).
- Only dot-prefixed `.json` files matching a folder's `filePattern` are
  records. Don't park drafts or samples inside `metadata/` — anything
  matching the pattern in a registered folder WILL be pushed.
- If a record implies codegen output (new entities/fields), run the codegen
  loop too and commit it all together.
