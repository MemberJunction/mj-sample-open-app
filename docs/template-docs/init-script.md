# The setup script — `npm run init`

`scripts/init-template.mjs` turns this template into **your** app in one shot:
it renames every template identifier across the repo and activates the
schema-registration metadata with a freshly generated, stable UUID. Run it
**once**, immediately after cloning, from the repo root.

## What it actually does

1. **Asks for your app's identity** (ten answers — table below), validating
   each against the real MJ/npm rules before accepting it.
2. **Derives** the GitHub repo name from your URL, a PascalCase form of the
   app id for the bootstrap function names (`acme-crm` → `LoadAcmeCrmServer`),
   and one fresh UUID for the SchemaInfo primary key.
3. **Rewrites every git-tracked text file** with an ordered, literal
   find-and-replace table — package names, manifest identity, schema name,
   entity prefix, bootstrap export names, repo URL, docs, CI scripts, even the
   lockfile. It skips itself and binary files. Nothing is regex-magic; it's
   plain string replacement, fully reviewable with `git diff`.
4. **Writes two files outright**: the `publisher` block in `mj-app.json`, and
   `metadata/schema-info/.schema-info.json` — which **activates the
   schema-info fill-out requirement for you** (see
   [metadata.md](metadata.md) § Schema registration) with your schema name,
   entity-ID range, prefix, and the generated UUID pinned as the primary key.
5. **Prints the follow-up steps** — it deliberately does NOT install, build,
   commit, or touch the network.

It is effectively **one-shot**: once the template tokens are replaced, a
second run finds nothing to change. Review the diff before you commit; before
committing you can always throw the result away and re-clone.

## How to run it

```sh
npm run init          # interactive — prompts for each answer
```

or non-interactively (flags map 1:1 to the prompts; `--yes` skips the
confirmation):

```sh
node scripts/init-template.mjs \
  --name acme-crm \
  --display "Acme CRM" \
  --description "Customer relationship management for MemberJunction" \
  --scope @acme/crm \
  --schema acme_crm \
  --prefix "Acme CRM" \
  --repo https://github.com/acme/mj-crm \
  --publisher "Acme Corp" \
  --email dev@acme.com \
  --id-min 20000001 --id-max 20099999 \
  --yes
```

## The options

Prompts with a **default** show it in `[brackets]` — press Enter to accept.
Defaults are derived from your earlier answers following MJ conventions.

| Flag | Prompt | What it should be | Default | Rules / notes |
|---|---|---|---|---|
| `--name` | App id | The permanent unique id of your app — becomes `mj-app.json` `"name"` and must match the GitHub release/install identity forever | — | Lowercase letters, digits, hyphens; 3–64 chars (`acme-crm`) |
| `--display` | Display name | The human-readable name shown in MJ Explorer and MJ Central | — | Free text (`Acme CRM`) |
| `--description` | Description | One or two sentences about what the app does — shows in discovery | — | 10–500 characters |
| `--scope` | npm package prefix | What replaces `@mj-sample-app` in the five package names. Two shapes: a bare npm **scope** (`@acme-crm` → `@acme-crm/entities`) or scope+app (`@acme/crm` → `@acme/crm-entities`, the shape the shipped BizApps use). The scope must be an npm org you own when you publish ([publishing.md](publishing.md)) | `@<app-id>` — the template's own convention; right for a standalone app. Change it when one npm org publishes several apps | Valid npm scope, optionally `/app-name` |
| `--schema` | SQL schema name | Your app's dedicated database schema — every table you create lives here | `<app-id>` with `_` for `-` — keeps DB objects traceable to the app | Lowercase + underscores; names starting `__` are reserved for first-party MJ apps |
| `--prefix` | Entity name prefix | The prefix stamped on your entity names (`Acme CRM: Customers`) so they can never collide with MJ core (`MJ: …`) or other apps. Written into both `mj.config.cjs` `NameRulesBySchema` and the SchemaInfo record — the script keeps them in agreement | Your display name — shorten it if that's long | Short human-readable phrase, no trailing colon (the `": "` is added by MJ) |
| `--repo` | GitHub repository URL | Where this app lives — used for `mj app install`, npm provenance, and the CI validator (which derives its expected URL from this) | — | `https://github.com/<org>/<repo>` |
| `--publisher` | Publisher name | Your organization — goes in the manifest's `publisher` block | — | Free text |
| `--email` | Publisher email | Contact for the publisher block | — | Free text |
| `--id-min` / `--id-max` | Entity ID range | The integer ID range reserved for this app's entities in `__mj.SchemaInfo`. Pick a block that does not overlap any other app installed alongside yours | `10000001` / min+99998 — fine for the first app on a database; move the block if another app claims it | Integers, max > min |
| `--yes` | — | Skip the confirmation prompt (for scripted use) | — | — |

One value you do **not** choose: the **SchemaInfo UUID**. The script generates
it (`crypto.randomUUID()`) and pins it as the record's primary key. Once that
row has been pushed to ANY database, the UUID must never change — it's what
makes the record deterministic across installs.

## After it runs

```sh
git diff                   # 1. review everything it changed
npm install                # 2. regenerate package-lock.json for the new names
npm run build:packages     # 3. confirm the renamed packages build (5/5)
```

Then commit, set up branches + services ([repo-setup.md](repo-setup.md)), and
link into a MemberJunction checkout ([linking-to-mj.md](linking-to-mj.md)).
You can delete `scripts/init-template.mjs` once you're done with it.

## If you'd rather do it by hand

The manual rename checklist in [getting-started.md](getting-started.md) is the
exact map of what the script touches — same result, more typing.
