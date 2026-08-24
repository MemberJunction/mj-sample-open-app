# <Your App> — development guide (template)

This repository is a **MemberJunction Open App** built from the
MemberJunction **open-app-template**. It is developed **linked to a
MemberJunction checkout** — the two clones are joined into one pnpm workspace by
`mj dev workspace`; see `docs/template-docs/linking-to-mj.md`. TODO(template):
replace the placeholders in this file when you rename the app.

**Package manager: pnpm** (`corepack pnpm --version`, ≥ 10) — matching MJ 6.x,
which is a pnpm monorepo. `pnpm-lock.yaml` is the lockfile of record;
`package-lock.json` is gitignored so a stray `npm install` cannot leave a second
one behind. Two pnpm/npm differences that fail *silently*: selecting one package
is `pnpm --filter <pkg> run build` (npm's `--workspace` flag makes pnpm run the
script at the repo ROOT instead), and `pnpm run x -- --flag` passes `--` through
as a literal argument (drop the `--`).

## Repository structure

```
mj-app.json            - MJ Open App manifest (the source of truth for the app)
mj.config.cjs          - CodeGen config: output paths, schema scope, SQL capture
pnpm-workspace.yaml    - pnpm workspace + resolution settings (see .npmrc)
migrations/            - Skyway migrations for the app schema (starts empty)
metadata/              - mj-sync metadata (dev-time; seeds ship as migrations)
packages/
  Entities/            - @mj-sample-app/entities   (CodeGen entity subclasses)
  CoreEntitiesServer/  - @mj-sample-app/core-entities-server (server-side entity overrides)
  Actions/             - @mj-sample-app/actions    (MJ Actions)
  Server/              - @mj-sample-app/server     (server bootstrap -> MJAPI)
  Angular/             - @mj-sample-app/ng         (client bootstrap -> MJExplorer)
docs/                  - how this repo works (branching, publishing, codegen, linking)
docs/claude/           - the MemberJunction development guide (topic-split, with TOC)
```

## 📖 The MemberJunction development guide → [`docs/claude/`](docs/claude/README.md)

The MJ coding rulebook — critical rules, entity/data patterns, performance,
CodeGen + migration authoring, Angular conventions, code style, metadata
authoring, testing — lives in **[docs/claude/](docs/claude/README.md)** as a
set of topic docs with a table of contents (adapted from MemberJunction's own
`CLAUDE.md`; MJ's copy remains authoritative for MJ-core work and anything not
covered there). Read the relevant topic before working in its area:

| Topic | Doc |
|---|---|
| Critical rules (non-negotiable) | [docs/claude/01-critical-rules.md](docs/claude/01-critical-rules.md) |
| Git & branches | [docs/claude/02-git-and-branches.md](docs/claude/02-git-and-branches.md) |
| Entities & data access | [docs/claude/03-entities-and-data.md](docs/claude/03-entities-and-data.md) |
| Performance | [docs/claude/04-performance.md](docs/claude/04-performance.md) |
| CodeGen & migrations | [docs/claude/05-codegen-and-migrations.md](docs/claude/05-codegen-and-migrations.md) |
| Angular | [docs/claude/06-angular.md](docs/claude/06-angular.md) |
| Code style | [docs/claude/07-code-style.md](docs/claude/07-code-style.md) |
| Metadata & mj-sync | [docs/claude/08-metadata-and-sync.md](docs/claude/08-metadata-and-sync.md) |
| Testing | [docs/claude/09-testing.md](docs/claude/09-testing.md) |

## The rules that matter most in THIS repo

1. **No commits without explicit approval** — never run `git commit` unless
   the user asked for that commit; commit only what is staged.
2. **Never edit `src/generated/`** in any package — CodeGen overwrites it.
   After schema/metadata changes run codegen and **commit the regenerated code
   together with its migration** (`docs/template-docs/codegen-and-metadata-migrations.md`).
3. **Never edit an applied migration** — add a new `V*` file. Additive-only
   within a published major version.
4. **Branch rules** — feature branches cut from `next`, tracking
   `origin/<same-name>` only; PRs target `next`; a PR adding a migration must
   include a changeset (≥ minor). See `docs/template-docs/branching.md`.
5. **Single-copy invariant** — `@memberjunction/*` are peerDependencies; never
   hard-depend on them, and never run an install *inside* a member of a linked
   workspace (installs happen at the workspace parent). A second physical copy of
   `@memberjunction/global`/`core` splits MJ's class-factory registry and your
   entities/resolvers silently stop appearing
   (`docs/template-docs/versioning-and-peer-deps.md`).
6. **When linked to MJ**: the *registration* edits in the MJ repo
   (`mj.config.cjs` `dynamicPackages`, MJAPI/MJExplorer `package.json`, the
   Explorer bootstrap import) are local-only — never commit them to MJ. The
   *linking* files are generated at the workspace parent, outside both repos, and
   are never committed anywhere.

## Build & dev commands

```sh
# this repo (works standalone AND as a workspace member):
pnpm install                  # at the WORKSPACE PARENT when linked; here when standalone
pnpm run build:packages       # build this app's packages
pnpm run mj:migrate           # apply this app's migrations (needs a DB + .env)
pnpm run mj:codegen           # regenerate entities/resolvers/forms after a schema change

# one package only (from the workspace root):
pnpm --filter @mj-sample-app/ng run build
```

The full development workflow (where to add code, capturing codegen +
metadata-sync migrations, releasing) is in the README's "Development
workflow" table.
