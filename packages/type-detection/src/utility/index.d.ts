/**
 * @module @species-js/type-detection/utility
 *
 * Cached prototype references and type-signature helpers.
 *
 * Used internally by the package's predicates and exposed via subpath for
 * downstream packages that need the same cross-realm-safe primitives.
 */

import type { NewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Property Descriptor Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A property descriptor: the shape `Object.getOwnPropertyDescriptor` returns
 * and `Object.defineProperty` accepts.
 *
 * Mirrors TypeScript's built-in `PropertyDescriptor` so the type can be
 * named from JSDoc. The `value` slot defaults to `unknown` per the
 * package's typing discipline.
 */
export interface PropertyDescriptor {
  /** Data-descriptor value; mutually exclusive with `get` / `set`. */
  value?: unknown;
  /** Whether the value may be reassigned (data descriptors only). */
  writable?: boolean;
  /** Accessor getter; mutually exclusive with `value` / `writable`. */
  get?: () => unknown;
  /** Accessor setter; mutually exclusive with `value` / `writable`. */
  set?: (v: unknown) => void;
  /** Whether the property surfaces in `for…in` / `Object.keys`. */
  enumerable?: boolean;
  /** Whether the descriptor itself may be redefined or the property deleted. */
  configurable?: boolean;
}

/**
 * A record of {@link PropertyDescriptor}s keyed by string or symbol. The
 * shape `Object.getOwnPropertyDescriptors` returns.
 */
export interface PropertyDescriptorMap {
  [key: string]: PropertyDescriptor;
  [key: symbol]: PropertyDescriptor;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

export interface DefinedConstructorAccessorOptions {
  assumePrototype?: boolean;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object-Shape Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An object whose properties are typed away. `Record<PropertyKey, never>`
 * makes every key statically unreachable.
 *
 * The intended runtime carrier is `Object.create(null)`. The absence of a
 * prototype chain is a runtime characteristic TypeScript cannot express,
 * so this type only marks an object's static surface as empty.
 */
export type BlankType = Record<PropertyKey, never>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Name String Aliases
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A constructor function's `name`. The string read from a value's
 * constructor.
 */
export type ConstructorName = string;

/**
 * A `Symbol.toStringTag` value: the string inside the `[object …]`
 * wrapper that `Object.prototype.toString.call` returns.
 *
 * The value may be a built-in tag such as `'Array'`, `'Date'`, or
 * `'Promise'`, or a custom tag installed via the well-known symbol.
 */
export type TaggedType = string;

/**
 * A JavaScript value's resolved type-name: either its constructor-name
 * ({@link ConstructorName}) or its tagged-type ({@link TaggedType}).
 *
 * Both are `string` at the type level. The distinction is provenance,
 * carried by the producers' return types rather than enforced nominally
 * here.
 */
export type ResolvedType = string;

/**
 * The `[object Tag]` string `Object.prototype.toString.call` returns.
 *
 * A template-literal type built from {@link TaggedType}, so the structural
 * distinction `'[object Array]' !== 'Array'` survives in the type system.
 */
export type TypeSignature = `[object ${TaggedType}]`;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype-Property Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether the value carries an own `prototype` property.
 *
 * The test reads the descriptor directly, not the inheritance chain.
 * Inherited prototypes — for example, an arrow function whose `prototype`
 * comes from `Function.prototype` — are deliberately excluded.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  has no own prototype
 * @returns `true` when the value carries an own `prototype` property;
 *  `false` otherwise
 */
export function hasOwnPrototype(value?: unknown): boolean;

/**
 * Detects whether the value carries an own `prototype` property whose
 * descriptor is `writable: true`.
 *
 * This is the structural tell of an `ES3Function` versus a
 * `ClassConstructor`, whose own `prototype` is read-only.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  has no own prototype
 * @returns `true` when the value's own `prototype` exists and is writable;
 *  `false` otherwise
 */
export function hasOwnWritablePrototype(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Property-Key Utilities
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `PropertyKey`.
 *
 * Accepts strings, symbols, and safe integers. The safe-integer
 * restriction means numeric property keys are limited to the range
 * `[-(2^53 - 1), 2^53 - 1]` where they round-trip losslessly.
 * Finite-but-non-integer numbers like `1.5` coerce to strings (`"1.5"`)
 * at runtime with lookup surprises; integers beyond
 * `Number.MAX_SAFE_INTEGER` lose precision in the round-trip. Both are
 * excluded. `NaN` and `±Infinity` are also excluded — they fail the
 * finite check that underlies safe-integer.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a property key
 * @returns `true` when the value can be safely used as a property key,
 *  narrowing `value` to `PropertyKey`; `false` otherwise
 */
export function isValidPropertyKey(value?: unknown): value is PropertyKey;

/**
 * Returns the first {@link PropertyDescriptor} found while walking the
 * value's prototype chain.
 *
 * Walks own properties first and then the prototype chain. Accessor
 * descriptors are returned as-is. The getter is never invoked.
 *
 * @param value - the value whose descriptor chain should be inspected
 * @param key - the property key to resolve; invalid keys yield `undefined`
 * @returns the first descriptor found while walking up the chain;
 *  `undefined` if none exists
 */
export function getNextAvailablePropertyDescriptor(
  value: unknown,
  key: PropertyKey,
): PropertyDescriptor | undefined;

/**
 * Returns the own string-keyed property names of a value, including
 * non-enumerable ones.
 *
 * `Object.getOwnPropertyDescriptors` produces enumerable descriptor entries
 * on its returned object regardless of the source's enumerability, so
 * `Object.keys` over that result surfaces every own string-keyed name.
 *
 * Symbol-keyed entries are excluded, since `Object.keys` reads strings
 * only. Nullish input (or an omitted call) yields `[]`.
 *
 * @param value - the value whose own string-keyed property names should be
 *  returned; nullish (or omitted) yields `[]`
 * @returns the array of own string-keyed property names
 * @example
 * const obj = Object.defineProperty({ a: 1 }, 'b', { value: 2 });
 * Object.keys(obj);                    // ['a']
 * getOwnPropertyDescriptorsKeys(obj);  // ['a', 'b']
 * getOwnPropertyDescriptorsKeys(null); // []
 */
export function getOwnPropertyDescriptorsKeys(value?: unknown): string[];

/**
 * Returns the own string-keyed property names of a value as a `Set<string>`.
 *
 * Composes {@link getOwnPropertyDescriptorsKeys} with the `Set` constructor.
 *
 * The Set carries set-equality, subset, and superset semantics natively
 * and supports per-key membership checks (`.has(key)`) directly. This is
 * the right primitive for shape-comparison checks that read individual key
 * presence or absence rather than full-shape equality.
 *
 * Same key-coverage as {@link getOwnPropertyDescriptorsKeys}.
 * Non-enumerable own string keys are included. Symbol-keyed entries are
 * excluded. Nullish input (or an omitted call) yields an empty `Set`.
 *
 * @param value - the value whose own string-keyed names should be returned
 *  as a Set; nullish (or omitted) yields an empty `Set`
 * @returns a `Set` of the value's own string-keyed property names
 * @example
 * const obj = Object.defineProperty({ a: 1 }, 'b', { value: 2 });
 * getOwnPropertyDescriptorsKeySet(obj);   // Set { 'a', 'b' }
 * getOwnPropertyDescriptorsKeySet({});    // Set {}
 * getOwnPropertyDescriptorsKeySet(null);  // Set {}
 */
export function getOwnPropertyDescriptorsKeySet(value?: unknown): Set<string>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Tests whether the value carries a callable data property at `key`,
 * reachable through its prototype chain.
 *
 * The lookup walks the prototype chain via own-descriptor reads at
 * each level, matching how ECMA-262 `Get(value, key)` resolves the
 * property at runtime. A `key` found anywhere along the chain — own
 * or inherited — satisfies the predicate, provided the descriptor is
 * a data descriptor whose value is callable.
 *
 * "Inert" refers to the inspect-without-invoke guarantee. The check
 * confirms callability via descriptor reads, never by accessing the
 * property directly. An accessor `get key()` would fire on access
 * regardless of whether the getter returns a callable; the predicate
 * rejects accessor descriptors, so the inspection itself remains inert.
 *
 * Used by Promise-contract predicates to verify the spec-defined `then`,
 * `catch`, and `finally` methods of a _thenable_ or _promise-like_
 * type without triggering side effects. The helper is general-purpose:
 * any method-contract predicate that needs the inspect-without-invoke
 * guarantee should compose it.
 *
 * @param type - the value to inspect
 * @param key - the property key to resolve through the value's
 *  prototype chain
 * @returns `true` when the value carries a callable data property at
 *  `key` in its prototype chain; `false` otherwise
 * @example
 * hasInertMethod(Promise.resolve(), 'then');                   // true (inherited)
 * hasInertMethod({ then: () => {} }, 'then');                  // true (own)
 * hasInertMethod({}, 'then');                                  // false
 * hasInertMethod({ get then() { return () => {}; } }, 'then'); // false (accessor)
 * hasInertMethod(null, 'then');                                // false
 */
export function hasInertMethod(type: unknown, key: PropertyKey): boolean;

/**
 * Tests whether the value carries an accessor `get` at `key`, reachable
 * through its prototype chain.
 *
 * Sibling of {@link hasInertMethod} for the accessor-getter case. The
 * descriptor walk returns the first descriptor found at any chain
 * level; if that descriptor's `get` field is callable, the predicate
 * returns `true`. Data descriptors yield `undefined` from `?.get` and
 * are rejected.
 *
 * Fully inert. The descriptor is read without invocation; the `get`
 * function itself is referenced but never called.
 *
 * @param type - the value to inspect
 * @param key - the property key to resolve through the value's
 *  prototype chain
 * @returns `true` when the value carries an accessor with a callable
 *  getter at `key` in its prototype chain; `false` otherwise
 * @internal
 */
export function hasInertGetter(type: unknown, key: PropertyKey): boolean;

/**
 * Tests whether the value carries an accessor `set` at `key`, reachable
 * through its prototype chain.
 *
 * Sibling of {@link hasInertGetter} for the setter case. Same
 * descriptor-walk + descriptor-shape discipline; data descriptors are
 * rejected (their `set` field is undefined). Fully inert.
 *
 * @param type - the value to inspect
 * @param key - the property key to resolve through the value's
 *  prototype chain
 * @returns `true` when the value carries an accessor with a callable
 *  setter at `key` in its prototype chain; `false` otherwise
 * @internal
 */
export function hasInertSetter(type: unknown, key: PropertyKey): boolean;

/**
 * Tests whether the value carries a data property at `key`, reachable
 * through its prototype chain.
 *
 * Sibling of {@link hasInertMethod} for the data-descriptor presence
 * case. Uses `objectHasOwn(descriptor, 'value')` rather than
 * `?.value !== undefined` because a data descriptor may legitimately
 * hold `undefined` as its value — both `{ value: undefined, writable:
 * true, … }` and "no descriptor" would otherwise be conflated. The
 * `objectHasOwn` check distinguishes "the descriptor IS a data
 * descriptor" from "the value is undefined" cleanly, matching
 * ECMA-262 §6.2.5.1 `IsDataDescriptor`.
 *
 * Fully inert. Use to discriminate data-vs-accessor descriptor shapes
 * along a prototype chain without invoking either getters or stored
 * values.
 *
 * @param type - the value to inspect
 * @param key - the property key to resolve through the value's
 *  prototype chain
 * @returns `true` when the value carries a data descriptor at `key`
 *  in its prototype chain; `false` otherwise (including accessor
 *  descriptors and missing descriptors)
 * @internal
 */
export function hasInertValue(type: unknown, key: PropertyKey): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Signature Readers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns the value's internal `[[Class]]` signature.
 *
 * Reads the tag through `Object.prototype.toString.call`, which is the
 * realm-independent read of a value's built-in type and is immune to a
 * missing or overridden instance `toString`.
 *
 * @param value - the value to read
 * @returns the `[object Tag]` string for the value
 * @example
 * getTypeSignature([]);                // '[object Array]'
 * getTypeSignature(null);              // '[object Null]'
 * getTypeSignature(Promise.resolve()); // '[object Promise]'
 */
export function getTypeSignature(value: unknown): TypeSignature;

/**
 * The no-argument overload. Returns `undefined`, distinguishing an
 * omitted call from one that passed `undefined` explicitly.
 */
export function getTypeSignature(): undefined;

/**
 * Returns the tag portion of a value's type signature.
 *
 * Wraps {@link getTypeSignature} and extracts the substring inside the
 * `[object …]` wrapper. Custom tags installed via `Symbol.toStringTag`
 * are honored.
 *
 * @param value - the value whose tag should be extracted
 * @returns the tag substring
 * @example
 * getTaggedType([]);                                 // 'Array'
 * getTaggedType(new Date());                         // 'Date'
 * getTaggedType({ [Symbol.toStringTag]: 'Custom' }); // 'Custom'
 */
export function getTaggedType(value: unknown): TaggedType;

/**
 * The no-argument overload. Returns `undefined`, mirroring
 * {@link getTypeSignature}'s contract.
 */
export function getTaggedType(): undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Constructor Inspection
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Walks the value to its constructor function via inert descriptor
 * traversal.
 *
 * Pivot — callable values are walked from themselves (finding their
 * own constructor: `Function` for plain functions, `%GeneratorFunction%`
 * for generator functions, `%AsyncFunction%` for async functions, etc.);
 * non-callable values are walked from their `[[Prototype]]`. The
 * non-callable pivot deliberately bypasses the value's own
 * `constructor` data descriptor — user-supplied tampering on plain
 * objects (e.g., `{ constructor: 'tampered' }`, `{ constructor: Array }`)
 * cannot influence the result.
 *
 * When the caller knows the input IS itself a real prototype object
 * (the result of `getPrototypeOf(instance)`, an `X.prototype` reference,
 * etc.), passing `{ assumePrototype: true }` skips the walk-up step and
 * lets the descriptor walk start at the value itself, reading the
 * spec-mandated own `constructor` (ECMA-262 §10.2.6).
 *
 * Two-stage walk: the first stage finds the first `constructor`
 * descriptor along the pivot's `[[Prototype]]` chain; if its value is a
 * function it is returned. For the generator-function family the first
 * stage lands on a descriptor whose value is itself an OBJECT
 * (`%GeneratorFunction.prototype%` or `%AsyncGeneratorFunction.prototype%`),
 * and the second stage walks that object to recover the actual function
 * constructor.
 *
 * Fully inert — accessor getters are never invoked. The returned value
 * is always either `undefined` or a function asserted as
 * {@link NewableFunction}; the `[[Construct]]` slot cannot be probed
 * without invoking, so newability is asserted rather than verified.
 *
 * @param value - the value whose constructor should be retrieved
 * @param options - call-site hints
 * @param options.assumePrototype - treats `value` as a real
 *  prototype-object and walks from `value` itself rather than
 *  from `getPrototypeOf(value)`. Defaults to `false`.
 * @returns the constructor function when reachable; `undefined` otherwise
 * @example
 * getDefinedConstructor([]);                                          // Array
 * getDefinedConstructor(new Date());                                  // Date
 * getDefinedConstructor(Object.create(null));                         // undefined
 * getDefinedConstructor((function* () {})());                         // GeneratorFunction
 * getDefinedConstructor({ constructor: 'tampered' });                 // Object
 * getDefinedConstructor(Object.prototype, { assumePrototype: true }); // Object
 */
export function getDefinedConstructor(
  value?: unknown,
  options?: DefinedConstructorAccessorOptions,
): NewableFunction | undefined;

/**
 * Returns the constructor's `name` via its property descriptor.
 *
 * `name` is spec-defined as an own data descriptor on every function
 * (ECMA-262 §10.2.9 `SetFunctionName`), so reading via
 * `getOwnPropertyDescriptor(constructor, 'name').value` returns the data
 * value directly. An accessor on `name` — e.g., a malicious
 * `Object.defineProperty(Cls, 'name', { get: () => 'Spoofed' })` — leaves
 * the descriptor's `value` undefined and is therefore rejected by the
 * string-check narrow that follows. No direct-access fallback, because
 * direct `.name` access would invoke the accessor.
 *
 * Edge cases:
 *
 * - A non-string `name` (for example, a malicious replacement that
 *   overrides `name` with a non-string value) yields `undefined` rather
 *   than leaking through.
 * - An unnamed function returns the empty string `''`.
 * - A value with no reachable constructor returns `undefined`.
 *
 * @param value - the value whose constructor name should be retrieved
 * @returns the constructor's name string when reachable; `undefined`
 *  otherwise
 * @example
 * getDefinedConstructorName([]);         // 'Array'
 * getDefinedConstructorName(new Date()); // 'Date'
 * getDefinedConstructorName(null);       // undefined
 */
export function getDefinedConstructorName(value?: unknown): ConstructorName | undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type Resolution
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Resolves a value to its type-name.
 *
 * Tries the constructor-name when reachable; falls back to the
 * tagged-type otherwise. The fallback also fires when the value's
 * `constructor` slot has been replaced with a non-callable.
 *
 * Works for every built-in. Custom types remain stable across
 * minification only if both the constructor's `name` descriptor and the
 * prototype's `Symbol.toStringTag` are frozen.
 *
 * @param value - the value whose type-name should be resolved
 * @returns the resolved type-name (constructor-name or tagged-type)
 * @example
 * resolveType([]);                // 'Array'
 * resolveType(Promise.resolve()); // 'Promise'
 * resolveType(null);              // 'Null'
 */
export function resolveType(value: unknown): ResolvedType;

/**
 * The no-argument overload. Returns `undefined`, distinguishing an
 * omitted call from one that passed `undefined` explicitly.
 */
export function resolveType(): undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
