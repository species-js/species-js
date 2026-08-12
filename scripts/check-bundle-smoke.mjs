// @ts-check

/**
 * Bundle smoke check — loads every BUILT artifact of every publishable package
 * and asserts its exports are present, correctly shaped, and callable.
 *
 * ## Why it exists
 *
 * Nothing else in the pipeline ever executes a built file. The suites import
 * source through `#index`; `pack:check` inspects tarball contents; `attw` and
 * `publint` resolve types and metadata. All of them stay green for a bundle
 * that is structurally perfect and functionally broken — an export tree-shaken
 * away, a dependency mis-inlined, a UMD that loads and throws on first call.
 *
 * That gap sits at the end of the delivery seam, which is where this
 * workspace's defects have actually lived: three subpaths with no build entry,
 * four legacy fields naming a stale file, a `types` field `publint` passed
 * because the file existed. `entries:check` closed the static half. This is the
 * half only execution can close.
 *
 * ## What it asserts, per publishable package
 *
 * The artifacts are exactly the ones `package.json` promises — the `exports["."]`
 * runtime conditions plus `unpkg` — so this gate inherits `entries:check`'s
 * parity instead of restating it. For each:
 *
 * 1. **Every export of the source entry is present**, with the same `typeof`.
 *    The expected set is READ from the source entry, so there is no list to
 *    maintain and none to drift.
 * 2. **Nothing extra escapes.** An artifact exporting more than the curated
 *    entry means the bundle published something the surface gate never saw.
 * 3. **The UMD is self-contained.** It is executed in a fresh realm with no
 *    `require`, `module`, `exports` or `define` in scope, so it cannot reach a
 *    dependency at runtime even in principle. It must still work.
 * 4. **The UMD claims its own namespace** under the shared `SpeciesJS` global,
 *    taken from the vite config rather than assumed, and merges rather than
 *    overwrites — two packages must coexist on one page.
 * 5. **Behavioral probes run**, when the package ships a `smoke.probes.mjs`.
 *    Presence and shape prove the wiring; only a probe proves the code RUNS.
 *
 * ## A missing `dist/` is an ERROR, never a skip
 *
 * This gate needs a build. A version that quietly passed when there was
 * nothing to load would be worse than no gate: it would report success in
 * exactly the situation it exists to catch. It therefore belongs in
 * `check:full` after `build`, never in `check`.
 *
 * ## TRIP CONDITION
 *
 * Delete this if the packages ever stop shipping prebuilt artifacts — if
 * consumers compile from source, there is no bundle left to smoke.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');
const require = createRequire(import.meta.url);

/** @type {string[]} */
const problems = [];

let packagesChecked = 0;
let artifactsLoaded = 0;
let namesChecked = 0;
let probesRun = 0;
let markersScanned = 0;

/**
 * Reads a nested value out of an `exports` subpath entry.
 *
 * @param {unknown} entry - the subpath's condition object
 * @param {string[]} keys - the condition path, outermost first
 * @returns {unknown} the value found, or `undefined`
 */
function at(entry, keys) {
  return keys.reduce(
    (node, key) =>
      node && typeof node === 'object'
        ? /** @type {Record<string, unknown>} */ (node)[key]
        : undefined,
    /** @type {unknown} */ (entry),
  );
}

/**
 * Syntax and APIs newer than the ES2020 floor each package's `engines.node`
 * (`>=18`, the CONSUMER floor of ADR #078) promises to run on.
 *
 * The node build target is `node22`, so esbuild is PERMITTED to emit anything
 * Node 22 understands. Nothing lowers it. What actually keeps the promise is
 * the source obeying an ES2020 floor by convention — and a convention with no
 * check is one contributor away from silently breaking a published contract.
 *
 * Markers are chosen for high signal and no false positives on minified
 * output. `.at(`, `with(` and numeric separators are deliberately ABSENT: they
 * collide with ordinary identifiers once names are mangled, and a gate that
 * cries wolf gets switched off.
 */
const POST_ES2020 = [
  { pattern: /\?\?=/, name: '??= (ES2021)' },
  { pattern: /\|\|=/, name: '||= (ES2021)' },
  { pattern: /&&=/, name: '&&= (ES2021)' },
  { pattern: /\breplaceAll\s*\(/, name: 'String.replaceAll (ES2021)' },
  { pattern: /\bPromise\s*\.\s*any\s*\(/, name: 'Promise.any (ES2021)' },
  { pattern: /\bWeakRef\b/, name: 'WeakRef (ES2021)' },
  { pattern: /\bFinalizationRegistry\b/, name: 'FinalizationRegistry (ES2021)' },
  { pattern: /\bObject\s*\.\s*hasOwn\s*\(/, name: 'Object.hasOwn (ES2022)' },
  { pattern: /\bstatic\s*\{/, name: 'class static block (ES2022)' },
  { pattern: /\bfindLast(Index)?\s*\(/, name: 'Array.findLast (ES2023)' },
  {
    pattern: /\btoSorted\s*\(|\btoReversed\s*\(|\btoSpliced\s*\(/,
    name: 'Array copy methods (ES2023)',
  },
  {
    pattern: /\bObject\s*\.\s*groupBy\s*\(|\bMap\s*\.\s*groupBy\s*\(/,
    name: 'groupBy (ES2024)',
  },
  {
    pattern: /\bPromise\s*\.\s*withResolvers\s*\(/,
    name: 'Promise.withResolvers (ES2024)',
  },
];

/**
 * Every emitted script under a `dist/` tree, source maps excluded.
 *
 * EVERY file, not just the entry points. The entries are re-export shells
 * holding almost no code — the implementation lives in the chunks they import,
 * so scanning only the entries produced a healthy-looking marker count over
 * files that could not have contained a violation. Caught by mutation probe.
 *
 * @param {string} directory - a directory to walk
 * @returns {string[]} absolute paths of every `.js`/`.cjs` file beneath it
 */
function emittedScripts(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...emittedScripts(path));
    } else if (/\.(js|cjs)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

/**
 * Scans one built file for syntax past the consumer floor.
 *
 * A REGRESSION guard over known markers, NOT a proof of compatibility — the
 * list is a sample and cannot be exhaustive. Only executing on the target
 * runtime proves a runtime works.
 *
 * @param {string} label - how to name this file in a message
 * @param {string} source - the built file's contents
 * @returns {number} how many markers were scanned
 */
function scanForPostFloorSyntax(label, source) {
  for (const { pattern, name } of POST_ES2020) {
    if (pattern.test(source)) {
      problems.push(
        `${label}: built output uses ${name}, past the ES2020 floor each package's ` +
          `\`engines.node\` (>=18) promises — either lower the build target or raise the ` +
          `declared floor`,
      );
    }
  }
  return POST_ES2020.length;
}

/**
 * The export names and value kinds of a module namespace, ignoring the
 * bookkeeping keys a bundler adds.
 *
 * @param {Record<string, unknown>} namespace - a loaded module namespace
 * @returns {Map<string, string>} export name to `typeof`
 */
function surfaceOf(namespace) {
  const surface = new Map();
  for (const [name, value] of Object.entries(namespace)) {
    if (name === 'default' || name === '__esModule') {
      continue;
    }
    surface.set(name, typeof value);
  }
  return surface;
}

/**
 * Compares one artifact's surface against the source entry's.
 *
 * @param {string} label - how to name this artifact in a message
 * @param {Map<string, string>} expected - the source entry's surface
 * @param {Map<string, string>} actual - the artifact's surface
 */
function compareSurface(label, expected, actual) {
  for (const [name, kind] of expected) {
    namesChecked += 1;
    if (!actual.has(name)) {
      problems.push(`${label}: '${name}' is missing from the built artifact`);
      continue;
    }
    if (actual.get(name) !== kind) {
      problems.push(
        `${label}: '${name}' is ${actual.get(name)} in the bundle but ${kind} in source`,
      );
    }
  }
  for (const name of actual.keys()) {
    if (!expected.has(name)) {
      problems.push(
        `${label}: '${name}' escapes from the built artifact but is not on the curated entry`,
      );
    }
  }
}

for (const name of readdirSync(PACKAGES)) {
  const packageDir = join(PACKAGES, name);
  const manifestPath = join(packageDir, 'package.json');
  if (!existsSync(manifestPath)) {
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.private === true) {
    continue;
  }

  const root = manifest.exports?.['.'];
  if (!root) {
    problems.push(`${name}: no "." export to smoke`);
    continue;
  }

  // The source entry is whatever `types` describes — the same module
  // `entries:check` proves the runtime is built from.
  const declarations = at(root, ['types']);
  if (typeof declarations !== 'string') {
    problems.push(`${name}: no \`types\` condition on the "." export`);
    continue;
  }
  const sourceEntry = join(packageDir, declarations.replace(/\.d\.ts$/, '.js'));
  if (!existsSync(sourceEntry)) {
    problems.push(`${name}: source entry ${sourceEntry} does not exist`);
    continue;
  }

  packagesChecked += 1;

  const expected = surfaceOf(await import(pathToFileURL(sourceEntry).href));
  if (expected.size === 0) {
    problems.push(
      `${name}: the source entry exports nothing — every comparison below is vacuous`,
    );
    continue;
  }

  /** The artifacts the manifest promises, each with how it must be loaded. */
  const artifacts = [
    { kind: 'esm', label: 'node ESM', target: at(root, ['node', 'import']) },
    { kind: 'cjs', label: 'node CJS', target: at(root, ['node', 'require']) },
    { kind: 'esm', label: 'browser ESM', target: at(root, ['browser', 'import']) },
    { kind: 'umd', label: 'UMD', target: manifest.unpkg },
  ];

  /** @type {Map<string, Record<string, unknown>>} */
  const loaded = new Map();

  for (const { kind, label, target } of artifacts) {
    const where = `${name} ${label}`;
    if (typeof target !== 'string') {
      problems.push(`${where}: the manifest names no artifact for this condition`);
      continue;
    }
    const file = join(packageDir, target);
    if (!existsSync(file)) {
      problems.push(
        `${where}: ${target} does not exist — run \`pnpm run build\` first. This gate ` +
          `needs artifacts and refuses to pass without them`,
      );
      continue;
    }

    /** @type {Record<string, unknown> | undefined} */
    let namespace;
    try {
      if (kind === 'esm') {
        namespace = await import(pathToFileURL(file).href);
      } else if (kind === 'cjs') {
        namespace = require(file);
      } else {
        // A browser-shaped global: the web APIs a page provides are handed in,
        // the module plumbing (`require`, `module`, `exports`, `define`) is
        // NOT. So the bundle takes its `globalThis` branch exactly as a
        // <script> would and cannot resolve a dependency even in principle —
        // while still finding the host objects it legitimately expects.
        //
        // Withholding these too would fail honest code for the wrong reason:
        // a bare realm has no `EventTarget`, and a browser does.
        const context = vm.createContext({
          EventTarget,
          AbortSignal,
          AbortController,
          DOMException,
          queueMicrotask,
        });
        vm.runInContext(readFileSync(file, 'utf8'), context);

        const config = await loadUmdConfig(packageDir);
        const globalName = config?.build?.lib?.name;
        if (typeof globalName !== 'string') {
          problems.push(`${where}: the vite config declares no UMD global name`);
          continue;
        }
        const [namespaceRoot, leaf] = globalName.split('.');
        const carrier = /** @type {Record<string, Record<string, unknown>>} */ (
          /** @type {unknown} */ (context)
        )[namespaceRoot];
        if (!carrier || !carrier[leaf]) {
          problems.push(
            `${where}: loaded but did not define \`${globalName}\` on the global`,
          );
          continue;
        }
        namespace = carrier[leaf];
      }
    } catch (error) {
      problems.push(`${where}: failed to load — ${/** @type {Error} */ (error).message}`);
      continue;
    }

    if (!namespace) {
      continue;
    }
    artifactsLoaded += 1;
    loaded.set(label, namespace);
    compareSurface(where, expected, surfaceOf(namespace));
  }

  // ----- the consumer floor: every emitted script, not just the entries -----

  const emitted = emittedScripts(join(packageDir, 'dist'));
  if (emitted.length === 0) {
    problems.push(`${name}: no emitted scripts found under dist/ to scan`);
  }
  for (const file of emitted) {
    markersScanned += scanForPostFloorSyntax(
      `${name} ${relative(packageDir, file)}`,
      readFileSync(file, 'utf8'),
    );
  }

  // ----- behavioural probes -----

  const probeFile = join(packageDir, 'smoke.probes.mjs');
  if (!existsSync(probeFile)) {
    problems.push(
      `${name}: no smoke.probes.mjs — presence and shape are checked, but nothing ` +
        `proves the built code RUNS. Add probes or this gate is half a gate`,
    );
    continue;
  }

  const { probes } = await import(pathToFileURL(probeFile).href);
  if (!Array.isArray(probes) || probes.length === 0) {
    problems.push(`${name}: smoke.probes.mjs exports no probes`);
    continue;
  }

  for (const [label, namespace] of loaded) {
    for (const probe of probes) {
      probesRun += 1;
      try {
        const outcome = probe.run(namespace);
        if (outcome !== true) {
          problems.push(
            `${name} ${label}: probe "${probe.name}" returned ${String(outcome)}, wanted true`,
          );
        }
      } catch (error) {
        problems.push(
          `${name} ${label}: probe "${probe.name}" threw — ` +
            `${/** @type {Error} */ (error).message}`,
        );
      }
    }
  }
}

/**
 * The package's vite config, evaluated for the UMD target so its declared
 * global name can be read rather than assumed.
 *
 * @param {string} packageDir - the package root
 * @returns {Promise<{ build?: { lib?: { name?: unknown } } } | undefined>} the resolved
 *  config, narrowed to the one field this gate reads
 */
async function loadUmdConfig(packageDir) {
  const configPath = join(packageDir, 'vite.config.js');
  if (!existsSync(configPath)) {
    return undefined;
  }
  process.env.SPECIES_BUILD_TARGET = 'umd';
  const module = await import(`${pathToFileURL(configPath).href}?smoke=umd`);
  return module.default;
}

// ----- the gate's own denominators -----

let red = false;

if (problems.length > 0) {
  red = true;
  console.error('✗ built artifacts do not behave like their source entry:\n');
  for (const problem of problems) {
    console.error(`    ${problem}`);
  }
  console.error(
    '\n  → a consumer installs these files, not `src/`. Rebuild, or fix the entry that\n' +
      '    produced them.\n',
  );
}

if (packagesChecked === 0 || artifactsLoaded === 0 || namesChecked === 0) {
  red = true;
  console.error(
    `✗ this gate measured nothing — ${packagesChecked} publishable packages, ` +
      `${artifactsLoaded} artifacts loaded,\n  ${namesChecked} exports compared. It must ` +
      `run AFTER \`pnpm run build\`.`,
  );
}

if (red) {
  process.exit(1);
}

console.warn(
  `✓ built artifacts behave (${packagesChecked} packages, ${artifactsLoaded} artifacts, ` +
    `${namesChecked} exports, ${probesRun} probes, ${markersScanned} syntax markers)`,
);
