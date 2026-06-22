// @ts-check

/**
 * @module @species-js/type-detection/thenable
 *
 * `Thenable` shaped value detection.
 *
 * The floor predicate {@link isThenable} narrows any value to
 * `Thenable<unknown>` via a descriptor-chain walk that inspects without
 * invoking. {@link isPromise} layers two further structural markers on
 * top — the `[[Class]]` tag and the resolved constructor name — to
 * close `Symbol.toStringTag`-spoofing while staying cross-realm safe.
 */

import { getPrototypeOf } from '@/config';
import { hasInertMethod, getTypeSignature, getDefinedConstructorName } from '@/utility';

import { isCallable } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/thenable').Thenable<unknown>} Thenable */
/** @typedef {import('@/thenable').PromiseLike<unknown>} PromiseLike */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const PromiseConstructor = /** @type {typeof Promise | null} */ (
  isCallable(Promise) ? Promise : null
);
const promisePrototype = PromiseConstructor && PromiseConstructor.prototype;
/**
 * Whether `value` is an instance of the realm-fixed `PromiseConstructor`
 * captured at module-load (or any subclass). The leading
 * `!!PromiseConstructor` guard returns `false` when the runtime lacks a
 * global `Promise` (pre-Node-15 environments, special embeddings) without
 * exercising `instanceof`.
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
 * @param {unknown} value - the value to test; assumed truthy by the caller
 * @returns {boolean} `true` when `PromiseConstructor` is captured and
 *  `value instanceof PromiseConstructor` holds; `false` otherwise (including
 *  when a hostile `getPrototypeOf` trap throws)
 * @internal
 */
export function isCurrentRealmPromiseInstance(value) {
  if (!PromiseConstructor) {
    return false;
  }
  try {
    return value instanceof PromiseConstructor;
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Thenable Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `Thenable<unknown>` by verifying that `then` is a
 * callable data property reachable through the value's prototype-chain.
 *
 * Tests in cost-order: the inexpensive `instanceof PromiseConstructor`
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
    !!value && (isCurrentRealmPromiseInstance(value) || hasInertMethod(value, 'then'))
  );
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
 * Used as the structural fallback inside {@link isPromiseLike} when the
 * realm-fixed `instanceof PromiseConstructor` fast-path fails — for
 * example, on cross-realm `Promise` instances or userland Promise-like
 * implementations such as Bluebird or Q.
 *
 * Does not require `Symbol.toStringTag === 'Promise'` or a particular
 * constructor-name; that level of identity narrowing belongs to
 * `isPromise`. `doesMatchPromiseContract` is purely structural.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the Promise-method contract
 * @returns {boolean} `true` when all three methods are callable data
 *  properties in the value's prototype-chain; `false` otherwise
 * @example
 * doesMatchPromiseContract(Promise.resolve());  // true (inherited from prototype)
 * doesMatchPromiseContract({ then: () => {} }); // false (no `catch` or `finally`)
 * doesMatchPromiseContract(42);                 // false
 * @internal
 */
export function doesMatchPromiseContract(value) {
  return (
    hasInertMethod(value, 'then') &&
    hasInertMethod(value, 'catch') &&
    hasInertMethod(value, 'finally')
  );
}

/**
 * Narrows a value to `PromiseLike<unknown>` via either local-realm
 * `Promise` identity or the structural `Promise.prototype` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof PromiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
 * If that fails, falls back to `doesMatchPromiseContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `Promise` instances (produced in iframes, workers, vm contexts) and
 * userland _promise-like_ implementations (such as Bluebird or Q) that
 * satisfy the full Promise-method contract.
 *
 * The leading `!!value` guard short-circuits on nullish input before
 * any property work, so neither branch runs for `null` or `undefined`.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm `Promise` instances on identity; the `doesMatchPromiseContract`
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
    !!value && (isCurrentRealmPromiseInstance(value) || doesMatchPromiseContract(value))
  );
}

/**
 * Narrows a value to `Promise<unknown>` via a two-branch identity check.
 *
 * The local-realm fast-path pairs `isCurrentRealmPromiseInstance(value)`
 * (the captured `value instanceof PromiseConstructor`) with
 * `getPrototypeOf(value) === promisePrototype`. The pair admits only
 * direct `Promise` instances; subclasses pass `instanceof` but fail the
 * prototype identity-check, preserving subclass rejection in two O(1)
 * operations. Both captures are realm-fixed at module-load.
 *
 * On miss, falls back to a three-marker structural chain-run in cost-order:
 * the `[[Class]]` tag `'Promise'` (single `Object.prototype.toString.call`),
 * the constructor-name `'Promise'` resolved through the package's
 * constructor-walk, and `doesMatchPromiseContract` for the `Promise.prototype`
 * method contract from ECMA-262 §27.2. The structural arm calls
 * `doesMatchPromiseContract` directly rather than cascading through
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
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & Promise<unknown>`; `T = unknown` collapses to `Promise<unknown>`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a `Promise`
 * @returns {value is T & Promise<unknown>} `true` when either the
 *  local-realm identity pair or the cross-realm structural chain holds,
 *  narrowing `value` to `T & Promise<unknown>`; `false` otherwise
 * @example
 * isPromise(Promise.resolve());                                   // true (instanceof + proto)
 * isPromise({ then: () => {} });                                  // false
 * isPromise({ [Symbol.toStringTag]: 'Promise', then: () => {} }); // false (spoof)
 * isPromise(42);                                                  // false
 */
export function isPromise(value) {
  return (
    !!value &&
    (isCurrentRealmPromiseInstance(value)
      ? getPrototypeOf(value) === promisePrototype
      : getTypeSignature(value) === '[object Promise]' &&
        getDefinedConstructorName(value) === 'Promise' &&
        doesMatchPromiseContract(value))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
