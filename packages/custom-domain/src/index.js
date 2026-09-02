// @ts-check

/**
 * @module @species-js/custom-domain
 *
 * Prototype-less namespace objects that group a module's exports behind one
 * named, identifiable value — sealed, so the grouping cannot be added to or
 * taken apart once built.
 *
 * One public entry, {@link createCustomNamespace}, composed from three
 * module-local helpers: a `Symbol.toPrimitive` implementation, a descriptor
 * recomposer, and the reduce callback that writes each member. None of the
 * three is exported — every branch they carry is reachable through the entry,
 * and a direct test would pin inputs the entry normalizes away.
 *
 * The builder reads `exports` through the RAW key and descriptor forms rather
 * than type-detection's `getSafe*` twins. That is the deliberate half of the
 * raw/throw-safe pairing: a namespace quietly missing a member is worse than
 * one that fails to build.
 *
 * See the sibling `.d.ts` for the consumer-facing contract; this file carries
 * the implementation and the reasoning a maintainer needs.
 */

import {
  globalContext,
  objectAssign,
  objectFreeze,
  defineProperty,
  getOwnPropertyDescriptor,
} from '#config';

import {
  objectCreate,
  frozenDataDescriptor,
  getOwnPropertyKeys,
  isBooleanValue,
  isPlainOrDictionaryObject,
  isString,
} from '@species-js/type-detection';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@species-js/type-detection').PropertyDescriptor} PropertyDescriptor */

/** @typedef {import('#index').CustomNamespace} CustomNamespace */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const String = globalContext.String;
const TypeError = globalContext.TypeError;

const toPrimitiveSymbol = globalContext.Symbol.toPrimitive;
const toStringTagSymbol = globalContext.Symbol.toStringTag;

/**
 * The two keys the builder defines itself, and therefore refuses to copy.
 *
 * A source carrying either would be silently overwritten — or, since the copied
 * member is non-configurable, would make the later definition throw from deep
 * inside the build. Rejecting them up front turns both into one stated rule.
 *
 * Keyed over `string | symbol` so the mixed key list `getOwnPropertyKeys`
 * returns can be probed directly; the members themselves are always symbols.
 * @type {Set<(string | symbol)>}
 * @internal
 */
const reservedNamespaceKeys = new Set([toPrimitiveSymbol, toStringTagSymbol]);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Module-local, and deliberately not exported — every branch is reachable
 * through `createCustomNamespace` via the namespace's own `Symbol.toPrimitive`,
 * and a direct test would exercise a `name` the public entry normalizes away.
 *
 * All three hints the engine supplies — `'string'`, `'number'` and
 * `'default'` — map to the same representation, so a namespace has exactly one
 * primitive form. `'number'` included: the value has no numeric meaning, and
 * answering the same string keeps `+ns` at `NaN` while leaving `ns + ''` and
 * `String(ns)` in agreement. Every builtin holds that agreement; returning
 * `undefined` for `'default'` broke it, since `undefined + ''` is `'undefined'`.
 *
 * The lookup table is prototype-less, so a hint naming an inherited member
 * (`'toString'`, `'constructor'`) misses rather than resolving to a function
 * the declared return type does not admit. A hint outside the three still
 * yields `undefined`, which is why the return type keeps that arm.
 * @param {string} name - The namespace name used in the string representation.
 * @param {string} hint - The type conversion hint.
 * @returns {string | undefined} The primitive string representation for any of
 *  the three engine-supplied hints; `undefined` for anything else.
 * @throws {unknown} when a caller passes a hint whose own `toString` throws.
 *  The engine only ever supplies `'string'`, `'number'` or `'default'`; this
 *  reaches the caller who invoked the namespace's `Symbol.toPrimitive` directly.
 * @internal
 */
function toPrimitive(name, hint) {
  const representation = `[namespace '${name}']`;

  return /** @type {string | undefined} */ (
    /** @type {Record<string, string>} */ (
      objectAssign(objectCreate(null), {
        string: representation,
        number: representation,
        default: representation,
      })
    )[String(hint || '').trim()]
  );
}

/**
 * Module-local, and deliberately not exported — what it returns is observable
 * through `getOwnPropertyDescriptor` on a built namespace.
 *
 * The read is unguarded by choice, matching the raw half of type-detection's
 * raw/throw-safe pairing. A `key` from `getOwnPropertyKeys` is one the source
 * reported a moment earlier, which is not the same as one it will still
 * describe: a `Proxy` may report a key from `ownKeys` and then answer
 * `undefined` — or throw — from `getOwnPropertyDescriptor`. Both surface to
 * the caller rather than yielding a quietly incomplete namespace.
 * @param {object} source - The source to read the property-descriptor from.
 * @param {string | symbol} key - The property key that targets the source's descriptor.
 * @returns {PropertyDescriptor} The recomposed descriptor — the source's, with
 *  any setter dropped and both `writable` and `configurable` forced `false`.
 * @throws {unknown} at a malicious `getOwnPropertyDescriptor` proxy-trap
 * @throws {TypeError} when the source reports no descriptor for a key its own
 *  `ownKeys` listed
 * @internal
 */
function createNSPropDescriptor(source, key) {
  const {
    // destructure `set` ... omit it at the recomposition (regardless of its existence).
    set: _omitted1,
    // destructure `configurable` ...omitted, but hardwired as false at the recomposition.
    configurable: _omitted2,
    // destructure `writable` ... in case it exists, recompose it always a non-writable.
    writable,
    // the descriptor rest ... provide it as new descriptor-base at recomposition-time.
    ...descriptor
  } = /** @type {PropertyDescriptor} */ (getOwnPropertyDescriptor(source, key));

  return {
    ...descriptor,
    ...(isBooleanValue(writable) ? { writable: false } : {}),
    configurable: false,
  };
}

/**
 * The `target` is always a fresh prototype-less object and every `key` is
 * distinct, so each definition creates a property that does not yet exist. No
 * redefinition rule applies, and no descriptor shape the source can produce
 * makes the write illegal — which is why the recomposition above is free to
 * hardwire its flags.
 * @param {{ source: object, target: object }} accumulator - The source/target pair.
 * @param {string | symbol} key - The property key to copy.
 * @returns {{ source: object, target: object }} The same accumulator for chaining.
 * @throws {unknown} propagated from {@link createNSPropDescriptor}'s unguarded
 *  descriptor read
 * @internal
 */
function aggregateNamespaceTarget({ source, target }, key) {
  defineProperty(target, key, createNSPropDescriptor(source, key));

  return { source, target };
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Creates a null-prototype object, a custom namespace branded with
 * the provided name.
 *
 * The returned object has:
 * - All own properties from `exports` copied as read-only
 * - `Symbol.toStringTag` set to `'CustomNamespace'`
 * - `Symbol.toPrimitive` returning `"[namespace '<name>']"` for every hint the
 *   engine supplies, so `String(ns)`, `` `${ns}` `` and `ns + ''` agree
 *
 * A builder, not a predicate — it either yields a complete namespace or fails.
 * The reads over `exports` are therefore the raw, unguarded forms, so an
 * unreadable source surfaces instead of yielding a namespace that looks whole
 * and is not. `exports` is expected to be the author's own module surface at
 * definition time, which is what makes failing loudly the cheap option.
 *
 * `exports` is required and validated by `isPlainOrDictionaryObject` rather
 * than the stricter `isPlainObject`, so an `Object.assign(Object.create(null),
 * {…})` bag qualifies alongside an object literal — that prototype-less form is
 * this repo's own house convention, and rejecting it would refuse the shape a
 * maintainer following CLAUDE.md would reach for. A benign `Proxy` over either
 * qualifies; an array, a function, a class instance and every primitive do not.
 *
 * An already-built namespace does NOT qualify, under either predicate: its
 * `Symbol.toStringTag` brand disqualifies it as a dictionary. A namespace is a
 * terminal artifact, not raw material for another one.
 * @param {string} name - The namespace name. The `.d.ts` types it `string`,
 *  which is the contract; at runtime a non-string is tolerated rather than
 *  coerced — `isString` gates the trim, so anything else falls to `''`.
 * @param {Record<PropertyKey, unknown>} exports - The exports to copy onto
 *  the namespace. At least one own property is required.
 * @returns {CustomNamespace} The created namespace object.
 * @throws {TypeError} when `exports` is neither a plain object nor a
 *  prototype-less dictionary
 * @throws {TypeError} when `exports` has no own property
 * @throws {TypeError} when `exports` carries `Symbol.toPrimitive` or
 *  `Symbol.toStringTag` — the namespace defines both itself
 * @throws {unknown} at a malicious `ownKeys` or `getOwnPropertyDescriptor`
 *  proxy-trap on `exports`, which the shape check admits
 */
export function createCustomNamespace(name, exports) {
  // - the three rejections run argument-shape first, then contents, and the
  //   first blocker wins. The order is contract, not incidental: a caller
  //   fixing one rejection must not be handed a different one for the same
  //   mistake.

  if (!isPlainOrDictionaryObject(exports)) {
    throw new TypeError(
      `'exports' must be a plain object or a prototype-less dictionary — an array, function, class instance or primitive is not one.`,
    );
  }
  const exportKeys = getOwnPropertyKeys(exports);

  if (exportKeys.length === 0) {
    throw new TypeError(
      `'exports' must carry at least one own property — an empty namespace has nothing to name.`,
    );
  }
  const reservedKeys = exportKeys.filter((key) => reservedNamespaceKeys.has(key));

  if (reservedKeys.length > 0) {
    // - rejected here rather than left to the definitions below, which would
    //   fail against the already-copied non-configurable member and report an
    //   internal key collision instead of the caller's mistake.
    throw new TypeError(
      `'exports' must not carry the reserved ${reservedKeys.map(String).join(' and ')} — the namespace defines its own.`,
    );
  }

  const { target: namespace } = /** @type {Record<string, object>} */ (
    exportKeys.reduce(aggregateNamespaceTarget, {
      source: exports,
      target: objectCreate(null),
    })
  );
  defineProperty(namespace, toPrimitiveSymbol, {
    ...frozenDataDescriptor,
    value: (
      (value) => (/** @type {string} */ hint) =>
        toPrimitive(value, hint)
    )((isString(name) && String(name).trim()) || ''),
  });
  defineProperty(namespace, toStringTagSymbol, {
    ...frozenDataDescriptor,
    value: 'CustomNamespace',
  });

  // - last, after both symbol definitions, which a frozen target would reject.
  //   A real ES module namespace is non-extensible too; leaving this one open
  //   would mean the shape a detector inspects is not the shape built here.
  return /** @type {CustomNamespace} */ (objectFreeze(namespace));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
