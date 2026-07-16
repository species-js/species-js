// @ts-check

/**
 * Resilient dependency audit — runs `pnpm audit --prod --audit-level high`, but
 * survives npm's retirement of the quick-audit endpoint
 * (`/-/npm/v1/security/audits`, HTTP 410 since ~2026-07-15), which otherwise
 * hard-fails every `pnpm run check` and blocks all pushes through no fault of
 * the code.
 *
 * The gate still BITES on real findings: a non-zero audit that reports advisories
 * propagates and fails the check. Only the infra-class failure
 * (`ERR_PNPM_AUDIT_BAD_RESPONSE` — the registry could not return a usable audit,
 * i.e. a retired / changed / unreachable endpoint) is downgraded to a warning, so
 * a registry outage or endpoint change cannot block a push while genuine
 * advisories still can.
 *
 * This is a deliberate standing inversion (audit non-blocking on infra failure)
 * with a stated TRIP CONDITION: restore strict blocking — delete this wrapper and
 * point the `audit` script back at `pnpm audit` directly — once `pnpm audit
 * --prod --audit-level high` resolves through a working endpoint again (a pnpm
 * release targeting npm's bulk advisory endpoint, or the registry restoring
 * compatibility). Verify by running that command directly: when it no longer
 * emits `ERR_PNPM_AUDIT_BAD_RESPONSE`, this wrapper's reason to exist is gone.
 * Peer of `check-toolchain-sync.mjs` — a remembered check kept red instead of in
 * a reviewer's head.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('pnpm', ['audit', '--prod', '--audit-level', 'high'], {
  cwd: repoRoot,
  encoding: 'utf8',
});

// Could not even launch `pnpm` — surface it, never mask a broken toolchain.
if (result.error) {
  console.error(`✗ could not run 'pnpm audit': ${result.error.message}`);
  process.exit(1);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

if (result.status === 0) {
  console.warn('✓ audit clean (no advisories at or above --audit-level high)');
  process.exit(0);
}

// Infra-class failure: the registry could not return a usable audit response
// (retired endpoint / outage). Downgrade to a warning — see TRIP CONDITION above.
if (/ERR_PNPM_AUDIT_BAD_RESPONSE/.test(output)) {
  console.warn(
    '⚠ audit skipped — registry audit endpoint unavailable ' +
      '(ERR_PNPM_AUDIT_BAD_RESPONSE); not blocking the check. See the TRIP ' +
      'CONDITION in scripts/audit.mjs to restore strict blocking.',
  );
  process.exit(0);
}

// Anything else: real advisories (or a genuine audit failure) — the gate bites.
process.stdout.write(output);
console.error('✗ audit found advisories at or above --audit-level high');
process.exit(1);
