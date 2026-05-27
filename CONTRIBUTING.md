# Contributing to species-js

Thanks for considering a contribution.

## Prerequisites

- Node.js ≥22 (see `.nvmrc`)
- pnpm ≥10 (the repo uses pnpm workspaces)
- **Windows contributors:** [Git for Windows](https://gitforwindows.org/) is required.
  Husky hooks are POSIX shell scripts and need a bash-compatible shell to run. Using a
  GUI-only Git client or a PowerShell-only environment may install the hook files but
  silently fail to execute them on commit/push — meaning local gating (`lint-staged` on
  commit, `pnpm run check` on push) is skipped. CI on `windows-latest` still enforces the
  gate, but local feedback disappears.

## Setup

```sh
pnpm install
```

## Development loop

```sh
pnpm run check          # typecheck + lint + format + docs + audit + test:coverage (the canonical gate)
pnpm run check:full     # everything above + build + pack:check (full CI mirror; slower)
pnpm run test:watch     # tests in watch mode
pnpm --filter @species-js/<package> run test  # focused single-package run
```

See [`CLAUDE.md`](./CLAUDE.md) for code conventions (manually crafted both vanilla JS and
`*.d.ts` files, ES2020 floor, `unknown` over `any`, cached prototype references, …) and
[`SCAFFOLD.md`](./SCAFFOLD.md) for the configuration rationale behind every tool in the
repo.

## Commits

Conventional commits (enforced via commitlint). Examples:

```
feat(type-detection): add cross-realm WeakSet discriminator
fix(custom-domain): seal prototype before freezing
chore(deps): bump vitest to 4.2.0
```

## Pull requests

1. Branch from `main`. species-js follows a trunk-based workflow — feature branches target
   `main` directly, and releases happen via the automated Changesets PR (see below).
2. Run `pnpm run check` locally — CI runs the same pipeline on Ubuntu, macOS, and Windows.
3. Add a changeset describing the user-visible change:
   ```sh
   pnpm changeset
   ```
   Select the affected package(s) and bump level (patch/minor/major). The changeset file
   should be committed with the PR.
4. Open the PR. Pre-commit runs `lint-staged`; pre-push runs the full `pnpm run check`
   (typecheck, lint, format, docs validation, supply-chain audit, and tests with coverage
   thresholds).

### Bypassing hooks (`--no-verify`)

`git commit --no-verify` and `git push --no-verify` skip the local Husky hooks. The gate
still runs in CI on every PR, so bypassed code never reaches `main` without passing the
same checks — but the local feedback you'd normally get instantly now arrives only after
CI runs (minutes later, and visible to everyone watching the PR).

Use the escape hatch sparingly and deliberately, typically only when a hook is itself
broken (in which case fix the hook in the same PR). Habitual bypassing defeats the
fast-feedback purpose of the hooks and effectively shifts the entire local gate onto CI's
load.

## Releases

Releases are automated. When the PR merges to `main`, the release workflow either:

- Opens a "Version Packages" PR collecting pending changesets, **or**
- Publishes the queued versions to npm (with `--provenance`) once a "Version Packages" PR
  is merged.

You do not bump versions manually — changesets handles that.

## Reporting issues

- **Bugs / feature requests:** open an issue.
- **Security vulnerabilities:** see [`SECURITY.md`](./SECURITY.md) — please do not open
  public issues for security reports.
