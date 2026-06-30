// @ts-check

/**
 * @module @species-js/type-detection/evented
 *
 * `EventTarget` and `AbortSignal` value detection.
 *
 * Two structural lattices live in this module. The first centers on
 * the EventTarget method contract — three callable methods
 * (`dispatchEvent`, `addEventListener`, `removeEventListener`)
 * specified by DOM WHATWG `EventTarget`. {@link isEventTargetLike}
 * narrows any value to the contract via an `instanceof` fast-path
 * against the realm-fixed capture plus a structural fallback.
 * {@link isEventTarget} layers `[[Class]]` tag and constructor-name
 * markers on top for direct-instance discrimination.
 *
 * The second extends the first: AbortSignal adds an `aborted` boolean
 * and a `throwIfAborted` callable on top of the EventTarget surface.
 * {@link isAbortSignalLike} and {@link isAbortSignal} mirror the same
 * structural-then-identity layering as their EventTarget counterparts.
 */

import { getOwnPropertyDescriptors, objectCreate } from '@/config';
import {
  TRUSTED_DATA_CONFIRMATION,
  INSTANCE_LESS_CONSTRUCTOR,
  getInertPrototypeOf,
  getInertDescriptor,
  getVerifiedOwnName,
  hasInertMethod,
  getTypeSignature,
  getDefinedConstructor,
} from '@/utility';

import { isCallable, isClass } from '@/function';
import { isBooleanValue } from '@/primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').NewableFunction} NewableFunction */

/** @typedef {import('@/evented').EventTargetLike} EventTargetLike */
/** @typedef {import('@/evented').AbortSignalLike} AbortSignalLike */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const EventTargetConstructor = /** @type {typeof EventTarget | Callable} */ (
  isCallable(EventTarget) ? EventTarget : INSTANCE_LESS_CONSTRUCTOR
);
const AbortSignalConstructor = /** @type {typeof AbortSignal | Callable} */ (
  isCallable(AbortSignal) ? AbortSignal : INSTANCE_LESS_CONSTRUCTOR
);

const eventTargetPrototype =
  EventTargetConstructor === INSTANCE_LESS_CONSTRUCTOR
    ? objectCreate(null)
    : /** @type {object} */ (EventTargetConstructor.prototype);

const abortSignalPrototype =
  AbortSignalConstructor === INSTANCE_LESS_CONSTRUCTOR
    ? objectCreate(null)
    : /** @type {object} */ (AbortSignalConstructor.prototype);

/**
 * Whether `value` is an instance of the realm-fixed `EventTarget`
 * capture (or any subclass — `Element`, `Document`, `Window`,
 * `XMLHttpRequest`, …).
 *
 * The subclass-admitting realm-membership building block shared by the
 * EventTarget predicates — it carries no proto-identity narrowing, so the
 * strict {@link isEventTarget} layers that check on top while the lenient
 * {@link isEventTargetLike} uses it as its fast-path arm.
 *
 * When the runtime lacks a global `EventTarget` (pre-Node-15 environments,
 * special embeddings), `EventTargetConstructor` is the realm-fixed
 * `INSTANCE_LESS_CONSTRUCTOR` sentinel — a never-instantiated function whose
 * `prototype` makes `value instanceof` return `false` for every input without
 * throwing. The `try`/`catch` additionally absorbs a hostile `getPrototypeOf`
 * Proxy-trap that throws during the `instanceof` prototype-walk, yielding
 * `false` rather than propagating (the package-wide throw-safety invariant).
 *
 * @param {unknown} value - the value to test; assumed truthy by the caller
 * @returns {boolean} `true` when `value instanceof EventTargetConstructor`
 *  holds; `false` otherwise (including on a throwing trap)
 * @internal
 */
export function isCurrentRealmEventTargetInstance(value) {
  try {
    return value instanceof EventTargetConstructor;
  } catch {
    return false;
  }
}
/**
 * Whether `value` is an instance of the realm-fixed `AbortSignal`
 * capture (or any subclass).
 *
 * The subclass-admitting realm-membership building block shared by the
 * AbortSignal predicates — it carries no proto-identity narrowing, so the
 * strict {@link isAbortSignal} layers that check on top while the lenient
 * {@link isAbortSignalLike} uses it as its fast-path arm.
 *
 * When the runtime lacks a global `AbortSignal` (pre-Node-15 environments,
 * special embeddings), `AbortSignalConstructor` is the realm-fixed
 * `INSTANCE_LESS_CONSTRUCTOR` sentinel — a never-instantiated function whose
 * `prototype` makes `value instanceof` return `false` for every input without
 * throwing. The `try`/`catch` additionally absorbs a hostile `getPrototypeOf`
 * Proxy-trap that throws during the `instanceof` prototype-walk, yielding
 * `false` rather than propagating (the package-wide throw-safety invariant).
 *
 * @param {unknown} value - the value to test; assumed truthy by the caller
 * @returns {boolean} `true` when `value instanceof AbortSignalConstructor`
 *  holds; `false` otherwise (including on a throwing trap)
 * @internal
 */
export function isCurrentRealmAbortSignalInstance(value) {
  try {
    return value instanceof AbortSignalConstructor;
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  EventTarget Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The two cheap string-shape markers of a direct `EventTarget` — the
 * caller-threaded constructor `name` equal to `'EventTarget'` and the
 * `[[Class]]` tag `'[object EventTarget]'`. The inexpensive front-gate of
 * the cross-realm {@link isEventTarget} arm: if either marker fails, the
 * costlier prototype-contract walk is skipped.
 *
 * @param {object} value - the value whose `[[Class]]` tag to read; assumed
 *  to be an object provided by the caller
 * @param {string | undefined} name - the value's already-resolved
 *  constructor name, threaded in by the caller
 * @returns {boolean} `true` when both string-shape markers match
 *  `EventTarget`'s signature; `false` otherwise
 * @internal
 */
export function hasEventTargetIdentitySignal(value, name) {
  return name === 'EventTarget' && getTypeSignature(value) === '[object EventTarget]';
}

/**
 * Verifies that the value matches the `EventTarget` method contract —
 * callable `dispatchEvent`, `addEventListener`, and `removeEventListener`
 * data properties reachable through the value's prototype-chain.
 *
 * Composes three `hasInertMethod` checks for the methods specified by
 * DOM WHATWG `EventTarget`. Short-circuit `&&` enforces an inner cost
 * ordering: `dispatchEvent` (the spec-defined emission hook) runs first,
 * `addEventListener` second, `removeEventListener` last.
 *
 * Used as the structural fallback inside `isEventTargetLike` when the
 * realm-fixed `instanceof EventTargetConstructor` fast-path fails — for
 * example, on cross-realm `EventTarget` instances or userland
 * event-emitter implementations that mirror the EventTarget method
 * surface. This is the duck-typed (proto-chain-walking) Like-tier contract;
 * the strict {@link isEventTarget} uses the own-descriptor
 * {@link doesImplementEventTargetPrototypeContract} instead.
 *
 * Does not require `Symbol.toStringTag === 'EventTarget'` or a
 * particular constructor-name. That level of identity narrowing belongs
 * to `isEventTarget`. `doesMatchEventTargetContract` is purely
 * structural.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the EventTarget method contract
 * @returns {boolean} `true` when all three methods are callable data
 *  properties in the value's prototype-chain; `false` otherwise
 * @example
 * doesMatchEventTargetContract(new EventTarget()); // true (inherited)
 * doesMatchEventTargetContract(document);          // true (subclass methods inherited)
 * doesMatchEventTargetContract({});                // false
 * doesMatchEventTargetContract(42);                // false
 * @internal
 */
export function doesMatchEventTargetContract(value) {
  return (
    hasInertMethod(value, 'dispatchEvent', TRUSTED_DATA_CONFIRMATION) &&
    hasInertMethod(value, 'addEventListener', TRUSTED_DATA_CONFIRMATION) &&
    hasInertMethod(value, 'removeEventListener', TRUSTED_DATA_CONFIRMATION)
  );
}

/**
 * Whether `prototype` carries `EventTarget.prototype`'s own member surface —
 * the three DOM WHATWG methods `dispatchEvent`, `addEventListener`, and
 * `removeEventListener` as own callable data properties. The strict-tier
 * counterpart of the duck-typed {@link doesMatchEventTargetContract}: it
 * reads the already-resolved `[[Prototype]]`'s OWN descriptors (decision
 * #059) rather than walking the value's prototype-chain, because the strict
 * {@link isEventTarget} admits only direct instances whose `[[Prototype]]`
 * IS the realm's `EventTarget.prototype`.
 *
 * Throw-safe: a hostile `getOwnPropertyDescriptors` trap that throws is
 * caught and yields `false` rather than propagating.
 *
 * Unlike its AbortSignal sibling, the EventTarget prototype carries no
 * spec-defined state accessor, so no receiver is threaded — the three
 * markers are pure callable-descriptor reads.
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @returns {boolean} `true` when all three methods are own callable data
 *  properties of `prototype`; `false` otherwise
 * @internal
 */
export function doesImplementEventTargetPrototypeContract(prototype) {
  try {
    const descriptors = getOwnPropertyDescriptors(prototype);

    return (
      isCallable(descriptors.dispatchEvent?.value) &&
      isCallable(descriptors.addEventListener?.value) &&
      isCallable(descriptors.removeEventListener?.value)
    );
  } catch {
    return false;
  }
}

/**
 * Whether `prototype` is structurally equivalent to the realm's
 * `EventTarget.prototype` — a four-marker chain: `constructor` is a class,
 * the prototype's `[[Class]]` tag is `'[object EventTarget]'`, the
 * constructor's own `prototype` round-trips back to `prototype`, and
 * `prototype` carries the EventTarget method surface
 * ({@link doesImplementEventTargetPrototypeContract}). The cross-realm
 * identity core of {@link isEventTarget}, run on the already-resolved
 * `[[Prototype]]` / `[[Constructor]]` pair (decision #059).
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {NewableFunction | undefined} constructor - the value's
 *  already-resolved `[[Constructor]]`, threaded in by the caller
 * @returns {boolean} `true` when all four markers hold; `false` otherwise
 * @internal
 */
export function isEventTargetPrototypeEquivalent(prototype, constructor) {
  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object EventTarget]' &&
    getInertDescriptor(constructor, 'prototype', TRUSTED_DATA_CONFIRMATION)?.value ===
      prototype &&
    doesImplementEventTargetPrototypeContract(prototype)
  );
}

/**
 * The cross-realm `EventTarget` identity arm, composed: the inexpensive
 * {@link hasEventTargetIdentitySignal} front-gate (tag + constructor-name)
 * AND the load-bearing {@link isEventTargetPrototypeEquivalent} structural
 * contract. Resolves the constructor from the threaded `[[Prototype]]` once
 * (`assumePrototype: true`, decision #059) and feeds its verified own `name`
 * into the signal gate.
 *
 * @param {object} value - the value to test; assumed to be an object
 *  provided by the caller
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @returns {boolean} `true` when the signal gate and the structural
 *  contract both hold; `false` otherwise
 * @internal
 */
export function isAlienRealmEventTarget(value, prototype) {
  const constructor = getDefinedConstructor(prototype, { assumePrototype: true });

  return (
    hasEventTargetIdentitySignal(value, getVerifiedOwnName(constructor)) &&
    isEventTargetPrototypeEquivalent(prototype, constructor)
  );
}

/**
 * Narrows a value to `EventTargetLike` via either local-realm
 * `EventTarget` identity or the structural `EventTarget` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof EventTargetConstructor`
 * check against the realm-fixed `EventTarget` capture catches
 * local-realm `EventTarget` instances and their subclasses (`Element`,
 * `Document`, `Window`, and so on) in a single prototype-walk. If that
 * fails, falls back to `doesMatchEventTargetContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `EventTarget` instances and userland event-emitter implementations
 * that mirror the full method contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract. When the runtime lacks a global
 * `EventTarget` (pre-Node-15 environments, special embeddings), the
 * realm-fixed capture is the `INSTANCE_LESS_CONSTRUCTOR` sentinel, against
 * which `instanceof` is always `false`, so only the structural check fires.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & EventTargetLike`; `T = unknown` collapses to `EventTargetLike`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an _event-target-like_ type
 * @returns {value is T & EventTargetLike} `true` when the value is either
 *  a local-realm `EventTarget` (or subclass) or satisfies the EventTarget
 *  method contract, narrowing `value` to `T & EventTargetLike`; `false`
 *  otherwise
 * @example
 * isEventTargetLike(new EventTarget()); // true (instanceof)
 * isEventTargetLike(document);          // true (subclass)
 * isEventTargetLike({
 *   dispatchEvent: () => true,
 *   addEventListener: () => {},
 *   removeEventListener: () => {},
 * });                                   // true (structural)
 * isEventTargetLike({});                // false
 * isEventTargetLike(null);              // false
 */
export function isEventTargetLike(value) {
  return (
    !!value &&
    (isCurrentRealmEventTargetInstance(value) || doesMatchEventTargetContract(value))
  );
}

/**
 * Narrows a value to `EventTarget` via a two-axis identity dispatch.
 *
 * The prototype is resolved ONCE via `getInertPrototypeOf` and threaded into
 * the cross-realm arm (decision #059). The leading `!!prototype` short-circuit
 * rejects nullish and other falsy values, and absorbs a hostile
 * `getPrototypeOf`-trap (which `getInertPrototypeOf` collapses to `undefined`)
 * before any further read.
 *
 * The local-realm fast-path pairs `isCurrentRealmEventTargetInstance(value)`
 * with `prototype === eventTargetPrototype`. The pair admits only direct
 * `EventTarget` instances; subclasses (`Element`, `Document`, `Window`,
 * `XMLHttpRequest`, …) pass `instanceof` but fail the prototype identity-check
 * in O(1). On miss, the cross-realm arm runs {@link isAlienRealmEventTarget} —
 * the tag + constructor-name signal gate plus the prototype-contract walk —
 * but only when the realm actually has a global `EventTarget` (the
 * `INSTANCE_LESS_CONSTRUCTOR` sentinel guard).
 *
 * `EventTarget` subclasses are rejected on both arms — by prototype identity
 * locally, by constructor-name equality cross-realm. This is a deliberate
 * strictness; consumers needing subclass admission compose with
 * {@link isEventTargetLike}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an `EventTarget`
 * @returns {value is EventTarget} `true` when either the local-realm identity
 *  pair or the cross-realm structural chain holds; `false` otherwise
 * @example
 * isEventTarget(new EventTarget());                       // true (instanceof + proto)
 * isEventTarget(document);                                // false (subclass)
 * isEventTarget({ [Symbol.toStringTag]: 'EventTarget' }); // false (spoof — no methods)
 * isEventTarget(null);                                    // false
 */
export function isEventTarget(value) {
  // Resolve the prototype ONCE and thread it into the contract walk (decision
  // #059), instead of letting the helper re-read it. `getInertPrototypeOf` is
  // capable of handling _nullish_ values.
  const prototype = getInertPrototypeOf(value);

  return (
    // nullish / falsy / hostile-trap values are all excluded by this first
    // short-circuit before any further read.
    !!prototype &&
    (isCurrentRealmEventTargetInstance(value)
      ? // local-realm fast-path
        prototype === eventTargetPrototype
      : // cross-realm fallback; thread the already-read prototype (#059)
        EventTargetConstructor !== INSTANCE_LESS_CONSTRUCTOR &&
        isAlienRealmEventTarget(/** @type {object} */ (value), prototype))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortSignal Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The two cheap string-shape markers of a direct `AbortSignal` — the
 * caller-threaded constructor `name` equal to `'AbortSignal'` and the
 * `[[Class]]` tag `'[object AbortSignal]'`. The inexpensive front-gate of
 * the cross-realm {@link isAbortSignal} arm: if either marker fails, the
 * costlier prototype-contract walk is skipped.
 *
 * @param {object} value - the value whose `[[Class]]` tag to read; assumed
 *  to be an object provided by the caller
 * @param {string | undefined} name - the value's already-resolved
 *  constructor name, threaded in by the caller
 * @returns {boolean} `true` when both string-shape markers match
 *  `AbortSignal`'s signature; `false` otherwise
 * @internal
 */
export function hasAbortSignalIdentitySignal(value, name) {
  return name === 'AbortSignal' && getTypeSignature(value) === '[object AbortSignal]';
}

/**
 * Verifies that the value matches the `AbortSignal` method contract —
 * `EventTargetLike` plus a boolean `aborted` and a callable
 * `throwIfAborted`.
 *
 * Composes two abort-specific markers with `doesMatchEventTargetContract`.
 * Short-circuit `&&` orders the checks for both nullish-safety and
 * discrimination cost: `hasInertMethod(value, 'throwIfAborted')` runs
 * first as a nullish-safe leading gate — its descriptor-walk via the
 * parameter-default-to-`null` pattern returns `false` for any nullish
 * input without touching the property surface. The direct `aborted`
 * value-read runs after, by which point `value` is guaranteed non-nullish.
 * The three-descriptor-walk `doesMatchEventTargetContract` runs last as
 * the heaviest discriminator and the structural baseline.
 *
 * The `aborted` check uses `isBooleanValue(value.aborted)` and invokes
 * the spec-defined accessor directly (decision #029) — the
 * descriptor-walk pattern would reject every real `AbortSignal` because
 * `aborted` IS an accessor. The body is wrapped in `try`/`catch` so a
 * throwing userland getter reduces to `false` rather than propagating.
 * The predicate's boolean-return contract is preserved. This is the
 * same exception-handling shape as the boxed-primitive equality helpers.
 *
 * This is the duck-typed Like-tier contract: it reads the `aborted` VALUE
 * (any descriptor shape — a plain data boolean is admitted), deliberately
 * NOT requiring the native readonly-accessor shape. That stricter,
 * spec-faithful prototype check belongs to the identity tier
 * ({@link doesImplementAbortSignalPrototypeContract}). See decision #030 —
 * `AbortSignalLike` is the lenient, subclass- and userland-admitting tier.
 *
 * The `throwIfAborted` check uses `hasInertMethod` for the standard
 * inspect-without-invoke contract — `throwIfAborted` is a data-property
 * method on `AbortSignal.prototype`, so the descriptor-walk pattern
 * applies without spec friction.
 *
 * Used as the structural fallback inside `isAbortSignalLike` when the
 * realm-fixed `instanceof AbortSignalConstructor` fast-path fails — for
 * example, on cross-realm `AbortSignal` instances or userland
 * abort-signal implementations.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the AbortSignal method contract
 * @returns {boolean} `true` when the value satisfies the EventTarget
 *  contract, has a boolean `aborted` property, and has a callable
 *  `throwIfAborted`; `false` otherwise (including when the `aborted`
 *  getter throws)
 * @example
 * doesImplementAbortSignalContract(new AbortController().signal); // true
 * doesImplementAbortSignalContract(AbortSignal.timeout(1000));    // true
 * doesImplementAbortSignalContract(new EventTarget());            // false (no abort surface)
 * doesImplementAbortSignalContract({});                           // false
 * @internal
 */
export function doesImplementAbortSignalContract(value) {
  try {
    return (
      hasInertMethod(value, 'throwIfAborted', TRUSTED_DATA_CONFIRMATION) &&
      isBooleanValue(/** @type {{ aborted?: unknown }} */ (value).aborted) &&
      doesMatchEventTargetContract(value)
    );
  } catch {
    return false;
  }
}

/**
 * Whether `prototype` carries `AbortSignal.prototype`'s own member surface —
 * the spec-defined accessors and method of DOM WHATWG `AbortSignal`:
 * `aborted` (a boolean getter with no setter), `reason` (a getter, no
 * setter), `onabort` (a getter/setter accessor pair), and `throwIfAborted`
 * (a callable). The strict-tier counterpart of the duck-typed
 * {@link doesImplementAbortSignalContract}: it reads the already-resolved
 * `[[Prototype]]`'s OWN descriptors (decision #059) and invokes the `aborted`
 * getter with the real receiver `value` to confirm a boolean result — the
 * spec-defined direct read (decision #029).
 *
 * Throw-safe: a hostile descriptor trap or a throwing `aborted` getter is
 * caught and yields `false` rather than propagating.
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {object} value - the root value, threaded as the receiver for the
 *  spec-defined `aborted` getter invocation
 * @returns {boolean} `true` when the full accessor/method surface is present
 *  in the spec-defined shape; `false` otherwise
 * @internal
 */
export function doesImplementAbortSignalPrototypeContract(prototype, value) {
  try {
    const descriptors = getOwnPropertyDescriptors(prototype);
    const { aborted, reason, onabort } = descriptors;

    return (
      isCallable(aborted?.get) &&
      !isCallable(aborted.set) &&
      isBooleanValue(aborted.get.call(value)) &&
      isCallable(reason?.get) &&
      !isCallable(reason.set) &&
      isCallable(onabort?.get) &&
      isCallable(onabort.set) &&
      isCallable(descriptors.throwIfAborted?.value)
    );
  } catch {
    return false;
  }
}

/**
 * Whether `prototype` is structurally equivalent to the realm's
 * `AbortSignal.prototype` — a four-marker chain: `constructor` is a class,
 * the prototype's `[[Class]]` tag is `'[object AbortSignal]'`, the
 * constructor's own `prototype` round-trips back to `prototype`, and
 * `prototype` carries the AbortSignal accessor/method surface
 * ({@link doesImplementAbortSignalPrototypeContract}). The cross-realm
 * identity core of {@link isAbortSignal}, run on the already-resolved
 * `[[Prototype]]` / `[[Constructor]]` pair (decision #059).
 *
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {NewableFunction | undefined} constructor - the value's
 *  already-resolved `[[Constructor]]`, threaded in by the caller
 * @param {object} value - the root value, threaded as the receiver for the
 *  spec-defined `aborted` getter invocation
 * @returns {boolean} `true` when all four markers hold; `false` otherwise
 * @internal
 */
export function isAbortSignalPrototypeEquivalent(prototype, constructor, value) {
  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object AbortSignal]' &&
    getInertDescriptor(constructor, 'prototype', TRUSTED_DATA_CONFIRMATION)?.value ===
      prototype &&
    doesImplementAbortSignalPrototypeContract(prototype, value)
  );
}

/**
 * The cross-realm `AbortSignal` identity arm, composed: the inexpensive
 * {@link hasAbortSignalIdentitySignal} front-gate (tag + constructor-name)
 * AND the load-bearing {@link isAbortSignalPrototypeEquivalent} structural
 * contract. Resolves the constructor from the threaded `[[Prototype]]` once
 * (`assumePrototype: true`, decision #059) and feeds its verified own `name`
 * into the signal gate.
 *
 * @param {object} value - the value to test; assumed to be an object provided
 *  by the caller
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @returns {boolean} `true` when the signal gate and the structural
 *  contract both hold; `false` otherwise
 * @internal
 */
export function isAlienRealmAbortSignal(value, prototype) {
  const constructor = getDefinedConstructor(prototype, { assumePrototype: true });

  return (
    hasAbortSignalIdentitySignal(value, getVerifiedOwnName(constructor)) &&
    isAbortSignalPrototypeEquivalent(prototype, constructor, value)
  );
}

/**
 * Narrows a value to `AbortSignalLike` via either local-realm
 * `AbortSignal` identity or the structural `AbortSignal` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof AbortSignalConstructor`
 * check against the realm-fixed `AbortSignal` capture catches
 * local-realm instances in a single prototype-walk. If that fails,
 * falls back to `doesImplementAbortSignalContract` for the structural
 * check — which catches cross-realm `AbortSignal` instances and
 * userland abort-signal implementations that mirror the minimum
 * contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract. When the runtime lacks a global
 * `AbortSignal` (pre-Node-15 environments, special embeddings), the
 * realm-fixed capture is the `INSTANCE_LESS_CONSTRUCTOR` sentinel, against
 * which `instanceof` is always `false`, so only the structural check fires.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AbortSignalLike`; `T = unknown` collapses to `AbortSignalLike`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an _abort-signal-like_ type
 * @returns {value is T & AbortSignalLike} `true` when the value is either
 *  a local-realm `AbortSignal` or satisfies the AbortSignal method
 *  contract, narrowing `value` to `T & AbortSignalLike`; `false` otherwise
 * @example
 * isAbortSignalLike(new AbortController().signal); // true (instanceof)
 * isAbortSignalLike(AbortSignal.timeout(1000));    // true (instanceof)
 * isAbortSignalLike(new EventTarget());            // false (no abort surface)
 * isAbortSignalLike(null);                         // false
 */
export function isAbortSignalLike(value) {
  return (
    !!value &&
    (isCurrentRealmAbortSignalInstance(value) || doesImplementAbortSignalContract(value))
  );
}

/**
 * Narrows a value to `AbortSignal` via a two-axis identity dispatch.
 *
 * The prototype is resolved ONCE via `getInertPrototypeOf` and threaded into
 * the cross-realm arm (decision #059). The leading `!!prototype` short-circuit
 * rejects nullish and other falsy values, and absorbs a hostile
 * `getPrototypeOf`-trap (which `getInertPrototypeOf` collapses to `undefined`)
 * before any further read.
 *
 * The local-realm fast-path pairs `isCurrentRealmAbortSignalInstance(value)`
 * with `prototype === abortSignalPrototype`. The pair admits only direct
 * `AbortSignal` instances; subclasses pass `instanceof` but fail the prototype
 * identity-check in O(1). On miss, the cross-realm arm runs
 * {@link isAlienRealmAbortSignal} — the tag + constructor-name signal gate
 * plus the prototype-contract walk — but only when the realm actually has a
 * global `AbortSignal` (the `INSTANCE_LESS_CONSTRUCTOR` sentinel guard).
 *
 * `AbortSignal` subclasses are rejected on both arms — by prototype identity
 * locally, by constructor-name equality cross-realm. Consistent with
 * {@link isEventTarget} and `isPromise`. Consumers needing subclass admission
 * compose with {@link isAbortSignalLike}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an `AbortSignal`
 * @returns {value is AbortSignal} `true` when either the local-realm
 *  identity pair or the cross-realm structural chain holds; `false` otherwise
 * @example
 * isAbortSignal(new AbortController().signal);            // true (instanceof + proto)
 * isAbortSignal(AbortSignal.timeout(1000));               // true (instanceof + proto)
 * isAbortSignal(new EventTarget());                       // false (no abort surface)
 * isAbortSignal({ [Symbol.toStringTag]: 'AbortSignal' }); // false (spoof)
 * isAbortSignal(null);                                    // false
 */
export function isAbortSignal(value) {
  // Resolve the prototype ONCE and thread it into the contract walk (decision
  // #059), instead of letting the helper re-read it. `getInertPrototypeOf` is
  // capable of handling _nullish_ values.
  const prototype = getInertPrototypeOf(value);

  return (
    // nullish / falsy / hostile-trap values are all excluded by this first
    // short-circuit before any further read.
    !!prototype &&
    (isCurrentRealmAbortSignalInstance(value)
      ? // local-realm fast-path
        prototype === abortSignalPrototype
      : // cross-realm fallback; thread the already-read prototype (#059)
        AbortSignalConstructor !== INSTANCE_LESS_CONSTRUCTOR &&
        isAlienRealmAbortSignal(/** @type {object} */ (value), prototype))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
