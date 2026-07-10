// @ts-check

/**
 * @module test/error/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance. The predicates admit only genuine
 * errors (or a cross-realm structural equivalent), so a value that merely LOOKS
 * right must be handled by contract. Covers:
 *
 *   - the DOMException descriptor-kind boundary (ADR #068): a get-gated `name`
 *     is admitted wherever it lives; a plain DATA `name`/`message` is rejected;
 *     symmetric on both members.
 *   - the graft boundaries: the bare DOMException graft is admitted (presence-
 *     only); the Error-prototype graft is rejected (stack-graft filter); the
 *     "Chrome stand-in" (valid getters, no stack) is admitted (getter contract,
 *     not stack).
 *   - the flattened-name DOMException subclass → NEITHER arm.
 *   - a tag-only DOMException spoof → rejected.
 *   - the weaponized realm-asymmetry: an own THROWING `name` getter on a real
 *     prototype is ADMITTED by isDOMException current-realm (presence-only,
 *     never invoked) and does not throw.
 *
 * Mirrors the "Spoof (axis 3)" + boundary vectors in `docs/spec/ERROR.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import { isGenericError, isDOMException, isError, isAbortError } from '@/index.js';

import {
  bareDomExceptionGraft,
  ownGetterNameGraft,
  ownDataNameGraft,
  ownDataMessageGraft,
  chromeStandInDomException,
  errorPrototypeGraft,
  flattenedDomExceptionSubclass,
  tagSpoofedDomException,
  throwingGetterNameGraft,
} from './__config.js';

describe('error — DOMException descriptor-kind boundary (ADR #068)', () => {
  it('isDOMException/A3: an own-GETTER `name` graft → true (get-gated name admitted anywhere)', () => {
    expect(isDOMException(ownGetterNameGraft())).toBe(true);
  });

  it('isDOMException/R3: an own-DATA `name` graft → false (data shadows the getter)', () => {
    expect(isDOMException(ownDataNameGraft())).toBe(false);
  });

  it('isDOMException/R4: an own-DATA `message` graft → false (symmetric on message)', () => {
    expect(isDOMException(ownDataMessageGraft())).toBe(false);
  });

  it('isDOMException/B1: the bare `Object.create(DOMException.prototype)` graft → true (presence-only)', () => {
    const graft = bareDomExceptionGraft();
    expect(isDOMException(graft), 'isDOMException').toBe(true);
    // it is not a generic error (excluded by identity — it IS instanceof DOMException).
    expect(isGenericError(graft), 'isGenericError').toBe(false);
    expect(isError(graft), 'isError').toBe(true);
  });
});

describe('error — graft filter boundaries (ADR #066)', () => {
  it('isGenericError/R4 + isGenericError/B1 + isError/B1: an `Object.create(Error.prototype)` graft → false (no reachable stack, stack-capable engine)', () => {
    const graft = errorPrototypeGraft();
    expect(isGenericError(graft), 'isGenericError').toBe(false);
    expect(isError(graft), 'isError').toBe(false);
  });

  it('isDOMException/A5 + iAE/B1: the Chrome stand-in (valid getters, NO stack) → DOMException, isError', () => {
    // the DOMException contract is getter-shape, NOT stack — engine-independent.
    const value = chromeStandInDomException();
    expect(isDOMException(value), 'isDOMException').toBe(true);
    expect(isError(value), 'isError').toBe(true);
    expect(isGenericError(value), 'isGenericError').toBe(false);
  });
});

describe('error — the flattened-name DOMException subclass → NEITHER arm (ADR #069)', () => {
  it('isGenericError/R3 + isDOMException/R2 + isError/R3: rejected by both, classified as neither', () => {
    const value = flattenedDomExceptionSubclass();
    expect(isDOMException(value), 'isDOMException').toBe(false);
    expect(isGenericError(value), 'isGenericError').toBe(false);
    expect(isError(value), 'isError').toBe(false);
  });
});

describe('error — spoof resistance', () => {
  it('a tag-only DOMException spoof (`[toStringTag]` + data name/message) → false', () => {
    const spoof = tagSpoofedDomException();
    expect(isDOMException(spoof), 'isDOMException').toBe(false);
    // it is not an Error either (not instanceof; no Error.prototype-equivalent level).
    expect(isGenericError(spoof), 'isGenericError').toBe(false);
    expect(isError(spoof), 'isError').toBe(false);
  });

  it('weaponized asymmetry: an own THROWING `name` getter graft → isDOMException true, NOT thrown', () => {
    // current-realm reads getter PRESENCE (never invokes), so a hostile throwing
    // getter is admitted without firing — the alien path (which invokes on a live
    // receiver) is the one that would reject it. Pins presence-only semantics.
    const graft = throwingGetterNameGraft();
    let verdict;
    expect(() => {
      verdict = isDOMException(graft);
    }, 'isDOMException threw').not.toThrow();
    expect(verdict, 'isDOMException verdict').toBe(true);
  });

  it('isAbortError/R3: an Error with a non-string `name` (`defineProperty value: 42`) → false, NOT thrown', () => {
    // the load-bearing string-type gate: the value passes `isError`, but its `name`
    // is not a string — without `isStringValue(value.name)` the bare `42.endsWith`
    // would throw `TypeError`.
    const value = Object.defineProperty(new Error(), 'name', { value: 42 });
    let verdict;
    expect(() => {
      verdict = isAbortError(value);
    }, 'isAbortError threw').not.toThrow();
    expect(verdict, 'isAbortError verdict').toBe(false);
  });
});
