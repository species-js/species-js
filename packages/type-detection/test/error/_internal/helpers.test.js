// @ts-check

/**
 * @module test/error/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The seventeen exported `@internal` helpers
 * that compose the three predicates, tested in isolation on LOCAL values (the
 * alien-walk helpers run their realm-independent logic on a genuine local value;
 * the foreign-fixture composition is covered by `cross-realm.test.js`). Groups,
 * source order:
 *
 *   stack-capability   — retrieveErrorStack, errorStackMode, ERROR_STACK_CAPABLE,
 *                        hasReachableErrorStack, doesPassErrorGraftFilter
 *   structural contracts — doesImplementMinimumErrorContract,
 *                        doesImplementGenericErrorContract, doesImplementDOMExceptionContract
 *   prototype contracts  — doesImplement{GenericError,DOMException}PrototypeContract
 *   prototype-equivalence — is{GenericError,DOMException}PrototypeEquivalent
 *   realm arms           — isAlienRealm{GenericError,DOMException},
 *                        isCurrentRealm{GenericError,DOMException}Instance
 *   polyfill body        — isAnyError
 *
 * The load-bearing helper-only boundaries pinned here (not reachable through a
 * public predicate): the `ownKeys`-trap and tag-getter-throw on the prototype
 * contracts (the public path fails an earlier gate), and the alien-walk's
 * getter-INVOKING receiver check (dIDEPC on a `{}` receiver throws → false).
 *
 * Mirrors the "Helper specification (axis 4)" section in `docs/spec/ERROR.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  retrieveErrorStack,
  errorStackMode,
  ERROR_STACK_CAPABLE,
  hasReachableErrorStack,
  doesPassErrorGraftFilter,
  doesImplementMinimumErrorContract,
  doesImplementGenericErrorContract,
  doesImplementDOMExceptionContract,
  doesImplementGenericErrorPrototypeContract,
  doesImplementDOMExceptionPrototypeContract,
  isGenericErrorPrototypeEquivalent,
  isDOMExceptionPrototypeEquivalent,
  isAlienRealmGenericError,
  isAlienRealmDOMException,
  isCurrentRealmGenericErrorInstance,
  isCurrentRealmDOMExceptionInstance,
  isAnyError,
  objectCreate,
} from '#index';

import {
  plainError,
  typeError,
  errorSubclassInstance,
  domException,
  errorPrototypeGraft,
  bareDomExceptionGraft,
  ownGetterNameGraft,
  ownDataNameGraft,
  chromeStandInDomException,
  flattenedDomExceptionSubclass,
  foreignError,
  foreignDomException,
  foreignPlainErrorShaped,
  foreignFlattenedDomException,
  throwingOwnKeysProto,
} from '../__config.js';

/** @typedef {import('#function').NewableFunction} NewableFunction */

const domExceptionPrototype = DOMException.prototype;
/** @param {unknown} c - a value to cast to `NewableFunction` for the equivalence helpers */
const asCtor = (c) => /** @type {NewableFunction} */ (/** @type {unknown} */ (c));

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Stack-capability internals
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] retrieveErrorStack / errorStackMode / ERROR_STACK_CAPABLE', () => {
  it('environment: V8 is gated-slot + stack-capable', () => {
    expect(errorStackMode, 'errorStackMode').toBe('gated-slot');
    expect(ERROR_STACK_CAPABLE, 'ERROR_STACK_CAPABLE').toBe(true);
  });

  it('rES/A1: a genuine Error → a string stack', () => {
    expect(typeof retrieveErrorStack(plainError())).toBe('string');
  });

  it('rES/R1: an `Object.create(Error.prototype)` graft → undefined (no internal stack)', () => {
    expect(retrieveErrorStack(errorPrototypeGraft())).toBeUndefined();
  });

  it('rES/R2: an own THROWING `stack` getter → undefined, not thrown (gated-slot uses the captured getter, never the own one)', () => {
    let result;
    expect(() => {
      result = retrieveErrorStack({
        get stack() {
          throw new Error('own-stack-trap');
        },
      });
    }).not.toThrow();
    expect(result).toBeUndefined();
  });

  it('rES/R3: a plain `{}` → undefined', () => {
    expect(retrieveErrorStack({})).toBeUndefined();
  });
});

describe('[Internal] hasReachableErrorStack / doesPassErrorGraftFilter', () => {
  it('hRES/A1 + dPEGF/A1: a genuine Error → true', () => {
    expect(hasReachableErrorStack(plainError()), 'hRES').toBe(true);
    expect(doesPassErrorGraftFilter(plainError()), 'dPEGF').toBe(true);
  });

  it('hRES/R1 + dPEGF/R1: an Error-prototype graft → false (stack-capable)', () => {
    expect(hasReachableErrorStack(errorPrototypeGraft()), 'hRES').toBe(false);
    expect(doesPassErrorGraftFilter(errorPrototypeGraft()), 'dPEGF').toBe(false);
  });

  it('hRES/R2: a plain `{}` → false', () => {
    expect(hasReachableErrorStack({})).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Structural contracts
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] doesImplementMinimumErrorContract', () => {
  it('dIMEC/A1 + dIMEC/A2 + dIMEC/A3: Error / DOMException / plain `{name,message}` → true (the floor)', () => {
    expect(doesImplementMinimumErrorContract(plainError()), 'Error').toBe(true);
    expect(doesImplementMinimumErrorContract(domException()), 'DOMException').toBe(true);
    expect(doesImplementMinimumErrorContract({ name: 'x', message: 'y' }), 'plain').toBe(
      true,
    );
  });

  it('dIMEC/R1: missing `message` → false', () => {
    expect(doesImplementMinimumErrorContract({ name: 'x' })).toBe(false);
  });

  it('dIMEC/R2: non-string `name` → false', () => {
    expect(
      doesImplementMinimumErrorContract(
        Object.defineProperty(new Error(), 'name', { value: 42 }),
      ),
    ).toBe(false);
  });

  it('dIMEC/R3: a throwing `name` getter → false, not thrown', () => {
    let verdict;
    expect(() => {
      verdict = doesImplementMinimumErrorContract({
        message: 'y',
        get name() {
          throw new Error('name-trap');
        },
      });
    }).not.toThrow();
    expect(verdict).toBe(false);
  });

  it('dIMEC/R4: `null` → false, not thrown', () => {
    expect(
      doesImplementMinimumErrorContract(
        /** @type {{ message?: unknown, name?: unknown }} */ (
          /** @type {unknown} */ (null)
        ),
      ),
    ).toBe(false);
  });
});

describe('[Internal] doesImplementGenericErrorContract', () => {
  it('dIGEC/A1: a genuine Error → true', () => {
    expect(doesImplementGenericErrorContract(plainError())).toBe(true);
  });

  it('dIGEC/R1: an Error-prototype graft → false (graft filter, stack-capable)', () => {
    expect(doesImplementGenericErrorContract(errorPrototypeGraft())).toBe(false);
  });

  it('dIGEC/R2: a plain `{name,message}` → false (min contract passes; graft filter rejects the missing stack)', () => {
    expect(doesImplementGenericErrorContract({ name: 'x', message: 'y' })).toBe(false);
  });
});

describe('[Internal] doesImplementDOMExceptionContract (getter presence, inert)', () => {
  it('dIDEC/A1 + dIDEC/A2 + dIDEC/A3: DOMException / bare graft / own-getter name → true', () => {
    expect(doesImplementDOMExceptionContract(domException()), 'DOMException').toBe(true);
    expect(doesImplementDOMExceptionContract(bareDomExceptionGraft()), 'bare graft').toBe(
      true,
    );
    expect(doesImplementDOMExceptionContract(ownGetterNameGraft()), 'own getter').toBe(
      true,
    );
  });

  it('dIDEC/R1: a real Error → false (data name/message, no getters)', () => {
    expect(doesImplementDOMExceptionContract(plainError())).toBe(false);
  });

  it('dIDEC/R2: an own-DATA `name` shadow → false', () => {
    expect(doesImplementDOMExceptionContract(ownDataNameGraft())).toBe(false);
  });

  it('dIDEC/R3: a plain `{}` → false', () => {
    expect(doesImplementDOMExceptionContract({})).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype contracts
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] doesImplementGenericErrorPrototypeContract', () => {
  it('dIGEPC/A1: `Error.prototype` → true (pinned root values)', () => {
    expect(doesImplementGenericErrorPrototypeContract(Error.prototype)).toBe(true);
  });

  it('dIGEPC/R1: `TypeError.prototype` → false (own `name` is `TypeError`)', () => {
    expect(doesImplementGenericErrorPrototypeContract(TypeError.prototype)).toBe(false);
  });

  it('dIGEPC/R2: `Object.prototype` → false', () => {
    expect(doesImplementGenericErrorPrototypeContract(Object.prototype)).toBe(false);
  });

  it('dIGEPC/R3: a `Proxy` prototype whose `ownKeys` trap throws → false, not thrown (helper-level)', () => {
    let verdict;
    expect(() => {
      verdict = doesImplementGenericErrorPrototypeContract(throwingOwnKeysProto());
    }).not.toThrow();
    expect(verdict).toBe(false);
  });

  it('dIGEPC/R4: a prototype whose `Symbol.toStringTag` getter throws → false, not thrown (helper-level)', () => {
    const throwingTagProto = objectCreate(Object.prototype, {
      [Symbol.toStringTag]: {
        get() {
          throw new Error('tag-trap');
        },
      },
    });
    let verdict;
    expect(() => {
      verdict = doesImplementGenericErrorPrototypeContract(throwingTagProto);
    }).not.toThrow();
    expect(verdict).toBe(false);
  });
});

describe('[Internal] doesImplementDOMExceptionPrototypeContract (INVOKES the getters on `value`)', () => {
  it('dIDEPC/A1: `(DOMException.prototype, new DOMException())` → true', () => {
    expect(
      doesImplementDOMExceptionPrototypeContract(
        domExceptionPrototype,
        new DOMException(),
      ),
    ).toBe(true);
  });

  it('dIDEPC/R1: `(Error.prototype, new Error())` → false (data props, no getters)', () => {
    expect(doesImplementDOMExceptionPrototypeContract(Error.prototype, new Error())).toBe(
      false,
    );
  });

  it('dIDEPC/R2: `(DOMException.prototype, {})` → false, not thrown (getter throws on a non-DOMException receiver)', () => {
    let verdict;
    expect(() => {
      verdict = doesImplementDOMExceptionPrototypeContract(domExceptionPrototype, {});
    }).not.toThrow();
    expect(verdict).toBe(false);
  });

  it('dIDEPC/R3: a `name` accessor WITH a setter → false (readonly-accessor shape required)', () => {
    const setterProto = {
      get name() {
        return 'x';
      },
      set name(_v) {
        void _v;
      },
      get message() {
        return 'm';
      },
    };
    expect(doesImplementDOMExceptionPrototypeContract(setterProto, setterProto)).toBe(
      false,
    );
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype-equivalence
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] isGenericErrorPrototypeEquivalent', () => {
  it('iGEPE/A1: `(Error.prototype, Error)` → true', () => {
    expect(isGenericErrorPrototypeEquivalent(Error.prototype, Error)).toBe(true);
  });

  it('iGEPE/R1: `(TypeError.prototype, TypeError)` → false (prototype-contract pins the root values)', () => {
    expect(isGenericErrorPrototypeEquivalent(TypeError.prototype, TypeError)).toBe(false);
  });

  it('iGEPE/R2: `(Error.prototype, function Error() {})` → false (`isClass` fails — writable prototype)', () => {
    expect(
      isGenericErrorPrototypeEquivalent(Error.prototype, function Error() {
        return undefined;
      }),
    ).toBe(false);
  });

  it('iGEPE/R3: `(DOMException.prototype, DOMException)` → false (tag mismatch)', () => {
    expect(isGenericErrorPrototypeEquivalent(domExceptionPrototype, DOMException)).toBe(
      false,
    );
  });
});

describe('[Internal] isDOMExceptionPrototypeEquivalent', () => {
  it('iDEPE/A1: `(DOMException.prototype, DOMException, new DOMException())` → true', () => {
    expect(
      isDOMExceptionPrototypeEquivalent(
        domExceptionPrototype,
        asCtor(DOMException),
        new DOMException(),
      ),
    ).toBe(true);
  });

  it('iDEPE/R1: `(Error.prototype, Error, new Error())` → false (tag / name mismatch)', () => {
    expect(
      isDOMExceptionPrototypeEquivalent(Error.prototype, asCtor(Error), new Error()),
    ).toBe(false);
  });

  it('iDEPE/R2: `(DOMException.prototype, DOMException, {})` → false, not thrown (getter throws on `{}`)', () => {
    let verdict;
    expect(() => {
      verdict = isDOMExceptionPrototypeEquivalent(
        domExceptionPrototype,
        asCtor(DOMException),
        {},
      );
    }).not.toThrow();
    expect(verdict).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Realm arms
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] isAlienRealmGenericError', () => {
  it('iARGE/A1: a foreign Error → true (and a LOCAL Error → true: the realm-independent arm alone is a complete decision procedure)', () => {
    expect(isAlienRealmGenericError(foreignError()), 'foreign').toBe(true);
    // helper-composition equivalence: the current-realm instanceof fast-path is a
    // pure optimization — the structural arm alone classifies a local value identically.
    expect(isAlienRealmGenericError(plainError()), 'local').toBe(true);
  });

  it('iARGE/R1: a foreign valid DOMException → false (DOMException excluded)', () => {
    expect(isAlienRealmGenericError(foreignDomException())).toBe(false);
  });

  it('iARGE/R2: a foreign plain object → false (no Error.prototype-equivalent level)', () => {
    expect(isAlienRealmGenericError(foreignPlainErrorShaped())).toBe(false);
  });

  it('iARGE/B1: a foreign FLATTENED DOMException → true (the accepted asymmetry)', () => {
    expect(isAlienRealmGenericError(foreignFlattenedDomException())).toBe(true);
  });
});

describe('[Internal] isAlienRealmDOMException', () => {
  it('iARDE/A1: a foreign DOMException synthetic → true (and a LOCAL DOMException → true: the realm-independent arm alone classifies identically)', () => {
    expect(isAlienRealmDOMException(foreignDomException()), 'foreign').toBe(true);
    expect(isAlienRealmDOMException(new DOMException('m', 'X')), 'local').toBe(true);
  });

  it('iARDE/R1: a foreign Error → false (no getters)', () => {
    expect(isAlienRealmDOMException(foreignError())).toBe(false);
  });

  it('iARDE/R2: a foreign flattened DOMException → false (contract fails)', () => {
    expect(isAlienRealmDOMException(foreignFlattenedDomException())).toBe(false);
  });
});

describe('[Internal] isCurrentRealmGenericErrorInstance', () => {
  it('iCRGEI/A1: Error / TypeError / subclass → true', () => {
    expect(isCurrentRealmGenericErrorInstance(plainError()), 'Error').toBe(true);
    expect(isCurrentRealmGenericErrorInstance(typeError()), 'TypeError').toBe(true);
    expect(isCurrentRealmGenericErrorInstance(errorSubclassInstance()), 'subclass').toBe(
      true,
    );
  });

  it('iCRGEI/A2: a `new DOMException()` → true (it is `instanceof Error` in Node)', () => {
    expect(isCurrentRealmGenericErrorInstance(new DOMException('m', 'X'))).toBe(true);
  });

  it('iCRGEI/R1: a foreign Error → false (local capture)', () => {
    expect(isCurrentRealmGenericErrorInstance(foreignError())).toBe(false);
  });

  it('iCRGEI/R2: a plain `{}` → false', () => {
    expect(isCurrentRealmGenericErrorInstance({})).toBe(false);
  });
});

describe('[Internal] isCurrentRealmDOMExceptionInstance', () => {
  it('iCRDEI/A1: a DOMException / subclass → true', () => {
    expect(isCurrentRealmDOMExceptionInstance(domException()), 'direct').toBe(true);
    expect(
      isCurrentRealmDOMExceptionInstance(flattenedDomExceptionSubclass()),
      'subclass',
    ).toBe(true);
  });

  it('iCRDEI/A2: a bare `Object.create(DOMException.prototype)` graft → true (proto chain)', () => {
    expect(isCurrentRealmDOMExceptionInstance(bareDomExceptionGraft())).toBe(true);
  });

  it('iCRDEI/R1: a real Error → false', () => {
    expect(isCurrentRealmDOMExceptionInstance(plainError())).toBe(false);
  });

  it('iCRDEI/R2: a foreign DOMException synthetic → false (local capture)', () => {
    expect(isCurrentRealmDOMExceptionInstance(foreignDomException())).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Polyfill body
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] isAnyError (the isError fallback)', () => {
  it('iAE/A1 + iAE/A2: Error / DOMException / subclass / cross-realm → true', () => {
    expect(isAnyError(plainError()), 'Error').toBe(true);
    expect(isAnyError(domException()), 'DOMException').toBe(true);
    expect(isAnyError(errorSubclassInstance()), 'subclass').toBe(true);
    expect(isAnyError(foreignError()), 'foreign Error').toBe(true);
    expect(isAnyError(foreignDomException()), 'foreign DOMException').toBe(true);
  });

  it('iAE/R1: the flattened DOMException subclass → false (neither arm)', () => {
    expect(isAnyError(flattenedDomExceptionSubclass())).toBe(false);
  });

  it('iAE/R2 + iAE/R3: Error graft (stack-capable) / `{}` / `null` → false', () => {
    expect(isAnyError(errorPrototypeGraft()), 'Error graft').toBe(false);
    expect(isAnyError({}), 'empty').toBe(false);
    expect(isAnyError(null), 'null').toBe(false);
  });

  it('iAE/B1: the Chrome stand-in (valid getters, NO stack) → true (getter contract, not stack)', () => {
    expect(isAnyError(chromeStandInDomException())).toBe(true);
  });
});
