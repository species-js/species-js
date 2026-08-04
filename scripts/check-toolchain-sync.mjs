// @ts-check

/**
 * Toolchain-sync check — fails when a locally-installed toolchain package whose
 * version changes lint / format / typecheck OUTPUT does not match the version
 * `pnpm-lock.yaml` pins (i.e. `node_modules` is stale versus the lockfile CI
 * installs from).
 *
 * This is the automated form of the commit gauntlet's Round 4 standing-inversion
 * trip-check, line #4 ("installed tool version === lockfile pin"): it converts a
 * remembered check into a red one. Locally it catches a stale `node_modules`
 * (fix with `pnpm install`); in CI — which installs `--frozen-lockfile` — it is a
 * no-op. Rationale: `prettier` 3.8.3 (stale local) formats multi-member unions
 * the opposite way from 3.9.4 (lockfile/CI), so a green local `format:check`
 * nearly shipped a red CI (2026-07-01).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Packages whose installed version alters CI OUTPUT (format / lint / typecheck /
// docs / coverage / publish gates). Extend deliberately — only add tools whose
// version drift can turn CI red. Every entry MUST be a direct dependency in the
// lockfile's `importers`; an unresolvable name fails the run (see below) rather
// than being skipped, so this list cannot rot into a silent no-op.
const TOOLCHAIN = [
  // format / lint / typecheck
  'prettier',
  'eslint',
  'eslint-plugin-jsdoc',
  'typescript-eslint',
  'typescript',
  // coverage — gate-affecting since the thresholds went live (2026-08-04): a
  // version drift here moves the measured percentages, which can flip the gate.
  'vitest',
  '@vitest/coverage-v8',
  // docs:check
  'typedoc',
  // check:publish
  '@arethetypeswrong/cli',
  'publint',
];

/**
 * The direct-dependency `name → resolved version` map from the lockfile's
 * `importers` section (the authoritative record of what CI installs). The
 * resolved `version:` may carry a `(peer@x)` suffix, which is stripped.
 *
 * @returns {Record<string, string>} direct-dependency name → resolved version
 */
function readLockfilePins() {
  const lines = readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8').split('\n');
  /** @type {Record<string, string>} */
  const pins = {};
  let inImporters = false;
  let pkg = null;
  for (const line of lines) {
    if (/^importers:/.test(line)) {
      inImporters = true;
      continue;
    }
    if (inImporters && /^\S/.test(line)) {
      break; // next top-level section
    }
    if (!inImporters) {
      continue;
    }
    // pnpm quotes SCOPED keys (`'@vitest/coverage-v8':`) and leaves unscoped ones
    // bare (`typedoc:`), so the optional quotes are load-bearing: without them a
    // scoped tool parses as absent and — before the unresolved-name guard above —
    // was skipped in silence, guarding nothing. Found 2026-08-04 when the guard
    // rejected the first two scoped entries ever added to TOOLCHAIN.
    const name = line.match(/^ {6}'?(@?[\w./-]+)'?:\s*$/);
    if (name) {
      pkg = name[1];
      continue;
    }
    const version = line.match(/^ {8}version:\s*(.+)$/);
    if (version && pkg) {
      pins[pkg] = version[1].replace(/\(.*$/, '').trim();
      pkg = null;
    }
  }
  return pins;
}

/**
 * The version in the (symlink-followed) `node_modules/<name>/package.json` — the
 * version that is actually loaded — or `null` when the package is absent.
 *
 * @param {string} name - the package name to resolve under `node_modules`
 * @returns {string | null} the installed version, or `null` when absent/unreadable
 */
function installedVersion(name) {
  try {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, 'node_modules', name, 'package.json'), 'utf8'),
    );
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

const pins = readLockfilePins();
/** @type {Array<{ name: string, installed: string, expected: string }>} */
const drift = [];
/** Names this list claims to guard but the lockfile does not pin — list rot. */
const unresolved = [];
for (const name of TOOLCHAIN) {
  const expected = pins[name];
  if (!expected) {
    // Previously skipped silently, which let a typo or a renamed package turn an
    // entry into a permanent no-op — the guard would report success while
    // checking nothing. An entry that cannot be resolved is a defect in THIS
    // list, so it is surfaced rather than swallowed.
    unresolved.push(name);
    continue;
  }
  const installed = installedVersion(name);
  if (installed !== expected) {
    drift.push({ name, installed: installed ?? '(not installed)', expected });
  }
}

if (unresolved.length > 0) {
  console.error(
    '✗ toolchain list is stale — these names are not direct dependencies in ' +
      'pnpm-lock.yaml, so they guard nothing:\n',
  );
  for (const name of unresolved) {
    console.error(`    ${name}`);
  }
  console.error(
    '\n  → fix the name in TOOLCHAIN (scripts/check-toolchain-sync.mjs), or drop\n' +
      '    it if the tool is gone.',
  );
  process.exit(1);
}

if (drift.length > 0) {
  console.error(
    '✗ toolchain out of sync with pnpm-lock.yaml — local gates may disagree with CI:\n',
  );
  for (const { name, installed, expected } of drift) {
    console.error(`    ${name}: installed ${installed}, lockfile ${expected}`);
  }
  console.error('\n  → run `pnpm install` to resync node_modules to the lockfile.');
  process.exit(1);
}

console.warn(`✓ toolchain in sync with lockfile (${TOOLCHAIN.join(', ')})`);
