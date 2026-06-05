/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection.
 *
 * The floor predicate {@link isCallable} narrows any value to
 * {@link Callable} via the minimal, realm-independent callability test.
 * Richer function classification — newability, verified Function-interface
 * shape, specific species such as async, generator, or class — builds on
 * top of it.
 */

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
 * @param value - the function whose source should be read
 * @returns the function's source as a trimmed string
 * @internal
 */
export function getFunctionSource(value: Callable): string;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Callable vs. Function-Interface Types and Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The floor of JavaScript callability. Any value for which
 * `typeof value === 'function'` holds satisfies `Callable`.
 *
 * The single guarantee is the `[[Call]]` internal method: invocation is
 * defined on the value. Defined is not the same as returning. A class
 * constructor satisfies `Callable` because it carries `[[Call]]`, but its
 * `[[Call]]` is hardwired to throw `TypeError` via the
 * `[[IsClassConstructor]]` slot, so invoking it never yields a value. The
 * floor promises that `[[Call]]` exists, not that it produces a result.
 *
 * Everything else is unpromised:
 *
 * - No `[[Construct]]`. The value may or may not be newable.
 * - No `call` / `apply` / `bind`. Those may be absent, deleted, or
 *   replaced on the instance.
 * - No particular `this` binding. Lexical vs. dynamic is not modeled at
 *   this layer.
 *
 * `Callable` is the cross-realm-safe floor because `typeof === 'function'`
 * works across realms, unlike `instanceof Function`. Every other function
 * check in this package builds on it. Richer guarantees — newability, a
 * verified `Function.prototype` method set, a specific classification
 * such as generator, async, or class — are the job of stricter types
 * layered above. {@link isCallable} is the guard that narrows an
 * `unknown` to this type.
 *
 * ## Runtime values that satisfy `Callable`
 *
 * - Function declarations and expressions; arrow, async, and async-arrow
 *   functions
 * - Generator and async-generator functions
 * - Object methods and class concise methods
 * - Class constructors
 * - Bound functions (`fn.bind(…)`)
 * - Proxies whose target is callable
 * - Exotic callable host objects
 * - Functions whose `call` / `apply` / `bind` have been deleted or
 *   replaced
 *
 * @template Args - the parameter tuple; defaults to `unknown[]`
 * @template R - the return type; defaults to `unknown`
 *
 * Both type parameters default to `unknown` (never `any`) per the
 * package's typing discipline. `R = unknown` is also the honest floor for
 * the two outcomes that `[[Call]]` can have: an ordinary callable returns
 * a value, a class constructor throws (`never`). `unknown | never`
 * collapses to `unknown`, so the floor already subsumes the throwing case
 * without glossing over it. The distinction surfaces one layer down,
 * where {@link ClassConstructor} refines its `[[Call]]` to `never` and
 * {@link ES3Function} refines its own to a concrete return. The floor
 * stays `unknown` because it is the supertype that abstracts over both.
 * Invoking a bare `Callable` therefore yields `unknown`, forcing the
 * caller to narrow the result before use.
 *
 * @example
 * declare const value: unknown;
 *
 * if (isCallable(value)) {
 *   // `value` is narrowed to `Callable` — safe to invoke.
 *   const result = value(1, 2, 3); // result: unknown
 * }
 */
export interface Callable<Args extends unknown[] = unknown[], R = unknown> {
  /** The sole guarantee — the `[[Call]]` internal method. */
  (...args: Args): R;
}

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
 * through the predicate. The narrow returns `T & Callable`, an intersection
 * that distributes through `T`'s union: non-callable arms collapse to
 * `never` (e.g., `string & Callable = never`), callable arms survive as
 * intersections that retain `T`'s call signature. For the common case
 * `T = unknown`, the intersection reduces to `Callable`, matching the
 * pre-generic behavior.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not callable
 * @returns `true` when `typeof value === 'function'`, narrowing `value` to
 *  `T & Callable`; `false` otherwise
 */
export function isCallable<T = unknown>(value?: T): value is T & Callable;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The union of pure callability and constructibility. A {@link Callable}
 * whose `[[Construct]]` internal method may or may not be present.
 *
 * The `new` signature is marked optional to express that uncertainty
 * structurally. This interface promises nothing about the
 * `Function.prototype` method set.
 *
 * Use this only when an API genuinely accepts both call-only and
 * also-constructor shapes. For stronger guarantees, narrow further to
 * {@link ES3Function}, {@link ClassConstructor}, or {@link NewableFunction}.
 *
 * @template Args - the parameter / constructor-argument tuple
 * @template R - the return type when invoked without `new`
 * @template T - the instance type when invoked with `new`
 */
export interface CallableOrNewable<
  Args extends unknown[] = unknown[],
  R = unknown,
  T = object,
> {
  /** `[[Call]]` — the floor guarantee inherited from {@link Callable}. */
  (...args: Args): R;
  /** `[[Construct]]` — optional; presence is not promised by this type. */
  new?(...args: Args): T;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A {@link Callable} whose own `call`, `apply`, and `bind` are themselves
 * callable. The verified Function-interface shape that survives prototype
 * tampering on those three members.
 *
 * `VerifiedFunction` sits one layer above {@link Callable}. It adds the
 * three `Function.prototype` methods as observed on the instance, each
 * verified to be a function in its own right. This is the narrow target
 * for {@link isFunction}: a value where `.call(…)`, `.apply(…)`, and
 * `.bind(…)` are guaranteed invocable, regardless of whether the
 * originals were shadowed, deleted, or replaced.
 *
 * The verification is observational, not nominal. `VerifiedFunction` does
 * not promise the methods are the `Function.prototype.*` members, only
 * that something callable answers at those names. A strict-identity
 * variant (members `=== Function.prototype.*`) is a separate concern,
 * deliberately not modeled here.
 *
 * @template ThisType - the dynamic `this` context
 * @template Args - the parameter tuple
 * @template R - the return type
 */
export interface VerifiedFunction<
  ThisType = unknown,
  Args extends unknown[] = unknown[],
  R = unknown,
> {
  /** `[[Call]]` — the floor guarantee inherited from {@link Callable}. */
  (this: ThisType, ...args: Args): R;
  /** Verified callable — invoke with an explicit `this`. */
  call: (thisArg: ThisType, ...args: Args) => R;
  /** Verified callable — invoke with an explicit `this` and an arguments-array. */
  apply: (thisArg: ThisType, args: Args) => R;
  /** Verified callable — produce a bound function with a fixed `this`. */
  bind: (thisArg: ThisType, ...args: unknown[]) => VerifiedFunction<ThisType, Args, R>;
  readonly name: string;
  readonly length: number;
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
 * carries a more specific function shape (e.g., `(this: O) => R`) keep
 * that shape post-narrow rather than collapsing to bare `VerifiedFunction`.
 * Non-callable arms of `T` collapse to `never` under the intersection;
 * `T = unknown` reduces to `VerifiedFunction`, matching the pre-generic
 * behavior.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not callable
 * @returns `true` when `value` is callable and exposes callable `call`,
 *  `apply`, and `bind`, narrowing to `T & VerifiedFunction`; `false`
 *  otherwise
 */
export function isFunction<T = unknown>(value?: T): value is T & VerifiedFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Newable Function Types and Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An ES3-style function. The classic `function` declaration or expression
 * that is both callable and newable.
 *
 * Unlike a class, an `ES3Function` may be invoked with or without `new`.
 * The structural tell that separates it from {@link ClassConstructor} is
 * a **writable** `prototype`
 * (`Object.getOwnPropertyDescriptor(fn, 'prototype').writable === true`).
 * TypeScript types a plain `function` declaration as call-only, so this
 * handwritten shape is what asserts the construct signature ES3 functions
 * carry at runtime.
 *
 * Bound ES3 functions are deliberately excluded. Binding strips the
 * function's own `prototype` slot, which removes the writable-prototype
 * tell entirely, so the value is no longer an ES3 shape. It remains
 * newable and still passes {@link isNewableFunction}, but it has become a
 * third species — a bound-newable — that this package does not name as
 * its own type. The matching guard {@link isES3Function} reflects this by
 * rejecting bound variants via the `hasOwnWritablePrototype` check.
 *
 * @template ThisType - the dynamic `this` context, resolved at the call site
 * @template Args - the parameter / constructor-argument tuple
 * @template R - the return type when called without `new`
 * @template T - the instance type when called with `new`
 */
export interface ES3Function<
  ThisType = unknown,
  Args extends unknown[] = unknown[],
  R = unknown,
  T = object,
> {
  /** Call signature — dynamic `this` binding. */
  (this: ThisType, ...args: Args): R;
  /** Construct signature — `this` is the new instance. */
  new (...args: Args): T;
  /** Mutable prototype — the structural tell vs. {@link ClassConstructor}. */
  prototype: T;
  /** The function's `name`. */
  readonly name: string;
  /** The number of declared formal parameters. */
  readonly length: number;
  /** Invoke with an explicit `this`. */
  call(thisArg: ThisType, ...args: Args): R;
  /** Invoke with an explicit `this` and an arguments-array. */
  apply(thisArg: ThisType, args: Args): R;
  /** Produce a bound function with a fixed `this`. */
  bind(thisArg: ThisType, ...args: unknown[]): ES3Function<ThisType, Args, R, T>;
}

/**
 * A class constructor. Produced by `class` declarations and expressions,
 * or by any built-in constructor whose `prototype` slot is read-only.
 *
 * A `ClassConstructor` is `typeof === 'function'`, so it carries `[[Call]]`
 * and {@link isCallable} accepts it. But it must be invoked with `new`.
 * Calling it without `new` throws `TypeError` via the
 * `[[IsClassConstructor]]` slot, so the call signature returns `never`.
 * The structural tell that separates it from {@link ES3Function} is a
 * **readonly** `prototype`
 * (`Object.getOwnPropertyDescriptor(cls, 'prototype').writable === false`).
 *
 * Bound class constructors are deliberately excluded. Once bound, the
 * result has lost its own `prototype` slot entirely, so the structural
 * tell of a class is gone and the value is no longer a class shape. It
 * remains newable (still passes {@link isNewableFunction}, since
 * `[[Construct]]` survives `bind`), but it has become a third species —
 * a bound-newable. The matching guard {@link isClass} reflects this by
 * rejecting bound variants on the descriptor check.
 *
 * @template Args - the constructor-argument tuple
 * @template T - the instance type the constructor produces
 */
export interface ClassConstructor<Args extends unknown[] = unknown[], T = object> {
  /** `[[Call]]` is present (typeof === 'function'), but invoking without `new` throws. */
  (...args: Args): never;
  /** Construct signature — the only non-throwing invocation. */
  new (...args: Args): T;
  /** Readonly prototype — the structural tell vs. {@link ES3Function}. */
  readonly prototype: T;
  /** The class's `name`. */
  readonly name: string;
  /** The number of declared constructor parameters. */
  readonly length: number;
  /** Present, but invoking it throws — a class cannot be called as a function. */
  call(thisArg: unknown, ...args: Args): never;
  /** Present, but invoking it throws. */
  apply(thisArg: unknown, args: Args): never;
  /** Returns a bound constructor; the bound function still requires `new`. */
  bind(thisArg: unknown, ...args: unknown[]): ClassConstructor<Args, T>;
}

/**
 * The lenient newable gate. Any value with the internal `[[Construct]]`
 * method reachable via a `Proxy` `construct` trap (see
 * {@link hasConstructSlot}).
 *
 * Deliberately permissive. Admits the three species of newable value
 * JavaScript supports:
 *
 * - {@link ES3Function}
 * - {@link ClassConstructor}
 * - Bound newables, the result of `someClassOrES3.bind(…)`, which
 *   preserves `[[Construct]]` but loses its own `prototype`.
 *
 * Because bound newables lack their own `prototype`, this interface makes
 * no `prototype` guarantee. To reach a `prototype` — and to tell the two
 * non-bound species apart — narrow further to {@link ES3Function} (own
 * writable `prototype`) or {@link ClassConstructor} (own readonly
 * `prototype`). Both of those guards reject bound variants on exactly that
 * ground. A bound class is no longer a class shape; a bound ES3 function
 * is no longer an ES3 shape; both remain newable but become a third
 * species, a bound-newable, that this package does not name as its own
 * type. The introspection layer can name it explicitly, but `is-bound`
 * detection carries real caveats: the only spec-reliable tell is
 * `[[BoundTargetFunction]]`, which is not observable, and every visible
 * fingerprint is spoofable.
 *
 * `NewableFunction` is deliberately a lenient base interface, not the
 * union `ES3Function | ClassConstructor`. The union would overpromise:
 * both branches carry a `prototype` that bound variants do not, so it
 * would be the wrong narrow target. TypeScript cannot infer
 * `[[Construct]]` for a plain `function` either (it types them call-only);
 * the runtime guard {@link isNewableFunction} asserts what the compiler
 * cannot derive. Arrow functions, methods, async, and generator functions
 * are not newable — they lack `[[Construct]]` in both the type system and
 * the runtime.
 *
 * @template Args - the constructor-argument tuple
 * @template T - the instance type produced by `new`
 */
export interface NewableFunction<Args extends unknown[] = unknown[], T = object> {
  /** `[[Call]]` is present (typeof === 'function'); the result type is unknown at this level. */
  (...args: Args): unknown;
  /** `[[Construct]]` — invocable with `new`. */
  new (...args: Args): T;
  /** Invoke with an explicit `this`. */
  call(thisArg: unknown, ...args: Args): unknown;
  /** Invoke with an explicit `this` and an arguments-array. */
  apply(thisArg: unknown, args: Args): unknown;
  /** Produce a bound newable with a fixed `this`. */
  bind(thisArg: unknown, ...args: unknown[]): NewableFunction<Args, T>;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Probes the value's `[[Construct]]` internal method without invoking the
 * value itself.
 *
 * Builds a `Proxy` whose `construct` trap returns an empty object, then
 * attempts `new proxy(…)`. If `[[Construct]]` is reachable on the proxy's
 * target, the construction succeeds and the function returns `true`.
 * Otherwise the `new` throws and the function returns `false`.
 *
 * The MDN-cited invariant — "the target used to initialize the proxy must
 * itself be a valid constructor" — is what makes this a reliable lenient
 * gate. The proxy can supply a `construct` trap, but the trap only fires
 * if the target has `[[Construct]]` to begin with. Bound newables count,
 * since they preserve `[[Construct]]`. Arrow functions, methods, async
 * functions, and generator functions do not.
 *
 * @param value - the value to probe; omitted is treated as `undefined`, which
 *  carries no `[[Construct]]`
 * @returns `true` when the value carries `[[Construct]]`; `false` otherwise
 */
export function hasConstructSlot(value?: unknown): boolean;

/**
 * Narrows a value to the lenient {@link NewableFunction} gate.
 *
 * Composes {@link isFunction} (the four-method callability check) with
 * {@link hasConstructSlot} (the `[[Construct]]` probe). The result admits
 * all three newable species: {@link ES3Function}, {@link ClassConstructor},
 * and bound newables.
 *
 * Generic in `T` per the family pattern set by {@link isCallable} and
 * {@link isFunction}. The narrow returns `T & NewableFunction`, preserving
 * caller-side narrowing; `T = unknown` collapses to `NewableFunction`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not callable
 * @returns `true` when the value is callable, exposes callable `call`,
 *  `apply`, and `bind`, and carries `[[Construct]]`, narrowing to
 *  `T & NewableFunction`; `false` otherwise
 */
export function isNewableFunction<T = unknown>(value?: T): value is T & NewableFunction;

/**
 * Narrows a value to {@link ES3Function}, the strict ES3-function shape.
 *
 * Builds on {@link isNewableFunction} and adds the structural tell: an
 * own `prototype` descriptor whose `writable` is `true`, verified through
 * `hasOwnWritablePrototype`.
 *
 * Bound ES3 functions are deliberately rejected. They remain newable but
 * have lost their own `prototype` slot, so what remains is no longer an
 * ES3 shape. The {@link NewableFunction} gate still admits them; this
 * guard does not.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & ES3Function`; `T = unknown` collapses to `ES3Function`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is an ES3-shaped newable, narrowing to
 *  `T & ES3Function`; `false` otherwise
 */
export function isES3Function<T = unknown>(value?: T): value is T & ES3Function;

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
 * Bound class constructors are deliberately rejected. They remain newable
 * but have lost their own `prototype` slot, so what remains is no longer
 * a class shape. The {@link NewableFunction} gate still admits them; this
 * guard does not.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & ClassConstructor`; `T = unknown` collapses to `ClassConstructor`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is a class-shaped newable (built-in or
 *  `class`-syntax), narrowing to `T & ClassConstructor`; `false` otherwise
 */
export function isClass<T = unknown>(value?: T): value is T & ClassConstructor;

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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & ClassConstructor`; `T = unknown` collapses to `ClassConstructor`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is a custom-class constructor, narrowing to
 *  `T & ClassConstructor`; `false` otherwise
 */
export function isCustomClass<T = unknown>(value?: T): value is T & ClassConstructor;

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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & ClassConstructor`; `T = unknown` collapses to `ClassConstructor`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is a built-in class constructor, narrowing
 *  to `T & ClassConstructor`; `false` otherwise
 */
export function isBuiltInClass<T = unknown>(value?: T): value is T & ClassConstructor;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Async Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `%AsyncFunction%` intrinsic. Any callable whose `[[Prototype]]`
 * traces to `%AsyncFunction.prototype%`.
 *
 * Admits every callable produced by async syntax, regardless of the
 * source-form:
 *
 * - `async function name() { … }` (async function declaration)
 * - `async function() { … }` (async function expression)
 * - `async () => …` (async arrow function)
 * - `{ async method() { … } }` (async concise method)
 *
 * Plus the bound variant of each. These four source-forms are structurally
 * identical at the runtime level: the same `Symbol.toStringTag`, no own
 * `prototype`, no `[[Construct]]`. The distinctions between them — dynamic
 * vs. lexical `this`, source layout — are visible only via source
 * inspection through `Function.prototype.toString`, which is
 * characterization-quality data. The source-regex predicates that
 * discriminate the four therefore live in
 * `@species-js/function-introspection`, not in this package.
 *
 * Bound async functions are admitted, which is an honest consequence of
 * spec mechanics rather than an oversight. `bind` sets the bound
 * function's `[[Prototype]]` to the target's `[[Prototype]]`
 * (`%AsyncFunction.prototype%` in the async case), so the bound function
 * inherits `Symbol.toStringTag` and resolves the same constructor name via
 * the prototype walk. This is asymmetric with {@link ClassConstructor} and
 * {@link ES3Function}, whose bound variants are rejected, but the
 * asymmetry is forced by where each family puts its discriminator. The
 * newable side's tells (own-prototype descriptors) are stripped by `bind`;
 * the async side's tells (prototype-chain tag and constructor) are
 * preserved by it. Without source inspection there is no structural way to
 * tell a bound async function from a non-bound one, and source inspection
 * is introspection's job, not type-detection's.
 *
 * Async-generator functions are NOT in this family, despite the shared
 * "Async" prefix. `async function* () { … }` is a generator function: it
 * synchronously returns an `AsyncGenerator` instance whose `.next()`
 * yields promises. It has its own `Symbol.toStringTag`
 * (`'AsyncGeneratorFunction'`), an own writable `prototype`, and traces to
 * the `%AsyncGeneratorFunction%` intrinsic — none of which is true of
 * `%AsyncFunction%`. Async-generator functions are kin to sync generator
 * functions, not to this predicate; the "Async" in their name describes
 * what their iterator yields, not the function itself.
 *
 * @template ThisType - the `this` context at the call site (dynamic for
 *  the non-arrow forms; ignored at runtime for arrow forms — the type
 *  cannot distinguish them, since the discrimination is source-based)
 * @template Args - the parameter tuple
 * @template R - the resolved Promise value type
 */
export interface AsyncFunction<
  ThisType = unknown,
  Args extends unknown[] = unknown[],
  R = unknown,
> {
  /** `[[Call]]` — returns a `Promise` resolving to `R`. */
  (this: ThisType, ...args: Args): Promise<R>;
  /** Async functions do not have own `prototype`. */
  readonly prototype: undefined;
  /** The function's `name`. */
  readonly name: string;
  /** The number of declared formal parameters. */
  readonly length: number;
  /** Invoke with an explicit `this`. */
  call(thisArg: ThisType, ...args: Args): Promise<R>;
  /** Invoke with an explicit `this` and an arguments-array. */
  apply(thisArg: ThisType, args: Args): Promise<R>;
  /** Produce a bound async function with a fixed `this`. */
  bind(thisArg: ThisType, ...args: unknown[]): AsyncFunction<ThisType, Args, R>;
}

/**
 * Tests the two identity-signal labels an `%AsyncFunction%` value carries.
 *
 * `Symbol.toStringTag`, read via the cached
 * `Object.prototype.toString.call`, must resolve to
 * `'[object AsyncFunction]'`, and the resolved constructor name must
 * equal `'AsyncFunction'`. Both labels are spec-invariant across realms
 * and survive `bind`, since the relevant prototype chain is preserved.
 * The pair is the realm-independent _"tells-what-it-is"_ for any genuine
 * `%AsyncFunction%`, so tampering with one label without matching the
 * other is rejected.
 *
 * Called as the third link of {@link hasAsyncFunctionShape}'s `&&` chain,
 * after the descriptor-presence floor (`!hasOwnPrototype`,
 * `!hasConstructSlot`) and before the proto-side membership check
 * ({@link hasAsyncFunctionPrototypeSurface}).
 *
 * @param value - the value whose identity-labels should be read
 * @returns `true` when both labels match; `false` otherwise
 * @internal
 */
export function hasAsyncFunctionIdentitySignal(value: unknown): boolean;

/**
 * Tests whether the value's `[[Prototype]]` matches the own-key structure
 * of `%AsyncFunction.prototype%`: `'constructor'` present and `'prototype'`
 * absent.
 *
 * The proto-side check uses set-membership semantics, so a prototype with
 * extra own keys is admitted as long as both conditions hold. The spec
 * promises which keys `%AsyncFunction.prototype%` exhibits, not that
 * those are the only keys.
 *
 * Called only as the last link of {@link hasAsyncFunctionShape}'s `&&`
 * chain, so by the time `getPrototypeOf` runs the upstream `[[Class]]`
 * check has already rejected `null` and `undefined`.
 *
 * @param value - the value whose `[[Prototype]]` should be inspected
 * @returns `true` when both membership conditions hold; `false` otherwise
 * @internal
 */
export function hasAsyncFunctionPrototypeSurface(value: unknown): boolean;

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
 * Markers 1–4 are spec invariants. Markers 5 and 6 are conservative
 * cross-validators that catch single-slot spoofing. A value that spoofs
 * `Symbol.toStringTag` but leaves its `[[Prototype]]` unmodified would slip
 * past the spec-invariant floor; the proto-side check rejects it.
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
 * each marker can be tested in isolation; any value can be passed, and
 * non-callables flow through the marker chain and return `false`.
 *
 * @param value - the value to inspect
 * @returns `true` when all six markers hold
 * @internal
 */
export function hasAsyncFunctionShape(value?: unknown): boolean;

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
 * `Symbol.toStringTag`, and an own writable `prototype`. They are not
 * a near-variant of `AsyncFunction`. The shared "Async" prefix in their
 * name describes what their iterator yields, not the function. See the
 * generator predicates for that family.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AsyncFunction`; `T = unknown` collapses to `AsyncFunction`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an async function
 * @returns `true` when the value is an async function in the species-js
 *  taxonomy, narrowing to `T & AsyncFunction`; `false` otherwise
 * @example
 * declare const value: unknown;
 *
 * if (isAsyncFunction(value)) {
 *   const result = value(); // result: Promise<unknown>
 *   result.then((resolved) => { ... });
 * }
 */
export function isAsyncFunction<T = unknown>(value?: T): value is T & AsyncFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generator Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `Generator` instance. The object a sync generator function
 * (`function*`) returns when invoked.
 *
 * Re-modeled in species-js rather than extending `globalThis.Generator`,
 * so the Tier-S contract is owned by this package and consumers' lib
 * config does not affect shape stability. Lib dependencies are minimal:
 * `IteratorResult` and `Symbol.iterator`, both ES2015 spec primitives.
 *
 * @template T - the yielded value type
 * @template TReturn - the value the generator returns when complete
 * @template TNext - the value sent to `.next(value)`
 */
export interface Generator<T = unknown, TReturn = unknown, TNext = unknown> {
  /** Advance the generator; returns `{ value, done }` synchronously. */
  next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
  /** Force completion with the given return value. */
  return(value: TReturn): IteratorResult<T, TReturn>;
  /** Inject an exception at the current yield point. */
  throw(e: unknown): IteratorResult<T, TReturn>;
  /** Iterator protocol — a generator is its own iterator. */
  [Symbol.iterator](): Generator<T, TReturn, TNext>;
  /** Spec-mandated tag — `'[object Generator]'`. */
  readonly [Symbol.toStringTag]: 'Generator';
}

/**
 * The `AsyncGenerator` instance. The object an async generator function
 * (`async function*`) returns when invoked.
 *
 * Re-modeled in species-js rather than extending `globalThis.AsyncGenerator`.
 * Lib dependencies are minimal: `IteratorResult`, `Promise`, `PromiseLike`,
 * and `Symbol.asyncIterator`, all ES2015 or ES2018 spec primitives.
 *
 * @template T - the yielded value type
 * @template TReturn - the value the generator returns when complete
 * @template TNext - the value sent to `.next(value)`
 */
export interface AsyncGenerator<T = unknown, TReturn = unknown, TNext = unknown> {
  /** Advance the generator; returns a Promise resolving to `{ value, done }`. */
  next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
  /** Force completion with the given return value (Promise-resolved). */
  return(value: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
  /** Inject an exception at the current yield point (Promise-resolved). */
  throw(e: unknown): Promise<IteratorResult<T, TReturn>>;
  /** Async-iterator protocol — an async-generator is its own async-iterator. */
  [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext>;
  /** Spec-mandated tag — `'[object AsyncGenerator]'`. */
  readonly [Symbol.toStringTag]: 'AsyncGenerator';
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `%GeneratorFunction%` intrinsic. Any callable whose `[[Prototype]]`
 * traces to `%GeneratorFunction.prototype%`.
 *
 * Synchronously returns a {@link Generator} when invoked; the generator's
 * `.next()` yields values synchronously. The function itself is fully
 * synchronous — there is no Promise at the call site.
 *
 * Admits `function* name() {}` (declaration), `function*() {}` (expression),
 * concise generator methods (`{ *m() {} }.m`, class generator methods),
 * and their bound variants. `bind` preserves the prototype chain, so the
 * tag and constructor-name resolution survive on bound forms.
 *
 * Structurally: an own writable `prototype` carrying a {@link Generator}
 * instance shape, `Symbol.toStringTag === 'GeneratorFunction'`, and no
 * `[[Construct]]` (generator functions are not newable per spec).
 *
 * The sibling intrinsic is {@link AsyncGeneratorFunction}, which returns
 * {@link AsyncGenerator}. The two share structural traits and call
 * mechanics but trace to distinct intrinsics. Do not confuse
 * `%AsyncGeneratorFunction%` with {@link AsyncFunction}. The "Async"
 * prefix on `AsyncGeneratorFunction` describes the iterator's yield
 * behavior (`.next()` returns promises), not the function itself. The
 * function's return is synchronous: an `AsyncGenerator` object handed
 * back immediately. See {@link AsyncGeneratorFunction}'s doc for the
 * explicit disambiguation.
 *
 * @template ThisType - the `this` context at the call site (dynamic)
 * @template Args - the parameter tuple
 * @template T - the yielded value type
 * @template TReturn - the value the generator returns when complete
 * @template TNext - the value sent to the generator's `.next(value)`
 */
export interface GeneratorFunction<
  ThisType = unknown,
  Args extends unknown[] = unknown[],
  T = unknown,
  TReturn = unknown,
  TNext = unknown,
> {
  /** `[[Call]]` — synchronously returns a {@link Generator} instance. */
  (this: ThisType, ...args: Args): Generator<T, TReturn, TNext>;
  /** Own writable prototype — the generator-instance prototype. */
  prototype: Generator<T, TReturn, TNext>;
  /** The function's `name`. */
  readonly name: string;
  /** The number of declared formal parameters. */
  readonly length: number;
  /** Invoke with an explicit `this`. */
  call(thisArg: ThisType, ...args: Args): Generator<T, TReturn, TNext>;
  /** Invoke with an explicit `this` and an arguments-array. */
  apply(thisArg: ThisType, args: Args): Generator<T, TReturn, TNext>;
  /** Produce a bound generator function with a fixed `this`. */
  bind(
    thisArg: ThisType,
    ...args: unknown[]
  ): GeneratorFunction<ThisType, Args, T, TReturn, TNext>;
}

/**
 * The `%AsyncGeneratorFunction%` intrinsic. Any callable whose
 * `[[Prototype]]` traces to `%AsyncGeneratorFunction.prototype%`.
 *
 * Synchronously returns an {@link AsyncGenerator} when invoked; the
 * generator's `.next()` returns `Promise<IteratorResult>`.
 *
 * Kin to {@link GeneratorFunction}, NOT to {@link AsyncFunction}, despite
 * the shared "Async" prefix. The function's return is synchronous: an
 * `AsyncGenerator` object handed back immediately at the call site. Only
 * the iterator's per-step yield is async — `.next()` returns a Promise.
 * `%AsyncFunction%` instead returns a Promise directly from the call site
 * and is unrelated structurally: a different intrinsic, no own prototype,
 * a different `Symbol.toStringTag`.
 *
 * Admits `async function* name() {}` (declaration), `async function*() {}`
 * (expression), concise async-generator methods, and their bound variants.
 * `bind` preserves the prototype chain.
 *
 * Structurally: an own writable `prototype` carrying an {@link AsyncGenerator}
 * instance shape, `Symbol.toStringTag === 'AsyncGeneratorFunction'`, and
 * no `[[Construct]]`.
 *
 * @template ThisType - the `this` context at the call site (dynamic)
 * @template Args - the parameter tuple
 * @template T - the yielded value type
 * @template TReturn - the value the generator returns when complete
 * @template TNext - the value sent to the generator's `.next(value)`
 */
export interface AsyncGeneratorFunction<
  ThisType = unknown,
  Args extends unknown[] = unknown[],
  T = unknown,
  TReturn = unknown,
  TNext = unknown,
> {
  /** `[[Call]]` — synchronously returns an {@link AsyncGenerator} instance. */
  (this: ThisType, ...args: Args): AsyncGenerator<T, TReturn, TNext>;
  /** Own writable prototype — the async-generator-instance prototype. */
  prototype: AsyncGenerator<T, TReturn, TNext>;
  /** The function's `name`. */
  readonly name: string;
  /** The number of declared formal parameters. */
  readonly length: number;
  /** Invoke with an explicit `this`. */
  call(thisArg: ThisType, ...args: Args): AsyncGenerator<T, TReturn, TNext>;
  /** Invoke with an explicit `this` and an arguments-array. */
  apply(thisArg: ThisType, args: Args): AsyncGenerator<T, TReturn, TNext>;
  /** Produce a bound async-generator function with a fixed `this`. */
  bind(
    thisArg: ThisType,
    ...args: unknown[]
  ): AsyncGeneratorFunction<ThisType, Args, T, TReturn, TNext>;
}

/**
 * The umbrella of both generator-function species:
 * {@link GeneratorFunction} | {@link AsyncGeneratorFunction}.
 *
 * They share structural traits — an own writable `prototype`, no
 * `[[Construct]]`, and a callable surface — but trace to distinct
 * intrinsics. {@link isAnyGeneratorFunction} narrows to this type. Use
 * the strict refinements {@link isGeneratorFunction} or
 * {@link isAsyncGeneratorFunction} when finer discrimination is needed.
 */
export type AnyGeneratorFunction = GeneratorFunction | AsyncGeneratorFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Tests the two identity-signal labels a `%GeneratorFunction%` value carries.
 *
 * `Symbol.toStringTag` must resolve to `'[object GeneratorFunction]'`, and
 * the resolved constructor name must equal `'GeneratorFunction'`. Both
 * labels are spec-invariant across realms and survive `bind`, since the
 * relevant prototype chain is preserved. The pair is the realm-independent
 * _"tells-what-it-is"_ for any genuine `%GeneratorFunction%`.
 *
 * Mirrors the async-family pattern; see
 * {@link hasAsyncFunctionIdentitySignal}. Called as the second link of
 * {@link hasGeneratorFunctionShape}'s `&&` chain, after `!hasConstructSlot`
 * and before {@link hasAnyGeneratorFunctionPrototypeSurface}.
 *
 * @param value - the value whose identity-labels should be read
 * @returns `true` when both labels match; `false` otherwise
 * @internal
 */
export function hasGeneratorFunctionIdentitySignal(value: unknown): boolean;

/**
 * Tests the two identity-signal labels an `%AsyncGeneratorFunction%` value
 * carries.
 *
 * `Symbol.toStringTag` must resolve to `'[object AsyncGeneratorFunction]'`,
 * and the resolved constructor name must equal `'AsyncGeneratorFunction'`.
 * Both labels are spec-invariant across realms and survive `bind`, since
 * the relevant prototype chain is preserved. The pair is the
 * realm-independent _"tells-what-it-is"_ for any genuine
 * `%AsyncGeneratorFunction%`.
 *
 * Mirrors {@link hasGeneratorFunctionIdentitySignal}. Called as the second
 * link of {@link hasAsyncGeneratorFunctionShape}'s `&&` chain, after
 * `!hasConstructSlot` and before
 * {@link hasAnyGeneratorFunctionPrototypeSurface}.
 *
 * @param value - the value whose identity-labels should be read
 * @returns `true` when both labels match; `false` otherwise
 * @internal
 */
export function hasAsyncGeneratorFunctionIdentitySignal(value: unknown): boolean;

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
 * The proto-side check uses set-membership semantics, so a prototype with
 * extra own keys is admitted as long as both required keys are present.
 *
 * Shared by {@link hasGeneratorFunctionShape} and
 * {@link hasAsyncGeneratorFunctionShape}. Both species exhibit the same
 * proto-side structure, so the proto-surface check is the family-level
 * invariant. The `[[Class]]` tag, carried via each species' identity-signal
 * link, is the per-species discriminator.
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
 * @param value - the value whose `[[Prototype]]` should be inspected
 * @returns `true` when both membership conditions hold; `false` otherwise
 * @internal
 */
export function hasAnyGeneratorFunctionPrototypeSurface(value: unknown): boolean;

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
 * Markers 1–3 are spec invariants. Markers 4 and 5 are conservative
 * cross-validators that catch single-slot spoofing: a value that overrides
 * the tag without also reshaping its `[[Prototype]]` would slip past the
 * spec-invariant floor, and the proto-side check rejects it. The
 * proto-side check uses set membership, so a prototype with extra own
 * keys is admitted as long as both `'constructor'` and `'prototype'` are
 * present.
 *
 * No prototype-slot check on the value itself. Unlike
 * {@link hasAsyncFunctionShape}, this helper does not include
 * `!hasOwnPrototype` or `hasOwnWritablePrototype`. The reason is the
 * bound-vs-unbound asymmetry: unbound generator functions carry an own
 * writable `prototype` holding the {@link Generator} instance proto;
 * bound ones do not, since `bind` strips own slots. Either check would
 * split bound from unbound, but this helper admits both. Bound forms are
 * lenient-by-spec-mechanics: `bind` preserves the prototype chain, so the
 * tag, constructor-name, and proto-surface remain inherited intact.
 *
 * Returns a plain boolean. Narrowing belongs to {@link isGeneratorFunction}.
 * The signature is independent of {@link isFunction} and accepts any
 * value; non-callables flow through the marker chain and return `false`.
 *
 * @param value - the value to inspect
 * @returns `true` when all five markers hold
 * @internal
 */
export function hasGeneratorFunctionShape(value?: unknown): boolean;

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
 * Markers 1–3 are spec invariants. Markers 4 and 5 are conservative
 * cross-validators against single-slot spoofing. The proto-surface rule is
 * identical to {@link hasGeneratorFunctionShape} — the generator and
 * async-generator families share this proto-side structure, and the
 * `[[Class]]` tag is the family discriminator.
 *
 * The no-prototype-slot-check rationale is the same as
 * {@link hasGeneratorFunctionShape}: unbound async-generator functions
 * carry an own writable `prototype`, bound ones do not, and admitting
 * both requires omitting that check.
 *
 * Returns a plain boolean. Narrowing belongs to
 * {@link isAsyncGeneratorFunction}.
 *
 * @param value - the value to inspect
 * @returns `true` when all five markers hold
 * @internal
 */
export function hasAsyncGeneratorFunctionShape(value?: unknown): boolean;

/**
 * Narrows a value to {@link GeneratorFunction}.
 *
 * Orchestrates three phases: the `isFunction` gate, the same-realm
 * `instanceof` fast path against the captured `%GeneratorFunction%`
 * intrinsic, and the cross-realm fallback via
 * {@link hasGeneratorFunctionShape}.
 *
 * Admits sync generator function declarations, expressions, concise-method
 * forms, and their bound variants.
 *
 * Does not admit async-generator functions, which trace to
 * `%AsyncGeneratorFunction%`. Use {@link isAsyncGeneratorFunction} for
 * that species, or {@link isAnyGeneratorFunction} for the umbrella over
 * both.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & GeneratorFunction`; `T = unknown` collapses to `GeneratorFunction`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a generator function
 * @returns `true` when the value is a sync-generator function, narrowing to
 *  `T & GeneratorFunction`; `false` otherwise
 * @example
 * declare const value: unknown;
 *
 * if (isGeneratorFunction(value)) {
 *   const gen = value(); // gen: Generator<unknown, unknown, unknown>
 *   for (const item of gen) { ... }
 * }
 */
export function isGeneratorFunction<T = unknown>(
  value?: T,
): value is T & GeneratorFunction;

/**
 * Narrows a value to {@link AsyncGeneratorFunction}.
 *
 * Orchestrates three phases: the `isFunction` gate, the same-realm
 * `instanceof` fast path against the captured `%AsyncGeneratorFunction%`
 * intrinsic, and the cross-realm fallback via
 * {@link hasAsyncGeneratorFunctionShape}.
 *
 * Admits `async function*` declarations, expressions, async concise
 * methods, and their bound variants. Does not admit sync generator
 * functions, async functions, or any other family — those trace to
 * different intrinsics.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AsyncGeneratorFunction`; `T = unknown` collapses to
 * `AsyncGeneratorFunction`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an async-generator function
 * @returns `true` when the value is an async-generator function, narrowing
 *  to `T & AsyncGeneratorFunction`; `false` otherwise
 * @example
 * declare const value: unknown;
 *
 * if (isAsyncGeneratorFunction(value)) {
 *   const gen = value(); // gen: AsyncGenerator<unknown, unknown, unknown>
 *   for await (const item of gen) { ... }
 * }
 */
export function isAsyncGeneratorFunction<T = unknown>(
  value?: T,
): value is T & AsyncGeneratorFunction;

/**
 * Narrows a value to {@link AnyGeneratorFunction}, the umbrella over both
 * sync and async generator-function species.
 *
 * Composes {@link isGeneratorFunction} and {@link isAsyncGeneratorFunction}:
 * passes if either fast path or either shape helper succeeds. There is no
 * dedicated `hasAnyGeneratorFunctionShape` helper. The umbrella's job is
 * exactly the union, and composing the two single-family helpers is the
 * codified pattern.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AnyGeneratorFunction`; `T = unknown` collapses to
 * `AnyGeneratorFunction`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a generator function
 * @returns `true` when the value is either a sync or an async generator
 *  function (including bound variants), narrowing to
 *  `T & AnyGeneratorFunction`; `false` otherwise
 * @example
 * declare const value: unknown;
 *
 * if (isAnyGeneratorFunction(value)) {
 *   // value: GeneratorFunction | AsyncGeneratorFunction — narrow further
 *   // with isGeneratorFunction or isAsyncGeneratorFunction before calling,
 *   // since the call-result types differ (Generator vs. AsyncGenerator).
 * }
 */
export function isAnyGeneratorFunction<T = unknown>(
  value?: T,
): value is T & AnyGeneratorFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
