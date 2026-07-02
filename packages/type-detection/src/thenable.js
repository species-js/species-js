// @ts-check

/**
 * @module @species-js/type-detection/thenable
 *
 * `Thenable` shaped value detection.
 *
 * The floor predicate {@link isThenable} narrows any value to
 * `Thenable<unknown>` via a descriptor-chain walk that inspects without
 * invoking. {@link isPromise} adds `Promise` identity through two-axis
 * dispatch — a local-realm `instanceof` + prototype-identity fast path,
 * or a cross-realm structural-equivalence check (the `[[Class]]` tag, the
 * constructor name, the method contract, and a prototype/constructor
 * reciprocal-identity marker) — to close `Symbol.toStringTag`-spoofing
 * while staying cross-realm safe.
 */

import { getOwnPropertyNames } from '@/config';

import {
  TRUSTED_DATA_CONFIRMATION,
  isValueOfBoundSet,
  getInertPrototypeOf,
  hasInertMethod,
  getTypeSignature,
  getVerifiedOwnName,
  getDefinedConstructor,
  getValidatedStandardConstructorAndPrototypeTuple,
} from '@/utility';

import { isObject } from '@/object';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').NewableFunction} NewableFunction */

/** @typedef {import('@/thenable').Thenable<unknown>} Thenable */
/** @typedef {import('@/thenable').PromiseLike<unknown>} PromiseLike */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Promise Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const [promiseConstructor, promisePrototype] =
  /** @type {[PromiseConstructor | undefined, object | undefined]} */ (
    /** @type {[object | undefined, object | undefined]} */ (
      getValidatedStandardConstructorAndPrototypeTuple(
        Promise,
        doesImplementPromiseContract,
      )
    )
  );

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
 * Used as the structural fallback inside {@link isPromiseLike} when the
 * realm-fixed `instanceof promiseConstructor` fast-path fails — for
 * example, on cross-realm `Promise` instances or userland Promise-like
 * implementations such as Bluebird or Q.
 *
 * Does not require `Symbol.toStringTag === 'Promise'` or a particular
 * constructor-name; that level of identity narrowing belongs to
 * `isPromise`. `doesImplementPromiseContract` is purely structural.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated
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
 * Whether `value` leaves the inherited `Promise` surface UN-shadowed at its own
 * level — no own property whose name is in the reserved denylist
 * (`disallowedPromiseContractShadowKeys`: the `constructor` back-reference plus
 * the `then`/`catch`/`finally` method contract). The own-surface integrity-gate
 * the strict local {@link isPromise} fast-path ANDs onto its
 * `prototype === promisePrototype` identity-check (decision #063).
 *
 * A genuine direct `Promise` instance inherits its whole method-contract and its
 * `constructor` link from `Promise.prototype` and owns none of it. So an own
 * property shadowing a reserved member is an instance-level override —
 * structurally an anonymous subclass-layer — and demotes the value from `is` to
 * merely `PromiseLike`, symmetric with the #028 subclass-rejection applied to the
 * own layer. Orthogonal own state (a value's own `id`, say) is untouched: only
 * the reserved member-names disqualify, never mere own-property presence.
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
 * Whether the value carries both of `Promise`'s string-shape identity
 * markers — the `[[Class]]` tag `'Promise'` (via `getTypeSignature`) and the
 * resolved constructor-name `'Promise'`. The name is threaded in by the caller,
 * which resolves the constructor once and derives its name via
 * `getVerifiedOwnName`; this helper does no constructor resolution of its own.
 *
 * @param {unknown} [value] - the value whose promise-shape tag to probe
 * @param {string} [name] - the value's already-resolved constructor name,
 *  threaded in by the caller; matched against `'Promise'`
 * @returns {boolean} `true` when both string-shape markers match `Promise`'s
 *  signature; `false` otherwise
 * @internal
 */
export function hasPromiseIdentitySignal(value, name) {
  return name === 'Promise' && getTypeSignature(value) === '[object Promise]';
}

/**
 * Whether `prototype` is structurally `Promise.prototype` — it carries
 * the Promise identity signal and method contract and reciprocally
 * back-references `constructor`.
 *
 * @param {object | Callable | null} prototype - the candidate `Promise.prototype` to validate
 * @param {NewableFunction | undefined} constructor - the resolved constructor to reference back
 *  against (`getDefinedConstructor`'s result); a falsy value short-circuits
 * @returns {boolean} `true` when `prototype` carries the Promise identity signal and
 *  method contract and reciprocally back-references `constructor`; `false` otherwise
 * @internal
 */
export function isStructuralPromisePrototypeEquivalent(prototype, constructor) {
  const definedConstructor =
    constructor && getDefinedConstructor(prototype, { assumePrototype: true });

  return (
    !!constructor &&
    constructor === definedConstructor &&
    hasPromiseIdentitySignal(prototype, getVerifiedOwnName(definedConstructor)) &&
    doesImplementPromiseContract(prototype)
  );
}

/**
 * Whether `value` is structurally a `Promise` — it carries the Promise
 * identity signal and method contract and resolves to a validated
 * prototype/constructor pair (via `getInertPrototypeOf` and
 * `getDefinedConstructor` when the caller supplies no prototype).
 *
 * @param {unknown} value - the candidate to test for structural `Promise` equivalence
 * @param {unknown} [prototype] - the value's already-read prototype, if the caller
 *  has it; otherwise resolved internally via `getInertPrototypeOf`
 * @returns {boolean} `true` when `value` is structurally a `Promise` — Promise
 *  identity signal, method contract, and a validated prototype/constructor pair;
 *  `false` otherwise
 * @internal
 */
export function isStructuralPromiseEquivalent(value, prototype) {
  const definedConstructor = getDefinedConstructor(value);

  return (
    hasPromiseIdentitySignal(value, getVerifiedOwnName(definedConstructor)) &&
    doesImplementPromiseContract(value) &&
    isStructuralPromisePrototypeEquivalent(
      isObject(prototype)
        ? prototype
        : /** @type {object | Callable | null} */ (getInertPrototypeOf(value)),
      definedConstructor,
    )
  );
}

/**
 * Whether `value` is an instance of the realm-fixed `promiseConstructor`
 * captured at module-load (or any subclass). The leading
 * `!!promiseConstructor` guard returns `false` when the runtime lacks
 * a global `Promise` (pre-Node-15 environments, special embeddings),
 * short-circuiting before the `instanceof` test ever runs.
 *
 * The subclass-admitting realm-membership building block shared by the
 * thenable predicates — it carries no proto-identity narrowing, so the
 * strict {@link isPromise} layers that check on top while the lenient
 * {@link isThenable} / {@link isPromiseLike} use it as their fast-path
 * arm. Invoked exclusively after the caller's `!!value` truthiness guard,
 * so the helper carries the constructor-presence guard only.
 *
 * Throw-safe: `instanceof` walks the value's `[[Prototype]]` chain, so a Proxy
 * whose `getPrototypeOf` trap throws would otherwise propagate. The check is
 * wrapped to yield `false` instead — a realm-membership probe must answer, not
 * raise (decision #029 trust boundary, extended to the `instanceof` read).
 *
 * Generic in `T` per the family-pattern, narrowing exactly as
 * {@link isPromiseLike}. The narrow returns `T & PromiseLike`; `T = unknown`
 * collapses to `PromiseLike`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; assumed truthy by the caller
 * @returns {value is T & PromiseLike} `true` when `promiseConstructor` is captured
 *  and `value instanceof promiseConstructor` holds; `false` otherwise (including
 *  when a hostile `getPrototypeOf` trap throws)
 * @internal
 */
export function isCurrentRealmPromiseInstance(value) {
  if (!promiseConstructor) {
    return false;
  }
  try {
    return value instanceof promiseConstructor;
  } catch {
    return false;
  }
}

/**
 * Narrows a value to `PromiseLike<unknown>` via either local-realm
 * `Promise` identity or the structural `Promise.prototype` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof promiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
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
 * (the captured `value instanceof promiseConstructor`) with
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
 * On miss, falls back to a three-marker structural chain-run in cost-order:
 * the `[[Class]]` tag `'Promise'` (single `Object.prototype.toString.call`),
 * the constructor-name `'Promise'` resolved through the package's
 * constructor-walk, and `doesImplementPromiseContract` for the `Promise.prototype`
 * method contract from ECMA-262 §27.2. The structural arm calls
 * `doesImplementPromiseContract` directly rather than cascading through
 * {@link isPromiseLike}, which would re-run the `instanceof` check already
 * disproved by the local-realm arm.
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
 * Strict identity narrows to the concrete `Promise` intrinsic, so — unlike the
 * subclass-admitting `isPromiseLike` / `isThenable` predicates — it is
 * intentionally non-generic (decision #062): every admitted value IS exactly a
 * `Promise`, with no caller-side type to preserve.
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
  if (!value) {
    return false;
  }
  const prototype = getInertPrototypeOf(value);

  return isCurrentRealmPromiseInstance(value)
    ? // local-realm fast-path: prototype-identity AND own-surface integrity —
      // reject an instance-level override of the inherited contract (#063).
      prototype === promisePrototype &&
        doesNotShadowPromiseContract(/** @type {object} */ (value))
    : isStructuralPromiseEquivalent(value, prototype);
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
 * Tests in cost-order: the inexpensive `instanceof promiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
 * The admission is sound because every `Promise` is a _thenable_ —
 * `then` lives on `Promise.prototype`. The implication does not run
 * the other way (not every _thenable_ is a `Promise`), so the
 * `instanceof` arm is a sufficient short-circuit, not a definition.
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
