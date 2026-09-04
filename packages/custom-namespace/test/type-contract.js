// @ts-check

/**
 * The `type/T*` band of `docs/spec/CUSTOM-NAMESPACE.spec.md`, as a compile-time
 * fixture.
 *
 * ## Why this file exists
 *
 * Five of the spec's vectors are claims about the DECLARED contract rather than
 * about runtime behavior: that a member keeps the type it had on `exports`, that
 * an unknown key reads as `unknown`, that neither a member nor the brand can be
 * assigned, and that the `T extends object` constraint admits an `interface`.
 * None of them can be asserted with `expect` — they are true or false at compile
 * time, and a runtime suite cannot see them at all.
 *
 * They also have nowhere else to live. type-detection's `config` round needed no
 * such fixture because the package's own source exercises its boundary-retypes
 * on every call. Here the claims are about the CONSUMER-facing return type,
 * `CustomNamespace & Readonly<T>`, and nothing inside `src/` ever consumes the
 * builder's own output. Without this file the five vectors would be recorded in
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
 * `type/T5` was probed the same way on 2026-09-04, for a reason particular to
 * it: it reads a type across a file boundary, and an unresolved `import()` in
 * JSDoc degrades to `any` SILENTLY — the fixture would compile while asserting
 * nothing. Mistyping the interface member produced `TS2322`, so the reference
 * resolves to the real declaration.
 *
 * ## Why there is a sibling `__types.d.ts`
 *
 * `type/T5` is a claim about the DECLARATION FORM of the exports bag, and JSDoc
 * cannot state it: `@typedef` produces a type alias, and TypeScript gives an
 * object type alias the implicit index signature an `interface` never gets. The
 * one `interface` this package needs therefore lives in a declarations-only
 * sibling, which the block below reads.
 */

/** @typedef {import('./__types').NamespaceExports} NamespaceExports */

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

// type/T5 — `T extends object` admits an `interface`, and members declared on
// one survive the intersection exactly as an object literal's do. A consumer
// writing `interface MyExports` in TypeScript is the case this stands for.
/** @type {NamespaceExports} */
const interfaceExports = { a: 1 };
const fromInterface = createCustomNamespace('t', interfaceExports);
/** @type {number} */
const interfaceMember = fromInterface.a;

// - the second half of T5 is the constraint that was REJECTED, kept here as an
//   executable record rather than as prose. `narrowlyConstrained` stands in for
//   a `createCustomNamespace` declared `T extends Record<PropertyKey, unknown>`
//   — the form tried and abandoned, because an interface has no implicit index
//   signature and so fails it with TS2345. The directive asserts both ways like
//   the two above: were that constraint ever to admit an interface, the
//   suppression would go unused and tsc would report it.
/**
 * @template {Record<PropertyKey, unknown>} T
 * @param {T} exports - a candidate exports bag
 * @returns {T} the same value
 */
const narrowlyConstrained = (exports) => exports;

// @ts-expect-error - an interface satisfies `object` but not an index signature
narrowlyConstrained(interfaceExports);

// - inert by design: nothing imports this, and the object exists only so the
//   three consts above count as read. Without it `no-unused-vars` would reject
//   the file, and deleting the consts to satisfy the linter would delete the
//   assertions themselves. Scaffolding for the linter, not a public surface.
export const typeContractFixture = {
  memberNumber,
  memberString,
  absentMember,
  interfaceMember,
};
