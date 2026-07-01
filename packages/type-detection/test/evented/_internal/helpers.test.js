// @ts-check

/**
 * @module test/evented/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The twelve exported `@internal` helpers
 * (six per family) that compose the two `evented` lattices, tested in isolation
 * on LOCAL values: the realm-membership and structural helpers carry no
 * local-realm proto-identity narrowing, so they run the realm-independent logic
 * directly — a genuine local `EventTarget` / `AbortSignal` exercises the same
 * path a foreign one would, and the foreign-fixture composition is covered by
 * `cross-realm.test.js`. Grouped by family, source order:
 *
 *   realm-membership     — isCurrentRealm{EventTarget,AbortSignal}Instance
 *   signal gate          — has{EventTarget,AbortSignal}IdentitySignal
 *   Like-tier contract   — doesImplement{EventTarget,AbortSignal}Contract
 *   strict-tier surface  — doesImplement{EventTarget,AbortSignal}PrototypeContract
 *   strict-tier identity — is{EventTarget,AbortSignal}PrototypeEquivalent
 *   composed alien arm   — isAlienRealm{EventTarget,AbortSignal}
 *
 * The load-bearing helper-only vectors — not reachable through any public
 * predicate — are pinned here: the `#061` spoof closure (`iARET/R1`, the
 * round-trip anti-graft marker that rejects a tag+name+method-names look-alike),
 * the graft rejections (`iETPE/R2` / `iASPE/R1`), the strict-tier accessor-shape
 * marker that rejects exactly what the Like tier admits (`dIASPC/R2`), and the
 * `ownKeys` / getter throw-safety boundaries (`dIETPC/R2`, `dIASPC/R4`).
 *
 * Mirrors the "Helper specification (axis 4)" section in `docs/spec/EVENTED.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isCurrentRealmEventTargetInstance,
  isCurrentRealmAbortSignalInstance,
  hasEventTargetIdentitySignal,
  hasAbortSignalIdentitySignal,
  doesImplementEventTargetContract,
  doesImplementAbortSignalContract,
  doesImplementEventTargetPrototypeContract,
  doesImplementAbortSignalPrototypeContract,
  isEventTargetPrototypeEquivalent,
  isAbortSignalPrototypeEquivalent,
  isAlienRealmEventTarget,
  isAlienRealmAbortSignal,
  getInertPrototypeOf,
} from '@/index.js';

import {
  directEventTarget,
  eventTargetSubclassInstance,
  userlandEventTarget,
  emptyObject,
  eventTargetMissingMethod,
  abortControllerSignal,
  abortSignalTimeout,
  abortSurfaceOnly,
  abortedNonBoolean,
  abortedGetterThrowUserland,
  whenBearingUserlandEventTarget,
  throwingOwnKeysProto,
  foreignEventTarget,
  foreignAbortSignal,
} from '../__config.js';

const noop = () => undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  EventTarget helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] isCurrentRealmEventTargetInstance', () => {
  it('iCRETI/A1: a local `new EventTarget()` and a subclass instance → true (subclass-admitting)', () => {
    expect(isCurrentRealmEventTargetInstance(directEventTarget()), 'direct').toBe(true);
    expect(isCurrentRealmEventTargetInstance(eventTargetSubclassInstance()), 'subclass').toBe(
      true,
    );
  });

  it('iCRETI/A2: `new AbortController().signal` → true (an `AbortSignal` IS an `EventTarget`)', () => {
    expect(isCurrentRealmEventTargetInstance(abortControllerSignal())).toBe(true);
  });

  it('iCRETI/R1: a cross-realm `EventTarget` → false (`instanceof` against the local capture)', () => {
    expect(isCurrentRealmEventTargetInstance(foreignEventTarget())).toBe(false);
  });

  it('iCRETI/R2: a plain object / userland 3-method object → false', () => {
    expect(isCurrentRealmEventTargetInstance(emptyObject()), 'empty').toBe(false);
    expect(isCurrentRealmEventTargetInstance(userlandEventTarget()), 'userland').toBe(false);
  });
});

describe('[Internal] hasEventTargetIdentitySignal (value, name)', () => {
  it('hETIS/A1: `(new EventTarget(), "EventTarget")` → true (both markers match)', () => {
    expect(hasEventTargetIdentitySignal(directEventTarget(), 'EventTarget')).toBe(true);
  });

  it('hETIS/R1: `(new EventTarget(), "Object")` → false (name mismatch — the tag-spoof closure)', () => {
    expect(hasEventTargetIdentitySignal(directEventTarget(), 'Object')).toBe(false);
  });

  it('hETIS/R2: `({ [toStringTag]: "Nope" }, "EventTarget")` → false (tag mismatch)', () => {
    expect(
      hasEventTargetIdentitySignal({ [Symbol.toStringTag]: 'Nope' }, 'EventTarget'),
    ).toBe(false);
  });
});

describe('[Internal] doesImplementEventTargetContract (Like-tier, chain-walking)', () => {
  it('dIETC/A1: `new EventTarget()` → true (methods inherited from the prototype)', () => {
    expect(doesImplementEventTargetContract(directEventTarget())).toBe(true);
  });

  it('dIETC/A2: a subclass instance / `AbortController().signal` → true (inherited)', () => {
    expect(doesImplementEventTargetContract(eventTargetSubclassInstance()), 'subclass').toBe(
      true,
    );
    expect(doesImplementEventTargetContract(abortControllerSignal()), 'signal').toBe(true);
  });

  it('dIETC/A3: a userland object with the three methods as own callables → true', () => {
    expect(doesImplementEventTargetContract(userlandEventTarget())).toBe(true);
  });

  it('dIETC/A4: the three methods plus a `when()` → true (`when` out of contract, #028)', () => {
    expect(doesImplementEventTargetContract(whenBearingUserlandEventTarget())).toBe(true);
  });

  it('dIETC/R1: missing one of the three → false (short-circuits)', () => {
    expect(doesImplementEventTargetContract(eventTargetMissingMethod())).toBe(false);
  });

  it('dIETC/R2: an accessor on one of the three → false (inspect-without-invoke)', () => {
    const accessorMethod = {
      dispatchEvent: noop,
      addEventListener: noop,
      get removeEventListener() {
        return noop;
      },
    };
    expect(doesImplementEventTargetContract(accessorMethod)).toBe(false);
  });

  it('dIETC/R3: `{}`, `null`, `undefined`, `42` → false (`hasInertMethod` nullish-safe)', () => {
    expect(doesImplementEventTargetContract(emptyObject()), 'empty').toBe(false);
    expect(doesImplementEventTargetContract(null), 'null').toBe(false);
    expect(doesImplementEventTargetContract(undefined), 'undefined').toBe(false);
    expect(doesImplementEventTargetContract(42), '42').toBe(false);
  });
});

describe('[Internal] doesImplementEventTargetPrototypeContract (strict-tier, own descriptors)', () => {
  it('dIETPC/A1: `EventTarget.prototype` → true (the three methods are own callable data props)', () => {
    expect(doesImplementEventTargetPrototypeContract(EventTarget.prototype)).toBe(true);
  });

  it('dIETPC/A2: a prototype also carrying `when()` → true (extra own members allowed, #028)', () => {
    const whenProto = {
      dispatchEvent: noop,
      addEventListener: noop,
      removeEventListener: noop,
      when: noop,
    };
    expect(doesImplementEventTargetPrototypeContract(whenProto)).toBe(true);
  });

  it('dIETPC/R1: `Object.prototype` → false (no such methods)', () => {
    expect(doesImplementEventTargetPrototypeContract(Object.prototype)).toBe(false);
  });

  it('dIETPC/R2: a `Proxy` prototype whose `ownKeys` trap throws → false, not thrown', () => {
    // the only path exercising marker 6`s try/catch — the public predicate fails
    // the tag + constructor-name signal gate before the prototype walk runs.
    expect(doesImplementEventTargetPrototypeContract(throwingOwnKeysProto())).toBe(false);
  });
});

describe('[Internal] isEventTargetPrototypeEquivalent (prototype, constructor)', () => {
  it('iETPE/A1: `(EventTarget.prototype, EventTarget)` → true (all four markers hold)', () => {
    expect(isEventTargetPrototypeEquivalent(EventTarget.prototype, EventTarget)).toBe(true);
  });

  it('iETPE/R1: `(EventTarget.prototype, function EventTarget(){})` → false (`isClass` fails)', () => {
    expect(
      isEventTargetPrototypeEquivalent(
        EventTarget.prototype,
        /** @type {never} */ (function EventTarget() {}),
      ),
    ).toBe(false);
  });

  it('iETPE/R2: a grafted prototype whose `constructor.prototype !== prototype` → false (round-trip marker)', () => {
    // isClass + tag markers pass; only the constructor.prototype round-trip fails.
    class EventTarget {
      get [Symbol.toStringTag]() {
        return 'EventTarget';
      }
    }
    const graftProto = Object.create(Object.prototype, {
      [Symbol.toStringTag]: { get: () => 'EventTarget' },
    });
    expect(isEventTargetPrototypeEquivalent(graftProto, EventTarget)).toBe(false);
  });
});

describe('[Internal] isAlienRealmEventTarget (value, prototype)', () => {
  it('iARET/A1: a genuine `EventTarget` and its prototype → true (realm-independent arm)', () => {
    // fed a LOCAL instance to exercise the realm-independent composition; the
    // foreign-fixture path is asserted in `cross-realm.test.js`.
    const value = directEventTarget();
    expect(isAlienRealmEventTarget(value, getInertPrototypeOf(value))).toBe(true);
  });

  it('iARET/R1: a tag + name + method-names look-alike whose prototype does not round-trip → false (#061 spoof closure)', () => {
    // signal gate PASSES (tag `[object EventTarget]` + constructor-name `EventTarget`);
    // the round-trip marker (`constructor.prototype === prototype`) is what rejects it.
    class EventTarget {
      dispatchEvent() {
        return true;
      }
      addEventListener() {}
      removeEventListener() {}
      get [Symbol.toStringTag]() {
        return 'EventTarget';
      }
    }
    const proto = Object.create(Object.prototype, {
      constructor: { value: EventTarget },
      [Symbol.toStringTag]: { get: () => 'EventTarget' },
      dispatchEvent: { value: noop },
      addEventListener: { value: noop },
      removeEventListener: { value: noop },
    });
    const value = Object.create(proto);
    expect(isAlienRealmEventTarget(value, proto)).toBe(false);
  });

  it('iARET/R2: an `EventTarget` subclass → false (constructor-name signal gate)', () => {
    const value = new (class Widget extends EventTarget {})();
    expect(isAlienRealmEventTarget(value, getInertPrototypeOf(value))).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortSignal helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] isCurrentRealmAbortSignalInstance', () => {
  it('iCRASI/A1: `AbortController().signal` and `AbortSignal.timeout(1000)` → true', () => {
    expect(isCurrentRealmAbortSignalInstance(abortControllerSignal()), 'controller').toBe(
      true,
    );
    expect(isCurrentRealmAbortSignalInstance(abortSignalTimeout()), 'timeout').toBe(true);
  });

  it('iCRASI/R1: `new EventTarget()` → false; a cross-realm `AbortSignal` → false', () => {
    expect(isCurrentRealmAbortSignalInstance(directEventTarget()), 'event-target').toBe(
      false,
    );
    expect(isCurrentRealmAbortSignalInstance(foreignAbortSignal()), 'foreign').toBe(false);
  });
});

describe('[Internal] hasAbortSignalIdentitySignal (value, name)', () => {
  it('hASIS/A1: `(AbortController().signal, "AbortSignal")` → true', () => {
    expect(hasAbortSignalIdentitySignal(abortControllerSignal(), 'AbortSignal')).toBe(true);
  });

  it('hASIS/R1: `(AbortController().signal, "EventTarget")` → false (name mismatch)', () => {
    expect(hasAbortSignalIdentitySignal(abortControllerSignal(), 'EventTarget')).toBe(false);
  });
});

describe('[Internal] doesImplementAbortSignalContract (Like-tier)', () => {
  it('dIASC/A1: `AbortController().signal`, `AbortSignal.timeout(1000)` → true', () => {
    expect(doesImplementAbortSignalContract(abortControllerSignal()), 'controller').toBe(
      true,
    );
    expect(doesImplementAbortSignalContract(abortSignalTimeout()), 'timeout').toBe(true);
  });

  it('dIASC/R1: `new EventTarget()` → false (no `throwIfAborted` / `aborted`)', () => {
    expect(doesImplementAbortSignalContract(directEventTarget())).toBe(false);
  });

  it('dIASC/R2: abort surface without the EventTarget methods → false', () => {
    expect(doesImplementAbortSignalContract(abortSurfaceOnly())).toBe(false);
  });

  it('dIASC/R3: `aborted` present but non-boolean → false', () => {
    expect(doesImplementAbortSignalContract(abortedNonBoolean())).toBe(false);
  });

  it('dIASC/R4: a throwing `aborted` getter → false (try/catch)', () => {
    expect(doesImplementAbortSignalContract(abortedGetterThrowUserland())).toBe(false);
  });

  it('dIASC/R5: `{}`, `null` → false', () => {
    expect(doesImplementAbortSignalContract(emptyObject()), 'empty').toBe(false);
    expect(doesImplementAbortSignalContract(null), 'null').toBe(false);
  });
});

describe('[Internal] doesImplementAbortSignalPrototypeContract (strict-tier accessor shape)', () => {
  it('dIASPC/A1: `(AbortSignal.prototype, AbortController().signal)` → true', () => {
    expect(
      doesImplementAbortSignalPrototypeContract(
        AbortSignal.prototype,
        abortControllerSignal(),
      ),
    ).toBe(true);
  });

  it('dIASPC/R1: `(EventTarget.prototype, new EventTarget())` → false (no abort accessors)', () => {
    expect(
      doesImplementAbortSignalPrototypeContract(EventTarget.prototype, directEventTarget()),
    ).toBe(false);
  });

  it('dIASPC/R2: `aborted` a plain DATA boolean (no getter) → false (rejects what the Like tier admits)', () => {
    const dataAbortedProto = {
      aborted: false,
      reason: undefined,
      onabort: null,
      throwIfAborted: noop,
    };
    expect(doesImplementAbortSignalPrototypeContract(dataAbortedProto, {})).toBe(false);
  });

  it('dIASPC/R3: `aborted` getter returns a non-boolean → false', () => {
    const nonBooleanAbortedProto = Object.create(Object.prototype, {
      aborted: { get: () => 'yes' },
      reason: { get: () => undefined },
      onabort: { get: () => null, set: noop },
      throwIfAborted: { value: noop },
    });
    expect(doesImplementAbortSignalPrototypeContract(nonBooleanAbortedProto, {})).toBe(false);
  });

  it('dIASPC/R4: a throwing `aborted` getter / hostile descriptor trap → false, not thrown', () => {
    const throwingAbortedProto = Object.create(Object.prototype, {
      aborted: {
        get() {
          throw new Error('aborted-getter');
        },
      },
      reason: { get: () => undefined },
      onabort: { get: () => null, set: noop },
      throwIfAborted: { value: noop },
    });
    expect(
      doesImplementAbortSignalPrototypeContract(throwingAbortedProto, {}),
      'throwing-getter',
    ).toBe(false);
    expect(
      doesImplementAbortSignalPrototypeContract(throwingOwnKeysProto(), {}),
      'ownKeys-trap',
    ).toBe(false);
  });
});

describe('[Internal] isAbortSignalPrototypeEquivalent (prototype, constructor, value)', () => {
  it('iASPE/A1: `(AbortSignal.prototype, AbortSignal, AbortController().signal)` → true', () => {
    expect(
      isAbortSignalPrototypeEquivalent(
        AbortSignal.prototype,
        AbortSignal,
        abortControllerSignal(),
      ),
    ).toBe(true);
  });

  it('iASPE/R1: a grafted prototype whose `constructor.prototype !== prototype` → false (graft)', () => {
    class AbortSignal {
      get [Symbol.toStringTag]() {
        return 'AbortSignal';
      }
    }
    const graftProto = Object.create(Object.prototype, {
      [Symbol.toStringTag]: { get: () => 'AbortSignal' },
    });
    expect(isAbortSignalPrototypeEquivalent(graftProto, AbortSignal, {})).toBe(false);
  });
});

describe('[Internal] isAlienRealmAbortSignal (value, prototype)', () => {
  it('iARAS/A1: a genuine `AbortSignal` and its prototype → true (realm-independent arm)', () => {
    const value = abortControllerSignal();
    expect(isAlienRealmAbortSignal(value, getInertPrototypeOf(value))).toBe(true);
  });

  it('iARAS/R1: an `EventTarget` (not an `AbortSignal`) → false (tag/name gate)', () => {
    const value = directEventTarget();
    expect(isAlienRealmAbortSignal(value, getInertPrototypeOf(value))).toBe(false);
  });
});