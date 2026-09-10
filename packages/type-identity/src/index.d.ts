/**
 * @module @species-js/type-identity
 *
 * Tamper-resistant type identity for userland constructors.
 *
 * {@link defineStableTypeIdentity} freezes a constructor's `name`, its
 * prototype's `constructor` back-reference, and a `Symbol.toStringTag` getter.
 * That is what makes a userland type detectable across realms, where
 * `instanceof` fails on identity. {@link brandFunctionName} freezes `name`
 * alone, for a function whose name must survive a bundler.
 * {@link doesCarryStableTypeIdentity} reports whether a value carries the
 * frozen shape.
 *
 * Neither freezing entry throws. Both report their rejections as an
 * {@link IdentityDefinitionResult}.
 */

import type {
  AnyError,
  NewableFunction,
  ClassConstructor,
  ES3Function,
} from '@species-js/type-detection';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error-Cause Capability-Seam
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `Error` constructor in the two-argument ES2022 form this package builds
 * its wrapped reasons with. Two things satisfy it: a native `Error` that
 * honors the options bag, and the stand-in {@link resolveErrorWithCause} falls
 * back to when it does not.
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
 * otherwise a stand-in that installs `cause` itself under the descriptor flags
 * the native form uses, leaving the errors this package builds
 * indistinguishable from native ones.
 *
 * The stand-in reads `cause` from a plain-object bag's own key, where the
 * native form takes it from any object and through the prototype chain. No
 * call path here can reach that difference — every reason is built from an
 * object literal — so it is visible only to a caller of this seam.
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
 * The outcome of a freezing attempt that landed: all three slots were shaped.
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
 * The outcome of a freezing attempt that was refused, carrying the reason.
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
//  Parameter Verification
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Whether an already-newable value carries one of the two shapes
 * {@link defineStableTypeIdentity} can freeze — an ES3 constructor function or a
 * `class`-syntax constructor.
 *
 * A shape gate rather than an origin one: a built-in constructor fails it on
 * the source read, a bound newable earlier still, `bind` having stripped the
 * own `prototype` slot both shapes are read from.
 *
 * Exported so its admissions and refusals can be asserted directly rather than
 * only through the entry's rejection order.
 *
 * @param value - the value to test, already known to be newable
 * @returns `true` when the value carries one of those two shapes; `false`
 *  otherwise
 * @internal
 */
export function isSupportedConstructor<T = NewableFunction>(
  value: T & NewableFunction,
): value is T & (ES3Function | ClassConstructor);

/* @@throw-safe */
/**
 * Verifies a value as an identifier this module is willing to write into a
 * `name` slot or a `Symbol.toStringTag` getter, and hands back the normalized
 * form.
 *
 * A boxed `String` is admitted and unwrapped to its primitive, then trimmed.
 * The union is discriminated on `error`, so ruling out the failing arm reaches
 * a `string` without a cast.
 *
 * One helper serves `constructorName`, `taggedType` and `fctName`;
 * `parameterName` is what keeps each rejection naming the parameter its caller
 * actually passed.
 *
 * @param value - the candidate identifier
 * @param parameterName - the parameter name to quote in a rejection
 * @returns the trimmed, unwrapped identifier under `value` with `error` null;
 *  otherwise the reason under `error` — a `TypeError` when the value is no kind
 *  of string, a `RangeError` when it trims to empty
 * @internal
 */
export function getIdentifierAsSafeResult(
  value: unknown,
  parameterName: string,
): { error: AnyError; value: null } | { error: null; value: string };

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Public Entries
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

//  A note on the parameter types
//
//  Every function-type parameter below is declared `unknown` and has its real
//  precondition enforced at runtime, because TypeScript cannot express the
//  accepted set. (The `string` parameters are exempt — that set TypeScript
//  states exactly, and the runtime widens it only to the boxed form.) Measured:
//  a `class Foo {}` is not assignable to `ClassConstructor`, `Callable` or
//  `NewableFunction` (it has no call signature), and a `function Bar() {}`
//  is not assignable to `NewableFunction` or a `new (...) => object`
//  constructor type (it has no construct signature). Those interfaces are
//  narrowing TARGETS for type-detection's guards, not input types — the
//  same gap `NewableFunction`'s own doc names when it says the runtime
//  guard "asserts what the compiler cannot derive".
//
//  So the signature promises nothing it cannot keep. The real precondition is
//  carried by the returned `reason` instead: neither freezing entry throws, and
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
 * `name` is likewise frozen.
 *
 * Each criterion is an exact flag test, so a slot that is **absent** satisfies
 * none of them — a value cannot report an identity by withholding a descriptor
 * rather than by freezing one. The accessor is the tag's alone: an accessor
 * installed as the prototype's `constructor` is refused, carrying no
 * `[[Writable]]` attribute for the non-writability criterion to read.
 *
 * Reports only that the identity is FROZEN, never that it is authentic — a
 * third party may freeze any name onto any constructor. It is the tamper-resistance
 * guarantee, not a provenance one.
 *
 * @param value - the value to inspect; omitted is treated as `null`, which
 *  carries no identity
 * @returns `true` when the value carries every criterion of a stable
 *  type-identity; `false` otherwise, including for any hostile input that
 *  makes a descriptor read throw
 */
export function doesCarryStableTypeIdentity(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Freezing
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Freezes a stable type identity onto a constructor: a frozen `name`, a frozen
 * `constructor` back-reference on its prototype, and a non-configurable
 * `Symbol.toStringTag` getter returning `taggedType`.
 *
 * This is what makes a userland type reliably detectable across realms, where
 * `instanceof` fails on identity: the frozen tag and name survive as structural
 * evidence, and no later code can rewrite the three slots this freezes.
 *
 * Those three are the guarantee; the constructor's own `prototype` pointer is
 * not. A `class` holds that pointer non-writably by construction, so its pair
 * is closed. An ES3 constructor function holds it writably — the very property
 * that identifies the shape — so a later `F.prototype = …` substitutes an
 * unfrozen prototype. That replaces the type rather than defeating the freeze:
 * the frozen prototype is untouched, and every value already built from it
 * keeps both its tag and its verdict.
 *
 * Restricted to ES3 constructor functions and `class`-syntax constructors —
 * the feature exists for types you own. The gate is shape, not origin: it turns
 * built-in constructors away, and equally a bound newable, which `bind` has
 * stripped of the own `prototype` slot both shapes are read from.
 *
 * @param constructor - the `class` constructor or ES3 constructor function to
 *  freeze; anything else is rejected as a `reason` at 1 or 2 below (see the note
 *  on parameter types above)
 * @param constructorName - the name to assign to the constructor; trimmed
 *  before assignment, and a boxed `String` unwrapped to its primitive
 * @param taggedType - the `Symbol.toStringTag` value, or nothing at all. A
 *  rest parameter typed `[] | [string]` rather than an optional parameter,
 *  because presence here is a property of the CALL: those two arities are the
 *  whole accepted set, so passing `undefined` is a compile error rather than a
 *  third way of omitting the tag. When omitted the tag takes `constructorName`;
 *  when supplied it is trimmed and unwrapped exactly as `constructorName` is
 * @returns `{ success: true }` when the identity was defined, carrying a
 *  `warning` when the supplied tag and `constructorName` differ; otherwise
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
 *  2. `constructor` is neither an ES3 function nor a `class`-syntax
 *     constructor — `TypeError`. Built-in and bound newables both land here.
 *  3. `constructorName` is neither a string nor a boxed `String` — `TypeError`.
 *  4. `constructorName` trims to empty — `RangeError`.
 *  5. `taggedType` was supplied and is neither a string nor a boxed `String` —
 *     `TypeError`. Presence is decided by the call's ARITY, so an explicitly
 *     passed `undefined` is a supplied argument and is refused here; only a
 *     genuinely omitted third argument takes the default. The signature's
 *     `[] | [string]` rest arity states the same rule statically, so a
 *     typed caller reaches this condition only by defeating it — a JS caller
 *     reaches it directly.
 *  6. `taggedType` trims to empty — `RangeError`.
 *  7. the constructor's own `name` can no longer be shaped — `TypeError`.
 *  8. reading the constructor's own `prototype` descriptor threw — that error,
 *     unchanged.
 *  9. the resolved `prototype` is neither an object nor callable — `TypeError`.
 *     A constructor carrying no own `prototype` descriptor at all resolves
 *     here too, rather than at 8: nothing threw, there was simply nothing to
 *     read.
 *  10. the prototype's `constructor` can no longer be shaped — `TypeError`.
 *  11. the prototype's `Symbol.toStringTag` can no longer be shaped —
 *      `TypeError`.
 *  12. a define threw regardless — that error, or, when what was thrown is not
 *      an error at all, a wrapper carrying it as `cause`.
 *
 *  Arguments are validated before slots are probed, so a bad argument is
 *  reported even against a target that could not have been frozen anyway.
 *  Re-freezing an already-frozen identity fails at 7: the first call froze its
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
 * // already frozen — rejected at 7, with the reason attached
 * const retry = defineStableTypeIdentity(Foo, 'Foo');
 * retry.success;                               // false
 * retry.reason.message;                        // '…"name" property cannot be redefined.'
 *
 * // a differing tag succeeds, and says so
 * class Bar {}
 * defineStableTypeIdentity(Bar, 'Bar', 'Baz'); // { success: true, warning: '…' }
 * Object.prototype.toString.call(new Bar());   // '[object Baz]'
 */
export function defineStableTypeIdentity(
  constructor: unknown,
  constructorName: string,
  ...taggedType: [] | [string]
): IdentityDefinitionResult;

/* @@throw-safe */
/**
 * Pins a callable's own `name` to a given string, so the value survives a
 * minifier that rewrites the identifier the name would otherwise be derived
 * from. The brand does not prevent that rename — it makes the observable `name`
 * independent of it.
 *
 * Re-defines the own `name` under `frozenEntryDescriptor` — non-enumerable,
 * non-writable, non-configurable. The brand is a one-way door: a second call
 * on the same callable is refused at 4 below, its slot having been frozen by
 * the first.
 *
 * Narrower than {@link defineStableTypeIdentity}, which additionally freezes the
 * prototype's `constructor` and installs the `Symbol.toStringTag` getter. Any
 * callable is admitted, a `class` constructor included; reach for this one when
 * a plain function's name must survive a bundler, and for the freezing entry
 * when a type is to become detectable across a realm boundary.
 *
 * "Any callable" is literal, built-ins included. Nothing here reads a
 * prototype, so there is no shape gate for one to fail — the freezing entry's
 * refusal of built-ins follows from the shape it requires rather than from a
 * policy this entry omits. Combined with the one-way door, that makes the
 * caller's own functions the intended targets: whatever is passed keeps the
 * brand for good.
 *
 * @param fct - the function-type to brand; anything non-callable is rejected
 *  as a `reason` (see the note on parameter types above)
 * @param fctName - the name to brand it with; trimmed before assignment, and a
 *  boxed `String` unwrapped to its primitive
 * @returns `{ success: true }` once `name` carries the brand; otherwise
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
 *  2. `fctName` is neither a string nor a boxed `String` — `TypeError`.
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
