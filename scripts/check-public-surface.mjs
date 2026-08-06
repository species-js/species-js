// @ts-check

/**
 * Public-surface check — fails when a package's curated public entry
 * (`src/public.{js,d.ts}`) disagrees with the `@internal` tagging of the
 * modules it re-exports from.
 *
 * ## Why it exists
 *
 * `@internal` is a JSDoc tag. No module resolver has ever read one, so tagging
 * an export internal narrows nothing on its own — a star re-export publishes it
 * regardless, and a consumer who imports it is bound by Hyrum's law across six
 * planned dependents. ADR #084 hit this from the other side: a re-export that
 * had silently dropped its `@internal` tag was the only path a sentinel had onto
 * the typed surface, and nothing caught it.
 *
 * The curated entry is what actually narrows the surface. This gate is what
 * keeps the tag and the curation from drifting apart — the tag becomes
 * enforcement at the moment a script reads it and exits non-zero, never before.
 *
 * ## What it asserts
 *
 * For every package with a `src/public.d.ts`, over each `#module` that file
 * re-exports from:
 *
 * 1. **Every exported declaration carries a JSDoc block.** An undocumented
 *    export cannot be classified, and the gate refuses to guess — silently
 *    treating it as either kind is how a surface leaks.
 * 2. **`public.d.ts` lists exactly the exports whose block lacks `@internal`** —
 *    no missing names (a documented-public export that no consumer can reach)
 *    and no extra ones (an `@internal` export published anyway).
 * 3. **`public.js` lists exactly the public VALUE exports.** Types are erased at
 *    runtime, so naming one in the `.js` would be a dangling binding; omitting a
 *    value would drop it from the built bundle while the `.d.ts` still promised
 *    it. This is the pair-drift that a hand-maintained list of ~138 names invites.
 *
 * ## TRIP CONDITION
 *
 * Delete this script if the packages ever stop hand-maintaining a curated entry
 * — for instance if every public module is made pure (internals relocated to
 * modules that are never re-exported), at which point `export * as ns from
 * '#mod'` narrows the surface structurally and there is no list left to drift.
 * A guard over a duplication that no longer exists is pure upkeep.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

/**
 * Pairs each exported declaration with the JSDoc block immediately preceding
 * it. A `@@`-marker comment (`/* @@throw-safe *\/`) may sit between the block
 * and the declaration and is skipped.
 *
 * @param {string} source - the `.d.ts` contents
 * @returns {{ name: string, kind: string, documented: boolean, internal: boolean }[]}
 *  one entry per exported declaration, in source order
 */
function readExports(source) {
  const found = [];
  const declaration =
    /^export\s+(?:declare\s+)?(function|const|interface|type|class)\s+([A-Za-z_$][\w$]*)/gm;

  let match;
  while ((match = declaration.exec(source)) !== null) {
    const before = source.slice(0, match.index).trimEnd();
    // step back over an optional `@@`-marker comment
    const head = before.endsWith('*/')
      ? before.slice(0, before.lastIndexOf('/*')).trimEnd()
      : before;
    const isMarker =
      before.endsWith('*/') && !before.slice(before.lastIndexOf('/*')).startsWith('/**');
    const block = isMarker ? head : before;

    const documented = block.endsWith('*/');
    const start = documented ? block.lastIndexOf('/**') : -1;
    const doc = start === -1 ? '' : block.slice(start);

    found.push({
      name: match[2],
      kind: match[1],
      documented: documented && start !== -1,
      // `@internal` counts only as a TAG — a block that merely mentions the
      // word in prose (`the singular form stays \`@internal\``) documents a
      // PUBLIC export, and matching it anywhere silently hides that export
      // from the surface. Found the hard way: the first export promoted to
      // public after this gate shipped was misclassified by its own doc block.
      internal: /^[ \t]*\*[ \t]*@internal\b/m.test(doc),
    });
  }
  return found;
}

/**
 * The `#module` specifiers a curated entry re-exports from, in order.
 *
 * @param {string} source - the `public.d.ts` contents
 * @returns {string[]} the distinct specifiers, first-seen order
 */
function readReExportedModules(source) {
  return [...new Set([...source.matchAll(/from\s+'(#[\w-]+)'/g)].map((m) => m[1]))];
}

/**
 * The names a curated entry re-exports.
 *
 * @param {string} source - the `public.{js,d.ts}` contents
 * @returns {Set<string>} every re-exported name, aliases resolved to the source name
 */
function readReExportedNames(source) {
  const names = new Set();
  for (const block of source.matchAll(
    /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s+'#[\w-]+'/g,
  )) {
    for (const raw of block[1].split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) {
        names.add(name);
      }
    }
  }
  return names;
}

const problems = [];
let packagesChecked = 0;
let namesChecked = 0;

for (const pkg of readdirSync(PACKAGES)) {
  const src = join(PACKAGES, pkg, 'src');
  const publicTypes = join(src, 'public.d.ts');
  if (!existsSync(publicTypes)) {
    continue;
  }

  packagesChecked += 1;

  const manifest = JSON.parse(readFileSync(join(PACKAGES, pkg, 'package.json'), 'utf8'));
  const imports = manifest.imports ?? {};

  const typesSource = readFileSync(publicTypes, 'utf8');
  const valuesSource = readFileSync(join(src, 'public.js'), 'utf8');

  /** @type {Set<string>} */ const expectedAll = new Set();
  /** @type {Set<string>} */ const expectedValues = new Set();

  for (const specifier of readReExportedModules(typesSource)) {
    const target = imports[specifier];
    if (typeof target !== 'string') {
      problems.push(
        `${pkg}: '${specifier}' is re-exported but absent from the imports map`,
      );
      continue;
    }
    const declarations = join(PACKAGES, pkg, target.replace(/^\.\//, '')).replace(
      /\.js$/,
      '.d.ts',
    );
    if (!existsSync(declarations)) {
      problems.push(
        `${pkg}: '${specifier}' has no sibling declaration file (${declarations})`,
      );
      continue;
    }

    for (const entry of readExports(readFileSync(declarations, 'utf8'))) {
      namesChecked += 1;
      if (!entry.documented) {
        problems.push(
          `${pkg} ${specifier}: '${entry.name}' has no JSDoc block — cannot be classified ` +
            `as public or @internal`,
        );
        continue;
      }
      if (entry.internal) {
        continue;
      }
      expectedAll.add(entry.name);
      if (entry.kind !== 'interface' && entry.kind !== 'type') {
        expectedValues.add(entry.name);
      }
    }
  }

  const listedAll = readReExportedNames(typesSource);
  const listedValues = readReExportedNames(valuesSource);

  const diff = (a, b) => [...a].filter((name) => !b.has(name)).sort();

  for (const name of diff(expectedAll, listedAll)) {
    problems.push(
      `${pkg}: '${name}' is documented public but missing from src/public.d.ts`,
    );
  }
  for (const name of diff(listedAll, expectedAll)) {
    problems.push(
      `${pkg}: '${name}' is listed in src/public.d.ts but is @internal or unknown`,
    );
  }
  for (const name of diff(expectedValues, listedValues)) {
    problems.push(
      `${pkg}: value '${name}' is documented public but missing from src/public.js`,
    );
  }
  for (const name of diff(listedValues, expectedValues)) {
    problems.push(
      `${pkg}: '${name}' is listed in src/public.js but is @internal, a type, or unknown`,
    );
  }
}

if (packagesChecked === 0) {
  console.error(
    '✗ no package carries a src/public.d.ts — this gate is measuring nothing.',
  );
  console.error(
    '  → either a curated entry was removed, or the trip condition fired: delete me.',
  );
  process.exit(1);
}

if (problems.length > 0) {
  console.error('✗ public surface disagrees with the @internal tagging:\n');
  for (const problem of problems) {
    console.error(`    ${problem}`);
  }
  console.error(
    `\n  → reconcile src/public.{js,d.ts} with the module declarations, or correct the ` +
      `@internal tag at the export.`,
  );
  process.exit(1);
}

console.warn(
  `✓ public surface matches the @internal tagging ` +
    `(${packagesChecked} package${packagesChecked === 1 ? '' : 's'}, ${namesChecked} exports classified)`,
);
