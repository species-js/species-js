// @ts-check

/**
 * Entry-parity check — fails when a package's `exports` map, its legacy entry
 * fields and its vite build entries disagree, so a published subpath resolves
 * to a file the build never emits.
 *
 * ## Why it exists
 *
 * `exports[subpath].types` resolves from `src/`, which is always present, while
 * `import` and `require` resolve into `dist/`, which is written by a build the
 * type-checker never runs. A subpath whose runtime target has no build entry
 * therefore type-checks perfectly, passes every test, and fails only for the
 * consumer who imports it. Three such defects were found by hand on 2026-08-12
 * — three subpaths with no entry, four legacy fields naming a file no longer
 * built, and a `types` field pointing at the internal barrel instead of the
 * curated root. `tsc` saw none of them, and `publint` missed the last one
 * because the file it named does exist.
 *
 * `emptyOutDir: false` compounds it: a stale `dist/` keeps answering after an
 * entry is renamed, so even a local build can look healthy.
 *
 * ## What it asserts — STATIC PARITY, never file existence
 *
 * Each vite config is evaluated once per build target, and the emitted paths
 * are derived through the config's own `lib.fileName()`. So the gate learns the
 * naming convention rather than repeating it, and needs no build to run — which
 * is the whole point. A "does every target exist on disk" check would pass
 * trivially in a fresh checkout, which is the empty-denominator shape this
 * workspace has cleaned out before. File existence stays in `check:publish`,
 * where a build has run.
 *
 * Per package:
 *
 * 1. **Every `exports` runtime target is a path the build emits.** The subpath
 *    with no entry.
 * 2. **Every built entry is reachable through `exports`.** The reverse — an
 *    entry nothing can import is dead weight in the tarball, and for an
 *    internal barrel it ships the `@internal` machinery with it.
 * 3. **A subpath's `types` and its runtime resolve to the same source module.**
 *    Declarations describing one module while the bundle is built from another.
 * 4. **The legacy fields agree with `exports["."]`**, `unpkg`/`jsdelivr`
 *    included, whose UMD path is derived from the UMD entry.
 * 5. **Every workspace dependency carries both halves of the ADR #089 pair** —
 *    listed in `rollupOptions.external` for the library builds, bundled into
 *    UMD, and aliased to the sibling's source entry for tests by a regex that
 *    is EXECUTED here, not pattern-matched: it must accept the bare name and
 *    refuse a subpath of it.
 *
 * Nothing here names `public`, `index`, `dist` or a file extension as a
 * constant. Both current package shapes — the curated `src/public.{js,d.ts}`
 * root and the plain `src/index.js` one — satisfy the same rules, and a package
 * moving between them stays green without touching this file.
 *
 * ## TRIP CONDITION
 *
 * This guards a duplication: the same entry list is written once in
 * `package.json` and once in `vite.config.js`. Generate either from the other —
 * a shared vite factory reading the manifest's `exports`, say — and the
 * disagreement becomes structurally impossible. DELETE this script then rather
 * than maintain it; a guard over a relationship that can no longer diverge is
 * pure upkeep.
 *
 * No dependencies. Peer of `check-public-surface.mjs`, which guards the other
 * end of the same seam: that one says what may escape, this one says where it
 * lands.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

/** The build targets `SPECIES_BUILD_TARGET` selects, and the outputs each emits. */
const TARGETS = ['node', 'browser', 'umd'];

/**
 * The runtime conditions an `exports` subpath may declare, each with the build
 * target and format that produces it. A subpath carrying a key absent from here
 * is reported rather than skipped — an unrecognized condition is exactly how a
 * target would slip past unchecked.
 */
const CONDITIONS = [
  { keys: ['browser', 'import'], target: 'browser', format: 'es' },
  { keys: ['node', 'import'], target: 'node', format: 'es' },
  { keys: ['node', 'require'], target: 'node', format: 'cjs' },
  { keys: ['default'], target: 'node', format: 'es' },
];

/** @type {string[]} */
const problems = [];

let packagesChecked = 0;
let subpathsChecked = 0;
let targetsChecked = 0;
let workspaceDepsChecked = 0;

/**
 * The slice of a vite config this gate reads. Every field is optional and
 * `unknown` on purpose: these configs are hand-authored, so each one is
 * validated where it is used rather than trusted from a type.
 *
 * @typedef {{
 *   build?: {
 *     lib?: { entry?: unknown, formats?: unknown, fileName?: unknown },
 *     outDir?: unknown,
 *     rollupOptions?: { external?: unknown },
 *   },
 *   test?: { alias?: unknown },
 * }} ViteConfig
 */

/**
 * A vite `test.alias` entry, as this gate needs to read one.
 *
 * @typedef {{ find?: unknown, replacement?: unknown }} AliasEntry
 */

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
 * Evaluates a package's vite config for one build target. The module is
 * re-imported per target with a cache-busting query, because the config reads
 * `SPECIES_BUILD_TARGET` at evaluation time and ESM would otherwise hand back
 * the first shape for all three.
 *
 * @param {string} configPath - absolute path to the package's `vite.config.js`
 * @param {string} target - the `SPECIES_BUILD_TARGET` value
 * @returns {Promise<ViteConfig>} the resolved config object
 */
async function loadConfig(configPath, target) {
  process.env.SPECIES_BUILD_TARGET = target;
  const module = await import(`${pathToFileURL(configPath).href}?target=${target}`);
  return module.default;
}

/**
 * The entry map of a `lib.entry`, normalized. Vite derives a string entry's
 * name from its file's basename — verified against built output, not assumed.
 *
 * @param {unknown} entry - the configured `build.lib.entry`
 * @returns {Record<string, string> | null} entry name to absolute source path
 */
function normalizeEntries(entry) {
  if (typeof entry === 'string') {
    const name = entry
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '');
    return name ? { [name]: entry } : null;
  }
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return /** @type {Record<string, string>} */ (entry);
  }
  return null;
}

/**
 * A source path reduced to its module identity — package-relative, extension
 * dropped. `src/utility/index.js` and `src/utility/index.d.ts` reduce alike, so
 * a declaration file and the module it describes compare equal.
 *
 * @param {string} packageDir - the package root
 * @param {string} sourcePath - an absolute or `./`-relative path into the package
 * @returns {string} the normalized module identity
 */
function moduleIdentity(packageDir, sourcePath) {
  const absolute = sourcePath.startsWith('.') ? join(packageDir, sourcePath) : sourcePath;
  return relative(packageDir, absolute).replace(/\.d\.ts$|\.[^.]+$/, '');
}

for (const name of readdirSync(PACKAGES)) {
  const packageDir = join(PACKAGES, name);
  const manifestPath = join(packageDir, 'package.json');
  const configPath = join(packageDir, 'vite.config.js');

  if (!existsSync(manifestPath) || !existsSync(configPath)) {
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  // This gate guards the PUBLISHED seam. A package that is never published has
  // no seam to guard, and demanding an `exports` map of it would be wrong.
  if (manifest.private === true) {
    continue;
  }

  const exportsMap = manifest.exports;

  if (!exportsMap || typeof exportsMap !== 'object') {
    problems.push(`${name}: declares no \`exports\` map — nothing to keep in parity`);
    continue;
  }

  packagesChecked += 1;

  // ----- the build's side of the seam -----

  /** Emitted path (`./dist/…`) per target, format and entry name. */
  /** @type {Map<string, string>} */
  const emitted = new Map();
  /** Source module identity per target and entry name. */
  /** @type {Map<string, string>} */
  const entrySources = new Map();
  /** @type {Set<string>} */
  const reachableEntries = new Set();
  /** @type {ViteConfig} */
  let nodeConfig = {};

  let configUsable = true;

  for (const target of TARGETS) {
    const config = await loadConfig(configPath, target);
    const lib = config?.build?.lib;
    const outDir = config?.build?.outDir;
    const entries = normalizeEntries(lib?.entry);

    if (!entries || typeof lib?.fileName !== 'function' || typeof outDir !== 'string') {
      problems.push(
        `${name} [${target}]: cannot read the build entries — \`lib.entry\` must be a ` +
          `string or an object, \`lib.fileName\` a function, \`outDir\` a string`,
      );
      configUsable = false;
      continue;
    }
    if (!Array.isArray(lib.formats) || lib.formats.length === 0) {
      problems.push(`${name} [${target}]: declares no output formats`);
      configUsable = false;
      continue;
    }

    targetsChecked += 1;
    if (target === 'node') {
      nodeConfig = config;
    }

    // The config's OWN naming function decides the emitted filenames, so the
    // convention is learned here rather than repeated.
    const fileName = /** @type {(format: string, entryName: string) => string} */ (
      lib.fileName
    );
    const formats = /** @type {string[]} */ (lib.formats);

    for (const [entryName, sourcePath] of Object.entries(entries)) {
      entrySources.set(`${target}:${entryName}`, moduleIdentity(packageDir, sourcePath));
      for (const format of formats) {
        emitted.set(
          `${target}:${format}:${entryName}`,
          `./${outDir}/${fileName(format, entryName)}`,
        );
      }
    }
  }

  if (!configUsable) {
    continue;
  }

  if (emitted.size === 0) {
    problems.push(`${name}: the build emits nothing — every assertion below is vacuous`);
    continue;
  }

  /**
   * The entry whose output for one target and format is exactly this path.
   *
   * @param {string} target - the build target
   * @param {string} format - the output format
   * @param {string} path - the `./dist/…` path an `exports` condition names
   * @returns {string | undefined} the entry name, or `undefined` if none emits it
   */
  const entryEmitting = (target, format, path) =>
    [...emitted]
      .find(
        ([key, value]) => key.startsWith(`${target}:${format}:`) && value === path,
      )?.[0]
      .split(':')[2];

  // ----- 1-3: every subpath, both directions, declarations included -----

  for (const [subpath, entry] of Object.entries(exportsMap)) {
    subpathsChecked += 1;

    const declarations = at(entry, ['types']);
    if (typeof declarations !== 'string') {
      problems.push(`${name} "${subpath}": no \`types\` condition`);
    } else if (!existsSync(join(packageDir, declarations))) {
      problems.push(
        `${name} "${subpath}": \`types\` names a missing file (${declarations})`,
      );
    }

    /** Every string leaf the subpath declares, so none goes unexamined. */
    const declared = new Set();
    const collect = (node) => {
      if (typeof node === 'string') {
        declared.add(node);
      } else if (node && typeof node === 'object') {
        Object.values(node).forEach(collect);
      }
    };
    collect(entry);
    if (typeof declarations === 'string') {
      declared.delete(declarations);
    }

    for (const { keys, target, format } of CONDITIONS) {
      const target_ = at(entry, keys);
      const condition = keys.join('.');

      if (typeof target_ !== 'string') {
        problems.push(`${name} "${subpath}": no \`${condition}\` condition`);
        continue;
      }
      declared.delete(target_);

      const entryName = entryEmitting(target, format, target_);
      if (!entryName) {
        problems.push(
          `${name} "${subpath}" ${condition}: nothing the build emits resolves to ` +
            `${target_} — the subpath has no matching \`lib.entry\``,
        );
        continue;
      }

      reachableEntries.add(`${target}:${entryName}`);

      // 3 — the declarations and the bundle must describe the same module.
      if (typeof declarations === 'string') {
        const fromTypes = moduleIdentity(packageDir, declarations);
        const fromEntry = entrySources.get(`${target}:${entryName}`);
        if (fromEntry && fromTypes !== fromEntry) {
          problems.push(
            `${name} "${subpath}" ${condition}: \`types\` describes ${fromTypes} but the ` +
              `bundle is built from ${fromEntry}`,
          );
        }
      }
    }

    for (const leftover of declared) {
      problems.push(
        `${name} "${subpath}": condition target ${leftover} sits under a key this gate ` +
          `does not know — it is going unchecked`,
      );
    }
  }

  // 2 — the reverse direction, over the target that builds every entry.
  for (const key of entrySources.keys()) {
    if (!key.startsWith('node:')) {
      continue;
    }
    if (!reachableEntries.has(key)) {
      const entryName = key.slice('node:'.length);
      problems.push(
        `${name}: the build emits entry '${entryName}' (${entrySources.get(key)}) but no ` +
          `\`exports\` subpath resolves to it — it ships unreachable`,
      );
    }
  }

  // ----- 4: the legacy fields -----

  const root = exportsMap['.'];
  if (root) {
    for (const [field, keys] of [
      ['main', ['node', 'require']],
      ['module', ['node', 'import']],
      ['types', ['types']],
    ]) {
      const declared = manifest[field];
      const expected = at(root, /** @type {string[]} */ (keys));
      if (declared !== expected) {
        problems.push(
          `${name}: \`${field}\` is ${JSON.stringify(declared)} but \`exports["."].` +
            `${/** @type {string[]} */ (keys).join('.')}\` is ${JSON.stringify(expected)}`,
        );
      }
    }

    const rootRuntime = at(root, ['node', 'import']);
    const rootEntry =
      typeof rootRuntime === 'string'
        ? entryEmitting('node', 'es', rootRuntime)
        : undefined;
    const umd = rootEntry ? emitted.get(`umd:umd:${rootEntry}`) : undefined;

    if (!umd) {
      problems.push(
        `${name}: the root entry is not part of the UMD build, so \`unpkg\`/\`jsdelivr\` ` +
          `cannot name a file that is emitted`,
      );
    } else {
      for (const field of ['unpkg', 'jsdelivr']) {
        if (manifest[field] !== umd) {
          problems.push(
            `${name}: \`${field}\` is ${JSON.stringify(manifest[field])} but the UMD build ` +
              `emits ${umd}`,
          );
        }
      }
    }
  } else {
    problems.push(`${name}: declares no "." export`);
  }

  // ----- 5: the workspace-dependency pair (ADR #089) -----

  const dependencies = Object.keys(manifest.dependencies ?? {}).filter((dep) =>
    dep.startsWith('@species-js/'),
  );
  const external = nodeConfig?.build?.rollupOptions?.external ?? [];
  const externals = Array.isArray(external) ? external : [external];
  /** @type {AliasEntry[]} */
  const aliases = Array.isArray(nodeConfig?.test?.alias) ? nodeConfig.test.alias : [];

  for (const dependency of dependencies) {
    workspaceDepsChecked += 1;

    if (!externals.includes(dependency)) {
      problems.push(
        `${name}: '${dependency}' is a dependency but absent from ` +
          `\`build.rollupOptions.external\` — the library builds would inline it`,
      );
    }

    const find = aliases
      .map((candidate) => candidate?.find)
      .find((pattern) => pattern instanceof RegExp && pattern.test(dependency));

    if (!(find instanceof RegExp)) {
      problems.push(
        `${name}: '${dependency}' has no \`test.alias\` — the suites would resolve it ` +
          `through its \`exports\` map into a \`dist/\` that need not exist (ADR #089)`,
      );
      continue;
    }
    // The pattern is EXECUTED, not read: an unanchored one would rewrite every
    // subpath of the dependency too, which no source entry can answer.
    if (find.test(`${dependency}/subpath`)) {
      problems.push(
        `${name}: the \`test.alias\` for '${dependency}' also matches its subpaths — ` +
          `anchor it (/^…$/) so only the bare specifier is rewritten`,
      );
    }

    const { replacement } = aliases.find((candidate) => candidate?.find === find) ?? {};
    if (typeof replacement !== 'string' || !existsSync(replacement)) {
      problems.push(
        `${name}: the \`test.alias\` for '${dependency}' points at a missing file ` +
          `(${String(replacement)})`,
      );
    }
  }

  for (const alias of aliases) {
    const source =
      alias?.find instanceof RegExp ? alias.find.source : String(alias?.find);
    const stale = /@species-js\\?\/([\w-]+)/.exec(source);
    if (stale && !dependencies.includes(`@species-js/${stale[1]}`)) {
      problems.push(
        `${name}: a \`test.alias\` rewrites '@species-js/${stale[1]}', which is not a ` +
          `declared dependency — the alias is stale`,
      );
    }
  }

  // The UMD bundle is standalone; externalizing a workspace dependency there
  // would emit a bundle with an unresolvable bare import.
  process.env.SPECIES_BUILD_TARGET = 'umd';
  const umdConfig = await loadConfig(configPath, 'umd');
  const umdExternal = umdConfig?.build?.rollupOptions?.external ?? [];
  for (const dependency of dependencies) {
    if ((Array.isArray(umdExternal) ? umdExternal : [umdExternal]).includes(dependency)) {
      problems.push(
        `${name}: '${dependency}' is external in the UMD build — the bundle is meant to ` +
          `be standalone and would carry an unresolvable bare import`,
      );
    }
  }
}

// ----- the gate's own denominators -----

// Both are reported before exiting: a vacuous run and a real disagreement are
// different failures, and swallowing either one loses the diagnosis that names
// what to fix.
let red = false;

if (problems.length > 0) {
  red = true;
  console.error(
    '✗ entry points disagree across `exports`, the legacy fields and vite:\n',
  );
  for (const problem of problems) {
    console.error(`    ${problem}`);
  }
  console.error(
    '\n  → reconcile package.json with vite.config.js. A published subpath resolves to a\n' +
      '    file the build emits, or a consumer gets ERR_MODULE_NOT_FOUND at import time.\n',
  );
}

if (packagesChecked === 0 || subpathsChecked === 0 || targetsChecked === 0) {
  red = true;
  console.error(
    `✗ this gate measured nothing — ${packagesChecked} publishable packages, ` +
      `${subpathsChecked} subpaths,\n  ${targetsChecked} build targets. Every assertion ` +
      `above passed for want of anything to check.\n  → the layout moved, or every ` +
      `package went private.`,
  );
}

if (red) {
  process.exit(1);
}

console.warn(
  `✓ entry points agree (${packagesChecked} packages, ${subpathsChecked} subpaths, ` +
    `${targetsChecked} build targets, ${workspaceDepsChecked} workspace deps)`,
);
