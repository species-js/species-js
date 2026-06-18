// @ts-check

/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection.
 *
 * The floor predicate {@link isCallable} narrows any value to
 * {@link Callable} via the minimal, realm-independent callability test.
 * Richer function classification builds on top of it: newability, the
 * verified Function-interface shape, and specific species such as async,
 * generator, or class.
 */

import { getOwnPropertyDescriptor, getPrototypeOf, toFunctionString } from '@/config';
import {
  hasOwnWritablePrototype,
  hasOwnPrototype,
  getTypeSignature,
  getDefinedConstructor,
  getDefinedConstructorName,
  getOwnPropertyDescriptorsKeySet,
} from '@/utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').VerifiedFunction} VerifiedFunction */
/** @typedef {import('@/function').NewableFunction} NewableFunction */
/** @typedef {import('@/function').ClassConstructor} ClassConstructor */
/** @typedef {import('@/function').ES3Function} ES3Function */
/** @typedef {import('@/function').AsyncFunction} AsyncFunction */
/** @typedef {import('@/function').Generator} Generator */
/** @typedef {import('@/function').AsyncGenerator} AsyncGenerator */
/** @typedef {import('@/function').GeneratorFunction} GeneratorFunction */
/** @typedef {import('@/function').AsyncGeneratorFunction} AsyncGeneratorFunction */
/** @typedef {import('@/function').AnyGeneratorFunction} AnyGeneratorFunction */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns a function's source string with surrounding whitespace trimmed.
 *
 * The read goes through the realm-fixed `toFunctionString.call(value)`
 * capture rather than the instance's own `toString`. A function whose
 * instance `toString` has been deleted, replaced, or shadowed still yields
 * its real source through this helper.
 *
 * `[native code]` markers that engines insert for built-in functions are
 * preserved in the output. Telling native code from user-authored code is
 * the load-bearing reason callers reach for this helper, so stripping the
 * markers would defeat the purpose.
 *
 * @param {Callable} value - the function whose source should be read
 * @returns {string} the function's source as a trimmed string
 * @internal
 */
export function getFunctionSource(value) {
  return toFunctionString.call(value).trim();
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Callable vs. Function-Interface Types and Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows an unknown value to {@link Callable} via the minimal callability
 * test, `typeof value === 'function'`.
 *
 * The floor-level guard. It confirms that the `[[Call]]` internal method is
 * present and nothing more. It does not verify `[[Construct]]`, the
 * `Function.prototype` method set, or any specific function classification.
 * Those checks belong to stricter guards layered above this one.
 *
 * Generic in the input type so existing caller-side narrowing is preserved
 * through the predicate. The narrow returns `T & Callable`. Non-callable
 * arms of `T` collapse to `never` under the intersection. Callable arms
 * retain their call signature. For `T = unknown`, the intersection
 * reduces to `Callable`, matching the pre-generic behavior.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not callable
 * @returns {value is T & Callable} `true` when `typeof value === 'function'`,
 *  narrowing `value` to `T & Callable`; `false` otherwise
 */
// Load-order invariant: must remain a hoisted `function` declaration.
// `@/config` calls `isCallable` at its own module-evaluation time (the
// `objectHasOwn` and `Number.is*` gates), and `config` sits in a circular
// import with this module. Function-declaration hoisting makes `isCallable`
// reachable mid-cycle, before `function.js` has finished evaluating.
// Rewriting as `const isCallable = (value) => …` puts the binding in the
// temporal dead zone and throws at package-load.
export function isCallable(value) {
  return typeof value === 'function';
}

/**
 * Narrows a value to {@link VerifiedFunction}.
 *
 * Verifies that `value` is {@link Callable} and that its own `call`,
 * `apply`, and `bind` are themselves callable. This is the
 * strict-Function-interface guard that survives prototype tampering on
 * those three members.
 *
 * Generic in the input type, mirroring {@link isCallable}. The narrow
 * returns `T & VerifiedFunction`, so callers whose `value` already
 * carries a more specific function shape keep that shape post-narrow.
 * Non-callable arms of `T` collapse to `never` under the intersection.
 * `T = unknown` reduces to `VerifiedFunction`, matching the pre-generic
 * behavior.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not callable
 * @returns {value is T & VerifiedFunction} `true` when `value` is callable
 *  and exposes callable `call`, `apply`, and `bind`, narrowing to
 *  `T & VerifiedFunction`; `false` otherwise
 * @example
 * isFunction(() => {});             // true
 * isFunction(function () {});       // true
 * isFunction(class Foo {});         // true
 * isFunction({ bind: () => {} });   // false (typeof not function)
 * isFunction(null);                 // false
 */
export function isFunction(value) {
  return (
    isCallable(value) &&
    isCallable(value.bind) &&
    isCallable(value.call) &&
    isCallable(value.apply)
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Newable Function Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Probes the value's `[[Construct]]` internal method without invoking the
 * value itself.
 *
 * Builds a `Proxy` whose `construct` trap returns an empty object, then
 * attempts `new proxy(…)`. If `[[Construct]]` is reachable on the proxy's
 * target, the construction succeeds and the function returns `true`.
 * Otherwise, the `new` throws and the function returns `false`.
 *
 * The MDN-cited invariant — "the target used to initialize the proxy must
 * itself be a valid constructor" — is what makes this a reliable lenient
 * gate. The proxy can supply a `construct` trap, but the trap only fires
 * if the target has `[[Construct]]` to begin with. Bound newables count,
 * since they preserve `[[Construct]]`. Arrow functions, methods, async
 * functions, and generator functions do not.
 *
 * Each call allocates a `Proxy` and runs a `new` inside a `try`/`catch`.
 * The async, generator, and async-generator predicates only reach this on
 * their cross-realm fallback (the same-realm `instanceof` fast-path runs
 * first), but {@link isNewableFunction}, {@link isES3Function}, and
 * {@link isClass} route through it unconditionally. No less expensive
 * technique exists for probing `[[Construct]]` without invoking the value,
 * but downstream callers placing those guards on a hot path should know
 * about the allocation.
 *
 * @param {unknown} [value] - the value to probe; omitted is treated as
 *  `undefined`, which carries no `[[Construct]]`
 * @returns {boolean} `true` when the value carries `[[Construct]]`; `false`
 *  otherwise
 */
export function hasConstructSlot(value) {
  try {
    new /** @type {NewableFunction} */ (
      new Proxy(/** @type {object} */ (value), { construct: () => ({}) })
    )();
    return true;
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the lenient {@link NewableFunction} gate.
 *
 * Composes {@link isFunction} (the four-method callability check) with
 * {@link hasConstructSlot} (the `[[Construct]]` probe). The result admits
 * all three newable species: {@link ES3Function}, {@link ClassConstructor},
 * and bound newables.
 *
 * Generic in `T` per the family-pattern set by {@link isCallable} and
 * {@link isFunction}. The narrow returns `T & NewableFunction`, preserving
 * caller-side narrowing. `T = unknown` collapses to `NewableFunction`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not callable
 * @returns {value is T & NewableFunction} `true` when the value is callable,
 *  exposes callable `call`, `apply`, and `bind`, and carries
 *  `[[Construct]]`, narrowing to `T & NewableFunction`; `false` otherwise
 */
export function isNewableFunction(value) {
  return isFunction(value) && hasConstructSlot(value);
}

/**
 * Narrows a value to {@link ES3Function}, the strict ES3-function shape.
 *
 * Builds on {@link isNewableFunction} and adds the structural tell: an
 * own `prototype` descriptor whose `writable` is `true`, verified through
 * {@link hasOwnWritablePrototype}.
 *
 * Bound ES3 functions are deliberately rejected. They remain newable but
 * have lost their own `prototype` slot, so what remains is no longer an
 * ES3 shape. The {@link NewableFunction} gate still admits them; this
 * guard does not.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & ES3Function`. `T = unknown` collapses to `ES3Function`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is T & ES3Function} `true` when the value is an
 *  ES3-shaped newable, narrowing to `T & ES3Function`; `false` otherwise
 */
export function isES3Function(value) {
  return isNewableFunction(value) && hasOwnWritablePrototype(value);
}

/**
 * Narrows a value to {@link ClassConstructor}, the strict class shape.
 *
 * Covers both custom (`class`-syntax) constructors and built-in class
 * constructors such as `Array`, `Date`, and `Map`. Both share the same
 * structural tell: an own `prototype` descriptor whose `writable` is
 * `false`. This is the only spec-given discriminator between a class
 * constructor (frozen own `prototype`) and a good-old ES3 function
 * (writable own `prototype`). To tell the two class families apart, use
 * {@link isCustomClass} or {@link isBuiltInClass} — disjoint refinements
 * that together partition this surface.
 *
 * Bound class constructors are deliberately rejected. Though they remain
 * newable, `bind` has stripped the own `prototype` slot from the bound
 * result. What remains is no longer a class shape.
 * The descriptor read returns `undefined` and `undefined?.writable === false`
 * short-circuits to `false`. The {@link NewableFunction} gate still admits
 * bound newables; this guard does not.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & ClassConstructor`. `T = unknown` collapses to `ClassConstructor`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is T & ClassConstructor} `true` when the value is a
 *  class-shaped newable (built-in or `class`-syntax), narrowing to
 *  `T & ClassConstructor`; `false` otherwise
 */
export function isClass(value) {
  return (
    isNewableFunction(value) &&
    getOwnPropertyDescriptor(value, 'prototype')?.writable === false
  );
}

/**
 * Narrows a value to a custom (`class`-syntax) constructor.
 *
 * Builds on {@link isClass} and adds the source-prefix check. A custom
 * class's stringified source starts with the literal `'class'` keyword.
 * A built-in class constructor's source does not; it always takes the
 * form `function Foo() { [native code] }`.
 *
 * `isCustomClass` and {@link isBuiltInClass} are disjoint refinements of
 * {@link isClass}. Together they partition the class surface into
 * authored-via-`class`-syntax and built-in. Both narrow to
 * {@link ClassConstructor}. A bound class fails {@link isClass} upstream,
 * so neither variant admits it.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & ClassConstructor`. `T = unknown` collapses to `ClassConstructor`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is T & ClassConstructor} `true` when the value is a
 *  custom-class constructor, narrowing to `T & ClassConstructor`;
 *  `false` otherwise
 */
export function isCustomClass(value) {
  return isClass(value) && getFunctionSource(value).startsWith('class');
}

/**
 * Narrows a value to a built-in class constructor.
 *
 * Builds on {@link isClass} and adds the inverse source-prefix check.
 * A built-in class constructor's stringified source always takes the
 * form `function Foo() { [native code] }`. A custom (`class`-syntax)
 * constructor's source does not; it starts with the literal `'class'`
 * keyword.
 *
 * The dual of {@link isCustomClass}. Both narrow to {@link ClassConstructor};
 * together they partition the {@link isClass} surface. Neither admits bound
 * variants, which are rejected upstream by {@link isClass}.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & ClassConstructor`. `T = unknown` collapses to `ClassConstructor`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is T & ClassConstructor} `true` when the value is a
 *  built-in class constructor, narrowing to `T & ClassConstructor`;
 *  `false` otherwise
 */
export function isBuiltInClass(value) {
  return isClass(value) && !getFunctionSource(value).startsWith('class');
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Async Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const AsyncFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(async () => Promise.resolve())
);

/**
 * Tests the two identity-signal labels an `%AsyncFunction%` value carries.
 *
 * `Symbol.toStringTag`, read via {@link getTypeSignature}, must resolve to
 * `'[object AsyncFunction]'`, and the resolved constructor name, read via
 * {@link getDefinedConstructorName}, must equal `'AsyncFunction'`. Both
 * labels are spec-invariant across realms and survive `bind`, since the
 * relevant prototype-chain is preserved. Together they form the
 * realm-independent identity signal for any genuine `%AsyncFunction%`, so
 * tampering with one label without matching the other is rejected.
 *
 * Called as the third link of {@link hasAsyncFunctionShape}'s `&&` chain,
 * after the descriptor-presence floor (`!hasOwnPrototype`,
 * `!hasConstructSlot`) and before the proto-side membership check
 * ({@link hasAsyncFunctionPrototypeSurface}).
 *
 * @param {unknown} value - the value whose identity-labels should be read
 * @returns {boolean} `true` when both labels match; `false` otherwise
 * @internal
 */
export function hasAsyncFunctionIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object AsyncFunction]' &&
    getDefinedConstructorName(value) === 'AsyncFunction'
  );
}

/**
 * Tests whether the value's `[[Prototype]]` matches the own-key structure
 * of `%AsyncFunction.prototype%`: `'constructor'` present and `'prototype'`
 * absent.
 *
 * The proto-side check uses {@link getOwnPropertyDescriptorsKeySet}'s
 * membership semantics, so a prototype with extra own keys is admitted as
 * long as both conditions hold. The spec promises which keys
 * `%AsyncFunction.prototype%` exhibits, not that those are the only keys.
 *
 * Called only as the last link of {@link hasAsyncFunctionShape}'s `&&`
 * chain, so by the time `getPrototypeOf` runs the upstream `[[Class]]`
 * check has already rejected `null` and `undefined`.
 *
 * @param {unknown} value - the value whose `[[Prototype]]` should be inspected
 * @returns {boolean} `true` when both membership conditions hold; `false`
 *  otherwise
 * @internal
 */
export function hasAsyncFunctionPrototypeSurface(value) {
  const keySet = getOwnPropertyDescriptorsKeySet(getPrototypeOf(value));
  return keySet.has('constructor') && !keySet.has('prototype');
}

/**
 * Detects whether a value has the runtime shape of an `%AsyncFunction%`.
 *
 * The check is structural, not identity-based. It does not require the
 * value to descend from this realm's `%AsyncFunction%` intrinsic, so it
 * admits async functions originating in foreign realms.
 *
 * Six realm-independent markers must hold:
 *
 * 1. No own `prototype` property.
 * 2. No `[[Construct]]` internal method.
 * 3. `Symbol.toStringTag` resolves to `'AsyncFunction'`.
 * 4. The resolved constructor name is `'AsyncFunction'`.
 * 5. The value's `[[Prototype]]` has an own `'constructor'` key.
 * 6. The value's `[[Prototype]]` has no own `'prototype'` key.
 *
 * The implementation groups these into four `&&` links: the
 * descriptor-presence floor (markers 1 and 2), then
 * {@link hasAsyncFunctionIdentitySignal} (markers 3 and 4), then
 * {@link hasAsyncFunctionPrototypeSurface} (markers 5 and 6).
 *
 * Markers 1–4 are spec invariants. Markers 5 and 6 are conservative
 * cross-validators that catch single-slot spoofing. A value that spoofs
 * `Symbol.toStringTag` but leaves its `[[Prototype]]` unmodified would slip
 * past the spec-invariant floor. The proto-side check rejects it.
 * Coordinated tampering across both the tag and the prototype surface still
 * passes here, but `instanceof` against the captured intrinsic accepts
 * such a value as well, so the result stays consistent across both code
 * paths.
 *
 * The proto-side check uses set membership rather than full-set equality.
 * A prototype with extra own keys is admitted, provided `'constructor'` is
 * present and `'prototype'` is absent. The spec promises the keys
 * `%AsyncFunction.prototype%` exhibits, not that those are the only keys.
 *
 * Returns a plain boolean. Narrowing is handled by {@link isAsyncFunction},
 * which runs the same-realm `instanceof` fast path before falling back to
 * this structural check. The signature is standalone by design so that
 * each marker can be tested in isolation. Any value can be passed, and
 * non-callables flow through the marker chain and return `false`.
 *
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when all six markers hold; `false` otherwise
 * @internal
 */
export function hasAsyncFunctionShape(value) {
  return (
    !hasOwnPrototype(value) &&
    !hasConstructSlot(value) &&
    hasAsyncFunctionIdentitySignal(value) &&
    hasAsyncFunctionPrototypeSurface(value)
  );
}

/**
 * Narrows a value to {@link AsyncFunction}.
 *
 * Orchestrates three phases:
 *
 * 1. The `isFunction` gate short-circuits for non-callable inputs.
 * 2. The same-realm fast path checks `value instanceof %AsyncFunction%`,
 *    which walks the `[[Prototype]]` chain. It passes for any value whose
 *    inheritance traces to the local realm's `%AsyncFunction.prototype%`,
 *    including bound variants — `bind` preserves the chain.
 * 3. The realm-independent fallback delegates to
 *    {@link hasAsyncFunctionShape}, which verifies the six spec-derived
 *    markers (four spec-invariant plus two proto-side key-set
 *    cross-validators). This is the cross-realm code path. Foreign-realm
 *    async functions have a different `%AsyncFunction%` identity but the
 *    same observable markers.
 *
 * Admits all four source-forms — `async function` declarations,
 * expressions, async arrows, and async concise methods — alongside their
 * bound variants. See the {@link AsyncFunction} doc for the lattice
 * framing and the spec-mechanics rationale for bound-admission.
 *
 * Does not admit async-generator functions. Those are generator functions
 * in the species-js taxonomy, with a different intrinsic, a different
 * `Symbol.toStringTag`, and an own writable `prototype`. They are not a
 * near-variant of `AsyncFunction`. The shared "Async" prefix in their name
 * describes what their iterator yields, not the function. See the
 * generator predicates for that family.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AsyncFunction`; `T = unknown` collapses to `AsyncFunction`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an async function
 * @returns {value is T & AsyncFunction} `true` when the value is an async
 *  function in the species-js taxonomy, narrowing to `T & AsyncFunction`;
 *  `false` otherwise
 * @example
 * isAsyncFunction(async () => {});                // true
 * isAsyncFunction(async function () {});          // true
 * isAsyncFunction({ async m() {} }.m);            // true
 * isAsyncFunction((async () => 1).bind(null));    // true — bound forms admitted
 * isAsyncFunction(() => Promise.resolve());       // false — returns a Promise,
 *                                                 // but not tagged AsyncFunction
 * isAsyncFunction(async function* () {});         // false — generator-family
 *                                                 // intrinsic, not async-family
 */
export function isAsyncFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof AsyncFunctionConstructor || hasAsyncFunctionShape(value))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generator Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const GeneratorFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(function* () {
    yield;
  })
);
const AsyncGeneratorFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(async function* () {
    await Promise.resolve();
    yield;
  })
);

/**
 * Tests the two identity-signal labels a `%GeneratorFunction%` value carries.
 *
 * `Symbol.toStringTag`, read via {@link getTypeSignature}, must resolve to
 * `'[object GeneratorFunction]'`, and the resolved constructor name, read
 * via {@link getDefinedConstructorName}, must equal `'GeneratorFunction'`.
 * Both labels are spec-invariant across realms and survive `bind`, since
 * the relevant prototype-chain is preserved. Together they form the
 * realm-independent identity signal for any genuine `%GeneratorFunction%`.
 *
 * Mirrors the async-family pattern. See: {@link hasAsyncFunctionIdentitySignal}.
 * Called as the second link of {@link hasGeneratorFunctionShape}'s `&&`
 * chain, after `!hasConstructSlot` and before
 * {@link hasAnyGeneratorFunctionPrototypeSurface}.
 *
 * @param {unknown} value - the value whose identity-labels should be read
 * @returns {boolean} `true` when both labels match; `false` otherwise
 * @internal
 */
export function hasGeneratorFunctionIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object GeneratorFunction]' &&
    getDefinedConstructorName(value) === 'GeneratorFunction'
  );
}

/**
 * Tests the two identity-signal labels an `%AsyncGeneratorFunction%` value
 * carries.
 *
 * `Symbol.toStringTag`, read via {@link getTypeSignature}, must resolve to
 * `'[object AsyncGeneratorFunction]'`, and the resolved constructor name,
 * read via {@link getDefinedConstructorName}, must equal
 * `'AsyncGeneratorFunction'`. Both labels are spec-invariant across realms
 * and survive `bind`, since the relevant prototype-chain is preserved.
 * Together they form the realm-independent identity signal for any genuine
 * `%AsyncGeneratorFunction%`.
 *
 * Mirrors {@link hasGeneratorFunctionIdentitySignal}. Called as the second
 * link of {@link hasAsyncGeneratorFunctionShape}'s `&&` chain, after
 * `!hasConstructSlot` and before
 * {@link hasAnyGeneratorFunctionPrototypeSurface}.
 *
 * @param {unknown} value - the value whose identity-labels should be read
 * @returns {boolean} `true` when both labels match; `false` otherwise
 * @internal
 */
export function hasAsyncGeneratorFunctionIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object AsyncGeneratorFunction]' &&
    getDefinedConstructorName(value) === 'AsyncGeneratorFunction'
  );
}

/**
 * Tests whether the value's `[[Prototype]]` matches the generator family's
 * shared own-key structure: `'constructor'` present and `'prototype'`
 * present.
 *
 * Both keys are spec-required on `%GeneratorPrototype%` and on
 * `%AsyncGeneratorPrototype%`. `'constructor'` points back to
 * `%GeneratorFunction%` or `%AsyncGeneratorFunction%` respectively;
 * `'prototype'` points to `%Generator.prototype%` or
 * `%AsyncGenerator.prototype%`, the iterator-instance or
 * async-iterator-instance prototype holding `next`, `return`, and `throw`.
 * The proto-side check uses {@link getOwnPropertyDescriptorsKeySet}'s
 * membership semantics, so a prototype with extra own keys is admitted as
 * long as both required keys are present.
 *
 * Shared by {@link hasGeneratorFunctionShape} and
 * {@link hasAsyncGeneratorFunctionShape}. Both species exhibit the same
 * proto-side structure, so the proto-surface check is the family-level
 * invariant. The `[[Class]]` tag, carried via each species'
 * identity-signal link, is the per-species discriminator.
 *
 * The `'prototype'`-on-the-proto presence is the structural discriminator
 * from the async family. `%AsyncFunction.prototype%` carries only
 * `'constructor'`, so {@link hasAsyncFunctionPrototypeSurface} asserts
 * `'prototype'` absent while this helper asserts it present.
 *
 * Called only as the last link of both
 * {@link hasGeneratorFunctionShape}'s and
 * {@link hasAsyncGeneratorFunctionShape}'s `&&` chains, so by the time
 * `getPrototypeOf` runs the upstream `[[Class]]` check has already
 * rejected `null` and `undefined`.
 *
 * @param {unknown} value - the value whose `[[Prototype]]` should be inspected
 * @returns {boolean} `true` when both membership conditions hold; `false`
 *  otherwise
 * @internal
 */
export function hasAnyGeneratorFunctionPrototypeSurface(value) {
  const keySet = getOwnPropertyDescriptorsKeySet(getPrototypeOf(value));
  return keySet.has('constructor') && keySet.has('prototype');
}

/**
 * Detects whether a value has the runtime shape of a `%GeneratorFunction%`.
 *
 * The check is structural, not identity-based. It does not require the
 * value to descend from this realm's `%GeneratorFunction%` intrinsic, so
 * it admits generator functions originating in foreign realms.
 *
 * Five realm-independent markers must hold:
 *
 * 1. No `[[Construct]]` internal method.
 * 2. `Symbol.toStringTag` resolves to `'GeneratorFunction'`.
 * 3. The resolved constructor name is `'GeneratorFunction'`.
 * 4. The value's `[[Prototype]]` has an own `'constructor'` key.
 * 5. The value's `[[Prototype]]` has an own `'prototype'` key.
 *
 * The implementation groups these into three `&&` links: the
 * descriptor-presence floor (marker 1, `!hasConstructSlot`), then
 * {@link hasGeneratorFunctionIdentitySignal} (markers 2 and 3), then
 * {@link hasAnyGeneratorFunctionPrototypeSurface} (markers 4 and 5).
 *
 * Markers 1–3 are spec invariants. Markers 4 and 5 are conservative
 * cross-validators that catch single-slot spoofing: a value that overrides
 * the tag without also reshaping its `[[Prototype]]` would slip past the
 * spec-invariant floor, and the proto-side check rejects it. The
 * proto-surface required of `%GeneratorFunction.prototype%` is shared by
 * the generator family; see
 * {@link hasAnyGeneratorFunctionPrototypeSurface}.
 *
 * No `!hasOwnPrototype` or `hasOwnWritablePrototype` self-side check,
 * unlike {@link hasAsyncFunctionShape}. The reason is the bound-vs-unbound
 * asymmetry: unbound generator functions carry an own writable `prototype`
 * holding the {@link Generator} instance proto; bound ones do not, since
 * `bind` strips own slots. Either check would split bound from unbound,
 * but this helper admits both. Bound forms are lenient-by-spec-mechanics:
 * `bind` preserves the prototype-chain, so the tag, constructor-name, and
 * proto-surface remain inherited intact.
 *
 * Returns a plain boolean. Narrowing belongs to {@link isGeneratorFunction}.
 * The signature is standalone by design so that each marker can be tested
 * in isolation. Any value can be passed, and non-callables flow through
 * the marker chain and return `false`.
 *
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when all five markers hold; `false` otherwise
 * @internal
 */
export function hasGeneratorFunctionShape(value) {
  return (
    !hasConstructSlot(value) &&
    hasGeneratorFunctionIdentitySignal(value) &&
    hasAnyGeneratorFunctionPrototypeSurface(value)
  );
}

/**
 * Detects whether a value has the runtime shape of an
 * `%AsyncGeneratorFunction%`.
 *
 * The check is structural, not identity-based. It does not require the
 * value to descend from this realm's `%AsyncGeneratorFunction%` intrinsic,
 * so it admits async-generator functions originating in foreign realms.
 *
 * Five realm-independent markers must hold:
 *
 * 1. No `[[Construct]]` internal method.
 * 2. `Symbol.toStringTag` resolves to `'AsyncGeneratorFunction'`.
 * 3. The resolved constructor name is `'AsyncGeneratorFunction'`.
 * 4. The value's `[[Prototype]]` has an own `'constructor'` key.
 * 5. The value's `[[Prototype]]` has an own `'prototype'` key.
 *
 * The implementation groups these into three `&&` links: the
 * descriptor-presence floor (marker 1, `!hasConstructSlot`), then
 * {@link hasAsyncGeneratorFunctionIdentitySignal} (markers 2 and 3), then
 * {@link hasAnyGeneratorFunctionPrototypeSurface} (markers 4 and 5).
 *
 * Markers 1–3 are spec invariants. Markers 4 and 5 are conservative
 * cross-validators that catch single-slot spoofing. A value that overrides
 * the tag without also reshaping its `[[Prototype]]` would slip past
 * the spec-invariant floor, and the proto-side check rejects it. The
 * proto-surface requirement of `%AsyncGeneratorFunction.prototype%`
 * is shared by the generator family. See: {@link hasAnyGeneratorFunctionPrototypeSurface}.
 * The `[[Class]]` tag is the per-species discriminator within that
 * shared structure.
 *
 * Same self-side-check omission as {@link hasGeneratorFunctionShape}:
 * Both `!hasOwnPrototype` and `hasOwnWritablePrototype` checks are skipped
 * because of the bound-vs-unbound asymmetry. Unbound async-generator
 * functions carry an own writable `prototype`, bound ones do not, and
 * admitting both requires omitting both checks.
 *
 * Returns a plain boolean. Narrowing belongs to
 * {@link isAsyncGeneratorFunction}. The signature is standalone by design
 * so that each marker can be tested in isolation. Any value can be passed,
 * and non-callables flow through the marker chain and return `false`.
 *
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when all five markers hold; `false` otherwise
 * @internal
 */
export function hasAsyncGeneratorFunctionShape(value) {
  return (
    !hasConstructSlot(value) &&
    hasAsyncGeneratorFunctionIdentitySignal(value) &&
    hasAnyGeneratorFunctionPrototypeSurface(value)
  );
}

/**
 * Narrows a value to {@link GeneratorFunction}.
 *
 * Orchestrates three phases:
 *
 * 1. The `isFunction` gate short-circuits for non-callable inputs.
 * 2. The same-realm fast path checks `value instanceof %GeneratorFunction%`,
 *    which walks the `[[Prototype]]` chain. It passes for any value whose
 *    inheritance traces to the local realm's `%GeneratorFunction.prototype%`,
 *    including bound variants — `bind` preserves the chain.
 * 3. The realm-independent fallback delegates to
 *    {@link hasGeneratorFunctionShape}, which verifies the five spec-derived
 *    markers (three spec-invariant plus two proto-side key-set cross-validators).
 *    This is the cross-realm code path. Foreign-realm generator functions have
 *    a different `%GeneratorFunction%` identity but the same observable markers.
 *
 * Admits sync generator function declarations, expressions, concise-method
 * forms, and their bound variants. See the {@link GeneratorFunction} doc
 * for the spec-mechanics rationale for bound-admission.
 *
 * Does not admit async-generator functions, which trace to
 * `%AsyncGeneratorFunction%`. Use {@link isAsyncGeneratorFunction} for
 * that species, or {@link isAnyGeneratorFunction} for the umbrella over
 * both.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & GeneratorFunction`; `T = unknown` collapses to `GeneratorFunction`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a generator function
 * @returns {value is T & GeneratorFunction} `true` when the value is a
 *  sync-generator function, narrowing to `T & GeneratorFunction`;
 *  `false` otherwise
 * @example
 * isGeneratorFunction(function* () {});              // true
 * isGeneratorFunction((function* () {}).bind(null)); // true — bound forms admitted
 * isGeneratorFunction(async function* () {});        // false — async-generator family
 * isGeneratorFunction(async () => {});               // false — async-function family
 */
export function isGeneratorFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof GeneratorFunctionConstructor || hasGeneratorFunctionShape(value))
  );
}

/**
 * Narrows a value to {@link AsyncGeneratorFunction}.
 *
 * Orchestrates three phases:
 *
 * 1. The `isFunction` gate short-circuits for non-callable inputs.
 * 2. The same-realm fast path checks `value instanceof %AsyncGeneratorFunction%`,
 *    which walks the `[[Prototype]]` chain. It passes for any value whose
 *    inheritance traces to the local realm's `%AsyncGeneratorFunction.prototype%`,
 *    including bound variants — `bind` preserves the chain.
 * 3. The realm-independent fallback delegates to
 *    {@link hasAsyncGeneratorFunctionShape}, which verifies the five spec-derived
 *    markers (three spec-invariant plus two proto-side key-set cross-validators).
 *    This is the cross-realm code path. Foreign-realm async-generator functions
 *    have a different `%AsyncGeneratorFunction%` identity but the same
 *    observable markers.
 *
 * Admits `async function*` declarations, expressions, async concise methods,
 * and their bound variants. See the {@link AsyncGeneratorFunction} doc for
 * the spec-mechanics rationale for bound-admission.
 *
 * Does not admit sync generator functions, async functions, or any other
 * family — those trace to different intrinsics.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AsyncGeneratorFunction`; `T = unknown` collapses to
 * `AsyncGeneratorFunction`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an async-generator function
 * @returns {value is T & AsyncGeneratorFunction} `true` when the value is
 *  an async-generator function, narrowing to `T & AsyncGeneratorFunction`;
 *  `false` otherwise
 * @example
 * isAsyncGeneratorFunction(async function* () {});              // true
 * isAsyncGeneratorFunction((async function* () {}).bind(null)); // true
 * isAsyncGeneratorFunction(function* () {});                    // false — sync generator
 * isAsyncGeneratorFunction(async () => {});                     // false — async function
 */
export function isAsyncGeneratorFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof AsyncGeneratorFunctionConstructor ||
      hasAsyncGeneratorFunctionShape(value))
  );
}

/**
 * Narrows a value to {@link AnyGeneratorFunction}, the umbrella over both
 * sync and async generator-function species.
 *
 * Inlines the union of both single-family checks
 * ({@link isGeneratorFunction}, {@link isAsyncGeneratorFunction}) under a
 * shared `isFunction` gate. The gate short-circuits for non-callable inputs.
 * The value then passes if any of four disjuncts holds: the same-realm
 * `instanceof` fast path against either `%GeneratorFunction%` or
 * `%AsyncGeneratorFunction%`, or the cross-realm fallback via
 * {@link hasGeneratorFunctionShape} or {@link hasAsyncGeneratorFunctionShape}.
 *
 * There is no dedicated `hasAnyGeneratorFunctionShape` helper. The
 * umbrella's job is exactly this union of fast paths and shape helpers,
 * and inlining it (rather than composing the orchestrators, which would
 * double-gate) is the codified pattern.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AnyGeneratorFunction`; `T = unknown` collapses to
 * `AnyGeneratorFunction`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a generator function
 * @returns {value is T & AnyGeneratorFunction} `true` when the value is
 *  either a sync or an async generator function (including bound variants),
 *  narrowing to `T & AnyGeneratorFunction`; `false` otherwise
 * @example
 * isAnyGeneratorFunction(function* () {});              // true — sync generator
 * isAnyGeneratorFunction(async function* () {});        // true — async generator
 * isAnyGeneratorFunction((function* () {}).bind(null)); // true — bound forms admitted
 * isAnyGeneratorFunction(async () => {});               // false — async function
 * isAnyGeneratorFunction(function () {});               // false — plain function
 */
export function isAnyGeneratorFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof GeneratorFunctionConstructor ||
      value instanceof AsyncGeneratorFunctionConstructor ||
      hasGeneratorFunctionShape(value) ||
      hasAsyncGeneratorFunctionShape(value))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
