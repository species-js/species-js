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

// Packages whose installed version alters CI OUTPUT (format / lint / typecheck).
// Extend deliberately — only add tools whose version drift can turn CI red.
const TOOLCHAIN = [
  'prettier',
  'eslint',
  'eslint-plugin-jsdoc',
  'typescript-eslint',
  'typescript',
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
    const name = line.match(/^ {6}(@?[\w./-]+):\s*$/);
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
for (const name of TOOLCHAIN) {
  const expected = pins[name];
  if (!expected) {
    continue; // not a direct dep in the lockfile — nothing to pin
  }
  const installed = installedVersion(name);
  if (installed !== expected) {
    drift.push({ name, installed: installed ?? '(not installed)', expected });
  }
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
