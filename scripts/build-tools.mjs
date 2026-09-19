/**
 * Generates src/data/tools.ts.
 *
 *   pnpm build:tools
 *
 * The list is derived, not hand-written. An entry appears when it clears both
 * bars:
 *
 *   1. over an hour of tracked time on WakaTime, and
 *   2. an icon exists in devicon or simple-icons.
 *
 * Run it by hand when the numbers should be refreshed. It is deliberately NOT
 * part of `build`, so a WakaTime outage can never break a deploy.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as simpleIcons from 'simple-icons';

const SHARE_URL =
  'https://wakatime.com/share/@Jat/2eb9c492-2f32-4d9c-8eac-edcdd6894d68.json';

/** Minimum tracked time to count. WakaTime logs seconds for any file merely opened. */
const MIN_SECONDS = 3600;

/**
 * Rows that are really one thing. Renaming merges their time and fixes the
 * catalogue lookup in one step.
 *
 *   Vue    — WakaTime reports "Vue" and "Vue.js" separately.
 *   HTML   — catalogued as "HTML5"; WakaTime calls it "HTML".
 *   shells — every POSIX-ish shell folds into Bash. PowerShell does not: it
 *            is a separate language with its own mark. Nor does Batchfile.
 */
const ALIAS = new Map([
  ['vue', 'Vue.js'],
  ['html', 'HTML5'],
  ['shellscript', 'Bash'],
  ['shell', 'Bash'],
  ['sh', 'Bash'],
  ['zsh', 'Bash'],
  ['ksh', 'Bash'],
  ['csh', 'Bash'],
  ['tcsh', 'Bash'],
  ['fish', 'Bash'],
  ['nushell', 'Bash'],
]);

/** Dropped regardless of time or icon availability. */
const EXCLUDE = new Set(['xorg', 'tex']);

/**
 *   SQL — no generic SQL mark exists in either library, only products
 *         (MySQL, PostgreSQL, SQL Server…). Azure SQL Database is the
 *         closest thing to a neutral one.
 */
const ICON_OVERRIDE = new Map([['sql', 'devicon:azuresqldatabase']]);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const norm = (s) =>
  s.toLowerCase().replace(/\+/g, 'plus').replace(/#/g, 'sharp').replace(/[^a-z0-9]/g, '');

/* ── catalogues, read from the installed packages ── */

const devicon = JSON.parse(readFileSync(resolve(root, 'node_modules/devicon/devicon.json'), 'utf8'));
const deviconIndex = new Map();
for (const entry of devicon) {
  const record = { name: entry.name, variants: entry.versions?.svg ?? [] };
  deviconIndex.set(norm(entry.name), record);
  for (const alt of entry.altnames ?? []) deviconIndex.set(norm(alt), record);
}

const simpleIndex = new Map();
for (const key of Object.keys(simpleIcons)) {
  const icon = simpleIcons[key];
  if (icon?.title && icon.path) simpleIndex.set(norm(icon.title), icon);
}

/** Pulls every path `d` out of a devicon SVG and drops its baked fills. */
function fromDevicon(name, variant) {
  const file = resolve(root, `node_modules/devicon/icons/${name}/${name}-${variant}.svg`);
  const svg = readFileSync(file, 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!viewBox || paths.length === 0) throw new Error(`unusable SVG: ${file}`);
  return { viewBox, paths };
}

/**
 * Prefers a filled monochrome glyph, because the grid tints everything with
 * `currentColor`: devicon `plain` first, then simple-icons, and only then a
 * devicon `line`/`original`, whose baked colours are being thrown away.
 */
function resolveIcon(label) {
  const key = norm(label);

  const override = ICON_OVERRIDE.get(key);
  if (override) {
    const [, name] = override.split(':');
    const record = deviconIndex.get(norm(name));
    const variant = record?.variants.includes('plain')
      ? 'plain'
      : existsSync(resolve(root, `node_modules/devicon/icons/${name}/${name}-plain.svg`))
        ? 'plain'
        : record?.variants[0];
    if (!variant) throw new Error(`override ${override} has no usable variant`);
    return { source: `devicon:${name} (${variant}, override)`, ...fromDevicon(name, variant) };
  }

  const dev = deviconIndex.get(key);
  // devicon.json under-reports: some icons ship a plain file it does not list
  const hasPlain =
    dev &&
    (dev.variants.includes('plain') ||
      existsSync(resolve(root, `node_modules/devicon/icons/${dev.name}/${dev.name}-plain.svg`)));
  if (hasPlain) {
    return { source: `devicon:${dev.name} (plain)`, ...fromDevicon(dev.name, 'plain') };
  }

  const simple = simpleIndex.get(key);
  if (simple) {
    return { source: `simple-icons:${simple.title}`, viewBox: '0 0 24 24', paths: [simple.path] };
  }

  if (dev) {
    const variant = ['line', 'original'].find((v) => dev.variants.includes(v));
    if (variant) {
      return { source: `devicon:${dev.name} (${variant})`, ...fromDevicon(dev.name, variant) };
    }
  }

  return null;
}

/* ── usage ── */

const response = await fetch(SHARE_URL);
if (!response.ok) throw new Error(`WakaTime returned ${response.status}`);
const entries = (await response.json())?.data;
if (!Array.isArray(entries) || entries.length === 0) {
  throw new Error('Unexpected share payload — expected a non-empty `data` array');
}

const totals = new Map();
for (const entry of entries) {
  const label = ALIAS.get(norm(entry.name)) ?? entry.name;
  const key = norm(label);
  totals.set(key, {
    label,
    seconds: (totals.get(key)?.seconds ?? 0) + (Number(entry.total_seconds) || 0),
  });
}

const qualifying = [...totals.values()]
  .filter((t) => !EXCLUDE.has(norm(t.label)) && t.seconds >= MIN_SECONDS)
  .sort((a, b) => b.seconds - a.seconds);

const kept = [];
const dropped = [];
for (const item of qualifying) {
  const icon = resolveIcon(item.label);
  if (icon) kept.push({ ...item, ...icon });
  else dropped.push(item);
}

/* ── emit ── */

// Alphabetical: the page shows no numbers, and ordering by hours would rank them.
const data = kept
  .slice()
  .sort((a, b) => a.label.localeCompare(b.label, 'en'))
  .map(({ label, viewBox, paths }) => ({ label, viewBox, paths }));

const bytes = data.reduce((n, t) => n + t.paths.join('').length, 0);
const today = new Date().toISOString().slice(0, 10);

writeFileSync(
  resolve(root, 'src/data/tools.ts'),
  `// GENERATED by scripts/build-tools.mjs — do not edit by hand.
// Source: ${SHARE_URL}
// Generated: ${today}
// Everything with over ${MIN_SECONDS / 3600} h tracked that has an icon in
// devicon or simple-icons: ${data.length} of ${qualifying.length} qualifying entries.
// Icons: devicon (MIT) and simple-icons (CC0-1.0). The marks themselves remain
// the trademarks of their respective owners.

export interface Tool {
  label: string;
  viewBox: string;
  paths: string[];
}

export const tools: Tool[] = ${JSON.stringify(data, null, 2)};
`
);

const hours = (s) => (s / 3600).toFixed(s < 36000 ? 1 : 0).padStart(6);
console.log(`wrote src/data/tools.ts — ${data.length} icons, ${(bytes / 1024).toFixed(1)} KB of paths\n`);
console.log(`kept (${kept.length}):`);
for (const k of kept) console.log(`  ${k.label.padEnd(24)} ${hours(k.seconds)} h   ${k.source}`);
console.log(`\nover ${MIN_SECONDS / 3600} h but no icon anywhere (${dropped.length}):`);
for (const d of dropped) console.log(`  ${d.label.padEnd(24)} ${hours(d.seconds)} h`);
