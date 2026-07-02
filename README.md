# MJ Sample Open App — the Open App template

A **fill-in-the-blanks template** for building
[MemberJunction](https://github.com/MemberJunction/MJ) Open Apps — and at the
same time a **working, minimal Open App** (schema `sample_app`, one sample
entity, stub packages that build). Clone it, run it as-is to learn the loop,
then rename and replace the samples with your app.

> An Open App **is its manifest** (`mj-app.json`) plus whatever optional blocks
> it declares: a database schema + migrations, mj-sync metadata, server
> packages loaded by MJAPI, and client packages bundled into MJExplorer.
> Everything is additive — a manifest-only app is valid.

## Start here

1. **[docs/getting-started.md](docs/getting-started.md)** — the rename
   checklist and your first dev loop.
2. **[docs/linking-to-mj.md](docs/linking-to-mj.md)** — how to develop this
   app inside a MemberJunction checkout (worktree linking), and when you need
   a database.
3. **[docs/README.md](docs/README.md)** — the full documentation index
   (branching, versioning, publishing, codegen conventions).

## What's in the box

| Path | Purpose | Required? |
|---|---|---|
| `mj-app.json` | THE app manifest (identity, schema, migrations, packages) | **Required** |
| `mj-app.reference.jsonc` | Fully-annotated manifest reference — every block explained | reference |
| `migrations/` | Skyway migrations for your schema (working annotated examples inside) | With a schema |
| `metadata/` | mj-sync metadata (dev-time source of truth; examples in `_examples/`) | Optional |
| `packages/Entities` | CodeGen entity subclasses (+ your helpers) | With a schema |
| `packages/CoreEntitiesServer` | Server-side entity overrides (validation, hooks) | Optional |
| `packages/Actions` | MJ Actions (agent/workflow integration points) | Optional |
| `packages/Server` | Server bootstrap — MJAPI loads this at startup | With server code |
| `packages/Angular` | Client bootstrap — MJExplorer bundles this | With UI |
| `mj.config.cjs` | CodeGen/migrate configuration for this repo | **Required** for codegen |
| `.github/workflows/` | CI: `build`, `changes` (migration+changeset gates), `publish` | Recommended |
| `.changeset/` + `ci/` | Fixed versioning + release pipeline helpers | Recommended |
| `plans/` | Design docs (start with `plans/TEMPLATE-SPEC.md`) | Recommended |
| `docs/` | The how-to documentation for this repo | Recommended |

The full inventory with rationale: [plans/TEMPLATE-SPEC.md](plans/TEMPLATE-SPEC.md).

## Quick smoke test (no database needed)

```sh
npm install
npm run build:packages
```

Real development happens linked into an MJ checkout — see
[docs/linking-to-mj.md](docs/linking-to-mj.md).

## Branch model

`next` (default, integration) → `main` (release; pushes publish to npm).
Details: [docs/branching.md](docs/branching.md).
