# Contributing to species-js

Thanks for considering a contribution.

> **New here?** This is foundation-tier infrastructure with a deliberately high bar. Once
> you're set up, read
> [**How this project works**](#how-this-project-works--read-this-before-your-first-change)
> and [**Orientation**](#orientation--where-knowledge-lives) before your first change —
> most of what makes a contribution "complete" here is process that isn't obvious from the
> code alone.

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

## How this project works — read this before your first change

`species-js` is foundation-tier: four packages here, and several downstream projects that
will depend on them. A convention that wobbles in this repo ripples into every consumer,
so the bar is deliberately high and the pace deliberately unhurried. A few principles
explain almost every "why is it done this way?":

- **Nothing is a one-line change.** A change to a module's behaviour usually travels with
  its types, its documentation, its architecture note, a decision record, its spec, and
  its tests (see [What "done" looks like](#what-done-looks-like--the-artifact-stack)). A
  diff that changes behaviour and nothing else is probably incomplete — not wrong, just
  not finished to the house standard.
- **The documentation is load-bearing, not decoration.** The chain is _good docs → a
  trustworthy spec → derived tests_; each link is trusted only because the previous one
  was verified against the real code. The reasoning is the product as much as the code is.
- **Green tests are necessary but not sufficient.** "It passes" is a starting point, not a
  finish line. This project has been burned by suites that never actually ran and by
  refactors that were green while silently wrong — the
  [verification checklist](#before-you-open-a-pr--the-verification-checklist) exists
  because of those scars.
- **Design authority sits with the maintainer.** API surface, contracts, naming, and
  structural rules are decided, not defaulted — for anything touching those, agree the
  shape _before_ you build it (see [Design decisions](#design-decisions)). Bug fixes and
  added test coverage can go straight to a PR.

## Orientation — where knowledge lives

The repo is documented like a specification. Each kind of question has a home:

| Your question                           | Read                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| How do I set up and contribute?         | this file                                                     |
| What are the code conventions?          | [`CLAUDE.md`](./CLAUDE.md) — the canonical convention doc     |
| Why is the tooling configured this way? | [`SCAFFOLD.md`](./SCAFFOLD.md)                                |
| _Why_ was something decided?            | `packages/<pkg>/docs/decisions/` — one ADR per decision       |
| _How_ does a module work?               | `packages/<pkg>/docs/architecture/<module>.md`                |
| _What_ does a predicate promise?        | `packages/<pkg>/docs/spec/<MODULE>.spec.md` — the test oracle |

A good first hour: skim this file → skim `CLAUDE.md` → then read **one module end to end**
as an exemplar — its `.js` + `.d.ts`, its `architecture/<module>.md`, its
`spec/<MODULE>.spec.md`, and its `test/<module>/` suite. The `evented` and `error` modules
of `@species-js/type-detection` are the most complete worked examples. You do **not** need
to read every decision record to start — open an ADR when you want the "why" behind a
specific choice.

### Gotchas that will trip you in the first hour

Most of the house style lives in `CLAUDE.md`; these few bite immediately:

- **Hand-crafted `.js` + `.d.ts` pairs, no transpilation.** Modules are vanilla JS with
  `// @ts-check` and JSDoc types, paired with a sibling `.d.ts` that is the canonical
  contract. There is no build step turning `.ts` into `.js`. If your instinct is "why
  isn't this TypeScript?", read the SCAFFOLD rationale before fighting it — it's
  deliberate, and both files must stay in sync (every export documented in both).
- **Direct subpath entries are safe — and guarded.** Loading a module file directly
  (rather than through the `#index` barrel) used to risk a load-order crash from the
  `config ↔ function ↔ utility` import cycle; that hazard was dissolved by the import-free
  `foundation` leaf (ADR #070) and is now permanently pinned by the entry-point arena
  (`test/entry-arena.test.js`), which loads every published subpath as its own entry on
  every run. Prefer the barrel in tests as the house default (see
  [Testing model](#testing-model)) — but if a direct entry ever fails again, that is an
  arena regression, not a you-problem: report it.
- **Internal imports use `#` subpath specifiers** (`#function`, `#utility`, …), declared
  in each package's `package.json` `imports` map and used uniformly in both `.js` and
  `.d.ts`. The map ships with the package, so the same specifier resolves for Node, for
  the bundler, and — critically — for a consumer's compiler reading the shipped
  declarations (ADR #071). Do not introduce tsconfig-only aliases (`@/`-style): they
  resolve only inside this workspace and break at the consumer's side.
- **ES2020 runtime floor.** No ES2021+ runtime APIs (`Object.hasOwn`,
  `Array.prototype.at`, `String.prototype.replaceAll`, …). Syntax is lowered by the
  bundler; runtime APIs are not.
- **Cross-realm-safe reads.** Cache prototype methods at module top and call via
  `.call(o, k)`; never call e.g. `Object.hasOwn` directly. `CLAUDE.md` has the full list.

## The development cycle

Work on a module follows a repeatable loop — it is what keeps the docs and tests honest:

1. **Implementation first.** Get the behaviour right in the `.js` + `.d.ts`.
2. **Derive the spec from the code.** Write `docs/spec/<MODULE>.spec.md` to describe what
   the implementation actually does — what it _admits_, _rejects_, and deliberately
   _refuses to claim_ — as concrete, ID'd vectors.
3. **Harden in rounds — then freeze.** Bidirectional passes between spec and code, each
   surfacing imprecision in one or the other. A module's rounds end in an explicit **spec
   freeze**: from that point the spec is the fixed oracle — tests derive from it and the
   code answers to it, never the reverse. The freeze is what keeps spec-derived-from-code
   from collapsing into test-derived-from-implementation; without it, step 4's warning
   about the tautology trap applies to the spec itself.
4. **Add tests that were NOT derived from the spec.** Adversarial, real-world, and
   cross-realm vectors that try to _break_ the implementation from angles the spec didn't
   anticipate. This pairing is essential: a spec derived from code, tested only by tests
   derived from that spec, is a tautology that launders bugs into "contract". The
   non-derived tests are what keep it honest.
5. **Documentation loops.** Reconcile `.js` / `.d.ts` / architecture / ADRs so every layer
   tells the same truth.

Coverage is an _output_ of this loop, not a target you write to.

## What "done" looks like — the artifact stack

A behavioural change is "done" when the relevant layers agree. Depending on what you
touched, that can include:

- the **`.js`** implementation and its **parallel `.d.ts`** contract (both document every
  export; the `.d.ts` is canonical and wins on conflicts);
- an **architecture doc** update (`docs/architecture/<module>.md`) if the mental model
  moved;
- an **ADR** (`docs/decisions/NNNN-slug.md`) if you made a real design decision — the log
  is **append-only**: a later decision supersedes an earlier one with an explicit pointer
  back, it does not edit history;
- a **spec** update (`docs/spec/<MODULE>.spec.md`) if observable behaviour changed;
- the **tests** across the relevant axes (below);
- a **changeset** for anything user-visible.

If a PR changes behaviour but leaves these stale, reviewers will ask for them — that is
the "why does my small PR feel incomplete?" answer, made explicit.

## Testing model

Tests derive from **specification**, not implementation, and full coverage of a module
comes from several axes (defined in `packages/<pkg>/docs/spec/README.md`):

| Axis            | Question                                                                                                                                                               | Source                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Spec / contract | Does the predicate honour its documented contract?                                                                                                                     | `spec/<MODULE>.spec.md`                                                          |
| Cross-realm     | Do the claims hold for foreign-realm values (`vm`/iframe/worker)?                                                                                                      | the spec's per-predicate expectation                                             |
| Adversarial     | Does it resist spoofs _and_ stay throw-safe on every path?                                                                                                             | spoof vectors + the throw-safety invariant                                       |
| Helper-unit     | Does each `@internal` helper do its isolated job?                                                                                                                      | the implementation's helper inventory                                            |
| Delivery        | Does the package _arrive_? Every published subpath loads as its own entry, and the shipped `.d.ts` resolve under a consumer's compiler — no workspace config in scope. | `test/entry-arena.test.js` + `test/consumer-resolution.test.js` (ADRs #070/#071) |
| Coverage        | Does every branch execute?                                                                                                                                             | the V8 report (a gate, not an authored suite)                                    |

The first four axes interrogate the code's _behaviour_; Delivery interrogates its
_arrival_. Both delivery fixtures derive their entry set from `exports`, so a newly
published subpath is covered automatically — you don't wire it up.

Where a module fits it, the suite is **config-driven**, one folder per module:

```
test/<module>/
  __config.js               # candidate value-universe + the axis-1 matrix + the throw-safety matrix
  spec.test.js              # drives the matrix + a completeness guard
  cross-realm.test.js       # foreign-realm fixtures (real intrinsics, or foreign synthetics)
  adversarial.test.js       # spoofs, grafts, boundary + realm-asymmetry pins
  throw-safety.test.js      # the hostile-input × predicate matrix
  _internal/helpers.test.js # each @internal helper in isolation
```

`test/evented/` and `test/error/` are the exemplars. Conventions that matter:

- **Every behavioural claim is a stable vector ID** (`isPromise/R3`, `dIETC/A4`, …) that
  appears both in the spec and, literally, in the tests — so `spec ↔ test` coverage is
  mechanically auditable (grep both, diff both directions; the diff should be empty except
  for documented, environment-unreachable exclusions). Write IDs out literally — ranges
  like `A1-A3` defeat the grep.
- **Throw-safety is a universal invariant.** Every predicate returns a boolean (never
  throws) on _every_ input, including hostile Proxies and throwing getters — proven by an
  exhaustive hostile-input × predicate matrix.
- **Cross-realm fixtures.** Some globals (`EventTarget`, `AbortController`,
  `DOMException`) are not ECMAScript intrinsics, so a bare `vm` realm can't construct them
  — those vectors use _foreign synthetics_ (a foreign class carrying the right shape).
  Real intrinsics (`Error`, `Promise`) can be constructed foreign directly.
- **Import predicates from `#index`** in tests (the barrel) — the house default, so
  behavioural suites exercise the surface consumers import. The one designed exception is
  the delivery axis: `entry-arena.test.js` loads subpaths directly _on purpose_ — its job
  is the raw entry, and routing it through the barrel would test nothing.

## Before you open a PR — the verification checklist

Green is necessary, not sufficient. Before submitting a change to a module, walk this (the
project's standing pre-submission gauntlet, in short form):

1. **Structural clarity.** Public predicates carry no `@internal`; helpers carry
   `@internal` in _both_ `.js` and `.d.ts`. The exported `@internal` helpers — not only
   the public predicates — are what your tests should exercise.
2. **Spec mirrors code.** The spec's composition/behaviour matches the current
   implementation exactly. Mirroring is itself a bug-finder.
3. **Spec ↔ test vector diff is empty both ways.** No spec vector without a test (a
   coverage gap); no test vector without a spec entry (an orphan/stale test). Documented
   environment-unreachable or refuses-to-claim exclusions are the only allowed residue —
   and they are named.
4. **No stale tests.** Every imported helper still exists; every cited vector ID resolves.
5. **Attack-angle completeness on new logic.** Probe the newest / least-exercised code to
   its limits — hunt for a claim in the code or docs that no test actually hits. Breakage
   is welcome; it proves the matrix wasn't aggressive enough.
6. **Reviewed, atomic commits.** Read your own `git diff` first; split into commits that
   each build and test green on their own; resolve any `TODO` markers before committing.
7. **The full package suite is green** — `pnpm --filter @species-js/<pkg> run test`, not
   just the file you touched. A change can have blast radius beyond its module.
8. **The delivery axis is green.** `entry-arena.test.js` and `consumer-resolution.test.js`
   pass — every published subpath loads as its own entry and every shipped declaration
   resolves from a consumer's position. If you added or renamed a subpath, both fixtures
   pick it up from `exports` automatically; a failure here means the package's _arrival_
   broke, however green its behaviour is. This project shipped-in-theory twice before this
   axis existed (ADRs #070/#071) — the checklist remembers so you don't have to.

## Design decisions

For anything touching **API surface, contracts, naming, or structural rules**, open an
issue or discussion and agree the shape _before_ building — the maintainer owns those
calls, and a proposal-with-trade-offs is the fastest path through. Bug fixes, added test
coverage, and documentation corrections can go straight to a PR. When in doubt, ask first:
a five-minute discussion beats a large PR built on the wrong assumption.

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
