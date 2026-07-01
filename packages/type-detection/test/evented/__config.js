// @ts-check

/**
 * @module test/evented/__config
 *
 * Test configuration for the `evented` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrix scoring each clean
 * candidate against all four public predicates — `isEventTargetLike`,
 * `isEventTarget`, `isAbortSignalLike`, `isAbortSignal`. The matrix makes the
 * two parallel two-tier lattices auditable at a glance:
 *
 *   EventTargetLike (isEventTargetLike) ─┬─ EventTarget (isEventTarget)
 *   AbortSignalLike (isAbortSignalLike) ─┴─ AbortSignal (isAbortSignal)
 *   (AbortSignalLike extends EventTargetLike — every abort-signal is an event-target)
 *
 * `spec.test.js` drives the matrix; the targeted axis suites (cross-realm,
 * adversarial, _internal, throw-safety) import the specific named factories they
 * need. Spoof / documented-admission candidates (the tag-spoofed EventTarget, the
 * `when`-bearing userland object, the throwing-`aborted` getter) are deliberately
 * NOT in the clean matrix — their rationale belongs in `adversarial.test.js` /
 * `throw-safety.test.js` prose, not a silent data row.
 *
 * Mirrors `docs/spec/EVENTED.spec.md`.
 */

import { objectCreate } from '@/index.js';

import { foreignRealmEval } from '../_cross-realm.js';

// ----- candidate factories (fresh value per call) -----

// a callable stub for userland duck-typed method surfaces — the predicates only
// verify the methods are callable (inspect-without-invoke), never call them, so a
// shared no-op suffices. A concise-body arrow (not an empty block).
const noop = () => undefined;

// direct EventTarget — instanceof + prototype === EventTarget.prototype.
export const directEventTarget = () => new EventTarget();

// an EventTarget subclass instance — passes `instanceof` (admits at the Like
// tier) but its `[[Prototype]]` is the subclass prototype, so the strict
// `isEventTarget` proto-identity check rejects it. Stands in for the real-world
// DOM subclasses (`document`, `Element`, `Window`, `XMLHttpRequest`), which are
// absent in the Node test env.
export const eventTargetSubclassInstance = () => new (class extends EventTarget {})();

// a userland object carrying the three EventTarget methods as own callables —
// admitted structurally by `isEventTargetLike`, rejected by the strict
// `isEventTarget` (not `instanceof`; `[[Class]]` tag is `[object Object]`).
export const userlandEventTarget = () => ({
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
});

// a plain empty object — no method surface at all; rejected by all four.
export const emptyObject = () => ({});

// a direct AbortSignal via AbortController — an `AbortSignal` IS an
// `EventTarget`, so it is `EventTargetLike` (true) but not a direct
// `EventTarget` (its proto is `AbortSignal.prototype`, so `isEventTarget` is
// false / R4).
export const abortControllerSignal = () => new AbortController().signal;

// AbortSignal.timeout — a direct AbortSignal from the static factory. Node's
// timeout signal timer is unref'd (does not keep the event loop alive), so it
// is safe to create in a test without teardown.
export const abortSignalTimeout = () => AbortSignal.timeout(1000);

// AbortSignal.any([]) — a direct AbortSignal that never aborts, no timer.
export const abortSignalAny = () => AbortSignal.any([]);

// a userland object matching the full AbortSignalLike contract: the three
// EventTarget methods + a boolean `aborted` + a callable `throwIfAborted`.
// EventTargetLike (has the methods) AND AbortSignalLike (structural), but not a
// real `AbortSignal` (not `instanceof`; tag `[object Object]`).
export const userlandAbortSignal = () => ({
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
  aborted: false,
  throwIfAborted: noop,
});

// missing one EventTarget method (no `removeEventListener`) — fails the Like
// contract entirely.
export const eventTargetMissingMethod = () => ({
  dispatchEvent: noop,
  addEventListener: noop,
});

// the AbortController itself (not its `.signal`) — carries neither the
// EventTarget method surface nor the abort surface. Rejected everywhere;
// pins `isAbortSignal/R4`.
export const abortController = () => new AbortController();

// abort surface WITHOUT the EventTarget methods — `aborted` + `throwIfAborted`
// but no dispatch/add/remove. Rejected by `isAbortSignalLike` (the EventTarget
// contract is part of it); `isAbortSignalLike/R2`.
export const abortSurfaceOnly = () => ({ aborted: false, throwIfAborted: noop });

// the EventTarget methods + abort surface but `aborted` is NOT a boolean — the
// Like tier reads the `aborted` VALUE and rejects a non-boolean;
// `isAbortSignalLike/R3`. (Still `EventTargetLike` — it has the three methods.)
export const abortedNonBoolean = () => ({
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
  aborted: 'yes',
  throwIfAborted: noop,
});

// ----- foreign-realm shapes (targeted by cross-realm.test.js) -----
// `EventTarget` / `AbortController` are Node globals, NOT ECMAScript intrinsics,
// so the vm realm (bare `createContext({})`) does NOT expose them — a REAL
// foreign EventTarget/AbortSignal is not constructible here. These are foreign
// SYNTHETICS: a foreign-realm class named `EventTarget` / `AbortSignal` carrying
// the structural contract (tag + method/accessor surface). They are genuinely
// foreign (their class/prototype are the vm realm's, so local `instanceof`
// fails), which is exactly what the cross-realm structural-equivalence arm must
// carry.

const FOREIGN_EVENT_TARGET_CLASS = `class EventTarget {
  get [Symbol.toStringTag]() { return 'EventTarget'; }
  dispatchEvent() { return true; }
  addEventListener() {}
  removeEventListener() {}
}`;

export const foreignEventTarget = () =>
  foreignRealmEval(
    `(() => { ${FOREIGN_EVENT_TARGET_CLASS} return new EventTarget(); })()`,
  );

// a foreign subclass — inherits the three methods (EventTargetLike true) but its
// constructor-name is the subclass name, so the strict signal gate rejects it.
export const foreignEventTargetSubclass = () =>
  foreignRealmEval(
    `(() => { ${FOREIGN_EVENT_TARGET_CLASS} class Widget extends EventTarget {} return new Widget(); })()`,
  );

// a foreign synthetic AbortSignal — the full spec accessor surface: `aborted`
// (boolean getter, no setter), `reason` (getter, no setter), `onabort`
// (getter+setter), `throwIfAborted` (callable), atop the EventTarget methods.
export const foreignAbortSignal = () =>
  foreignRealmEval(`(() => {
    class AbortSignal {
      get [Symbol.toStringTag]() { return 'AbortSignal'; }
      get aborted() { return false; }
      get reason() { return undefined; }
      get onabort() { return null; }
      set onabort(v) {}
      throwIfAborted() {}
      dispatchEvent() { return true; }
      addEventListener() {}
      removeEventListener() {}
    }
    return new AbortSignal();
  })()`);

// a genuine foreign plain object — a foreign non-EventTarget: all four → false.
export const foreignPlainObject = () => foreignRealmEval('({})');

// ----- spoof / boundary shapes (targeted by adversarial.test.js) -----

// a tag-only spoof: the `[[Class]]` tag says `EventTarget` but there is no
// `instanceof`, no method surface, and the resolved constructor-name is
// `Object`. `isEventTarget/R2`.
export const tagSpoofedEventTarget = () => ({ [Symbol.toStringTag]: 'EventTarget' });

// the AbortSignal analogue; `isAbortSignal/R2`.
export const tagSpoofedAbortSignal = () => ({ [Symbol.toStringTag]: 'AbortSignal' });

// a userland EventTarget carrying the Observable-proposal `when()` on top of the
// three canonical methods — still `EventTargetLike` (true): `when` is
// deliberately out of contract (#028), neither required nor rejected. Pins the
// public-level admission behind `dIETC/A4`.
export const whenBearingUserlandEventTarget = () => ({
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
  when: noop,
});

// ----- prototype-graft shapes (realm-asymmetry, targeted by adversarial.test.js) -----
// A bare `Object.create(EventTarget.prototype)` genuinely HAS `eventTargetPrototype`
// as its `[[Prototype]]`, so `isEventTarget`'s local identity fast-path admits it
// (`isEventTarget/A3`) even though it never ran the constructor. The fast-path is
// tag-blind, so an OWN spoofed/throwing `Symbol.toStringTag` does not change the local
// verdict — but the FOREIGN counterpart falls to the structural cross-realm arm, which
// reads that tag and rejects. See `isEventTarget` → "Realm asymmetry on tampered inputs".

// a LOCAL graft with an own tag `'Nope'` shadowing the inherited `'EventTarget'` —
// `isEventTarget` still true (local arm never reads the tag).
export const localTagSpoofedEventTargetGraft = () =>
  objectCreate(EventTarget.prototype, {
    [Symbol.toStringTag]: { value: 'Nope' },
  });

// a LOCAL graft whose own `Symbol.toStringTag` getter throws — `isEventTarget` still
// true (local arm never reads the tag; the throw is never triggered).
export const localTagThrowingEventTargetGraft = () =>
  objectCreate(EventTarget.prototype, {
    [Symbol.toStringTag]: {
      get() {
        throw new Error('tag-trap');
      },
    },
  });

// the FOREIGN counterpart of `localTagSpoofedEventTargetGraft`: a graft onto a foreign
// `EventTarget.prototype` with the same own tag `'Nope'`. Local `instanceof` misses, so
// the cross-realm arm runs; its signal gate reads the own tag via `getTypeSignature` →
// `'[object Nope]'` ≠ `'[object EventTarget]'` → rejects (`false`).
export const foreignTagSpoofedEventTargetGraft = () =>
  foreignRealmEval(`(() => {
    ${FOREIGN_EVENT_TARGET_CLASS}
    return Object.create(EventTarget.prototype, {
      [Symbol.toStringTag]: { value: 'Nope' },
    });
  })()`);

// ----- throw-safety probes (evented's re-derived hostile set) -----
// The public predicates must answer a boolean on EVERY hostile input and never
// propagate a throw. evented's read surface differs from object's — it reaches
// the `instanceof` prototype-walk (isCurrentRealm*Instance), `getInertPrototypeOf`
// (the strict-tier prototype resolve), the constructor-walk descriptor reads, and
// — AbortSignal-only — the `aborted` getter. Three public-predicate surfaces:

// (1) a Proxy value whose `getPrototypeOf` trap throws — hits BOTH the Like-tier
// `instanceof` walk (isCurrentRealm*Instance's try/catch absorbs it) AND the
// strict-tier `getInertPrototypeOf` (collapses to `undefined` → the `!!prototype`
// short-circuit). All four predicates → false, not thrown.
export const throwingProtoTrapProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('proto-trap');
      },
    },
  );

// (2) a value whose `[[Prototype]]` is a Proxy whose `getOwnPropertyDescriptor`
// trap throws — the strict cross-realm arm's constructor-walk (`getDefinedConstructor`)
// pivots into it, guarded by `getInertDescriptor` (#056) → `undefined` → the
// signal gate's constructor-name is undefined → rejects. The Like-tier
// `hasInertMethod` walk over the same hostile prototype also absorbs it. All four
// → false, not thrown.
export const valueOverThrowingProtoDescTrap = () =>
  objectCreate(
    new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('proto-desc-trap');
        },
      },
    ),
  );

// (3) a userland EventTarget (the three methods) whose `aborted` is a throwing
// getter. The AbortSignal-specific surface: the Like-tier
// `doesImplementAbortSignalContract` reads `value.aborted` directly (its
// try/catch absorbs the throw → false). The EventTarget contract never reads
// `aborted`, so `isEventTargetLike` still admits it (true) — the honest
// asymmetric verdict this row pins. Discharges the public rejection vector
// `isAbortSignalLike/R4` (throwing `aborted` getter → false) at the public tier;
// the helper-tier `dIASC/R4` is the same input against the helper directly.
export const abortedGetterThrowUserland = () => ({
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
  throwIfAborted: noop,
  get aborted() {
    throw new Error('aborted-getter');
  },
});

// (4) a hostile `[[Prototype]]` whose `ownKeys` trap throws — drives the
// strict-tier member-surface read (`getOwnPropertyDescriptors` in
// `doesImplement{EventTarget,AbortSignal}PrototypeContract`) into its try/catch.
// HELPER-level boundary (dIETPC/R2 / dIASPC/R4, in `_internal/helpers.test.js`),
// NOT a public-predicate row: the public path fails the tag+constructor-name
// signal gate before the prototype-contract walk runs.
export const throwingOwnKeysProto = () =>
  new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('ownKeys-trap');
      },
    },
  );

// ----- axis-1 contract matrix -----
// Each row: a fresh-value factory + the expected outcome of all four public
// predicates + the spec vector IDs the row covers. `spec.test.js` asserts every
// cell and guards that every row scores every predicate (no silent gaps).

/**
 * @typedef {object} SpecRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isEventTargetLike: boolean, isEventTarget: boolean, isAbortSignalLike: boolean, isAbortSignal: boolean }} expected - expected outcome of each predicate
 * @property {string[]} vectors - spec vector IDs this row covers
 */

const T = true;
const F = false;

/** @type {Record<string, SpecRow>} */
export const specMatrix = {
  directEventTarget: {
    description: 'a direct `new EventTarget()`',
    make: directEventTarget,
    expected: {
      isEventTargetLike: T,
      isEventTarget: T,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: [
      'isEventTargetLike/A1',
      'isEventTarget/A1',
      'isAbortSignalLike/R1',
      'isAbortSignal/R1',
    ],
  },
  eventTargetSubclassInstance: {
    description: 'an `EventTarget` subclass instance',
    make: eventTargetSubclassInstance,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isEventTargetLike/A2', 'isEventTarget/R1'],
  },
  userlandEventTarget: {
    description: 'a userland object with the three EventTarget methods',
    make: userlandEventTarget,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isEventTargetLike/A3', 'isEventTarget/R3'],
  },
  emptyObject: {
    description: 'a plain empty object `{}`',
    make: emptyObject,
    expected: {
      isEventTargetLike: F,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isEventTargetLike/R3'],
  },
  abortControllerSignal: {
    description: 'a direct `AbortSignal` (`new AbortController().signal`)',
    make: abortControllerSignal,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: T,
      isAbortSignal: T,
    },
    vectors: [
      'isEventTargetLike/A4',
      'isEventTarget/R4',
      'isAbortSignalLike/A1',
      'isAbortSignal/A1',
    ],
  },
  abortSignalTimeout: {
    description: '`AbortSignal.timeout(1000)` — a direct AbortSignal',
    make: abortSignalTimeout,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: T,
      isAbortSignal: T,
    },
    vectors: ['isAbortSignalLike/A2', 'isAbortSignal/A2'],
  },
  abortSignalAny: {
    description: '`AbortSignal.any([])` — a direct AbortSignal',
    make: abortSignalAny,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: T,
      isAbortSignal: T,
    },
    vectors: ['isAbortSignalLike/A2', 'isAbortSignal/A2'],
  },
  userlandAbortSignal: {
    description: 'a userland object matching the full AbortSignalLike contract',
    make: userlandAbortSignal,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: T,
      isAbortSignal: F,
    },
    vectors: ['isAbortSignalLike/A3', 'isAbortSignal/R3'],
  },
  eventTargetMissingMethod: {
    description: 'an object missing one EventTarget method',
    make: eventTargetMissingMethod,
    expected: {
      isEventTargetLike: F,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isEventTargetLike/R1'],
  },
  abortController: {
    description: 'an `AbortController` (not its `.signal`)',
    make: abortController,
    expected: {
      isEventTargetLike: F,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isAbortSignal/R4'],
  },
  abortSurfaceOnly: {
    description: 'the abort surface without the EventTarget methods',
    make: abortSurfaceOnly,
    expected: {
      isEventTargetLike: F,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isAbortSignalLike/R2'],
  },
  abortedNonBoolean: {
    description: 'EventTarget methods + abort surface but `aborted` is non-boolean',
    make: abortedNonBoolean,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
    vectors: ['isAbortSignalLike/R3'],
  },
};

// ----- cross-cutting rejection inputs (all four predicates → false) -----
// The spec cross-cutting groups: CC/nullish, plus the primitive and function
// type-categories that carry no method surface. (`{}` is the named
// `isEventTargetLike/R3` vector — it lives in the matrix, not here.) `spec.test.js`
// labels each it-name `CC/${group}` and asserts all four predicates → false.
export const crossCuttingRejections = {
  nullish: [null, undefined],
  primitive: [0, '', false, NaN, 0n, 42, 'x', true, 1n, Symbol('s')],
  function: [
    () => undefined,
    class {
      run() {
        return 0;
      }
    },
    function named() {
      return undefined;
    },
  ],
};

// ----- throw-safety matrix (hostile-input-class × predicate) -----
// The universal invariant (docs/spec/README.md → "Throw-safety — the universal
// invariant"; EVENTED.spec.md Module-contract Throw-safety paragraph): every
// public predicate answers a boolean on EVERY hostile input and never propagates
// a throw. `throw-safety.test.js` asserts BOTH not-thrown AND the honest
// by-contract verdict for every cell; the invariant is met ⟺ every cell is filled.
//
// The `ownKeys`-trap is a HELPER-level boundary (dIETPC/R2 / dIASPC/R4, in
// `_internal/helpers.test.js`) — the public path fails the signal gate before the
// prototype-contract walk runs — so it is NOT a row here.

/**
 * @typedef {object} ThrowSafetyRow
 * @property {string} surface - the throw-surface class this row exercises
 * @property {() => unknown} make - fresh hostile-value factory
 * @property {{ isEventTargetLike: boolean, isEventTarget: boolean, isAbortSignalLike: boolean, isAbortSignal: boolean }} expected - honest verdict per predicate (all must NOT throw)
 */

/** @type {Record<string, ThrowSafetyRow>} */
export const throwSafetyMatrix = {
  prototypeTrap: {
    surface: 'prototype-trap: Proxy whose `getPrototypeOf` throws',
    make: throwingProtoTrapProxy,
    expected: {
      isEventTargetLike: F,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
  },
  descriptorTrapOnPrototype: {
    surface:
      'descriptor-trap: value over a `[[Prototype]]` whose `getOwnPropertyDescriptor` throws',
    make: valueOverThrowingProtoDescTrap,
    expected: {
      isEventTargetLike: F,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
  },
  abortedGetterThrow: {
    surface:
      'aborted-getter-throw: userland EventTarget whose `aborted` getter throws — Like-tier admits (never reads aborted), AbortSignal-tier rejects',
    make: abortedGetterThrowUserland,
    expected: {
      isEventTargetLike: T,
      isEventTarget: F,
      isAbortSignalLike: F,
      isAbortSignal: F,
    },
  },
};
