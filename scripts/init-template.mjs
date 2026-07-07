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
import { createInterface } from 'node:readline/promises';
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
const rl = createInterface({ input: process.stdin, output: process.stdout });
async function ask(flag, question, validate, hint) {
  let value = args[flag];
  while (true) {
    if (value == null) value = (await rl.question(`${question}${hint ? ` (${hint})` : ''}: `)).trim();
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
const scopeRe = /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/;

console.log('\nMJ Open App template setup — answers become your app\'s identity.\n');

const name = await ask('name', 'App id (mj-app.json "name")', (v) => appIdRe.test(v) ? null : 'lowercase letters/digits/hyphens, 3-64 chars, e.g. acme-crm');
const display = await ask('display', 'Display name', nonEmpty, 'e.g. Acme CRM');
const description = await ask('description', 'Description (10-500 chars)', (v) => v.length >= 10 && v.length <= 500 ? null : '10-500 characters');
const scope = await ask('scope', 'npm package scope base', (v) => scopeRe.test(v) ? null : 'e.g. @acme/crm — packages become @acme/crm-entities etc. (well, ' + '@acme/crm/entities is invalid; we use it as the literal replacement for @mj-sample-app)');
const schema = await ask('schema', 'SQL schema name', (v) => schemaRe.test(v) ? null : 'lowercase + underscores, e.g. acme_crm (no leading __ — reserved)');
const prefix = await ask('prefix', 'Entity name prefix', nonEmpty, 'e.g. Acme CRM — entities become "Acme CRM: Things"');
const repo = await ask('repo', 'GitHub repository URL', (v) => /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(v.replace(/\.git$/, '')) ? null : 'https://github.com/<org>/<repo>');
const publisher = await ask('publisher', 'Publisher name', nonEmpty);
const email = await ask('email', 'Publisher email', nonEmpty);
const idMin = await ask('id-min', 'Entity ID range MIN', (v) => /^\d+$/.test(v) ? null : 'integer, e.g. 20000001');
const idMax = await ask('id-max', 'Entity ID range MAX', (v) => /^\d+$/.test(v) && Number(v) > Number(idMin) ? null : `integer > ${idMin}`);

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
  ['@mj-sample-app', scope],
  ['mj-sample-open-app', repoName],
  ['mj-sample-app', name],
  ['sample_app', schema],
  ['Sample App', prefix],
  ['<Your App>', display],
];

console.log(`\nRenaming to:\n  id=${name}  display="${display}"  scope=${scope}\n  schema=${schema}  prefix="${prefix}"  repo=${repoUrl}\n  SchemaInfo UUID=${schemaUuid}\n`);
if (!args.yes) {
  const ok = (await rl.question('Proceed? [y/N] ')).trim().toLowerCase();
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
