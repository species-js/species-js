/**
 * @module @species-js/type-detection/utility
 *
 * Cached prototype references and type-signature helpers, used internally by
 * the package's predicates and exposed via subpath for downstream packages
 * that need the same cross-realm-safe primitives.
 */

import type { NewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Mirrors TypeScript's built-in `PropertyDescriptor` for JSDoc usage.
 * This allows JSDoc type annotations to reference `PropertyDescriptor`
 * without ESLint's `jsdoc/no-undefined-types` rule complaining.
 *
 * A property descriptor describes the attributes of a property on an object.
 */
export interface PropertyDescriptor {
  /** The value associated with the property (data descriptors only) */
  value?: unknown;
  /** Whether the property value can be changed (data descriptors only) */
  writable?: boolean;
  /** A function serving as a getter for the property (accessor descriptors only) */
  get?: () => unknown;
  /** A function serving as a setter for the property (accessor descriptors only) */
  set?: (v: unknown) => void;
  /** Whether the property shows up during enumeration (for...in, Object.keys) */
  enumerable?: boolean;
  /** Whether the property descriptor can be changed and property can be deleted */
  configurable?: boolean;
}

/**
 * A record of property-descriptors keyed by property-name.
 * This is the return type of `Object.getOwnPropertyDescriptors()`.
 */
export interface PropertyDescriptorMap {
  [key: string]: PropertyDescriptor;
  [key: symbol]: PropertyDescriptor;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Represents an object with no properties, typically created via
 * `Object.create(null)`.
 *
 * Note: TypeScript cannot express the absence of a prototype chain
 * at the type level - that's a runtime characteristic. This type
 * indicates an object where no properties are expected to exist.
 */
export type BlankType = Record<PropertyKey, never>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The constructor-name of a JavaScript type.
 */
export type ConstructorName = string;

/**
 * The string-value representation of a JavaScript type ...
 *  - as defined by the `[Symbol.toStringTag]` key,
 *     e.g., `const obj = { [Symbol.toStringTag]: 'CustomType' };`
 *  - and as returned within the type-signature via
 *    the invocation of `Object.prototype.toString.call`,
 *     e.g., `Object.prototype.toString.call(obj) === '[object CustomType]' // true`
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
 * The _type-signature_ string-value that represents a JavaScript object-type as returned
 * by the invocation of `Object.prototype.toString.call`, e.g., `'[object Promise]'`.
 */
export type TypeSignature = `[object ${TaggedType}]`;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether a passed value features an own `prototype` property.
 * @param value - An optionally passed value of an unknown type.
 * @returns A boolean value that indicates whether the
 *  passed value features an own `prototype` property.
 */
export function hasOwnPrototype(value?: unknown): boolean;

/**
 * Detects whether a passed value features an own, truly `writable`
 * `prototype` property.
 * @param value - An optionally passed value of an unknown type.
 * @returns A boolean value that indicates whether a passed value
 * features an own, truly `writable` `prototype` property.
 */
export function hasOwnWritablePrototype(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether a passed value is a valid JavaScript property key.
 * @param value - The value to validate.
 * @returns Whether the value can be safely used as a property key.
 */
export function isValidPropertyKey(value?: unknown): value is PropertyKey;

/**
 * Returns the next available property descriptor for the given property key by
 * inspecting the passed object's own properties first and then walking its
 * prototype chain.
 *
 * Accessor properties are not invoked. Their descriptor is returned as-is.
 * Invalid property keys return `undefined`.
 * @param value - The object whose descriptor chain should be inspected.
 * @param key - The property key to resolve.
 * @returns The resolved property descriptor, if present.
 */
export function getNextAvailablePropertyDescriptor(
  value: object,
  key: PropertyKey,
): PropertyDescriptor | undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns the internal `[[Class]]` type signature of a value
 * by utilizing `Object.prototype.toString.call`.
 * @param value - The value to get the type signature for.
 * @returns The type signature string, e.g., `"[object Promise]"`.
 */
export function getTypeSignature(value: unknown): TypeSignature;

/**
 * Returns the `undefined` value when called with no arguments.
 */
export function getTypeSignature(): undefined;

/**
 * Returns the tag name extracted from a value's internal type signature.
 *
 * Wraps `getTypeSignature` and extracts the `[[Class]]` tag name -
 * e.g., `'Array'` for arrays, `'Date'` for dates, or custom tags
 * defined via `Symbol.toStringTag`.
 * @param value - The value to get the tagged type for.
 * @returns The extracted tag name (e.g., `'Array'`, `'Date'`).
 * @example
 * getTaggedType([]); // 'Array'
 * getTaggedType(new Date()); // 'Date'
 * getTaggedType({ [Symbol.toStringTag]: 'Custom' }); // 'Custom'
 */
export function getTaggedType(value: unknown): TaggedType;

/**
 * Returns `undefined` when called with no arguments.
 */
export function getTaggedType(): undefined;

/**
 * Retrieves a value's constructor function if available.
 *
 * Traverses the prototype chain to find a valid constructor,
 * handling edge cases like manipulated `constructor` slots
 * and objects created via `Object.create(null)`.
 * @param value - An optionally passed value of any type.
 * @returns The constructor function if available, otherwise `undefined`.
 * @example
 * getDefinedConstructor([]); // Array
 * getDefinedConstructor(new Date()); // Date
 * getDefinedConstructor(Object.create(null)); // undefined
 */
export function getDefinedConstructor(value?: unknown): NewableFunction | undefined;

/**
 * Returns the constructor-function name of the passed value.
 *
 * Retrieves the `name` property from the value's constructor function.
 * The name is obtained from the function's property descriptor,
 * which by default is non-writable, non-enumerable, but configurable.
 * @param value - An optionally passed value of any type.
 * @returns The constructor-function name, or `undefined` if not available.
 *   Unnamed functions return an empty string `''`.
 * @example
 * getDefinedConstructorName([]); // 'Array'
 * getDefinedConstructorName(new Date()); // 'Date'
 * getDefinedConstructorName(null); // undefined
 */
export function getDefinedConstructorName(value?: unknown): ConstructorName | undefined;

/**
 * Resolves the passed value's type-name through a combined, balanced approach
 * of retrieving either the value's constructor-function name or its `toString` tag.
 *
 * Works for every built-in type. For custom types to remain stable across
 * code minification, constructor functions should have their `name` property
 * and `Symbol.toStringTag` branded and frozen.
 * @param value - The value to resolve the type for.
 * @returns The resolved type name (constructor name or tagged type).
 * @example
 * resolveType([]); // 'Array'
 * resolveType(Promise.resolve()); // 'Promise'
 * resolveType(null); // 'Null'
 */
export function resolveType(value: unknown): ResolvedType;

/**
 * Returns `undefined` when called with no arguments.
 */
export function resolveType(): undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
