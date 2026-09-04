// @ts-check

/**
 * Browser contract check — executes each package's `browser.probes.mjs` inside
 * Chromium, Firefox and WebKit against its built UMD bundle.
 *
 * ## Why it exists
 *
 * Every other gate in this repository runs on V8. `test:coverage` runs the
 * suites under Node, `smoke:check` loads the built bundles under Node, and the
 * Node-18 job executes the UMD under Node again. The packages nevertheless
 * declare a browser support matrix — Chrome 80+, Firefox 74+, Safari 13.1+,
 * Edge 80+ — and that claim has been carried by an ES2020 build target and a
 * syntax scan over the output. Neither executes anything.
 *
 * For most libraries the gap would be theoretical. Here it is not.
 * `function-introspection` classifies callables by reading
 * `Function.prototype.toString`, and its own source states that "V8 emits a
 * single line where JavaScriptCore and SpiderMonkey break it across three".
 * That is a claim about two engines, written into the design, and until this
 * script ran it had been tested on neither.
 *
 * ## Why the UMD bundle
 *
 * It inlines every dependency, so it needs no module resolution and loads from
 * a plain `<script>` — the same property that lets `smoke:check` evaluate it in
 * a bare `vm` context. Each bundle publishes a global named in its package's
 * `vite.config.js`.
 *
 * ## Deliberately not part of `check` or `check:full`
 *
 * Engine divergence changes when engines ship, not when we commit, and the
 * three browsers cost roughly a gigabyte to install. So this runs from its own
 * workflow — on a schedule, on demand, and before a release — rather than on
 * every push. It is therefore invisible to `gates:check`, which derives its
 * gate population from the `check` chains; that is intended, not an oversight.
 *
 * ## Usage
 *
 * ```sh
 * pnpm run build:umd && pnpm run browser:check
 * SPECIES_BROWSER_ONLY=webkit pnpm run browser:check   # one engine
 * ```
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = join(repoRoot, 'packages');

/** Engine names Playwright exposes, in the order they are reported. */
const ENGINES = ['chromium', 'firefox', 'webkit'];

/**
 * Restricts the run to ONE engine, unset for all three.
 *
 * WebKit is the one worth naming: it is the only engine here that is neither
 * V8 nor available on a Windows runner, so it is the usual reason to narrow a
 * local run rather than wait for all three.
 */
const only = process.env.SPECIES_BROWSER_ONLY;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Discovery
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The UMD global a package publishes, read from its `vite.config.js`.
 *
 * Read rather than mapped, so the name cannot drift away from the build that
 * produces it. A package whose config stops declaring one is a hard failure —
 * silently probing the wrong global would report a green that means nothing.
 *
 * @param {string} packageDir - absolute path to the package
 * @returns {string} the dotted global path, e.g. `SpeciesJS.TypeDetection`
 * @throws {Error} when the config declares no UMD name
 */
function umdGlobalOf(packageDir) {
  const config = readFileSync(join(packageDir, 'vite.config.js'), 'utf8');
  // Anchored on the `SpeciesJS.` prefix rather than on `name:` alone, so a
  // future `name:` elsewhere in the config cannot be picked up instead.
  const match = /name:\s*'(SpeciesJS\.[^']+)'/.exec(config);

  if (!match) {
    throw new Error(
      `${packageDir}/vite.config.js declares no UMD \`name\` — the bundle's ` +
        'global cannot be resolved, and probing a guessed one would be worse ' +
        'than failing here.',
    );
  }
  return match[1];
}

/**
 * Every package carrying browser probes, with the artifacts needed to run them.
 *
 * @returns {{ name: string, global: string, bundle: string, probes: string }[]}
 *  one entry per probed package
 */
function collectTargets() {
  return readdirSync(packagesRoot)
    .map((name) => {
      const packageDir = join(packagesRoot, name);

      // The UMD path is READ from `unpkg`, never assembled from a convention:
      // a package with a curated `public.js` emits `public.umd.js` (#085) and
      // one without emits `index.umd.js` (#097). `entries:check` already holds
      // that field to the vite entry, so reading it here inherits that gate
      // instead of adding a second place for the name to drift.
      const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

      return {
        name,
        packageDir,
        probes: join(packageDir, 'browser.probes.mjs'),
        bundle: join(packageDir, manifest.unpkg ?? ''),
        declaresUmd: typeof manifest.unpkg === 'string',
      };
    })
    .filter((entry) => existsSync(entry.probes))
    .map((entry) => {
      if (!entry.declaresUmd) {
        throw new Error(
          `${entry.name} carries browser probes but declares no \`unpkg\` — ` +
            'there is no UMD bundle to load them against.',
        );
      }
      return {
        name: entry.name,
        global: umdGlobalOf(entry.packageDir),
        bundle: entry.bundle,
        probes: entry.probes,
      };
    });
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Execution
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Runs one package's probes in one already-launched browser.
 *
 * The bundle goes in as a classic script so its UMD wrapper can publish the
 * global, and the probe file as a module — which is why the probes also assign
 * themselves to `globalThis`: a module's exports are not reachable from
 * `page.evaluate`, which sees the page's global scope only.
 *
 * @param {import('playwright').Browser} browser - the launched engine
 * @param {{ name: string, global: string, bundle: string, probes: string }} target
 *  - the package under test
 * @returns {Promise<{ name: string, ok: boolean, error?: string }[]>} one
 *  result per probe
 */
async function runProbes(browser, target) {
  const page = await browser.newPage();

  try {
    // A real document, not `about:blank` — the realm probes attach an iframe
    // to `document.body`, which a blank page does not reliably provide.
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: readFileSync(target.bundle, 'utf8') });
    await page.addScriptTag({
      content: readFileSync(target.probes, 'utf8'),
      type: 'module',
    });
    // Module scripts evaluate asynchronously; without this the probes are read
    // before they exist and the run reports an empty, passing corpus.
    await page.waitForFunction(() => '__speciesBrowserProbes' in globalThis, null, {
      timeout: 10_000,
    });

    return await page.evaluate(
      ({ globalPath }) => {
        /** @type {unknown} */
        let namespace = globalThis;

        for (const key of globalPath.split('.')) {
          namespace = /** @type {Record<string, unknown>} */ (namespace ?? {})[key];
        }
        if (!namespace) {
          throw new Error(`the bundle published no global at \`${globalPath}\``);
        }
        const probes = /** @type {{ name: string, run: (ns: unknown) => unknown }[]} */ (
          /** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes
        );

        return probes.map((probe) => {
          try {
            const answer = probe.run(namespace);

            return { name: probe.name, ok: answer === true };
          } catch (reason) {
            return {
              name: probe.name,
              ok: false,
              error: reason instanceof Error ? reason.message : String(reason),
            };
          }
        });
      },
      { globalPath: target.global },
    );
  } finally {
    await page.close();
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Entry
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const targets = collectTargets();

if (targets.length === 0) {
  console.error(
    '✗ no package carries a `browser.probes.mjs` — this check would pass\n' +
      '  while asserting nothing. Add probes, or remove the gate.',
  );
  process.exit(1);
}

const missing = targets.filter((target) => !existsSync(target.bundle));

if (missing.length > 0) {
  console.error(
    '✗ these packages have probes but no built UMD bundle:\n' +
      missing.map((target) => `    ${target.name}`).join('\n') +
      '\n\n  → run `pnpm run build:umd` first\n',
  );
  process.exit(1);
}

/** @type {typeof import('playwright')} */
let playwright;

try {
  playwright = await import('playwright');
} catch {
  console.error(
    '✗ `playwright` is not installed.\n\n' +
      '  → pnpm add -Dw playwright && pnpm exec playwright install --with-deps\n',
  );
  process.exit(1);
}

const engines = only ? [only] : ENGINES;

if (only && !ENGINES.includes(only)) {
  console.error(`✗ SPECIES_BROWSER_ONLY=${only} is not one of ${ENGINES.join(', ')}\n`);
  process.exit(1);
}

let failures = 0;
let executed = 0;

for (const engine of engines) {
  /** @type {import('playwright').Browser} */
  let browser;

  // - a missing engine binary is an ENVIRONMENT problem, not a contract
  //   failure, and the two must not read alike. Left uncaught it surfaces as an
  //   uncaught exception with a stack trace into this file, which invites the
  //   reader to look for a bug in the probes.
  try {
    browser =
      await playwright[
        /** @type {'chromium' | 'firefox' | 'webkit'} */ (engine)
      ].launch();
  } catch (reason) {
    console.error(
      `✗ could not launch ${engine} — the engine binaries are not installed.\n` +
        '  This says nothing about the browser contract; the check never ran.\n\n' +
        '  → pnpm exec playwright install --with-deps chromium firefox webkit\n\n' +
        `  (${reason instanceof Error ? reason.message.split('\n')[0] : String(reason)})\n`,
    );
    process.exit(1);
  }
  const version = browser.version();

  console.warn(`\n${engine} ${version}`);

  try {
    for (const target of targets) {
      const results = await runProbes(browser, target);

      executed += results.length;
      for (const result of results) {
        if (result.ok) {
          console.warn(`  ✓ ${target.name} · ${result.name}`);
        } else {
          failures += 1;
          console.warn(
            `  ✗ ${target.name} · ${result.name}` +
              (result.error ? ` — threw: ${result.error}` : ''),
          );
        }
      }
    }
  } finally {
    await browser.close();
  }
}

console.warn('');
if (failures > 0) {
  console.error(
    `✗ ${failures} of ${executed} probe runs failed across ` +
      `${engines.length} engine(s).\n\n` +
      '  Read the failure by LAYER. An `A` probe alone means the documented\n' +
      '  source strings are V8-specific while classification still holds — a\n' +
      '  documentation defect. `A` and `B` together is a real classification\n' +
      '  bug on that engine.\n',
  );
  process.exit(1);
}
console.warn(
  `✓ browser contract holds — ${executed} probe runs across ` +
    `${engines.length} engine(s), ${targets.length} packages`,
);
