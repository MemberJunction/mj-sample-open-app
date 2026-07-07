#!/usr/bin/env node
/**
 * init-template.mjs — one-shot template setup.
 *
 * Interactively (or via flags) renames every template identifier to YOUR
 * app's values, activates metadata/schema-info with a freshly generated
 * stable UUID, and prints the follow-up steps. Run it ONCE, right after
 * cloning, from the repo root:
 *
 *     npm run init
 *     # or non-interactive:
 *     node scripts/init-template.mjs \
 *       --name acme-crm --display "Acme CRM" \
 *       --description "CRM for MemberJunction" \
 *       --scope @acme/crm --schema acme_crm --prefix "Acme CRM" \
 *       --repo https://github.com/acme/mj-crm \
 *       --publisher "Acme Corp" --email dev@acme.com \
 *       --id-min 20000001 --id-max 20099999 --yes
 *
 * Everything it does is plain-text replacement + one file write — review the
 * diff with `git diff` before committing. Safe to re-run only BEFORE you
 * commit (it looks for the template tokens; once renamed they're gone).
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// ---------- arg parsing ----------------------------------------------------
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    if (key === 'yes') { args.yes = true; continue; }
    args[key] = argv[++i];
  }
}

// ---------- prompts ---------------------------------------------------------
// Line-queue reader: unlike rl.question(), this works when stdin is a PIPE
// (all lines arrive at once and the stream closes before later questions).
const rl = createInterface({ input: process.stdin, output: process.stdout });
const pendingLines = [];
const lineWaiters = [];
let stdinClosed = false;
rl.on('line', (l) => { const w = lineWaiters.shift(); if (w) w(l); else pendingLines.push(l); });
rl.on('close', () => { stdinClosed = true; while (lineWaiters.length) lineWaiters.shift()(null); });
function nextLine() {
  if (pendingLines.length) return Promise.resolve(pendingLines.shift());
  if (stdinClosed) return Promise.resolve(null);
  return new Promise((res) => lineWaiters.push(res));
}
async function readAnswer(prompt) {
  process.stdout.write(prompt);
  const line = await nextLine();
  if (line === null) { console.error('\n✗ Input ended before all questions were answered — pass the remaining values as flags.'); process.exit(1); }
  return line.trim();
}
/**
 * Prompt for one answer. `opts.describe` prints a short explanation above the
 * prompt; `opts.def` is the default accepted by pressing Enter. Flags always
 * win (validated, fail-fast).
 */
async function ask(flag, question, validate, opts = {}) {
  let value = args[flag];
  let described = false;
  while (true) {
    if (value == null) {
      if (opts.describe && !described) { console.log(`\n${opts.describe}`); described = true; }
      const suffix = opts.def != null ? ` [${opts.def}]` : '';
      value = await readAnswer(`${question}${suffix}: `);
      if (!value && opts.def != null) value = opts.def;
    }
    const problem = validate(value);
    if (!problem) return value;
    console.error(`  ✗ ${problem}`);
    if (args[flag] != null) process.exit(1);   // bad flag value: fail fast
    value = null;
  }
}

const nonEmpty = (v) => (v ? null : 'required');
const appIdRe = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
const schemaRe = /^[a-z][a-z0-9_]{1,126}[a-z0-9]$/;
// "@acme" (packages become @acme/entities) or "@acme/crm" (=> @acme/crm-entities)
const scopeRe = /^@[a-z0-9-~][a-z0-9-._~]*(\/[a-z0-9-~][a-z0-9-._~]*)?$/;

console.log('\nMJ Open App template setup — answers become your app\'s identity.\n');

const name = await ask('name', 'App id', (v) => appIdRe.test(v) ? null : 'lowercase letters/digits/hyphens, 3-64 chars, e.g. acme-crm', {
  describe: 'Your app\'s permanent unique id (mj-app.json "name"). Identifies the app at\ninstall time forever — it should never change once published.',
});
const display = await ask('display', 'Display name', nonEmpty, {
  describe: 'The human-readable name users see in MJ Explorer and MJ Central.',
});
const description = await ask('description', 'Description', (v) => v.length >= 10 && v.length <= 500 ? null : '10-500 characters', {
  describe: 'One or two sentences on what the app does — shown in discovery listings.',
});
const scope = await ask('scope', 'npm package prefix', (v) => scopeRe.test(v) ? null : 'an npm scope like @acme-crm (=> @acme-crm/entities) or scope+app like @acme/crm (=> @acme/crm-entities)', {
  def: `@${name}`,
  describe: 'The prefix for this app\'s npm packages (replaces "@mj-sample-app").\nThe default — a scope named after your app — is the MJ template convention and\nworks for a standalone app. Change it if your org publishes several apps under\none npm org (e.g. @acme/crm => @acme/crm-entities, the BizApps shape).\nPublishing later requires owning the npm org.',
});
const schema = await ask('schema', 'SQL schema name', (v) => schemaRe.test(v) ? null : 'lowercase + underscores, e.g. acme_crm (no leading __ — reserved)', {
  def: name.replace(/-/g, '_'),
  describe: 'The dedicated database schema that will hold every table your app creates.\nThe default (your app id with underscores) keeps names traceable; change it\nonly to match your own DB conventions. Leading "__" is reserved for MJ.',
});
const prefix = await ask('prefix', 'Entity name prefix', nonEmpty, {
  def: display,
  describe: 'Stamped on your entity names ("Acme CRM: Customers") so they can never\ncollide with MJ core or other apps. The default (your display name) is right\nfor almost everyone — shorten it if your display name is long.',
});
const repo = await ask('repo', 'GitHub repository URL', (v) => /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(v.replace(/\.git$/, '')) ? null : 'https://github.com/<org>/<repo>', {
  describe: 'Where this repo will live on GitHub — used by `mj app install`, npm\nprovenance, and the CI repository-url validator.',
});
const publisher = await ask('publisher', 'Publisher name', nonEmpty, {
  describe: 'Who ships this app — shown in the manifest\'s publisher block.',
});
const email = await ask('email', 'Publisher email', nonEmpty);
const idMin = await ask('id-min', 'Entity ID range MIN', (v) => /^\d+$/.test(v) ? null : 'integer, e.g. 10000001', {
  def: '10000001',
  describe: 'An integer ID block reserved for this app\'s entities in __mj.SchemaInfo.\nThe default block is fine for a first app on a database — change it if another\napp already claims that range (ranges must never overlap).',
});
const idMax = await ask('id-max', 'Entity ID range MAX', (v) => /^\d+$/.test(v) && Number(v) > Number(idMin) ? null : `integer > ${idMin}`, {
  def: String(Number(idMin) + 99998),
});

const repoUrl = repo.replace(/\.git$/, '');
const repoName = repoUrl.split('/').pop();
const pascal = name.split(/-+/).map(w => w[0].toUpperCase() + w.slice(1)).join('');
const schemaUuid = randomUUID().toUpperCase();

// Ordered longest-first so prose containing shorter tokens rewrites cleanly.
const replacements = [
  ['MJ Sample Open App (Template)', display],
  ['A fill-in-the-blanks template for building MemberJunction Open Apps. Clone it, rename it, and replace the samples with your app.', description],
  ['https://github.com/MemberJunction/mj-sample-open-app', repoUrl],
  ['LoadSampleAppEntitiesServer', `Load${pascal}EntitiesServer`],
  ['LoadSampleAppActions', `Load${pascal}Actions`],
  ['LoadSampleAppServer', `Load${pascal}Server`],
  ['LoadSampleAppClient', `Load${pascal}Client`],
  ['SampleAppDashboard', `${pascal}Dashboard`],
  // Scope: "@acme" swaps 1:1 (=> @acme/server); "@acme/crm" needs the
  // slash-form rewrite so package names stay valid (=> @acme/crm-server).
  ...(scope.includes('/')
    ? [['@mj-sample-app/', `${scope}-`], ['@mj-sample-app', scope.split('/')[0]]]
    : [['@mj-sample-app', scope]]),
  ['mj-sample-open-app', repoName],
  ['mj-sample-app', name],
  ['sample_app', schema],
  ['Sample App', prefix],
  ['<Your App>', display],
];

console.log(`\nRenaming to:\n  id=${name}  display="${display}"  scope=${scope}\n  schema=${schema}  prefix="${prefix}"  repo=${repoUrl}\n  SchemaInfo UUID=${schemaUuid}\n`);
if (!args.yes) {
  const ok = (await readAnswer('Proceed? [y/N] ')).toLowerCase();
  if (ok !== 'y' && ok !== 'yes') { console.log('Aborted — nothing changed.'); process.exit(0); }
}
rl.close();

// ---------- apply replacements over tracked text files ---------------------
const SKIP = new Set(['scripts/init-template.mjs']);
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => !SKIP.has(f) && existsSync(f) && statSync(f).isFile());

let changed = 0;
for (const f of files) {
  const buf = readFileSync(f);
  if (buf.includes(0)) continue;                    // binary — skip
  let text = buf.toString('utf8');
  const before = text;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  if (text !== before) { writeFileSync(f, text); changed++; }
}

// ---------- mj-app.json publisher block -------------------------------------
const manifest = JSON.parse(readFileSync('mj-app.json', 'utf8'));
manifest.publisher = { name: publisher, email };
writeFileSync('mj-app.json', JSON.stringify(manifest, null, 2) + '\n');

// ---------- activate schema-info with a real UUID ---------------------------
const schemaInfo = [{
  fields: {
    SchemaName: schema,
    EntityIDMin: Number(idMin),
    EntityIDMax: Number(idMax),
    EntityNamePrefix: prefix,
    Description: `${display} - application schema`,
  },
  primaryKey: { ID: schemaUuid },
}];
writeFileSync('metadata/schema-info/.schema-info.json', JSON.stringify(schemaInfo, null, 2) + '\n');

console.log(`
✅ Done — ${changed} file(s) rewritten, metadata/schema-info/.schema-info.json activated.

Next steps:
  1. Review:   git diff
  2. Lockfile: npm install        (regenerates package-lock.json for the new names)
  3. Build:    npm run build:packages
  4. Commit, then set up branches + services: docs/template-docs/repo-setup.md
  5. Link into a MemberJunction checkout:      docs/template-docs/linking-to-mj.md

The template's schema-info UUID above is now pinned — never change it once
pushed to any database. You can delete scripts/init-template.mjs after this.
`);
