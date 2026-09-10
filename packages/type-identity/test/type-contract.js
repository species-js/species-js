// @ts-check

/**
 * The `type/T*` band of `docs/spec/TYPE-IDENTITY.spec.md`, as a compile-time
 * fixture.
 *
 * ## Why this file exists
 *
 * Ten of the spec's vectors are claims about the DECLARED contract rather than
 * about runtime behavior: which arities compile, which arguments are refused
 * before anything runs, where the result union narrows, and what a helper's
 * parameter type states about its precondition. None of them can be asserted
 * with `expect` — they are true or false at compile time, and a runtime suite
 * cannot see them at all.
 *
 * They also have nowhere else to live, and here that is sharper than usual: the
 * spec records the type as deliberately NARROWER than the runtime in three
 * places (`type/T2`, `type/T4`, `type/T10`). A runtime vector for one of those
 * asserts what the runtime does with an argument a typed caller cannot write —
 * which is worth asserting, and is not the same claim. Without this file the
 * narrowing itself would be recorded in a frozen spec and checked by nothing.
 *
 * ## Why it is not a `.test.js`
 *
 * There is nothing to run. `tsconfig.json` includes every `.js` file under
 * `test/`, so `tsc` reads this one and fails the package's `typecheck` if any
 * claim below stops holding; vitest collects only `*.test.js`, so it correctly
 * ignores it. The gate is `pnpm run typecheck`, which runs in `check` and in CI.
 *
 * ## Why most of it imports `#public`
 *
 * `type/T1`–`T9` are claims a CONSUMER makes, and a consumer reaches
 * `exports["."]`, which resolves to `src/public.d.ts`. Asserting them through
 * `#index` would state them about a surface nobody outside this package sees,
 * and would keep passing if the curated entry ever stopped re-exporting a type.
 * `type/T10` is the exception: it is about an `@internal` helper, so it is
 * asserted where that helper lives.
 *
 * ## Both directions
 *
 * Each `@ts-expect-error` asserts in BOTH directions: if the construct is
 * rejected as expected the directive is consumed, and if the contract regressed
 * and it became legal the directive would have nothing to suppress and `tsc`
 * would report it as unused. Each `@type` ANNOTATION is likewise the assertion
 * rather than the binding: a `const` annotated `boolean` and initialized from a
 * call compiles only while that call really returns `boolean`, and the value is
 * never read for its own sake.
 *
 * A fixture nobody has seen fail is not yet a gate; the probe record is in the
 * suite's commit message.
 */

import {
  brandFunctionName,
  defineStableTypeIdentity,
  doesCarryStableTypeIdentity,
} from '#public';
import { isSupportedConstructor } from '#index';
import { isNewableFunction } from '@species-js/type-detection';

/** @typedef {import('@species-js/type-detection').AnyError} AnyError */
/** @typedef {import('#public').IdentityDefinitionResult} IdentityDefinitionResult */

/**
 * A place for the bindings whose only purpose is to hold a suppressed read.
 *
 * Each `@ts-expect-error` below needs something to sit above, and a bare member
 * access is not a statement `no-unused-expressions` accepts. Pushing the value
 * here is what makes the binding a read rather than dead scaffolding.
 *
 * @type {unknown[]}
 */
const reads = [];

/** @returns {unknown} a fresh class, typed the way a caller's own type would be */
const freshType = () =>
  class Local {
    /** @returns {string} a value, so the class carries a member */
    identify() {
      return 'local';
    }
  };

// type/T1 — both accepted arities compile.
/** @type {IdentityDefinitionResult} */
const twoArguments = defineStableTypeIdentity(freshType(), 'Foo');
/** @type {IdentityDefinitionResult} */
const threeArguments = defineStableTypeIdentity(freshType(), 'Foo', 'Bar');

// type/T2 — an EXPLICIT `undefined` third argument is a compile error. The rest
// tuple `[] | [string]` states statically the rule `args.length` enforces at
// runtime, where an optional parameter would have admitted it. This is the
// vector the arity contract exists for.
// @ts-expect-error - an explicit `undefined` is a supplied argument, not an omitted one
defineStableTypeIdentity(freshType(), 'Foo', undefined);

// type/T3 — a fourth argument is a compile error.
// @ts-expect-error - the accepted set is exactly two arities
defineStableTypeIdentity(freshType(), 'Foo', 'Bar', 'Baz');

// type/T4 — `constructorName` is typed `string`, so a boxed `String` is a
// compile error even though the runtime admits and unwraps one (`ident/A3`).
// The runtime is deliberately wider than the type here.
// @ts-expect-error - a boxed `String` is not a `string`
defineStableTypeIdentity(freshType(), new String('Foo'));

// type/T5 — `constructor` is typed `unknown`, so nothing is refused there.
// TypeScript cannot express the accepted set — a `class Foo {}` is assignable
// to neither `ClassConstructor` nor `Callable` nor `NewableFunction` — so the
// precondition is carried by the returned `reason` instead.
/** @type {IdentityDefinitionResult} */
const objectTarget = defineStableTypeIdentity({}, 'Foo');
/** @type {IdentityDefinitionResult} */
const numberTarget = defineStableTypeIdentity(42, 'Foo');

// type/T6 — the result is discriminated on `success`.
/** @type {unknown} */
// @ts-expect-error - `reason` is unreachable on the bare union
const bareUnionReason = twoArguments.reason;

/** @type {AnyError | null} */
let narrowedReason = null;
/** @type {string | undefined} */
let narrowedWarning;

if (twoArguments.success) {
  /** @type {unknown} */
  // @ts-expect-error - and unreachable on the success arm
  const successArmReason = twoArguments.reason;

  reads.push(successArmReason);

  // type/T7 — `warning` is `string | undefined` on the success arm.
  narrowedWarning = twoArguments.warning;
} else {
  narrowedReason = twoArguments.reason;
}

// type/T8 — `brandFunctionName` takes `unknown` for `fct` and `string` for
// `fctName`, the same asymmetry for the same reason.
/** @type {IdentityDefinitionResult} */
const brandedNumber = brandFunctionName(42, 'Foo');

// @ts-expect-error - the identifier is a `string`, here as everywhere
brandFunctionName(() => undefined, 42);

// type/T9 — the verification entry accepts zero or one argument and returns a
// plain `boolean`.
/** @type {boolean} */
const omittedVerdict = doesCarryStableTypeIdentity();
/** @type {boolean} */
const suppliedVerdict = doesCarryStableTypeIdentity(freshType());

// @ts-expect-error - one argument at most
doesCarryStableTypeIdentity(freshType(), 'extra');

// - and it is NOT a type guard. There is no TypeScript type for "carries a
//   frozen identity", and asserting one would be a claim about provenance the
//   runtime check explicitly refuses to make (`carry/A4`). So the operand keeps
//   the type it had inside the branch, and reading a member of it stays an
//   error on `unknown`.
/** @type {unknown} */
const unnarrowed = freshType();

if (doesCarryStableTypeIdentity(unnarrowed)) {
  /** @type {unknown} */
  // @ts-expect-error - the verdict narrows nothing
  const unnarrowedName = unnarrowed.name;

  reads.push(unnarrowedName);
}

// type/T10 — `isSupportedConstructor` states its precondition in its parameter
// type, so a typed caller must narrow with `isNewableFunction` first. That is
// the same order the freezing entry uses, condition 1 before condition 2.
// - the class is bound first so the CALL is one line: a directive suppresses
//   the line below it, and against a multi-line argument the error lands
//   further down and the directive itself is reported as unused.
const unnarrowedClass = class Unnarrowed {
  /** @returns {string} a value, so the class carries a member */
  identify() {
    return 'unnarrowed';
  }
};

// @ts-expect-error - a class literal is not assignable to `T & NewableFunction`
isSupportedConstructor(unnarrowedClass);

/** @type {unknown} */
const candidate = freshType();
/** @type {boolean} */
let supported = false;

if (isNewableFunction(candidate)) {
  supported = isSupportedConstructor(candidate);
}

// - inert by design: nothing imports this, and the object exists only so the
//   bindings above count as read. Without it `no-unused-vars` would reject the
//   file, and deleting the bindings to satisfy the linter would delete the
//   assertions themselves. Scaffolding for the linter, not a public surface.
export const typeContractFixture = {
  bareUnionReason,
  brandedNumber,
  reads,
  narrowedReason,
  narrowedWarning,
  numberTarget,
  objectTarget,
  omittedVerdict,
  suppliedVerdict,
  supported,
  threeArguments,
};
