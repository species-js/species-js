/**
 * @module @species-js/custom-domain
 *
 * Customizable prototype-less namespace objects
 * for sealed method grouping.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A null-prototype object that serves as a custom namespace, similar to
 * an ECMAScript `Module`-type namespace. Its intended usage is to serve
 * as a named, identifiable entry-point for cross-realm type-detection.
 *
 * Created by {@link createCustomNamespace}, it carries a `Symbol.toStringTag`
 * of `'CustomNamespace'` and a `Symbol.toPrimitive` that returns
 * `"[namespace '<name>']"` for every hint the engine supplies — `'string'`,
 * `'number'` and `'default'` alike — so `String(ns)`, `` `${ns}` `` and
 * `ns + ''` all agree. The namespace has no numeric meaning, so `+ns` is
 * `NaN`. All own properties from
 * the provided exports are copied as read-only — including the
 * non-enumerable and symbol-keyed ones, and non-configurably, so a copied
 * member can be neither reassigned, redefined nor deleted. The object itself
 * is frozen, so nothing can be attached to it either.
 */
export interface CustomNamespace {
  readonly [Symbol.toStringTag]: 'CustomNamespace';
  readonly [Symbol.toPrimitive]: (hint: string) => string | undefined;
  readonly [key: PropertyKey]: unknown;
}

/**
 * Creates a null-prototype object, a custom namespace branded with
 * the provided name.
 *
 * The returned object has:
 * - All own properties from `exports` copied as read-only
 * - `Symbol.toStringTag` set to `'CustomNamespace'`
 * - `Symbol.toPrimitive` returning `"[namespace '<name>']"` for every hint the
 *   engine supplies
 *
 * Copied members are non-writable and non-configurable, so they can be neither
 * reassigned, redefined nor deleted. A source accessor keeps its getter and
 * loses its setter; its getter is never invoked during the copy, only its
 * descriptor is moved. `enumerable` mirrors the source.
 *
 * The namespace is frozen before it is returned, so it is non-extensible as
 * well: nothing can be attached to it afterwards. `Object.isSealed` and
 * `Object.isFrozen` both report `true`. A real ES module namespace is
 * non-extensible for the same reason — the shape a detector inspects has to be
 * the shape the builder produced.
 *
 * `Symbol.toPrimitive` and `Symbol.toStringTag` are reserved: the namespace
 * defines both, and an `exports` carrying either is rejected rather than
 * silently overwritten.
 *
 * This is a builder, not a predicate. It either returns a complete namespace or
 * throws — `exports` is read through the unguarded forms, so a source that
 * cannot be enumerated or described surfaces instead of producing a namespace
 * that looks whole and is not. `exports` is expected to be the author's own
 * module surface at definition time.
 *
 * `exports` is required and must carry at least one own property. An object
 * literal qualifies, so does a prototype-less `Object.create(null)` bag, and so
 * does a benign `Proxy` over either; an array, a function, a class instance and
 * every primitive do not. An already-built namespace does not qualify either —
 * a namespace is a terminal artifact, not raw material for another one.
 *
 * ## Rejection order
 *
 * Fixed, and part of the contract — the first blocker wins, so one mistake
 * always reports the same way:
 *
 * 1. `exports` is neither a plain object nor a prototype-less dictionary
 * 2. `exports` has no own property
 * 3. `exports` carries a reserved key
 *
 * @param name - The namespace name. One that trims to empty yields
 *  `"[namespace '']"`.
 * @param exports - The exports to copy onto the namespace.
 * @returns The created namespace object.
 * @throws {TypeError} when `exports` is neither a plain object nor a
 *  prototype-less dictionary
 * @throws {TypeError} when `exports` has no own property
 * @throws {TypeError} when `exports` carries `Symbol.toPrimitive` or
 *  `Symbol.toStringTag`
 * @throws {unknown} at a malicious `ownKeys` or `getOwnPropertyDescriptor`
 *  proxy-trap on `exports`
 */
export function createCustomNamespace(
  name: string,
  exports: Record<PropertyKey, unknown>,
): CustomNamespace;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
