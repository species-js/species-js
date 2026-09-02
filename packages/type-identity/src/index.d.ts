/**
 * @module @species-js/type-identity
 *
 * Tamper-resistant type identity for userland constructors.
 *
 * {@link defineStableTypeIdentity} seals a constructor's `name`, its
 * prototype's `constructor` back-reference, and a `Symbol.toStringTag` getter.
 * That is what makes a userland type detectable across realms, where
 * `instanceof` fails on identity. {@link brandFunctionName} seals `name`
 * alone, for a function whose name must survive a bundler.
 * {@link doesCarryStableTypeIdentity} reports whether a value carries the
 * sealed shape.
 *
 * Neither sealing entry throws. Both report their rejections as an
 * {@link IdentityDefinitionResult}.
 */

import type { AnyError } from '@species-js/type-detection';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error-Cause Capability-Seam
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `Error` constructor in the two-argument ES2022 form this package builds
 * its wrapped reasons with. Two things satisfy it: a native `Error` that
 * honors the options bag, and the stand-in {@link resolveErrorWithCause} falls
 * back to otherwise.
 *
 * @internal
 */
export type ErrorWithCauseConstructor = new (
  message?: string,
  options?: { cause?: unknown },
) => Error;

/* @@throw-safe */
/**
 * Resolves the `Error` constructor this package builds its wrapped reasons
 * with: the native one when it already honors the ES2022 options bag,
 * otherwise a stand-in that installs `cause` itself with the same descriptor
 * flags, leaving the two indistinguishable to a consumer.
 *
 * The two-argument form parses on every engine, so support cannot be inferred
 * from syntax. An engine without it ignores the second argument silently
 * rather than throwing, so the observable effect is probed instead.
 *
 * Total over every constructor. A probe that throws answers the question in
 * the negative and selects the stand-in, exactly as a missing `cause` would,
 * so no input produces a load error.
 *
 * Exported only so both branches are reachable under test. Passing a stub that
 * ignores its second argument selects the fallback on an engine whose native
 * `Error` would not, which is otherwise dead code everywhere `cause` is already
 * supported.
 *
 * @param ProvidedError - the constructor to probe, and to hand back unchanged
 *  when it already honors `cause`
 * @returns the constructor itself when the options bag took effect; otherwise
 *  the stand-in
 * @internal
 */
export function resolveErrorWithCause(
  ProvidedError: ErrorConstructor,
): ErrorWithCauseConstructor;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The outcome of a sealing attempt that landed: all three slots were shaped.
 *
 * `warning` is present only when `taggedType` and `constructorName` differ.
 * That is a supported combination. It is reported because the two identifiers
 * a value then answers with, `constructor.name` and its `Symbol.toStringTag`,
 * diverge, which is more often a slip than an intention.
 */
export interface IdentityDefinitionSuccess {
  success: true;
  warning?: string;
}

/**
 * The outcome of a sealing attempt that was refused, carrying the reason.
 *
 * A single error, not an aggregate. The checks run in order and the first
 * blocking one ends the attempt, so `reason` is whichever came first. That is
 * what makes the order contract rather than an implementation detail.
 * See {@link defineStableTypeIdentity} for the ordered list.
 *
 * Always an `Error`, including when the underlying throw was not one: such a
 * value is wrapped and carried as the wrapper's `cause`.
 */
export interface IdentityDefinitionFailure {
  success: false;
  reason: AnyError;
}

/**
 * The discriminated result of {@link defineStableTypeIdentity} — narrow on
 * `success` to reach `reason` on the failing arm.
 */
export type IdentityDefinitionResult =
  IdentityDefinitionSuccess | IdentityDefinitionFailure;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type Identity Predicate Functions
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

//  A note on the parameter types
//
//  Every entry below takes `unknown` and enforces its real precondition at
//  runtime, because TypeScript cannot express the accepted set. Measured:
//  a `class Foo {}` is not assignable to `ClassConstructor`, `Callable` or
//  `NewableFunction` (it has no call signature), and a `function Bar() {}`
//  is not assignable to `NewableFunction` or a `new (...) => object`
//  constructor type (it has no construct signature). Those interfaces are
//  narrowing TARGETS for type-detection's guards, not input types — the
//  same gap `NewableFunction`'s own doc names when it says the runtime
//  guard "asserts what the compiler cannot derive".
//
//  So the signature promises nothing it cannot keep. The real precondition is
//  carried by the returned `reason` instead: neither sealing entry throws, and
//  both report every rejection as a value, invalid arguments included.
//

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Verification
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Whether a value carries a stable type-identity — the shape
 * {@link defineStableTypeIdentity} installs.
 *
 * Accepts either side of the relation: a constructor is inspected directly,
 * any other value through its resolved constructor and `[[Prototype]]`. Three
 * criteria must hold together, all read inertly from descriptors: the
 * prototype's `Symbol.toStringTag` is a getter-only, non-configurable,
 * non-enumerable accessor; the prototype's `constructor` is a non-writable,
 * non-configurable, non-enumerable data property; and the constructor's own
 * `name` is likewise sealed.
 *
 * Reports only that the identity is SEALED, never that it is authentic — a
 * third party may seal any name onto any constructor. It is the tamper-resistance
 * guarantee, not a provenance one.
 *
 * @param value - the value to inspect
 * @returns `true` when the value carries every criterion of a stable
 *  type-identity; `false` otherwise, including for any hostile input that
 *  makes a descriptor read throw
 */
export function doesCarryStableTypeIdentity(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Sealing
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Seals a stable type identity onto a constructor: a frozen `name`, a frozen
 * `constructor` back-reference on its prototype, and a non-configurable
 * `Symbol.toStringTag` getter returning `taggedType`.
 *
 * This is what makes a userland type reliably detectable across realms, where
 * `instanceof` fails on identity: the sealed tag and name survive as
 * structural evidence no later code can rewrite.
 *
 * Restricted to ES3 constructor functions and `class`-syntax constructors.
 * Built-in constructors are rejected — the feature exists for types you own.
 *
 * @param constructor - the `class` constructor or ES3 constructor function to
 *  seal; anything else is rejected as a `reason` at 1 or 2 below (see the note
 *  on parameter types above)
 * @param constructorName - the name to assign to the constructor
 * @param taggedType - the `Symbol.toStringTag` value; defaults to
 *  `constructorName`
 * @returns `{ success: true }` when the identity was defined, carrying a
 *  `warning` when `taggedType` and `constructorName` differ; otherwise
 *  `{ success: false, reason }` naming the first condition that blocked the
 *  attempt. **Never throws.** Every rejection arrives as a returned value,
 *  invalid arguments included.
 *
 *  ## Rejection order
 *
 *  The first blocking condition ends the attempt, so this order is contract:
 *  which `reason` a caller sees depends on it.
 *
 *  1. `constructor` is not a constructable function-type — `TypeError`.
 *  2. `constructor` is a built-in rather than an ES3 function or a
 *     `class`-syntax constructor — `TypeError`.
 *  3. `constructorName` is not a string — `TypeError`.
 *  4. `constructorName` trims to empty — `RangeError`.
 *  5. `taggedType` was supplied and trims to empty — `RangeError`.
 *  6. the constructor's own `name` can no longer be shaped — `TypeError`.
 *  7. reading the constructor's own `prototype` descriptor threw — that error,
 *     unchanged.
 *  8. the resolved `prototype` is neither an object nor callable — `TypeError`.
 *  9. the prototype's `constructor` can no longer be shaped — `TypeError`.
 *  10. the prototype's `Symbol.toStringTag` can no longer be shaped —
 *      `TypeError`.
 *  11. a define threw regardless — that error, or, when what was thrown is not
 *      an error at all, a wrapper carrying it as `cause`.
 *
 *  Arguments are validated before slots are probed, so a bad argument is
 *  reported even against a target that could not have been sealed anyway.
 *  Re-sealing an already-sealed identity fails at 6: the first call froze its
 *  `name`.
 *
 *  A slot is un-shapeable when it is already occupied by a non-configurable
 *  property, or absent from a non-extensible target where the define would
 *  throw.
 * @example
 * class Foo {}
 * defineStableTypeIdentity(Foo, 'Foo');        // { success: true }
 * Object.prototype.toString.call(new Foo());   // '[object Foo]'
 * doesCarryStableTypeIdentity(Foo);            // true
 * doesCarryStableTypeIdentity(new Foo());      // true — either side works
 *
 * // already sealed — rejected at 6, with the reason attached
 * const retry = defineStableTypeIdentity(Foo, 'Foo');
 * retry.success;                               // false
 * retry.reason.message;                        // '…"name" property cannot be redefined.'
 *
 * // a differing tag succeeds, and says so
 * class Bar {}
 * defineStableTypeIdentity(Bar, 'Bar', 'Baz'); // { success: true, warning: '…' }
 */
export function defineStableTypeIdentity(
  constructor: unknown,
  constructorName: string,
  taggedType?: string,
): IdentityDefinitionResult;

/* @@throw-safe */
/**
 * Brands a callable's `name` so code-minimization cannot rewrite it.
 *
 * Re-defines the own `name` under `frozenEntryDescriptor` — non-enumerable,
 * non-writable, non-configurable. The brand is a one-way door: a second call
 * on the same callable is refused at 4 below, its slot having been frozen by
 * the first.
 *
 * Narrower than {@link defineStableTypeIdentity}, which additionally seals the
 * prototype's `constructor` and installs the `Symbol.toStringTag` getter. Use
 * this one for a plain function whose name must survive a bundler.
 *
 * @param fct - the function-type to brand; anything non-callable is rejected
 *  as a `reason` (see the note on parameter types above)
 * @param fctName - the name to brand it with; trimmed before assignment
 * @returns `{ success: true }` when the callable was re/named; otherwise
 *  `{ success: false, reason }` naming the first condition that blocked it.
 *  **Never throws.** Every rejection arrives as a returned value, invalid
 *  arguments included. The success arm never carries a `warning`. That field
 *  belongs to {@link defineStableTypeIdentity}'s two-identifier case, which
 *  has no counterpart here.
 *
 *  ## Rejection order
 *
 *  As in {@link defineStableTypeIdentity}, arguments are validated before the
 *  slot is probed, and the first blocking condition ends the attempt:
 *
 *  1. `fct` is not a function-type — `TypeError`.
 *  2. `fctName` is not a string — `TypeError`.
 *  3. `fctName` trims to empty — `RangeError`.
 *  4. the callable's own `name` can no longer be shaped — `TypeError`. Either
 *     already made non-configurable, an earlier brand being the usual cause, or
 *     absent from a non-extensible callable where the define would throw.
 *  5. the define threw regardless — that error, or, when what was thrown is not
 *     an error at all, a wrapper carrying it as `cause`.
 * @example
 * function handler() {}
 * brandFunctionName(handler, 'handler');   // { success: true }
 * handler.name;                            // 'handler', now frozen
 *
 * const again = brandFunctionName(handler, 'other');
 * again.success;                           // false — one-way door
 * again.reason.message;                    // '…"name" property cannot be redefined.'
 */
export function brandFunctionName(
  fct: unknown,
  fctName: string,
): IdentityDefinitionResult;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
