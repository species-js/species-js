// @ts-check

/**
 * CI gate-coverage check — fails when a gate that `check` / `check:full` invoke
 * is not invoked anywhere in the CI workflow, so it can pass locally (or be
 * believed to run in CI) while CI never executes it.
 *
 * ## What it asserts — deliberately ONE-DIRECTIONAL
 *
 * Every script reachable from `check` or `check:full` must appear in
 * `.github/workflows/ci.yml`, or sit in ALLOWLIST below with a stated reason.
 * That is the whole contract.
 *
 * It is **not** a mirror check, and the distinction is load-bearing. CI is not
 * equal to `check`: it omits `toolchain:check`, adds `check:full`'s build /
 * pack / publish steps, and gates five steps to `ubuntu-latest`. A script
 * asserting equality would need an exception list describing all of that — and
 * that list becomes a SECOND place the correspondence lives, needing its own
 * vigilance, which is the failure mode this family exists to remove. Asserting
 * coverage in one direction only keeps the exception surface at a single entry
 * instead of growing with every legitimate CI change. So this says nothing
 * about extra CI steps, step order, OS conditions, or what a step does — only
 * that no gate silently fails to run.
 *
 * ## Why it exists (the niche — read before extending it)
 *
 * This guards ONE relationship between TWO files that change a few times a
 * year, and it finds nothing today. It does not pay for itself the way
 * `adr-graph.mjs` does, which guards a corpus that grows monotonically and
 * found eleven defects on its first run. Its entire justification is a single
 * historical incident: `check:publish` (the attw + publint publish gate) lived
 * in `check:full`, which CI never invoked, so the gate was believed active for
 * weeks while nothing ran it. It was found by an unrelated audit, not by any
 * check. That defect is silent, invisible in review, high-cost if it reaches a
 * publish, and trivially machine-detectable — the profile that earns a gate.
 *
 * Keep it narrow. The temptation is to grow it into a CI/script consistency
 * linter; that version would spend more vigilance than it saves.
 *
 * ## TRIP CONDITION
 *
 * This script is only justified while CI enumerates the gates individually,
 * duplicating the script list. That enumeration is currently load-bearing: the
 * 3-OS matrix runs `decisions:check`, `audit`, `pack:check` and `check:publish`
 * on `ubuntu-latest` only, which a single wholesale `pnpm run check` step could
 * not express. If CI ever invokes `pnpm run check` (plus `check:full`'s extras)
 * directly, the duplication disappears, the mismatch this guards becomes
 * structurally impossible, and this script should be DELETED rather than
 * maintained — a guard over a relationship that can no longer diverge is pure
 * upkeep. Verify by reading the workflow: if no step names an individual gate,
 * the reason to exist is gone.
 *
 * No dependencies. Peer of `check-toolchain-sync.mjs` and `adr-graph.mjs` — a
 * remembered check kept red instead of in a reviewer's head.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The aggregate entry points whose gates must be covered by CI. */
const ROOTS = ['check', 'check:full'];

/**
 * Gates deliberately absent from CI, each with the reason it is exempt. An
 * entry here is a claim that CI is BETTER off without the gate — not a
 * convenience. Adding one is a decision; record why.
 */
const ALLOWLIST = {
  'toolchain:check':
    'compares node_modules against the lockfile; CI installs with ' +
    '--frozen-lockfile, so it is a guaranteed no-op there',
};

/**
 * Sub-scripts a script body invokes through `pnpm run <name>`. The spacing is
 * exact on purpose: `pnpm -r run x` and `pnpm -r exec x` are recursive or
 * per-package invocations, not root-script delegation, so they must NOT be
 * followed (`test:coverage` runs `pnpm -r run test:coverage` and would
 * otherwise appear to invoke itself).
 *
 * @param {string} body - the script body to scan
 * @returns {string[]} the root-script names it delegates to
 */
function delegatesOf(body) {
  return [...body.matchAll(/\bpnpm run ([a-zA-Z][\w:.-]*)/g)].map((m) => m[1]);
}

/**
 * Escape a script name for literal use inside a regular expression.
 *
 * @param {string} value - the raw script name
 * @returns {string} the escaped form, safe to embed in a pattern
 */
function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk the root entry points and collect the gates they ultimately run. A
 * script that delegates to other root scripts is an AGGREGATOR (`check`,
 * `check:full`): it is expanded and never itself required in CI, because CI
 * runs the individual gates rather than the aggregate. Everything else is a
 * leaf gate and must be covered.
 *
 * @param {Record<string, string>} scripts - the `package.json` scripts map
 * @returns {Set<string>} the leaf gate names reachable from the roots
 */
function collectGates(scripts) {
  /** @type {Set<string>} */
  const gates = new Set();
  /** @type {Set<string>} */
  const seen = new Set();

  /** @param {string} name - the script to expand */
  const walk = (name) => {
    if (seen.has(name)) {
      return;
    }
    seen.add(name);

    const body = scripts[name];
    if (typeof body !== 'string') {
      return;
    }

    const delegates = delegatesOf(body).filter((sub) => typeof scripts[sub] === 'string');
    if (delegates.length === 0) {
      gates.add(name);
      return;
    }
    for (const sub of delegates) {
      walk(sub);
    }
  };

  for (const root of ROOTS) {
    walk(root);
  }
  // The roots are aggregates, never gates in their own right.
  for (const root of ROOTS) {
    gates.delete(root);
  }
  return gates;
}

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
/** @type {Record<string, string>} */
const scripts = pkg.scripts ?? {};
const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

const gates = collectGates(scripts);

/** @type {string[]} */
const uncovered = [];
/** @type {string[]} */
const staleAllowlist = [];

for (const gate of gates) {
  // A trailing boundary keeps `check` from matching inside `check:publish`.
  const invoked = new RegExp(`pnpm run ${escapeForRegExp(gate)}(?![\\w:.-])`).test(
    workflow,
  );
  if (invoked) {
    // An allowlisted gate that CI runs after all means the exemption is stale.
    if (gate in ALLOWLIST) {
      staleAllowlist.push(gate);
    }
    continue;
  }
  if (!(gate in ALLOWLIST)) {
    uncovered.push(gate);
  }
}

if (uncovered.length > 0) {
  console.error(
    '✗ these gates run in `check` / `check:full` but nothing in CI invokes them —\n' +
      '  they can pass locally while CI never executes them:\n',
  );
  for (const gate of uncovered) {
    console.error(`    pnpm run ${gate}`);
  }
  console.error(
    '\n  → add a step to .github/workflows/ci.yml, or exempt it in ALLOWLIST\n' +
      '    (scripts/check-ci-gate-coverage.mjs) with the reason it is exempt.',
  );
  process.exit(1);
}

if (staleAllowlist.length > 0) {
  console.error(
    '✗ these gates are exempted in ALLOWLIST but CI invokes them anyway — the\n' +
      '  exemption is stale and its stated reason is no longer true:\n',
  );
  for (const gate of staleAllowlist) {
    console.error(`    ${gate}`);
  }
  console.error(
    '\n  → drop the entry from ALLOWLIST (scripts/check-ci-gate-coverage.mjs).',
  );
  process.exit(1);
}

const exempt = [...gates].filter((gate) => gate in ALLOWLIST);
console.warn(
  `✓ every gate runs in CI (${gates.size - exempt.length} covered` +
    `${exempt.length > 0 ? `, ${exempt.length} exempt: ${exempt.join(', ')}` : ''})`,
);
