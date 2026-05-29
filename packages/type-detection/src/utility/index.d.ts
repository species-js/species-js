/**
 * @module @species-js/type-detection/utility
 *
 * Cached prototype references and type-signature helpers, used internally by
 * the package's predicates and exposed via subpath for downstream packages
 * that need the same cross-realm-safe primitives.
 */

import type { NewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Property Descriptor Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A property descriptor — the shape `Object.getOwnPropertyDescriptor` returns
 * and `Object.defineProperty` accepts. Mirrors TypeScript's built-in
 * `PropertyDescriptor` so it can be named from JSDoc; the `value` slot defaults
 * to `unknown` per the package's typing discipline.
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
 * A record of {@link PropertyDescriptor}s keyed by string or symbol — the shape
 * `Object.getOwnPropertyDescriptors` returns.
 */
export interface PropertyDescriptorMap {
  [key: string]: PropertyDescriptor;
  [key: symbol]: PropertyDescriptor;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object-Shape Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An object whose properties are *typed away* — `Record<PropertyKey, never>`
 * makes every key statically unreachable. The intended runtime carrier is
 * `Object.create(null)`, but the absence of a prototype chain is a runtime
 * characteristic TypeScript cannot express; this type only marks an object's
 * static surface as empty.
 */
export type BlankType = Record<PropertyKey, never>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Name String Aliases
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A constructor function's `name` — the string read from a value's
 * constructor.
 */
export type ConstructorName = string;

/**
 * A `Symbol.toStringTag` value — the string inside the `[object …]` wrapper
 * that `Object.prototype.toString.call` returns. Maybe a built-in tag
 * (`'Array'`, `'Date'`, `'Promise'`, …) or a custom tag installed via the
 * well-known symbol.
 */
export type TaggedType = string;

/**
 * A JavaScript value's resolved type-name — either its constructor-name
 * ({@link ConstructorName}) or its tagged-type ({@link TaggedType}). Both are
 * `string` at the type level; the distinction is provenance, carried by the
 * producers' return types rather than enforced nominally here.
 */
export type ResolvedType = string;

/**
 * The `[object Tag]` string `Object.prototype.toString.call` returns — a
 * template-literal type built from {@link TaggedType}, so the structural
 * distinction `'[object Array]' !== 'Array'` survives in the type system.
 */
export type TypeSignature = `[object ${TaggedType}]`;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype-Property Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects an own `prototype` property on the value. Inherited prototypes (e.g.,
 * arrow functions inheriting from `Function.prototype`) are deliberately
 * excluded — the test reads the descriptor directly, not the inheritance
 * chain.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  has no own prototype
 * @returns `true` when the value carries an own `prototype` property; `false`
 *  otherwise
 */
export function hasOwnPrototype(value?: unknown): boolean;

/**
 * Detects an own `prototype` property whose descriptor is `writable: true` —
 * the structural tell of an `ES3Function` versus a `ClassConstructor` (whose
 * own `prototype` is read-only).
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
 * Narrows a value to `PropertyKey` — accepts strings, symbols, and *finite*
 * numbers. `NaN` and `±Infinity` are excluded because they cannot serve as
 * enumerated property keys without coercion surprises.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a property key
 * @returns `true` when the value can be safely used as a property key,
 *  narrowing `value` to `PropertyKey`; `false` otherwise
 */
export function isValidPropertyKey(value?: unknown): value is PropertyKey;

/**
 * Returns the {@link PropertyDescriptor} for the next reachable property under
 * `key`, walking own properties first and then the prototype chain. Accessor
 * descriptors are returned intact — the getter is *not* invoked.
 *
 * @param value - the object whose descriptor chain should be inspected
 * @param key - the property key to resolve; invalid keys yield `undefined`
 * @returns the first descriptor found while walking up the chain; `undefined`
 *  if none exists
 */
export function getNextAvailablePropertyDescriptor(
  value: object,
  key: PropertyKey,
): PropertyDescriptor | undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Signature Readers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns the value's internal `[[Class]]` signature via
 * `Object.prototype.toString.call` — the realm-independent read of a value's
 * built-in type, immune to a missing or overridden instance `toString`.
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
 * The no-argument overload — returns `undefined`, distinguishing an *omitted*
 * call from one that passed `undefined` explicitly.
 */
export function getTypeSignature(): undefined;

/**
 * Returns the tag portion of a value's type signature — wraps
 * {@link getTypeSignature} and extracts the substring inside the `[object …]`
 * wrapper. Custom tags installed via `Symbol.toStringTag` are honored.
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
 * The no-argument overload — returns `undefined`, mirroring
 * {@link getTypeSignature}'s contract.
 */
export function getTaggedType(): undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Constructor Inspection
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Walks the value to its constructor function, defending against tampered
 * `constructor` slots and prototype-less objects. Inspects the value's own
 * `constructor` descriptor first; if that yields a non-callable, falls back to
 * the prototype's `constructor`; if still nothing, returns `undefined`.
 *
 * The return type is {@link NewableFunction} because a real constructor is by
 * definition newable, but the runtime guard verifies callability only — the
 * `[[Construct]]` slot cannot be probed without invoking, so the result is
 * asserted rather than verified.
 *
 * @param value - the value whose constructor should be retrieved
 * @returns the constructor function when reachable; `undefined` otherwise
 * @example
 * getDefinedConstructor([]);                  // Array
 * getDefinedConstructor(new Date());          // Date
 * getDefinedConstructor(Object.create(null)); // undefined
 */
export function getDefinedConstructor(value?: unknown): NewableFunction | undefined;

/**
 * Returns the constructor's `name` via its property descriptor — so an
 * instance-level shadow cannot spoof a frozen, branded constructor name. An
 * unnamed function returns the empty string `''`; a value with no reachable
 * constructor returns `undefined`.
 *
 * @param value - the value whose constructor name should be retrieved
 * @returns the constructor's name string when reachable; `undefined` otherwise
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
 * Resolves a value to its type-name — its constructor-name when reachable,
 * falling back to the tagged-type. Works for every built-in; for custom types
 * to remain stable across minification, freeze both the constructor's `name`
 * descriptor and the prototype's `Symbol.toStringTag`.
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
 * The no-argument overload — returns `undefined`, distinguishing an *omitted*
 * call from one that passed `undefined` explicitly.
 */
export function resolveType(): undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
