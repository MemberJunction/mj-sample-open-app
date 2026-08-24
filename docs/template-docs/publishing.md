# Publishing the app

An Open App is **consumed from GitHub + npm**: the manifest and migrations are
fetched from a tagged GitHub release, the packages are installed from npm.
Publishing = making those two things exist for a version. The pipeline is
already wired in `.github/workflows/publish.yml`.

## The release pipeline (two halves, deliberately)

Versioning and publishing are separate workflows, and neither writes to a
protected branch. The version bump arrives as a **pull request**; publishing
reads the versions that PR landed.

### 1. `version.yml` — on every push to `next`

Runs `changesets/action` with a version script and **no** publish script, so it
can only ever open or update the **"Version Packages" PR** into `next`. That PR
contains, as a reviewable diff:

- every package bumped (all fixed packages move together)
- the generated `CHANGELOG.md` entries
- `mj-app.json`'s `version` **and** `mjVersionRange` (`ci/sync-mj-app-version.mjs`)
- a **refreshed lockfile**

The lockfile refresh is not incidental. `changeset version` rewrites every
`package.json` — internal dependency ranges included — and does **not** touch
the lockfile. Skip it and `--frozen-lockfile` fails on every branch afterwards,
which is exactly what happened in bizapps-accounting when a bump was run by hand.

### 2. `release-readiness.yml` — on the version PR, and on any PR to `main`

Two aggregate assertions, sharing one implementation (`ci/check-bump-level.sh`):

- **no changesets may still be pending** — that state would publish versions no
  changelog describes
- **a release carrying migrations must be at least a minor** — a consumer
  upgrading on a patch does not expect schema changes

Both are properties of the *release*, not of any one PR, which is why they are
not enforced per feature PR: changesets aggregate, so one minor already in the
window covers the release. Label a PR `bump-level-exempt` for the migrations that
genuinely are not features (a re-captured baseline, a comment fix).

### 3. `publish.yml` — on push to `main` (i.e. merging the release PR)

1. Validations: lockfile case-sensitivity, migration filenames, every package
   exists on npm, `repository.url` matches the root (npm provenance), and every
   publishable package restricts what it ships (`files` + `publishConfig.access`).
2. **Fails** if changesets are still pending on `main`.
3. Builds, then `changeset publish` → **npm**.
4. Tags `vX.Y.Z`, idempotently.

`changeset publish` never reads `.changeset/*.md`. It compares each package's
version against the registry and publishes what is missing — so the versions the
release PR carried *are* the instruction, and a re-run is a safe no-op.

Nothing in this half writes to `main` or `next`. The old shape did (a version
commit pushed straight to `main`, then a merge-back to `next`), and under a
branch ruleset requiring pull requests it failed **after** publishing to npm:
registry moved, repository did not, no tag. `github-actions[bot]` cannot be
granted a ruleset bypass — GitHub blocks that by design — so routing the bump
through a PR is the fix, not a permission.

> **The template does not publish itself.** `publish.yml` is guarded on
> `github.repository`, so the sample `@mj-sample-app/*` packages can never reach
> npm from this repo. A generated app inherits a condition that is already true.
> Note this is deliberately *not* done by marking the sample packages
> `private: true` — all three publish gates skip private packages, so the CI here
> would pass vacuously and a generated app would inherit gates that had never
> actually run.

## Where versions start (and why `0.0.0`)

Every package in this template — and `mj-app.json` — ships at **`0.0.0`**, and the
template's own packages are **never published**. `0.0.0` is not a placeholder to
hand-edit: it is the number that makes the release machinery land on the right first
version by itself.

Your first real release should be **`0.1.0`**, and `changeset version` computes the next
version from the current one. From `0.0.0`, the first `minor` changeset — which a first
schema migration requires anyway (CI enforces it) — produces exactly `0.1.0`, with a real
changelog entry and no version edited by hand. Had the template shipped `0.1.0`, that same
changeset would produce `0.2.0`, and getting `0.1.0` out would mean publishing with no
changeset and then reconciling the two by hand.

It also lines up with the bootstrap below: `0.0.0` is the placeholder version you push to
npm to enable trusted publishing, so the manifest and the registry agree from the start.

So: **don't set a version manually.** Write changesets; the release flow owns the number.
(Sibling packages are pinned at each other's exact version and move together — see
[versioning-and-peer-deps.md](versioning-and-peer-deps.md).)

## One-time setup for a new app (first publish bootstrap)

npm refuses OIDC publishing for packages that don't exist yet, and the
validation step fails until they do. So, once per package:

1. **Publish a `0.0.0` placeholder manually** (with a classic npm token or
   `npm login`): minimal `package.json` + `npm publish --access public`. This one
   step uses the `npm` CLI on purpose — it is a registry operation, not a
   workspace install, and `npm publish` is what npm's own docs describe.
2. On npmjs.com, under each package → Settings → **Trusted Publisher**, add
   this GitHub repo + the `publish.yml` workflow.
3. From then on the workflow publishes via **OIDC trusted publishing** — there
   is **no `NPM_TOKEN` secret** to create or rotate. (`publish.yml` already
   declares `permissions: id-token: write`.)

## GitHub release tags

`mj app install <repo>` resolves versions from **git tags** (`vX.Y.Z`) — the
publish workflow creates them. The manifest version at a tag must equal the
tag (step 4 guarantees it).

## The no-breaking-changes policy (IMPORTANT)

Within a published **major** version, schema changes must be **additive only**:
no dropping tables/columns, no narrowing types, no renames, no new required
parameters. Anything breaking forces a **major** bump. Consult MemberJunction's
`packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md` before authoring any migration
that touches an existing published schema — upgraders run only your NEW
migrations, never a rebuild.

## Publish checklist

- [ ] Changesets on `next` describe everything since the last release
- [ ] Migrations + regenerated code committed together (see codegen doc)
- [ ] `next` is green (build.yml + changes.yml)
- [ ] "Version Packages" PR reviewed and merged into `next` (check it carries the
      refreshed lockfile and the `mj-app.json` sync). Under the default
      `GITHUB_TOKEN` its checks do not start on their own — they sit waiting, and
      a maintainer clicks **Approve and run** on the PR. One click, not a dead
      end; a GitHub App token removes the click, since App-created PRs trigger
      workflows normally.
- [ ] Release PR `next` → `main` green on `release-readiness`
- [ ] Workflow run green; tag exists; packages on npm
