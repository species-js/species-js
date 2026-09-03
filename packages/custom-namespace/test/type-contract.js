// @ts-check

/**
 * The `type/T*` band of `docs/spec/CUSTOM-NAMESPACE.spec.md`, as a compile-time
 * fixture.
 *
 * ## Why this file exists
 *
 * Four of the spec's vectors are claims about the DECLARED contract rather than
 * about runtime behavior: that a member keeps the type it had on `exports`, that
 * an unknown key reads as `unknown`, and that neither a member nor the brand can
 * be assigned. None of them can be asserted with `expect` — they are true or
 * false at compile time, and a runtime suite cannot see them at all.
 *
 * They also have nowhere else to live. type-detection's `config` round needed no
 * such fixture because the package's own source exercises its boundary-retypes
 * on every call. Here the claims are about the CONSUMER-facing return type,
 * `CustomNamespace & Readonly<T>`, and nothing inside `src/` ever consumes the
 * builder's own output. Without this file the four vectors would be recorded in
 * a frozen spec and checked by nothing, which is the failure mode the spec was
 * written to prevent.
 *
 * ## Why it is not a `.test.js`
 *
 * There is nothing to run. `tsconfig.json` includes every `.js` file under
 * `test/`, so `tsc` reads this one and fails the package's `typecheck` if any
 * claim below stops holding; vitest collects only `*.test.js`, so it correctly
 * ignores it. The gate is `pnpm run typecheck`, which runs in `check` and in CI.
 *
 * Both directions of that gate were probed on 2026-09-03: annotating a member
 * with the wrong type produced `TS2322` here, and deleting one of the
 * `@ts-expect-error` directives produced `TS2540`. A fixture nobody has seen
 * fail is not yet a gate.
 *
 * ## What is deliberately absent
 *
 * `type/T5` — that `T extends object` admits an `interface`. Reproducing it
 * needs a real `interface` declaration, which JSDoc cannot express, and this
 * package authors no `.ts` sources. The spec records it as unverified rather
 * than implying otherwise (spec Open item 3).
 */

import { createCustomNamespace } from '#index';

const namespace = createCustomNamespace('t', { a: 1, s: 'x' });

// - the ANNOTATION is the assertion in each of the two blocks below, not the
//   binding. Declaring `memberNumber` as `number` compiles only while
//   `namespace.a` really is `number`; were the intersection to collapse members
//   to the index signature's `unknown`, this line would stop compiling. That is
//   the whole test — the value is never read for its own sake.

// type/T1 — `Readonly<T>` preserves each member's type rather than collapsing it
// to the `unknown` of `CustomNamespace`'s index signature.
/** @type {number} */
const memberNumber = namespace.a;
/** @type {string} */
const memberString = namespace.s;

// type/T2 — an unknown key reads as `unknown` rather than erroring, which is
// what keeps `CustomNamespace` usable as a parameter type for any namespace.
// Two failures are caught here at once: a MISSING index signature would make
// this line an error, and one typed wider than `unknown` would not satisfy the
// annotation.
/** @type {unknown} */
const absentMember = namespace.nope;

// - each `@ts-expect-error` below asserts in BOTH directions, which is why no
//   further assertion is needed. If the assignment were rejected as expected,
//   the directive is consumed and the file compiles. If the contract regressed
//   and the assignment became legal, the directive would have nothing to
//   suppress and tsc would report it as unused — an error either way.

// type/T3 — a member cannot be assigned.
// @ts-expect-error - a namespace member is readonly
namespace.a = 2;

// type/T4 — the brand cannot be assigned either.
// @ts-expect-error - the tag is readonly
namespace[Symbol.toStringTag] = 'Other';

// - inert by design: nothing imports this, and the object exists only so the
//   three consts above count as read. Without it `no-unused-vars` would reject
//   the file, and deleting the consts to satisfy the linter would delete the
//   assertions themselves. Scaffolding for the linter, not a public surface.
export const typeContractFixture = {
  memberNumber,
  memberString,
  absentMember,
};
