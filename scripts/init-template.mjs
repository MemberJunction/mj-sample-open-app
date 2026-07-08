#!/usr/bin/env node
/**
 * init-template.mjs — template setup / rename tool.
 *
 * Reads the repo's CURRENT identity (mj-app.json + metadata/schema-info) and
 * renames it to YOUR answers. Because it works from current values — not
 * hardcoded template tokens — it is RE-RUNNABLE: every prompt shows the
 * current value as its default (press Enter to keep it). The pinned
 * SchemaInfo UUID is generated once and preserved forever.
 *
 *     npm run setup
 *     # or non-interactive (any subset; missing flags prompt):
 *     node scripts/init-template.mjs \
 *       --name acme-crm --display "Acme CRM" \
 *       --description "CRM for MemberJunction" \
 *       --scope @acme/crm --schema acme_crm --prefix "Acme CRM" \
 *       --repo https://github.com/acme/mj-crm \
 *       --publisher "Acme Corp" [--email dev@acme.com] \
 *       [--first-party | --third-party] [--allow-reserved-schema] \
 *       [--id-min N --id-max N] --yes
 *
 * Everything is plain-text replacement + JSON writes — review with `git diff`
 * before committing.
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// ---------- console style (mirrors the mj CLI: chalk-like, zero deps) -------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s);
const bold = paint('1'), gray = paint('90'), cyan = paint('36'),
      green = paint('32'), yellow = paint('33'), red = paint('31');
const ok = (s) => console.log(green('✓ ') + s);
const warn = (s) => console.log(yellow('⚠ ') + s);
const fail = (s) => console.error(red('✗ ') + s);
const section = (t) => console.log('\n' + bold(t));
const kv = (k, v) => console.log(`  ${gray((k + ':').padEnd(13))}${v}`);

// ---------- arg parsing ------------------------------------------------------
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    if (['yes', 'allow-reserved-schema', 'first-party', 'third-party'].includes(key)) { args[key] = true; continue; }
    args[key] = argv[++i];
  }
}

// ---------- read the repo's CURRENT identity --------------------------------
const manifest = JSON.parse(readFileSync('mj-app.json', 'utf8'));
const pascalOf = (id) => id.split(/-+/).map(w => (w[0] || '').toUpperCase() + w.slice(1)).join('');

// npm scope: derive from the server bootstrap package name, e.g.
//   @mj-sample-app/server  -> scope @mj-sample-app, pkg prefix "@mj-sample-app/"
//   @acme/crm-server       -> scope @acme/crm,      pkg prefix "@acme/crm-"
const serverPkg = manifest.packages?.server?.[0]?.name ?? '@mj-sample-app/server';
const pkgPrefixOfScope = (scope) => scope.includes('/') ? `${scope}-` : `${scope}/`;
const stripped = serverPkg.replace(/server$/, '');
const cur = {
  name: manifest.name,
  display: manifest.displayName,
  description: manifest.description,
  repo: manifest.repository,
  publisher: manifest.publisher?.name ?? '',
  email: manifest.publisher?.email ?? '',
  schema: manifest.schema?.name ?? 'sample_app',
  pkgPrefix: stripped,
  scope: stripped.slice(0, -1),
  pascal: (manifest.packages?.server?.[0]?.startupExport?.match(/^Load(.+)Server$/) ?? [, 'SampleApp'])[1],
};
cur.repoName = cur.repo.split('/').pop();

// prefix / ID range / UUID: from the activated schema-info record when present
const SCHEMA_INFO = 'metadata/schema-info/.schema-info.json';
let schemaInfoRecord = null;
if (existsSync(SCHEMA_INFO)) {
  try { schemaInfoRecord = JSON.parse(readFileSync(SCHEMA_INFO, 'utf8'))[0]; } catch { /* rewritten below */ }
}
cur.prefix = schemaInfoRecord?.fields?.EntityNamePrefix
  ?? (cur.name === 'mj-sample-app' ? 'Sample App' : cur.display);
cur.idMin = String(schemaInfoRecord?.fields?.EntityIDMin ?? 10000001);
cur.idMax = String(schemaInfoRecord?.fields?.EntityIDMax ?? 10099999);
const existingUuid = schemaInfoRecord?.primaryKey?.ID ?? null;
const isTemplate = cur.name === 'mj-sample-app';

// ---------- stdin line-queue reader (works for TTYs AND pipes) --------------
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
  if (line === null) { fail('Input ended before all questions were answered — pass the remaining values as flags.'); process.exit(1); }
  return line.trim();
}
/**
 * Prompt once. opts.def: Enter accepts it. opts.describe: gray explainer.
 * opts.optional: blank input allowed (returns '').
 */
async function ask(flag, question, validate, opts = {}) {
  let value = args[flag];
  let described = false;
  while (true) {
    if (value == null) {
      if (opts.describe && !described) { console.log('\n' + gray(opts.describe)); described = true; }
      const suffix = opts.def != null ? gray(` [${opts.def}]`) : (opts.optional ? gray(' (optional)') : '');
      value = await readAnswer(cyan(question) + suffix + ': ');
      if (!value && opts.def != null) value = opts.def;
      if (!value && opts.optional) return '';
    }
    const problem = validate(value);
    if (!problem) return value;
    fail(problem);
    if (args[flag] != null) process.exit(1);   // bad flag value: fail fast
    value = null;
  }
}

const nonEmpty = (v) => (v ? null : 'required');
const appIdRe = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
// Same shape the OpenApp engine validates: up to two leading underscores,
// then letters/digits/underscores, mixed case allowed.
const schemaRe = /^_{0,2}[a-zA-Z][a-zA-Z0-9_]{1,126}[a-zA-Z0-9]$/;
const scopeRe = /^@[a-z0-9-~][a-z0-9-._~]*(\/[a-z0-9-~][a-z0-9-._~]*)?$/;

console.log(bold('\nMemberJunction Open App — template setup'));
console.log(gray(isTemplate
  ? 'Your answers become this app\'s identity. Docs: docs/template-docs/init-script.md'
  : `Re-running for "${cur.name}" — press Enter at any prompt to keep the [current] value.`));

// keep(current): identity fields have no default on a fresh template.
const keep = (v) => (isTemplate ? undefined : v);

section('Identity');
const name = await ask('name', 'App id', (v) => appIdRe.test(v) ? null : 'lowercase letters/digits/hyphens, 3-64 chars, e.g. acme-crm', {
  def: keep(cur.name),
  describe: 'Permanent unique id (mj-app.json "name") — identifies the app at install\ntime forever; it should never change once published.',
});
const display = await ask('display', 'Display name', nonEmpty, {
  def: keep(cur.display),
  describe: 'The human-readable name users see in MJ Explorer and MJ Central.',
});
const description = await ask('description', 'Description', (v) => v.length >= 10 && v.length <= 500 ? null : '10-500 characters', {
  def: keep(cur.description),
  describe: 'One or two sentences on what the app does — shown in discovery listings.',
});

section('Ownership');
// First-party MemberJunction apps (the primary audience right now) get MJ
// defaults: a reserved __mj_* schema (no confirmation), MemberJunction
// publisher + repo org. Third-party apps keep the standalone defaults.
let firstParty;
if (args['first-party']) firstParty = true;
else if (args['third-party']) firstParty = false;
else {
  const fp = await ask('__fp', 'First-party MemberJunction app?', (v) => /^(y|yes|n|no)$/i.test(v) ? null : 'y or n', {
    def: isTemplate ? 'y' : (cur.schema.startsWith('__') ? 'y' : 'n'),
    describe: 'First-party = built by the MemberJunction team (the primary audience for this\ntemplate). y selects MJ conventions: reserved __mj_* schema, MemberJunction\npublisher, github.com/MemberJunction repo. n = third-party/community app.',
  });
  firstParty = /^y/i.test(fp);
}
const repo = await ask('repo', 'GitHub repository URL', (v) => /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(v.replace(/\.git$/, '')) ? null : 'https://github.com/<org>/<repo>', {
  def: keep(cur.repo) ?? (firstParty && isTemplate ? `https://github.com/MemberJunction/${name}` : undefined),
  describe: 'Where this repo lives on GitHub — used by `mj app install`, npm provenance,\nand the CI repository-url validator.',
});
const publisher = await ask('publisher', 'Publisher name', nonEmpty, {
  def: keep(cur.publisher) ?? (firstParty && isTemplate ? 'MemberJunction' : undefined),
  describe: 'Who ships this app — the manifest\'s publisher block.',
});
const email = await ask('email', 'Publisher email', () => null, {
  def: keep(cur.email) || (firstParty && isTemplate ? 'dev@memberjunction.com' : undefined),
  optional: true,
});

section('Naming (npm + database)');
const scope = await ask('scope', 'npm package prefix', (v) => scopeRe.test(v) ? null : 'an npm scope like @acme-crm (=> @acme-crm/entities) or scope+app like @acme/crm (=> @acme/crm-entities)', {
  def: isTemplate ? (firstParty ? `@memberjunction/${name}` : `@${name}`) : cur.scope,
  describe: firstParty
    ? 'Prefix for this app\'s npm packages. Default: the @memberjunction org as\n@memberjunction/<app>-entities etc. Follow team convention — the shipped\nBizApps use their own org (@mj-biz-apps/<app>-*).'
    : 'Prefix for this app\'s npm packages. Default: a scope named after your app\n(the template convention). Use scope+app (@acme/crm => @acme/crm-entities)\nwhen one npm org publishes several apps. Publishing requires owning the org.',
});
let schema;
while (true) {
  schema = await ask('schema', 'SQL schema name', (v) => schemaRe.test(v) ? null : 'letters/digits/underscores, e.g. acme_crm (up to two leading underscores)', {
    def: isTemplate ? (firstParty ? `__mj_${pascalOf(name)}` : name.replace(/-/g, '_')) : cur.schema,
    describe: firstParty
      ? 'Dedicated database schema for this app\'s tables. First-party MJ apps use the\nreserved __mj_* namespace (the default — like __mj_BizAppsCommon). Installs\nand dev-links of __ schemas use an allow flag on the MJ side.'
      : 'Dedicated database schema for this app\'s tables. The default (app id with\nunderscores) keeps names traceable. "__" prefixes are RESERVED for\nfirst-party MemberJunction apps.',
  });
  if (!schema.startsWith('__')) break;
  if (firstParty || args['allow-reserved-schema']) break;   // intended for first-party — no confirmation needed
  if (args.schema != null) {
    fail('Schema names starting with "__" are reserved for first-party MJ apps. Re-run with --allow-reserved-schema to confirm.');
    process.exit(1);
  }
  warn(`"${schema}" starts with "__" — reserved for FIRST-PARTY MemberJunction apps.\n  Third-party apps must not use it, and installing/dev-linking such a schema\n  requires an explicit allow flag on the MJ side.`);
  const sure = (await readAnswer(cyan('Use the reserved schema name anyway?') + gray(' [y/N]') + ' ')).toLowerCase();
  if (sure === 'y' || sure === 'yes') break;
  delete args.schema; // re-prompt
}
const prefix = await ask('prefix', 'Entity name prefix', nonEmpty, {
  def: isTemplate ? display : cur.prefix,
  describe: 'Stamped on your entity names ("Acme CRM: Customers") so they never collide\nwith MJ core or other apps. The default is right for almost everyone.',
});

// Entity ID range: a NOT NULL legacy pair in __mj.SchemaInfo that no runtime
// code reads (entity IDs are UUIDs today; CodeGen itself auto-creates rows
// with dummy values). Not worth prompting — written silently, current values
// preserved on re-runs, --id-min/--id-max flags still override.
const idMin = args['id-min'] ?? cur.idMin;
const idMax = args['id-max'] ?? (Number(cur.idMax) > Number(idMin) ? cur.idMax : String(Number(idMin) + 99998));
if (!/^\d+$/.test(idMin) || !/^\d+$/.test(idMax) || Number(idMax) <= Number(idMin)) {
  fail('--id-min/--id-max must be integers with max > min'); process.exit(1);
}

const repoUrl = repo.replace(/\.git$/, '');
const repoName = repoUrl.split('/').pop();
const pascal = pascalOf(name);
const newPkgPrefix = pkgPrefixOfScope(scope);
const schemaUuid = existingUuid ?? randomUUID().toUpperCase();

// ---------- replacement table: CURRENT -> NEW, skipping unchanged ------------
const pairs = [
  [cur.display, display],
  [cur.description, description],
  [cur.repo, repoUrl],
  [`Load${cur.pascal}EntitiesServer`, `Load${pascal}EntitiesServer`],
  [`Load${cur.pascal}Actions`, `Load${pascal}Actions`],
  [`Load${cur.pascal}Server`, `Load${pascal}Server`],
  [`Load${cur.pascal}Client`, `Load${pascal}Client`],
  [`${cur.pascal}Dashboard`, `${pascal}Dashboard`],
  [cur.pkgPrefix, newPkgPrefix],          // package names + every reference to them
  // Bare-scope PROSE ("all @acme packages") — compare bare parts only, or an
  // unchanged two-part scope would mangle package names on re-runs.
  [cur.scope.split('/')[0], scope.split('/')[0]],
  [cur.repoName, repoName],
  [cur.name, name],
  [cur.schema, schema],
  // Bare prefix text replaced only in template state (post-rename it can
  // collide with the display name); the quoted-colon config form is always safe.
  [`'${cur.prefix}: '`, `'${prefix}: '`],
  ...(isTemplate ? [[cur.prefix, prefix], ['<Your App>', display]] : []),
];
const seen = new Set();
const replacements = pairs
  .filter(([f, t]) => f && t && f !== t && !seen.has(f) && (seen.add(f) || true))
  .sort((a, b) => b[0].length - a[0].length);

section('Review');
kv('App', `${cyan(name)}  ${gray('·')}  ${display}`);
kv('Packages', `${cyan(newPkgPrefix + '*')}  ${gray('(entities, core-entities-server, actions, server, ng)')}`);
kv('Schema', `${cyan(schema)}  ${gray(`prefix "${prefix}: "`)}`);
kv('Repository', repoUrl);
kv('Publisher', publisher + (email ? gray(`  <${email}>`) : ''));
kv('SchemaInfo', `${schemaUuid} ${existingUuid ? gray('(kept)') : gray('(new — pinned forever once pushed)')}`);
kv('Changes', `${replacements.length} text replacement(s)${replacements.length === 0 ? gray(' — nothing to do') : ''}`);
if (!args.yes) {
  const okAns = (await readAnswer('\n' + cyan('Proceed?') + gray(' [y/N]') + ' ')).toLowerCase();
  if (okAns !== 'y' && okAns !== 'yes') { console.log(gray('Aborted — nothing changed.')); process.exit(0); }
}
rl.close();

// ---------- apply replacements over tracked text files -----------------------
console.log('');
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
ok(`${changed} file(s) rewritten`);

// ---------- authoritative JSON writes ----------------------------------------
const m2 = JSON.parse(readFileSync('mj-app.json', 'utf8'));
m2.name = name; m2.displayName = display; m2.description = description;
m2.repository = repoUrl;
m2.publisher = email ? { name: publisher, email } : { name: publisher };
if (m2.schema) m2.schema.name = schema;
writeFileSync('mj-app.json', JSON.stringify(m2, null, 2) + '\n');
ok('mj-app.json identity updated');

writeFileSync(SCHEMA_INFO, JSON.stringify([{
  fields: {
    SchemaName: schema,
    EntityIDMin: Number(idMin),
    EntityIDMax: Number(idMax),
    EntityNamePrefix: prefix,
    Description: `${display} - application schema`,
  },
  primaryKey: { ID: schemaUuid },
  ...(schemaInfoRecord?.sync ? { sync: schemaInfoRecord.sync } : {}),
}], null, 2) + '\n');
ok(`schema-info ${existingUuid ? 'updated (UUID kept)' : 'activated (new pinned UUID)'}`);

console.log(bold(`\n${green('✓')} ${display} is set up\n`));
console.log(bold('Next steps'));
console.log(`  1. ${cyan('git diff')}                 ${gray('review everything this script changed')}`);
console.log(`  2. ${cyan('npm install')}              ${gray('regenerate the lockfile (needed if scope/id changed)')}`);
console.log(`  3. ${cyan('npm run build:packages')}   ${gray('confirm all five packages build')}`);
console.log(`  4. ${gray('branches + services:')} docs/template-docs/repo-setup.md`);
console.log(`     ${gray('link into MJ:')}        docs/template-docs/linking-to-mj.md`);
if (existingUuid) console.log('\n' + yellow('⚠ ') + gray('Schema renamed after a push? The old row remains in that dev DB — clean it\n  up (or drop the dev schema) before re-syncing.'));
console.log(gray('\nRe-run `npm run setup` any time — Enter keeps current values.\n'));
