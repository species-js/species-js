/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection. The floor predicate {@link isCallable}
 * narrows any value to {@link Callable} via the minimal, realm-independent
 * callability test; richer function classification builds on top of it.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Reads a function's source via `toFunctionString.call(value)` — routes
 * around the instance's `toString` (which may be missing or replaced) by
 * going through the realm-fixed `Function.prototype.toString` capture
 * directly. Returns the trimmed source string; `[native code]` markers in
 * the source are not stripped, since distinguishing native from user-authored
 * code is precisely why callers reach for this helper.
 *
 * @param value - the function whose source should be read
 * @returns the function's source as a trimmed string
 * @internal
 */
export function getFunctionSource(value: Callable): string;

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
 * The union shape between pure callability and constructibility — a
 * {@link Callable} whose `[[Construct]]` internal method may *or may not* be
 * present. The `new` signature is marked optional to express that uncertainty
 * structurally; this interface promises nothing about the
 * `Function.prototype` method set.
 *
 * Use this as a target only when an API genuinely accepts both
 * call-only-or-also-constructor shapes; for stronger guarantees, narrow further
 * to {@link ES3Function} / {@link ClassConstructor} / {@link NewableFunction}.
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
 * callable — the verified Function-interface shape that survives prototype
 * tampering on those three members.
 *
 * `VerifiedFunction` sits one layer above {@link Callable}: it adds the three
 * `Function.prototype` methods *as observed on the instance*, each verified to
 * be a function in its own right. This is the narrow target for
 * {@link isFunction}: a value where `.call(…)` / `.apply(…)` / `.bind(…)` are
 * guaranteed invocable, regardless of whether the originals were shadowed,
 * deleted, or replaced.
 *
 * The verification is *observational*, not nominal — `VerifiedFunction` does
 * not promise the methods are *the* `Function.prototype.*`, only that something
 * callable answers at those names. A strict-identity variant (members
 * `=== Function.prototype.*`) is a separate concern, deliberately not modeled
 * here.
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
 * Narrows a value to {@link VerifiedFunction} — verifies that `value` is
 * {@link Callable} *and* its own `call`, `apply`, and `bind` are themselves
 * callable. The strict-Function-interface guard that survives prototype
 * tampering on those three members.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not callable
 * @returns `true` when `value` is callable and exposes callable `call` /
 *  `apply` / `bind`, narrowing to {@link VerifiedFunction}; `false` otherwise
 */
export function isFunction(value?: unknown): value is VerifiedFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Newable Function Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An ES3-style function — the classic `function` declaration/expression that
 * is both callable and newable.
 *
 * Unlike a class, an `ES3Function` may be invoked with or without `new`. Its
 * structural tell versus {@link ClassConstructor} is a **writable** `prototype`
 * (`Object.getOwnPropertyDescriptor(fn, 'prototype').writable === true`).
 * TypeScript types a plain `function` declaration as call-only, so this
 * handwritten shape is what *asserts* the construct signature ES3 functions
 * carry at runtime.
 *
 * Bound ES3 functions are **deliberately excluded** from this type. Binding
 * strips the function's own `prototype` slot — the writable-prototype tell is
 * gone, so what you have isn't an ES3 shape anymore. It's still newable
 * (passes {@link isNewableFunction}), but it has become a third species — a
 * bound-newable — that this package does not name as its own type. The
 * matching guard {@link isES3Function} reflects this: it rejects bound
 * variants via the `hasOwnWritablePrototype` check.
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
 * A class constructor — produced by `class` declarations/expressions, or any
 * built-in constructor whose `prototype` slot is read-only.
 *
 * A `ClassConstructor` is `typeof === 'function'` — it carries `[[Call]]`, so
 * {@link isCallable} accepts it — but **must** be invoked with `new`; calling
 * it without `new` throws `TypeError` (its `[[IsClassConstructor]]` slot), so
 * the call signature returns `never`. Its structural tell versus
 * {@link ES3Function} is a **readonly** `prototype`
 * (`Object.getOwnPropertyDescriptor(cls, 'prototype').writable === false`).
 *
 * Bound class constructors are **deliberately excluded** from this type. Once
 * bound, the result has lost its own `prototype` slot entirely — the
 * structural tell of a class is gone, so what you have is no longer a class
 * shape. It is still newable (passes {@link isNewableFunction}, since
 * `[[Construct]]` survives `bind`), but it has become a third species — a
 * bound-newable. The matching guard {@link isClass} reflects this: it
 * rejects bound variants on the descriptor check.
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
 * The lenient newable gate — any value with the internal `[[Construct]]`
 * method reachable via a `Proxy` `construct` trap (see
 * {@link hasConstructSlot}). Deliberately permissive: admits the three
 * species of newable value JavaScript supports — {@link ES3Function},
 * {@link ClassConstructor}, and **bound newables** (the result of
 * `someClassOrES3.bind(…)`, which preserves `[[Construct]]` but loses its
 * own `prototype`).
 *
 * Because bound newables lack own `prototype`, this interface makes **no
 * `prototype` guarantee**. To reach a `prototype` — and to tell the two
 * non-bound species apart — narrow further to {@link ES3Function} (own
 * writable `prototype`) or {@link ClassConstructor} (own readonly
 * `prototype`). Both of those guards deliberately reject bound variants on
 * exactly that ground: a bound class is no longer a class-shape, a bound ES3
 * function is no longer an ES3-shape; both remain newable but become a third
 * species — a bound-newable — that this package does not name as its own
 * type. The introspection layer can, with the caveats "is-bound" detection
 * carries (the only spec-reliable tell is `[[BoundTargetFunction]]`, which
 * isn't observable; every visible fingerprint is spoofable).
 *
 * Modeling note — `NewableFunction` is deliberately a lenient base interface,
 * not the union `ES3Function | ClassConstructor`. The union would
 * over-promise (both branches carry a `prototype` bound variants don't), so
 * it would be the wrong narrow target. TypeScript cannot infer `[[Construct]]`
 * for a plain `function` either (it types them call-only); the runtime guard
 * {@link isNewableFunction} asserts what the compiler cannot derive. Arrow
 * functions, methods, async, and generator functions are **not** newable —
 * they lack `[[Construct]]` in both the type system and the runtime.
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
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Probes the value's `[[Construct]]` internal method without invoking the
 * value itself. Builds a `Proxy` whose `construct` trap returns an empty
 * object, then attempts `new proxy(…)`: if `[[Construct]]` is reachable on
 * the proxy's target, the construction succeeds and the function returns
 * `true`; otherwise the `new` throws and the function returns `false`.
 *
 * The MDN-cited invariant — "the `target` used to initialize the proxy must
 * itself be a valid constructor" — is what makes this a reliable lenient
 * gate: the proxy can supply a `construct` trap, but the trap is only
 * exercised if the target has `[[Construct]]` to begin with. Bound newables
 * count (they preserve `[[Construct]]`); arrow functions, methods, async
 * functions, and generator functions do not.
 *
 * @param value - the value to probe
 * @returns `true` when the value carries `[[Construct]]`; `false` otherwise
 */
export function hasConstructSlot(value: unknown): boolean;

/**
 * Narrows a value to the lenient {@link NewableFunction} gate — composes
 * {@link isFunction} (the four-method callability check) with
 * {@link hasConstructSlot} (the `[[Construct]]` probe). The result admits
 * all three newable species: {@link ES3Function}, {@link ClassConstructor},
 * and bound newables.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not callable
 * @returns `true` when the value is callable, exposes callable `call` /
 *  `apply` / `bind`, AND carries `[[Construct]]`, narrowing to
 *  {@link NewableFunction}; `false` otherwise
 */
export function isNewableFunction(value?: unknown): value is NewableFunction;

/**
 * Narrows a value to {@link ClassConstructor} — the strict class shape,
 * covering both custom (`class`-syntax) constructors and built-in class
 * constructors (`Array`, `Date`, `Map`, …). Both share the same structural
 * tell `isClass` verifies: an own `prototype` descriptor whose `writable` is
 * `false` and whose `value.constructor` points back to the constructor. To
 * tell the two families apart, use {@link isCustomClass} or
 * {@link isBuiltInClass} (disjoint refinements that together partition this
 * surface).
 *
 * Bound class constructors are **deliberately rejected** — they remain
 * newable but have lost their own `prototype` slot, so what you have is no
 * longer a class shape. The {@link NewableFunction} gate still admits them;
 * this guard does not.
 *
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is a class-shaped newable (built-in or
 *  `class`-syntax), narrowing to {@link ClassConstructor}; `false` otherwise
 */
export function isClass(value?: unknown): value is ClassConstructor;

/**
 * Narrows a value to a custom (`class`-syntax) constructor — builds on
 * {@link isClass} and adds the source-prefix check: a custom class's
 * stringified source starts with the literal `'class'` keyword, while a
 * built-in class constructor (`Array`, `Date`, …) renders as
 * `function Foo() { [native code] }` and does not.
 *
 * `isCustomClass` and {@link isBuiltInClass} are *disjoint refinements* of
 * {@link isClass} — together they partition the class surface into "authored
 * via `class` syntax" vs. "built-in." Both narrow to {@link ClassConstructor}.
 * A bound class fails {@link isClass} upstream, so neither variant admits it.
 *
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is a custom-class constructor, narrowing to
 *  {@link ClassConstructor}; `false` otherwise
 */
export function isCustomClass(value?: unknown): value is ClassConstructor;

/**
 * Narrows a value to a built-in class constructor — builds on
 * {@link isClass} and adds the inverse source-prefix check: built-in classes
 * (`Array`, `Date`, `Map`, …) render as `function Foo() { [native code] }`
 * and do not start with `'class'`, while custom (`class`-syntax) constructors
 * do.
 *
 * The dual of {@link isCustomClass}: both narrow to {@link ClassConstructor},
 * together they partition the {@link isClass} surface, neither admits bound
 * variants (rejected upstream by {@link isClass}).
 *
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is a built-in class constructor, narrowing
 *  to {@link ClassConstructor}; `false` otherwise
 */
export function isBuiltInClass(value?: unknown): value is ClassConstructor;

/**
 * Narrows a value to {@link ES3Function} — the strict ES3-function shape.
 * Builds on {@link isNewableFunction} and adds the structural tell: an own
 * `prototype` descriptor whose `writable` is `true` (verified via
 * `hasOwnWritablePrototype`).
 *
 * Bound ES3 functions are **deliberately rejected** — they remain newable
 * but have lost their own `prototype` slot, so what you have is no longer
 * an ES3 shape. The {@link NewableFunction} gate still admits them; this
 * guard does not.
 *
 * @param value - the value to test; omitted is treated as `undefined`
 * @returns `true` when the value is an ES3-shaped newable, narrowing to
 *  {@link ES3Function}; `false` otherwise
 */
export function isES3Function(value?: unknown): value is ES3Function;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Async Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `%AsyncFunction%` intrinsic — any callable whose `[[Prototype]]`
 * traces to `%AsyncFunction.prototype%`. Admits every callable produced by
 * async syntax, regardless of the source form:
 *
 * - `async function name() { … }` (async function declaration)
 * - `async function() { … }` (async function expression)
 * - `async () => …` (async arrow function)
 * - `{ async method() { … } }` (async concise method)
 *
 * …**plus the bound variants of each.** These four source forms are
 * structurally identical at the runtime level — same `Symbol.toStringTag`,
 * no own `prototype`, no `[[Construct]]`. The distinctions between them
 * (dynamic vs. lexical `this`, source layout) are visible only via source
 * inspection (`Function.prototype.toString`), which is
 * characterization-quality data; the source-regex predicates that
 * discriminate the four therefore live in
 * `@species-js/function-introspection`, not in this package.
 *
 * **Bound async functions are admitted** — this is an honest consequence of
 * spec mechanics, not an oversight. `bind` sets the bound function's
 * `[[Prototype]]` to the *target's* `[[Prototype]]`
 * (`%AsyncFunction.prototype%` in the async case), so the bound function
 * inherits `Symbol.toStringTag` and resolves the same constructor name via
 * the prototype walk. This is asymmetric with {@link ClassConstructor} and
 * {@link ES3Function}, whose bound variants are *rejected* — but the
 * asymmetry is forced by where each family puts its discriminator: the
 * newable side's tells (own-prototype descriptors) are stripped by `bind`;
 * the async side's tells (prototype-chain tag and constructor) are
 * preserved by it. Without source inspection there is no structural way to
 * tell a bound async function from a non-bound one — and source inspection
 * is introspection's job, not type-detection's.
 *
 * **Async-generator functions are NOT in this family**, despite the shared
 * "Async" prefix in the name. `async function* () { … }` is a *generator*
 * function: it synchronously returns an `AsyncGenerator` instance whose
 * `.next()` yields promises. Structurally it has its own `Symbol.toStringTag`
 * (`'AsyncGeneratorFunction'`), an own writable `prototype`, and traces to
 * the `%AsyncGeneratorFunction%` intrinsic — none of which `%AsyncFunction%`
 * does. Async-generator functions are kin to sync generator functions, not
 * to this predicate; the "Async" in their name describes what their
 * iterator *yields*, not the function itself.
 *
 * @template ThisType - the `this` context at the call site (dynamic for the
 *  non-arrow forms; ignored at runtime for arrow forms — the type cannot
 *  distinguish them, since the discrimination is source-based)
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
 * Tests whether a value carries the runtime "shape" of the `%AsyncFunction%`
 * intrinsic — the four realm-independent markers any such value must
 * exhibit: no own `prototype`, no `[[Construct]]`, `Symbol.toStringTag`
 * equals `'AsyncFunction'`, and the resolved constructor name equals
 * `'AsyncFunction'`. Returns plain `boolean` (not a narrowing predicate);
 * narrowing belongs to {@link isAsyncFunction}, which also orchestrates the
 * same-realm `instanceof` fast path before delegating here.
 *
 * Defensive against single-slot spoofing: tampering with the tag without a
 * matching change to the constructor chain (or vice versa) is rejected.
 * Multi-slot coordinated tampering (override both `Symbol.toStringTag` and
 * the prototype chain) passes — but at that point the value's spec-level
 * inheritance also passes, so the result is consistent with `instanceof`.
 *
 * Independent of {@link isFunction} — accepts any value, returns `false`
 * for non-callable inputs. The standalone signature is deliberate so each
 * marker can be exercised in isolation by tests.
 *
 * @param value - the value to inspect
 * @returns `true` when all four markers match; `false` otherwise
 * @internal
 */
export function hasAsyncFunctionShape(value?: unknown): boolean;

/**
 * Narrows a value to {@link AsyncFunction} — orchestrates three phases:
 *
 * 1. `isFunction` gate — short-circuits for non-callable inputs.
 * 2. Same-realm fast path — `value instanceof %AsyncFunction%` walks the
 *    `[[Prototype]]` chain. Passes for any value whose inheritance traces
 *    to the local realm's `%AsyncFunction.prototype%` (including bound
 *    variants — `bind` preserves the chain).
 * 3. Realm-independent fallback — delegates to
 *    {@link hasAsyncFunctionShape}, which verifies the four spec-derived
 *    markers. This is the cross-realm code path: foreign-realm async
 *    functions have a different `%AsyncFunction%` identity but the same
 *    observable markers.
 *
 * **Admits** all four source forms (`async function` declarations,
 * expressions, async arrows, async concise methods) and their bound
 * variants alike. See the {@link AsyncFunction} doc for the lattice framing
 * and the spec-mechanics rationale for bound-admission.
 *
 * **Does not admit async-generator functions** — those are *generator*
 * functions in the species-js taxonomy (different intrinsic, different
 * `Symbol.toStringTag`, own writable `prototype`), not a near-variant of
 * `AsyncFunction`. The shared "Async" prefix in their name describes what
 * their iterator yields, not the function. See the generator predicates
 * for that family.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an async function
 * @returns `true` when the value is an async function in the species-js
 *  taxonomy, narrowing to {@link AsyncFunction}; `false` otherwise
 * @example
 * declare const value: unknown;
 *
 * if (isAsyncFunction(value)) {
 *   const result = value(); // result: Promise<unknown>
 *   result.then((resolved) => { ... });
 * }
 */
export function isAsyncFunction(value?: unknown): value is AsyncFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generator Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `Generator` instance — the object a sync generator function (`function*`)
 * returns when invoked. Re-modeled in species-js rather than extending
 * `globalThis.Generator` so the Tier-S contract is owned by this package and
 * consumers' lib config does not affect shape stability. Minimal lib
 * dependencies: `IteratorResult`, `Symbol.iterator` (both ES2015 spec
 * primitives).
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
 * The `AsyncGenerator` instance — the object an async generator function
 * (`async function*`) returns when invoked. Re-modeled in species-js rather
 * than extending `globalThis.AsyncGenerator`. Minimal lib dependencies:
 * `IteratorResult`, `Promise`, `PromiseLike`, `Symbol.asyncIterator` (all
 * ES2015 / ES2018 spec primitives).
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
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `%GeneratorFunction%` intrinsic — any callable whose `[[Prototype]]`
 * traces to `%GeneratorFunction.prototype%`. Synchronously returns a
 * {@link Generator} when invoked; the generator's `.next()` yields values
 * synchronously. The function itself is fully synchronous — there is no
 * Promise at the call site.
 *
 * Admits `function* name() {}` (declaration), `function*() {}` (expression),
 * concise generator methods (`{ *m() {} }.m`, class generator methods), and
 * their bound variants — `bind` preserves the prototype chain, so the tag
 * and constructor-name resolution survive on bound forms.
 *
 * Structurally: own writable `prototype` (carrying a {@link Generator}
 * instance shape), `Symbol.toStringTag === 'GeneratorFunction'`, no
 * `[[Construct]]` (generator functions are not newable per spec).
 *
 * Sibling intrinsic: {@link AsyncGeneratorFunction} (returns
 * {@link AsyncGenerator}). The two share structural traits and call
 * mechanics but trace to distinct intrinsics. Do **not** confuse
 * `%AsyncGeneratorFunction%` with {@link AsyncFunction} — the "Async"
 * prefix on `AsyncGeneratorFunction` describes the *iterator*'s yield
 * behavior (`.next()` returns promises), not the function itself; the
 * function's *return* is synchronous (an AsyncGenerator object handed back
 * immediately). See {@link AsyncGeneratorFunction}'s doc for the explicit
 * disambiguation.
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
 * The `%AsyncGeneratorFunction%` intrinsic — any callable whose
 * `[[Prototype]]` traces to `%AsyncGeneratorFunction.prototype%`.
 * Synchronously returns an {@link AsyncGenerator} when invoked; the
 * generator's `.next()` returns `Promise<IteratorResult>`.
 *
 * **Kin to {@link GeneratorFunction}, NOT to {@link AsyncFunction}**,
 * despite the shared "Async" prefix. The function's *return* is synchronous
 * — an AsyncGenerator object handed back immediately at the call site; only
 * the iterator's per-step yield is async (its `.next()` returns a Promise).
 * `%AsyncFunction%` instead returns a Promise *directly* from the call site
 * and is unrelated structurally (different intrinsic, no own prototype,
 * different `Symbol.toStringTag`).
 *
 * Admits `async function* name() {}` (declaration), `async function*() {}`
 * (expression), concise async-generator methods, and their bound variants —
 * `bind` preserves the prototype chain.
 *
 * Structurally: own writable `prototype` (carrying an {@link AsyncGenerator}
 * instance shape), `Symbol.toStringTag === 'AsyncGeneratorFunction'`, no
 * `[[Construct]]`.
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
 * The umbrella of both generator-function species —
 * {@link GeneratorFunction} | {@link AsyncGeneratorFunction}. They share
 * structural traits (own writable prototype, no `[[Construct]]`, callable
 * surface) but trace to distinct intrinsics. {@link isAnyGeneratorFunction}
 * narrows to this type; use the strict refinements
 * {@link isGeneratorFunction} or {@link isAsyncGeneratorFunction} to
 * discriminate further when needed.
 */
export type AnyGeneratorFunction = GeneratorFunction | AsyncGeneratorFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Tests whether a value carries the runtime "shape" of the
 * `%GeneratorFunction%` intrinsic — the **three** realm-independent markers:
 * no `[[Construct]]`, `Symbol.toStringTag === 'GeneratorFunction'`, and the
 * resolved constructor name `=== 'GeneratorFunction'`.
 *
 * **No prototype-slot check.** Unlike {@link hasAsyncFunctionShape}, this
 * helper does NOT include `!hasOwnPrototype` or `hasOwnWritablePrototype`.
 * The reason: unbound generator functions *have* an own writable
 * `prototype` (carrying the {@link Generator} instance proto), bound ones
 * don't — `bind` strips own slots. Either check would split bound from
 * unbound, but the helper is meant to admit both (lenient by spec
 * mechanics — `bind` preserves the prototype chain, so the tag and
 * constructor-name remain inherited intact in both cases).
 *
 * Returns plain `boolean`; narrowing belongs to {@link isGeneratorFunction}.
 * Independent of {@link isFunction} — accepts any value, returns `false`
 * for non-callable inputs.
 *
 * @param value - the value to inspect
 * @returns `true` when all three markers match; `false` otherwise
 * @internal
 */
export function hasGeneratorFunctionShape(value?: unknown): boolean;

/**
 * Narrows a value to {@link GeneratorFunction} — orchestrator: `isFunction`
 * gate, same-realm `instanceof` fast path against the captured
 * `%GeneratorFunction%` intrinsic, cross-realm fallback via
 * {@link hasGeneratorFunctionShape}.
 *
 * Admits sync generator function declarations, expressions,
 * concise-method forms, and their bound variants.
 *
 * Does NOT admit async-generator functions — those trace to
 * `%AsyncGeneratorFunction%`. Use {@link isAsyncGeneratorFunction} for that
 * species or {@link isAnyGeneratorFunction} for the umbrella.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a generator function
 * @returns `true` when the value is a sync-generator function, narrowing to
 *  {@link GeneratorFunction}; `false` otherwise
 */
export function isGeneratorFunction(value?: unknown): value is GeneratorFunction;

/**
 * Tests whether a value carries the runtime "shape" of the
 * `%AsyncGeneratorFunction%` intrinsic — the three realm-independent
 * markers: no `[[Construct]]`, `Symbol.toStringTag` equals
 * `'AsyncGeneratorFunction'`, and the resolved constructor name equals
 * `'AsyncGeneratorFunction'`.
 *
 * Same "no prototype-slot check" rationale as {@link hasGeneratorFunctionShape}
 * — unbound async-generator functions carry an own writable `prototype`,
 * bound ones don't; admitting both requires omitting that check.
 *
 * Returns plain `boolean`; narrowing belongs to
 * {@link isAsyncGeneratorFunction}.
 *
 * @param value - the value to inspect
 * @returns `true` when all three markers match; `false` otherwise
 * @internal
 */
export function hasAsyncGeneratorFunctionShape(value?: unknown): boolean;

/**
 * Narrows a value to {@link AsyncGeneratorFunction} — orchestrator:
 * `isFunction` gate, same-realm `instanceof` fast path against the captured
 * `%AsyncGeneratorFunction%` intrinsic, cross-realm fallback via
 * {@link hasAsyncGeneratorFunctionShape}.
 *
 * Admits `async function*` declarations, expressions, async concise methods,
 * and their bound variants. Does NOT admit sync generator functions, async
 * functions, or any other family — those have different intrinsics.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an async-generator function
 * @returns `true` when the value is an async-generator function, narrowing
 *  to {@link AsyncGeneratorFunction}; `false` otherwise
 */
export function isAsyncGeneratorFunction(
  value?: unknown,
): value is AsyncGeneratorFunction;

/**
 * Narrows a value to {@link AnyGeneratorFunction} — the umbrella over both
 * sync and async generator-function species. Composes
 * {@link isGeneratorFunction} and {@link isAsyncGeneratorFunction}: passes
 * if either fast path or either shape helper succeeds. No dedicated
 * `hasAnyGeneratorFunctionShape` helper — the umbrella's job is exactly the
 * union, and composing the two single-family helpers is the codified
 * pattern.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a generator function
 * @returns `true` when the value is either a sync or an async generator
 *  function (including bound variants), narrowing to
 *  {@link AnyGeneratorFunction}; `false` otherwise
 */
export function isAnyGeneratorFunction(value?: unknown): value is AnyGeneratorFunction;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
