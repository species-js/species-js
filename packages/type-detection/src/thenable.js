// @ts-check

/**
 * @module @species-js/type-detection/thenable
 *
 * `Thenable` shaped value detection.
 *
 * The floor predicate {@link isThenable} narrows any value to
 * `Thenable<unknown>` via a descriptor-chain walk that inspects without
 * invoking.
 *
 * {@link isPromise} adds `Promise` identity through a two-axis dispatch: a
 * local-realm `instanceof` plus prototype-identity fast path, or a cross-realm
 * structural-equivalence check. The structural check reads the `[[Class]]` tag,
 * the constructor name, the method contract, and a prototype/constructor
 * reciprocal-identity marker — enough to reject a `Symbol.toStringTag` spoof
 * while staying cross-realm safe.
 */

import { TRUSTED_DATA_CONFIRMATION } from '@/foundation';

import {
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  INSTANCE_LESS_CONSTRUCTOR,
} from '@/config';

import {
  isValueOfBoundSet,
  getInertPrototypeOf,
  getInertDescriptor,
  hasInertMethod,
  getTypeSignature,
  getVerifiedOwnName,
  getDefinedConstructor,
  getValidatedStandardConstructorAndPrototypeTuple,
} from '@/utility';

import { isCallable, isClass } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {typeof import('@/config').INSTANCE_LESS_CONSTRUCTOR} NEVER_INVOKED_CONSTRUCTOR */
/** @typedef {import('@/config').BlankDictionary} BlankDictionary */

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').NewableFunction} NewableFunction */

/** @typedef {import('@/thenable').Thenable<unknown>} Thenable */
/** @typedef {import('@/thenable').PromiseLike<unknown>} PromiseLike */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const [PromiseConstructorFunction, promisePrototype] =
  /** @type {[PromiseConstructor, object | null] | [NEVER_INVOKED_CONSTRUCTOR, BlankDictionary]} */ (
    getValidatedStandardConstructorAndPrototypeTuple(
      Promise,
      isPromisePrototypeEquivalent,
    )
  );

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Promise Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The reserved own-name denylist for {@link doesNotShadowPromiseContract} — the
 * `constructor` back-reference plus the three `Promise.prototype` contract
 * methods (ECMA-262 §27.2). A genuine direct `Promise` instance inherits every
 * one of these and owns none of them (its state lives in internal slots).
 * `Symbol.toStringTag` is absent — a symbol key (invisible to the string-keyed
 * `getOwnPropertyNames`) and cosmetic once prototype-identity is proven locally.
 * @internal
 */
const disallowedPromiseContractShadowKeys = new Set([
  'constructor',
  'then',
  'catch',
  'finally',
]);

/**
 * Whether `value` leaves the inherited `Promise` surface unshadowed at its own
 * level: it owns no property whose name is in the reserved denylist
 * (`disallowedPromiseContractShadowKeys` — the `constructor` back-reference plus
 * the `then`/`catch`/`finally` method contract). This is the own-surface
 * integrity gate that the strict local {@link isPromise} fast path ANDs onto its
 * `prototype === promisePrototype` identity check (decision #063).
 *
 * A genuine direct `Promise` instance inherits its whole method contract and its
 * `constructor` link from `Promise.prototype`, owning none of it. An own property
 * that shadows a reserved member is therefore an instance-level override —
 * structurally an anonymous subclass layer — so it demotes the value from `is` to
 * merely `PromiseLike`. This is the #028 subclass rejection applied to the own
 * layer. Orthogonal own state (a value's own `id`, say) is untouched: only the
 * reserved member names disqualify, never mere own-property presence.
 *
 * Weaker than a structural seal by design (decision #052): `Promise` exposes no
 * inert slot-reader, so the bare graft `Object.create(Promise.prototype)` — which
 * owns nothing — cannot be caught here and stays admitted (`isPromise/B2`). This
 * gate closes the own-level override, not the hollow bare graft.
 *
 * Throw-safe and fail-closed: a hostile `ownKeys` trap that throws collapses to
 * `false` (a clean own surface cannot be confirmed → treat as shadowed → reject),
 * never propagating. Membership is tested via the `this`-bound `isValueOfBoundSet`
 * with the denylist passed as the `some` `thisArg`, so no per-call closure is
 * allocated.
 *
 * @param {object} value - the direct-instance candidate whose OWN property names
 *  are enumerated; assumed by the caller to carry `promisePrototype` as its
 *  `[[Prototype]]`
 * @returns {boolean} `true` when no own property name shadows a reserved member;
 *  `false` when one does, or when the own-key enumeration throws
 * @internal
 */
export function doesNotShadowPromiseContract(value) {
  try {
    return !getOwnPropertyNames(value).some(
      isValueOfBoundSet,
      disallowedPromiseContractShadowKeys,
    );
  } catch {
    return false;
  }
}

/**
 * Verifies that the value matches the `Promise.prototype` method
 * contract — callable `then`, `catch`, and `finally` data properties
 * reachable through the value's prototype-chain.
 *
 * Composes three `hasInertMethod` checks for the methods defined on
 * `Promise.prototype` by ECMA-262 §27.2. Short-circuit `&&` enforces
 * an inner cost ordering: `then` (the spec-defined adoption hook) runs
 * first, `catch` second, and `finally` last.
 *
 * Used as the structural fallback inside {@link isPromiseLike} when
 * the realm-fixed `instanceof Promise` fast-path fails — for example,
 * on cross-realm `Promise` instances or userland Promise-like
 * implementations such as Bluebird or Q.
 *
 * Does not require `Symbol.toStringTag === 'Promise'` or a particular
 * constructor-name; that level of identity narrowing belongs to
 * `isPromise`. `doesImplementPromiseContract` is purely structural.
 *
 * @param {unknown} value - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the Promise-method contract
 * @returns {boolean} `true` when all three methods are callable data
 *  properties in the value's prototype-chain; `false` otherwise
 * @example
 * doesImplementPromiseContract(Promise.resolve());  // true (inherited from prototype)
 * doesImplementPromiseContract({ then: () => {} }); // false (no `catch` or `finally`)
 * doesImplementPromiseContract(42);                 // false
 * @internal
 */
export function doesImplementPromiseContract(value) {
  return (
    hasInertMethod(value, 'then', TRUSTED_DATA_CONFIRMATION) &&
    hasInertMethod(value, 'catch', TRUSTED_DATA_CONFIRMATION) &&
    hasInertMethod(value, 'finally', TRUSTED_DATA_CONFIRMATION)
  );
}

/**
 * The member-surface marker of the cross-realm `Promise` contract: confirms that
 * `prototype` carries `then`, `catch`, and `finally` as its own callable data
 * properties (ECMA-262 §27.2).
 *
 * This is the prototype-side counterpart to {@link doesImplementPromiseContract}.
 * That helper walks the value's chain via `hasInertMethod` for the lenient
 * {@link isPromiseLike}; this one reads the prototype's own descriptors for the
 * strict cross-realm anchor, so it inspects what `Promise.prototype` itself
 * implements, never what it inherits.
 *
 * Reads own descriptors via `getOwnPropertyDescriptors` and tests each member's
 * `.value` with `isCallable`, so an accessor-form member (`get then()`) yields
 * `undefined` from `?.value` and fails — closing the lying-accessor surface.
 * Short-circuit `&&` runs `then` first, `catch` second, `finally` last.
 *
 * Throw-safe: a hostile `ownKeys` / `getOwnPropertyDescriptor` Proxy-trap that
 * throws is absorbed and yields `false` rather than propagating.
 *
 * @param {unknown} prototype - the prototype whose own member surface to
 *  verify (callers pass an already-resolved `[[Prototype]]`); a nullish or
 *  non-object value is absorbed by the guard and yields `false`
 * @returns {boolean} `true` when all three members are own callable data
 *  properties; `false` otherwise (including on a throwing trap)
 * @internal
 */
export function doesImplementPromisePrototypeContract(prototype) {
  try {
    const descriptors = getOwnPropertyDescriptors(prototype);

    return (
      isCallable(descriptors.then?.value) &&
      isCallable(descriptors.catch?.value) &&
      isCallable(descriptors.finally?.value)
    );
  } catch {
    return false;
  }
}

/**
 * Verifies the structural anchor for cross-realm `Promise` discrimination over a
 * value's already-resolved `[[Prototype]]` — a four-marker chain, short-circuited
 * in cost-order:
 *
 * 1. `isClass(constructor)` — the constructor resolved from the prototype is a
 *    built-in or `class`-syntax newable (rejects non-function pointers).
 * 2. `getTypeSignature(prototype) === '[object Promise]'` — the prototype's own
 *    `[[Class]]` tag matches.
 * 3. The constructor's own `prototype` data property points back to the threaded
 *    `prototype` — round-trip identity, read via the throw-safe
 *    `getInertDescriptor(...).value` (an accessor-form definition yields
 *    `undefined` and fails, closing the lying-accessor spoof).
 * 4. {@link doesImplementPromisePrototypeContract} — the prototype carries the
 *    `then`/`catch`/`finally` contract as its own callable members.
 *
 * Unlike the object-module counterpart `isObjectPrototypeEquivalent`, there is no
 * chain-depth marker: `Promise.prototype`'s `[[Prototype]]` is `Object.prototype`,
 * not `null`, so a top-level check would wrongly reject every genuine
 * `Promise.prototype`. The value's constructor-name identity is verified
 * separately by the caller {@link isAlienRealmPromise} via
 * {@link hasPromiseIdentitySignal}.
 *
 * Throw-safe: the tag read (`getTypeSignature`), the round-trip
 * (`getInertDescriptor`), and the member surface (a guarded
 * `getOwnPropertyDescriptors`) each absorb a hostile Proxy-trap, failing the
 * contract rather than propagating; `isClass` is likewise throw-safe at its own
 * descriptor read.
 *
 * @param {unknown} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param {unknown} constructor - the constructor resolved from `prototype`,
 *  threaded in by the caller; a falsy value fails `isClass`
 * @returns {boolean} `true` when all four markers hold; `false` otherwise
 * @internal
 */
export function isPromisePrototypeEquivalent(prototype, constructor) {
  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object Promise]' &&
    getInertDescriptor(constructor, 'prototype', TRUSTED_DATA_CONFIRMATION)?.value ===
      prototype &&
    doesImplementPromisePrototypeContract(/** @type {object} */ (prototype))
  );
}

/**
 * Whether the value carries both of `Promise`'s string-shape identity
 * markers — the `[[Class]]` tag `'Promise'` (via `getTypeSignature`) and the
 * resolved constructor-name `'Promise'`. The name is threaded in by the caller,
 * which resolves the constructor once and derives its name via
 * `getVerifiedOwnName`; this helper does no constructor resolution of its own.
 *
 * @param {unknown} value - the value whose promise-shape tag to probe
 * @param {string | undefined} name - the value's already-resolved constructor name,
 *  threaded in by the caller; matched against `'Promise'`
 * @returns {boolean} `true` when both string-shape markers match `Promise`'s
 *  signature; `false` otherwise
 * @internal
 */
export function hasPromiseIdentitySignal(value, name) {
  return name === 'Promise' && getTypeSignature(value) === '[object Promise]';
}

/**
 * The cross-realm `Promise` fallback, composed: the inexpensive
 * {@link hasPromiseIdentitySignal} front-gate (the value's `[[Class]]` tag and
 * resolved constructor-name) AND the load-bearing
 * {@link isPromisePrototypeEquivalent} structural contract. A foreign-realm
 * `Promise` fails the local-realm `instanceof` + `=== promisePrototype`
 * fast-path but matches this structural contract in every realm.
 *
 * This is the single internal seam {@link isPromise} takes on its cross-realm
 * branch, the direct parallel to the object module's `isAlienRealmPlainObject`.
 * It resolves the constructor once from the threaded prototype, then threads that
 * constructor's name into the signal gate — exactly as the object seam does
 * (decision #059). The `assumePrototype: true` hint reads the prototype's own
 * `constructor` descriptor (the spec-mandated source, ECMA-262 §10.2.6) rather
 * than walking one level further up. Exported `@internal` for direct
 * unit-testability (decision #053).
 *
 * @param {object} value - the candidate whose cross-realm `Promise` structure and
 *  identity are to be verified; assumed to be an object provided by the caller
 * @param {object} prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @returns {boolean} `true` when the signal gate and the structural contract both
 *  hold; `false` otherwise
 * @internal
 */
export function isAlienRealmPromise(value, prototype) {
  const constructor = getDefinedConstructor(prototype, { assumePrototype: true });

  return (
    hasPromiseIdentitySignal(value, getVerifiedOwnName(constructor)) &&
    isPromisePrototypeEquivalent(prototype, constructor)
  );
}

/**
 * Whether `value` is an instance of the realm-fixed `PromiseConstructorFunction`
 * captured at module load, or of any subclass.
 *
 * When the runtime has no global `Promise` (pre-Node-15, special embeddings),
 * that capture is the `INSTANCE_LESS_CONSTRUCTOR` sentinel — a never-instantiated
 * function — so `instanceof` is always `false` and no presence guard is needed.
 *
 * This is the realm-membership building block the thenable predicates share. It
 * narrows nothing on prototype identity, so strict {@link isPromise} adds its own
 * checks on top, while the lenient {@link isThenable} and {@link isPromiseLike}
 * use it directly as their fast-path arm. It assumes a truthy `value`; each
 * public predicate applies its nullish guard first.
 *
 * Throw-safe: `instanceof` walks the value's `[[Prototype]]` chain, so a Proxy
 * whose `getPrototypeOf` trap throws would otherwise propagate. The check is
 * wrapped to yield `false` instead — a realm-membership probe must answer, not
 * raise (decision #029 trust boundary, extended to the `instanceof` read).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & PromiseLike`; `T = unknown` collapses to `PromiseLike`.
 *
 * @template [T=unknown]
 * @param {T} value - the value to test; assumed to be at least
 *  truthy by the caller
 * @returns {value is T & PromiseLike} `true` when
 *  `value instanceof PromiseConstructorFunction` holds; `false` otherwise
 *  (including on a throwing trap)
 * @internal
 */
export function isCurrentRealmPromiseInstance(value) {
  try {
    return value instanceof PromiseConstructorFunction;
  } catch {
    return false;
  }
}

/**
 * Narrows a value to `PromiseLike<unknown>` via either local-realm
 * `Promise` identity or the structural `Promise.prototype` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof Promise` check against
 * the realm-fixed `Promise` capture catches local-realm `Promise` instances
 * and their subclasses in a single prototype walk.
 * If that fails, falls back to `doesImplementPromiseContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `Promise` instances (produced in iframes, workers, vm contexts) and
 * userland _promise-like_ implementations (such as Bluebird or Q) that
 * satisfy the full Promise-method contract.
 *
 * The leading `!!value` guard short-circuits on nullish input before
 * any property work, so neither branch runs for `null` or `undefined`.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm `Promise` instances on identity; the `doesImplementPromiseContract`
 * branch admits foreign-realm `Promise` instances on structure. No
 * value satisfying the `Promise.prototype` method contract is rejected
 * on realm membership alone.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & PromiseLike`; `T = unknown` collapses to `PromiseLike`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a _promise-like_ type
 * @returns {value is T & PromiseLike} `true` when the value is either a
 *  local-realm `Promise` (or subclass) or satisfies the `Promise.prototype`
 *  method contract, narrowing `value` to `T & PromiseLike`; `false`
 *  otherwise
 * @example
 * isPromiseLike(Promise.resolve());                                      // true (instanceof)
 * isPromiseLike({ then: () => {} });                                     // false (no `catch`/`finally`)
 * isPromiseLike({ then: () => {}, catch: () => {}, finally: () => {} }); // true (structural)
 * isPromiseLike(null);                                                   // false
 */
export function isPromiseLike(value) {
  return (
    !!value &&
    (isCurrentRealmPromiseInstance(value) || doesImplementPromiseContract(value))
  );
}

/**
 * Narrows a value to `Promise<unknown>` via a two-branch identity check.
 *
 * The local-realm fast-path pairs `isCurrentRealmPromiseInstance(value)`
 * (the captured `value instanceof PromiseConstructorFunction`) with
 * `prototype === promisePrototype`, where `prototype` is the once-resolved
 * throw-safe `getInertPrototypeOf(value)` read threaded into both arms
 * (decision #059). The pair admits only direct `Promise` instances;
 * subclasses pass `instanceof` but fail the prototype identity-check,
 * preserving subclass rejection in two O(1) operations. Both captures are
 * realm-fixed at module-load. The pair is further gated by
 * {@link doesNotShadowPromiseContract}: a value that overrides an inherited
 * contract method (or the `constructor`) at its OWN level —
 * `Object.create(Promise.prototype, { then })` — is an instance-level subclass
 * layer, demoted to merely `PromiseLike` (decision #063, the #028 subclass
 * rejection applied to the own layer).
 *
 * On miss, falls back to the cross-realm structural seam
 * {@link isAlienRealmPromise}: the {@link hasPromiseIdentitySignal} front-gate
 * (the `[[Class]]` tag `'Promise'` and the constructor-name `'Promise'` resolved
 * once from the threaded prototype) AND the {@link isPromisePrototypeEquivalent}
 * anchor (the constructor is a newable class, the prototype's own tag is
 * `'Promise'`, its constructor round-trips back to it, and it carries the
 * `then`/`catch`/`finally` contract as own members). Every marker reads
 * realm-independently, so foreign-realm `Promise` instances are admitted, while
 * the round-trip and member-surface markers close the tag / constructor-name
 * spoof. This cross-realm branch runs only when the realm captured a real
 * `Promise` at module-load; without a global `Promise` the branch is skipped
 * and the value yields `false`.
 *
 * Cross-realm safe. The local-realm pair admits only direct local-realm
 * `Promise` instances; the structural fallback admits foreign-realm
 * `Promise` instances on contract (the tag-read and constructor-walk
 * both work realm-independently). No legitimate `Promise` is rejected
 * on realm membership alone.
 *
 * `Promise` subclasses are rejected on both branches — by the
 * prototype identity-check on the local-realm path, by the
 * constructor-name equality on the structural path. A value of
 * `class MyPromise extends Promise {}` resolves its constructor-name to
 * `'MyPromise'`, which fails the cross-realm constructor-name equality.
 * Consumers needing subclass admission should compose with a
 * constructor-chain walk on top of this predicate.
 *
 * The bare graft `Object.create(Promise.prototype)` stays admitted: `Promise`
 * exposes no inert slot-reader, so a hollow direct-prototype value cannot be
 * caught (decision #052, `isPromise/B2`). The own-shadow gate closes the
 * own-level override, not the hollow graft.
 *
 * Strict identity narrows to the concrete `Promise` intrinsic. Unlike the
 * subclass-admitting `isPromiseLike` / `isThenable`, it is intentionally
 * non-generic (decision #062): every admitted value IS exactly a `Promise`, with
 * no caller-side type to preserve.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a `Promise`
 * @returns {value is Promise<unknown>} `true` when the local-realm identity pair
 *  (with own-surface integrity) or the cross-realm structural chain holds;
 *  `false` otherwise
 * @example
 * isPromise(Promise.resolve());                                   // true (instanceof + proto)
 * isPromise(Object.create(Promise.prototype));                    // true (bare graft, #052)
 * isPromise(Object.assign(Object.create(Promise.prototype), { then() {} })); // false (own-shadow, #063)
 * isPromise({ [Symbol.toStringTag]: 'Promise', then: () => {} }); // false (spoof)
 * isPromise(42);                                                  // false
 */
export function isPromise(value) {
  // Resolve the prototype ONCE and thread it into the contract walk (decision
  // #059), instead of letting the helper re-read it. `getInertPrototypeOf` is
  // capable of handling _nullish_ values.
  const prototype = getInertPrototypeOf(value);

  return (
    // nullish / falsy / hostile-trap values are all excluded by this first
    // short-circuit before any further read.
    !!prototype &&
    (isCurrentRealmPromiseInstance(value)
      ? // local-realm fast-path: prototype-identity AND own-surface integrity —
        // reject an instance-level override of the inherited contract (#063).
        prototype === promisePrototype &&
        doesNotShadowPromiseContract(/** @type {object} */ (value))
      : // cross-realm fallback; thread the already-read prototype (#059)
        PromiseConstructorFunction !== INSTANCE_LESS_CONSTRUCTOR &&
        isAlienRealmPromise(/** @type {object} */ (value), prototype))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Sole Thenable Predicate
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `Thenable<unknown>` by verifying that `then` is a
 * callable data property reachable through the value's prototype-chain.
 *
 * Tests in cost-order: the inexpensive `instanceof Promise` check against
 * the realm-fixed `Promise` capture catches local-realm `Promise` instances
 * and their subclasses in a single prototype walk.
 * The admission is sound because every `Promise` is a _thenable_ — `then`
 * lives on `Promise.prototype`. The implication does not run the other way
 * (not every _thenable_ is a `Promise`), so the `instanceof` arm is a
 * sufficient short-circuit, not a definition.
 *
 * If `instanceof` fails (cross-realm `Promise`, userland _thenable_,
 * or any non-`Promise` candidate), falls back to a chain-walk via
 * own-descriptor reads at each level, matching how ECMA-262
 * `Get(value, "then")` resolves the property during `Promise`
 * adoption. A `then` found anywhere along the chain — own or
 * inherited — satisfies the predicate.
 *
 * Verifies callability only — it does not validate the `then` signature
 * shape or whether the value honors the `resolve`/`reject` protocol.
 * Accessor descriptors are deliberately rejected on the structural arm:
 * the predicate's contract is to inspect without invoking, so a
 * `get then()` shape is treated as "not a _thenable_ type" even if this
 * very getter returns a callable type.
 *
 * Generic in `T` per the family-pattern set by {@link isCallable} and
 * {@link isFunction}. The narrow returns `T & Thenable`; `T = unknown`
 * collapses to `Thenable`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a _thenable_ type
 * @returns {value is T & Thenable} `true` when the value is either a
 *  local-realm `Promise` (or subclass) or carries a callable `then`
 *  data property in its prototype-chain, narrowing `value` to
 *  `T & Thenable`; `false` otherwise
 * @example
 * isThenable(Promise.resolve());                   // true (instanceof)
 * isThenable({ then: () => {} });                  // true (own)
 * isThenable({ then: 'not a function' });          // false
 * isThenable({ get then() { return () => {}; } }); // false (accessor)
 * isThenable(null);                                // false
 */
export function isThenable(value) {
  return (
    !!value &&
    (isCurrentRealmPromiseInstance(value) ||
      hasInertMethod(value, 'then', TRUSTED_DATA_CONFIRMATION))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
