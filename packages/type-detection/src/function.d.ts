/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection. The floor predicate {@link isCallable}
 * narrows any value to {@link Callable} via the minimal, realm-independent
 * callability test; richer function classification builds on top of it.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Callable vs. Function Interface Types
//
//  These types distinguish between the minimal `typeof === 'function'` check
//  and progressively stricter verification of the Function interface.
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The floor of JavaScript callability: any value for which
 * `typeof value === 'function'` holds.
 *
 * A `Callable` is guaranteed exactly one thing — it has the internal
 * `[[Call]]` method, so invocation is *defined* on it. Defined is not the
 * same as *returning*: a class constructor is a `Callable` whose `[[Call]]`
 * is hardwired to throw (`[[IsClassConstructor]]` → `TypeError`), so invoking
 * it never yields a value. The floor promises that `[[Call]]` exists, not that
 * it returns. It promises **nothing** else:
 * - no `[[Construct]]` — it may or may not be newable;
 * - no `call` / `apply` / `bind` — those may be absent, deleted, or replaced;
 * - no particular `this` binding — lexical vs. dynamic is not expressed here.
 *
 * Because `typeof === 'function'` is realm-independent — unlike
 * `instanceof Function`, which breaks across realms — `Callable` is the
 * foundation every cross-realm function check in this package builds on.
 * It is deliberately the *minimal* type; richer guarantees (newability, a
 * verified `Function.prototype` method set, a specific classification such
 * as generator/async/class) are the job of stricter types layered above it.
 * {@link isCallable} is the guard that narrows an `unknown` to this type.
 *
 * ## Runtime values that satisfy `Callable`
 * - Function declarations and expressions; arrow, async, and async-arrow functions
 * - Generator and async-generator functions
 * - Object methods and class (concise) methods
 * - Class constructors
 * - Bound functions (`fn.bind(…)`)
 * - Proxies whose target is callable
 * - Exotic callable host objects (rare)
 * - Functions whose `call` / `apply` / `bind` have been deleted or reassigned
 *
 * @template Args - the parameter tuple; defaults to `unknown[]`
 * @template R - the return type; defaults to `unknown`
 *
 * Both type parameters default to `unknown` (never `any`) per the package's
 * typing discipline. `R = unknown` is also the *honest* floor for the two
 * outcomes a `[[Call]]` can have: an ordinary callable returns a value; a
 * class constructor throws (`never`). `unknown` is the join of those —
 * `unknown | never === unknown` — so it already subsumes the throwing case
 * rather than glossing over it. The distinction surfaces one layer down, where
 * {@link ClassConstructor} refines its `[[Call]]` to `never` and
 * {@link ES3Function} refines its own to a concrete return; the floor stays
 * `unknown` precisely because it is the supertype that abstracts over both.
 * Invoking a bare `Callable` therefore yields `unknown`, forcing the caller to
 * narrow the result before use.
 *
 * @example
 * declare const value: unknown;
 *
 * if (isCallable(value)) {
 *   // `value` is narrowed to `Callable` — safe to invoke
 *   const result = value(1, 2, 3); // result: unknown
 * }
 */
export interface Callable<Args extends unknown[] = unknown[], R = unknown> {
  /** The sole guarantee — the `[[Call]]` internal method. */
  (...args: Args): R;
}

/**
 * Narrows an unknown value to {@link Callable} by the minimal callability
 * test — `typeof value === 'function'`.
 *
 * The floor-level guard: it confirms the `[[Call]]` internal method is present
 * (the value can be invoked) and nothing more. It does not verify
 * `[[Construct]]`, the `Function.prototype` method set, or any specific
 * function classification — those are the job of stricter guards layered
 * above it.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not callable
 * @returns `true` when `typeof value === 'function'`, narrowing `value` to
 *  {@link Callable}; `false` otherwise
 */
export function isCallable(value?: unknown): value is Callable;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Represents any value where `typeof value === 'function'` AND it may
 * also be newable (has `[[Construct]]` internal slot).
 *
 * This covers both regular callables and constructors but makes no
 * guarantees about the `Function.prototype` methods.
 *
 * @template Args - The argument types
 * @template R - The return value type (when called without `new`)
 * @template T - The instance type (when called with `new`)
 */
export interface CallableOrNewable<
  Args extends unknown[] = unknown[],
  R = unknown,
  T = object,
> {
  /** The [[Call]] internal method */
  (...args: Args): R;
  /** The [[Construct]] internal method (optional) */
  new?(...args: Args): T;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Represents a verified Function - passes `typeof === 'function'` AND
 * has proper `call`, `apply`, `bind` methods that are themselves functions.
 *
 * Use this type for:
 * - The return type of `isFunction` type guard (the robust check)
 * - When you need to use `.call()`, `.apply()`, or `.bind()` on the value
 *
 * This is what `isFunction` verifies at runtime:
 * ```js
 * typeof value === 'function' &&
 * typeof value.call === 'function' &&
 * typeof value.apply === 'function' &&
 * typeof value.bind === 'function'
 * ```
 *
 * @template ThisType - The type of `this` context
 * @template Args - The argument types
 * @template R - The return value type
 *
 * @example
 * function isFunction(value: unknown): value is VerifiedFunction {
 *   return (
 *     typeof value === 'function' &&
 *     typeof value.call === 'function' &&
 *     typeof value.apply === 'function' &&
 *     typeof value.bind === 'function'
 *   );
 * }
 */
export interface VerifiedFunction<
  ThisType = unknown,
  Args extends unknown[] = unknown[],
  R = unknown,
> {
  /** The [[Call]] internal method */
  (this: ThisType, ...args: Args): R;

  /** Verified to be a function (typeof === 'function') */
  call: (thisArg: ThisType, ...args: Args) => R;

  /** Verified to be a function (typeof === 'function') */
  apply: (thisArg: ThisType, args: Args) => R;

  /** Verified to be a function (typeof === 'function') */
  bind: (thisArg: ThisType, ...args: unknown[]) => VerifiedFunction<ThisType, Args, R>;

  /** The function name */
  readonly name: string;

  /** The number of formal parameters */
  readonly length: number;
}

/**
 * Type guard that checks whether a value is a function.
 * Performs a thorough check ensuring the value has `bind`, `call`, and `apply` methods.
 * @param value - The value to check.
 * @returns `true` if the value is a function, `false` otherwise.
 */
export function isFunction(value?: unknown): value is VerifiedFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// /**
//  * Represents a strictly verified Function - the `call`, `apply`, `bind`
//  * methods are not just functions, but are THE original `Function.prototype`
//  * methods (not overwritten or replaced).
//  *
//  * This is the strictest verification level, ensuring the function has not
//  * been tampered with.
//  *
//  * This is what `isStrictFunction` verifies at runtime:
//  * ```js
//  * typeof value === 'function' &&
//  * value.call === Function.prototype.call &&
//  * value.apply === Function.prototype.apply &&
//  * value.bind === Function.prototype.bind
//  * ```
//  *
//  * @template ThisType - The type of `this` context
//  * @template Args - The argument types
//  * @template R - The return value type
//  *
//  * @example
//  * function isStrictFunction(value: unknown): value is StrictFunction {
//  *   return (
//  *     typeof value === 'function' &&
//  *     value.call === Function.prototype.call &&
//  *     value.apply === Function.prototype.apply &&
//  *     value.bind === Function.prototype.bind
//  *   );
//  * }
//  */
// export interface StrictFunction<
//   ThisType = unknown,
//   Args extends unknown[] = unknown[],
//   R = unknown
// > extends VerifiedFunction<ThisType, Args, R> {
//   /** Guaranteed to be Function.prototype.call */
//   call: typeof Function.prototype.call;
//
//   /** Guaranteed to be Function.prototype.apply */
//   apply: typeof Function.prototype.apply;
//
//   /** Guaranteed to be Function.prototype.bind */
//   bind: typeof Function.prototype.bind;
// }

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Newable Function Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An ES3-style function — the classic `function` declaration/expression that is
 * both callable and newable.
 *
 * Unlike a class, an `ES3Function` may be invoked with or without `new`. Its
 * structural tell versus {@link ClassConstructor} is a **writable** `prototype`
 * (`Object.getOwnPropertyDescriptor(fn, 'prototype').writable === true`).
 * TypeScript types a plain `function` declaration as call-only, so this
 * handwritten shape is what *asserts* the construct signature ES3 functions
 * carry at runtime.
 *
 * @template ThisType - the dynamic `this` context (resolved at the call site)
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
 * An ES6 class constructor — produced by `class` declarations/expressions.
 *
 * A `ClassConstructor` is `typeof === 'function'` — it carries `[[Call]]`, which
 * is why {@link isCallable} accepts it — but **must** be invoked with `new`;
 * calling it without `new` throws `TypeError` (its `[[IsClassConstructor]]`
 * slot), so the call signature returns `never`. Its structural tell versus
 * {@link ES3Function} is a **readonly** `prototype`
 * (`Object.getOwnPropertyDescriptor(cls, 'prototype').writable === false`).
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
 * The lenient newable gate: any value that is `typeof === 'function'` (callable,
 * with callable `call`/`apply`/`bind`) AND carries the internal `[[Construct]]`
 * method. This is what `isNewableFunction` narrows to — deliberately permissive:
 * it admits **bound** classes and bound ES3 functions, which keep `[[Construct]]`
 * but have lost their own `prototype`.
 *
 * It therefore makes **no `prototype` guarantee**. To reach a `prototype` — and
 * to tell the two strict shapes apart — narrow further to {@link ES3Function}
 * (own *writable* `prototype`) or {@link ClassConstructor} (own *readonly*
 * `prototype`), the shapes that `isES3Function` and `isClass` verify.
 *
 * Modeling note — the union `ES3Function | ClassConstructor` would be *stricter*
 * than this gate (both branches promise a `prototype` that bound variants lack),
 * so the faithful narrow target for `isNewableFunction` is this base interface,
 * not that union. TypeScript can't infer `[[Construct]]` for a plain `function`
 * either (it types them call-only); the runtime guard asserts what the compiler
 * cannot derive. Arrow functions, methods, async, and generator functions are
 * **not** newable — they lack `[[Construct]]` in both the type system and the
 * runtime.
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
