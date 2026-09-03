// @ts-check

/**
 * @module @species-js/custom-domain
 *
 * Prototype-less namespace objects that group a module's exports behind one
 * named, identifiable value — frozen, so the grouping cannot be added to or
 * taken apart once built.
 *
 * One public entry, {@link createCustomNamespace}, composed from three
 * module-local helpers: a `Symbol.toPrimitive` implementation, a member
 * resolver, and the reduce callback that writes each member. None of the three
 * is exported — every branch they carry is reachable through the entry, and a
 * direct test would pin inputs the entry normalizes away.
 *
 * The builder RESOLVES rather than copies. Every own key of `exports` is
 * reduced to a value once, at build time — a data member by its value, an
 * accessor by invoking its getter — and written as a frozen data property whose
 * only variable is its visibility. The namespace is a snapshot, not a view:
 * nothing it exposes re-enters the source afterward.
 *
 * The caller keeps exactly one axis of control, `enumerable`; the builder's own
 * two structural symbols are always hidden, so identity never rides along on a
 * copy of the namespace.
 *
 * Reads over `exports` use the RAW key and descriptor forms rather than
 * type-detection's `getSafe*` twins, and a getter is invoked unguarded. That is
 * the deliberate half of the raw/throw-safe pairing: a source that cannot be
 * enumerated, described or read fails the build, because a namespace quietly
 * missing a member is worse than one that never gets built. The single
 * member-level omission that is NOT a failure is a member with no readable
 * value at all — see {@link createNamespacePropDescriptor}.
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
  frozenEntryDescriptor,
  frozenDataDescriptor,
  objectCreate,
  objectHasOwn,
  getOwnPropertyKeys,
  isPlainOrDictionaryObject,
  isCallable,
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
 * A source carrying either would be resolved into a non-configurable member and
 * then collide with the builder's own definition, throwing from deep inside the
 * build with a message naming an internal redefinition rather than the caller's
 * mistake. Rejecting the key up front turns that into one stated rule.
 *
 * Keyed over `string | symbol` so the mixed key list `getOwnPropertyKeys`
 * returns can be probed directly; the members themselves are always symbols.
 * @type {Set<string | symbol>}
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
 * Resolves one own member of `source` to the frozen data descriptor the
 * namespace will carry, or to `null` when that member has no readable value.
 *
 * Module-local, and deliberately not exported — every branch is reachable
 * through {@link createCustomNamespace}.
 *
 * RESOLVE, not copy. A data descriptor contributes its `value`; an accessor has
 * its getter invoked once, here, with `source` as receiver so a getter reading
 * sibling members still sees them. Either way the member lands as a frozen data
 * property, so the namespace holds exactly one member shape and no live accessor
 * survives into it. That is what makes the namespace a snapshot: a later read
 * cannot re-enter the source, vary, or throw.
 *
 * `enumerable` is the ONE flag the source keeps, and the reason is a difference
 * in kind. `writable`, `configurable` and the accessor pair are overridden
 * because they are what a namespace IS — read-only, sealed, resolved — so
 * overriding them discards nothing the author meant. `enumerable` carries
 * authorial intent instead: "this is part of my surface" or "this is internal",
 * orthogonal to everything the namespace enforces. An object literal makes every
 * member enumerable, so honoring the flag costs the ordinary caller nothing,
 * while reaching for `Object.defineProperty` to clear it is never accidental.
 * The builder overrides what you did not have to spell out and preserves the one
 * thing you did.
 *
 * The `null` arm is the one member-level omission that is not a failure. A
 * setter-only accessor — or one carrying neither half — has nothing to resolve,
 * and is left off rather than written as a key that could never answer. Such a
 * key would be indistinguishable on read from a genuinely `undefined` export
 * while still appearing in `in` and the own-key listings, so omitting it is the
 * honest outcome.
 *
 * Nothing here is guarded. A hostile `getOwnPropertyDescriptor` trap, a key
 * `ownKeys` reported that no descriptor describes, and a getter that throws all
 * propagate to the caller of {@link createCustomNamespace}.
 * @param {object} source - The object whose own member is being resolved.
 * @param {string | symbol} key - The own property key to resolve.
 * @returns {PropertyDescriptor | null} A frozen data descriptor carrying the
 *  resolved value; `null` when the member has no readable value.
 * @throws {unknown} at a malicious `getOwnPropertyDescriptor` proxy-trap, or
 *  from a source getter invoked here
 * @throws {TypeError} when the source reports no descriptor for a key its own
 *  `ownKeys` listed
 * @internal
 */
function createNamespacePropDescriptor(source, key) {
  const descriptor = /** @type {PropertyDescriptor} */ (
    getOwnPropertyDescriptor(source, key)
  );

  // - the one flag the source gets to keep. `frozenDataDescriptor` is the
  //   visible pair, `frozenEntryDescriptor` the hidden one; both are otherwise
  //   identical, so the member shape stays uniform and only visibility varies.
  const flags =
    descriptor.enumerable === true ? frozenDataDescriptor : frozenEntryDescriptor;

  if (objectHasOwn(descriptor, 'value')) {
    return {
      ...flags,
      value: descriptor.value,
    };
  }
  const { get } = descriptor;

  // - `objectHasOwn(descriptor, 'get')` would also admit a setter-only
  //   accessor, whose `get` is present but `undefined`; the callable test
  //   answers the question that actually matters and lets that case fall
  //   through to the valueless return rather than into a TypeError on a
  //   non-callable.
  if (isCallable(get)) {
    return {
      ...flags,
      value: get.call(source),
    };
  }
  return null;
}

/**
 * The reduce callback that writes one resolved member onto the target.
 *
 * `target` is always a fresh prototype-less object and every `key` is distinct,
 * so each definition creates a property that does not yet exist. No
 * redefinition rule applies, and no descriptor the resolver can produce makes
 * the write illegal — which is why the resolver is free to hardwire its flags.
 *
 * A `null` from the resolver means the member had no readable value; that key
 * is skipped rather than written.
 * @param {{ source: object, target: object }} accumulator - The source/target pair.
 * @param {string | symbol} key - The own property key to resolve and write.
 * @returns {{ source: object, target: object }} The same accumulator for chaining.
 * @throws {unknown} propagated from {@link createNamespacePropDescriptor} — an
 *  unguarded descriptor read or getter invocation
 * @internal
 */
function aggregateNamespaceTarget({ source, target }, key) {
  const descriptor = createNamespacePropDescriptor(source, key);

  if (descriptor !== null) {
    defineProperty(target, key, descriptor);
  }
  return { source, target };
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Creates a null-prototype object, a custom namespace branded with
 * the provided name.
 *
 * The returned object has:
 * - Every own member of `exports` resolved once to a frozen value, keeping the
 *   source's `enumerable` flag
 * - `Symbol.toStringTag` set to `'CustomNamespace'`, hidden
 * - `Symbol.toPrimitive` returning `"[namespace '<name>']"` for every hint the
 *   engine supplies, so `String(ns)`, `` `${ns}` `` and `ns + ''` agree; hidden
 *
 * A builder, not a predicate — it either yields a complete namespace or fails.
 * The reads over `exports` are therefore the raw, unguarded forms and getters
 * run unprotected, so an unreadable source surfaces instead of yielding a
 * namespace that looks whole and is not. `exports` is expected to be the
 * author's own module surface at definition time, which is what makes failing
 * loudly the cheap option — and what makes running its getters here acceptable.
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
 * @param {Record<PropertyKey, unknown>} exports - The exports to resolve onto
 *  the namespace. At least one own property is required — note the guard counts
 *  KEYS, so a source whose every member is valueless passes it and still yields
 *  an empty namespace.
 * @returns {CustomNamespace} The created namespace object.
 * @throws {TypeError} when `exports` is neither a plain object nor a
 *  prototype-less dictionary
 * @throws {TypeError} when `exports` has no own property
 * @throws {TypeError} when `exports` carries `Symbol.toPrimitive` or
 *  `Symbol.toStringTag` — the namespace defines both itself
 * @throws {unknown} at a malicious `ownKeys` or `getOwnPropertyDescriptor`
 *  proxy-trap on `exports`, which the shape check admits, or from any `exports`
 *  getter invoked while resolving
 */
export function createCustomNamespace(name, exports) {
  // - the three rejections below run argument-shape first, then contents, and
  //   the first blocker wins. The order is contract, not incidental: a caller
  //   fixing one rejection must not be handed a different one for the same
  //   mistake. Per-member failures come later, during the reduce, in key order.

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

  const { target: namespace } = /** @type {{ source: object, target: object }} */ (
    exportKeys.reduce(aggregateNamespaceTarget, {
      source: exports,
      target: objectCreate(null),
    })
  );
  // - both structural entries are HIDDEN, never `frozenDataDescriptor`. A real
  //   ES module namespace declares its `Symbol.toStringTag` non-enumerable for
  //   the same reason: identity must not travel on a copy. Enumerable brands
  //   would ride along on `{ ...namespace }` and hand back a plain object that
  //   answers `[object CustomNamespace]` — the builder forging its own mark.
  //   Property lookup ignores `enumerable`, so both still function.
  defineProperty(namespace, toPrimitiveSymbol, {
    ...frozenEntryDescriptor,
    value: (
      (value) => (/** @type {string} */ hint) =>
        toPrimitive(value, hint)
    )((isString(name) && String(name).trim()) || ''),
  });
  defineProperty(namespace, toStringTagSymbol, {
    ...frozenEntryDescriptor,
    value: 'CustomNamespace',
  });

  // - last, after both symbol definitions, which a frozen target would reject.
  //   A real ES module namespace is non-extensible too; leaving this one open
  //   would mean the shape a detector inspects is not the shape built here.
  return /** @type {CustomNamespace} */ (objectFreeze(namespace));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
