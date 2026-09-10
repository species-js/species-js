// @ts-check

/**
 * @module test/verification
 *
 * Axis 1 — the one PREDICATE. Dimension D of
 * `docs/spec/TYPE-IDENTITY.spec.md` (FROZEN 2026-09-09), the `carry/*` band.
 *
 * If a test here fails, the implementation is wrong, not the test.
 *
 * This is the dimension the workspace's predicate template fits unchanged, so
 * the suite is matrix-driven the way every other predicate in the workspace is
 * scored — one row per candidate, one boolean, a guard that the matrix is not
 * empty.
 *
 * What is hand-written is the set of vectors whose claim has a SECOND half.
 * `carry/B2` claims a verdict AND that a getter went uninvoked; `carry/B4` a
 * verdict AND the tag a shadowing value answers; `carry/B6` two verdicts that
 * disagree about the same type at two moments. A matrix row carries one
 * boolean, so reducing any of those to a row would assert the smaller half and
 * report it as the whole claim.
 *
 * Foreign-realm candidates (`carry/A5`) are in `cross-realm.test.js`.
 */

import { describe, it, expect } from 'vitest';

import { doesCarryStableTypeIdentity } from '#index';
import { defineProperty } from '#config';

import {
  callDefine,
  frozenType,
  verificationMatrix,
  verificationNearMisses,
} from './__config.js';
import {
  accessorConstructorSlotType,
  descriptorWithholdingPair,
  freshClassHierarchy,
  inertReadProbeType,
  instantiate,
  ownDescriptorOf,
  prototypeOf,
  tagOf,
  withOwnPrototype,
  withPollutedObjectPrototype,
} from './__fixtures.js';

describe('type-identity spec — D: the verification matrix (carry/*)', () => {
  it('the matrix is non-empty, so this block cannot pass vacuously', () => {
    expect(Object.keys(verificationMatrix).length).toBeGreaterThan(0);
  });

  it('the matrix scores both verdicts, so it cannot be satisfied by a constant', () => {
    const verdicts = new Set(
      Object.values(verificationMatrix).map((row) => row.expected),
    );

    expect(verdicts).toEqual(new Set([true, false]));
  });

  for (const [key, row] of Object.entries(verificationMatrix)) {
    it(`${row.description} → ${String(row.expected)} [${row.vectors.join(', ')}]`, () => {
      expect(doesCarryStableTypeIdentity(row.make()), key).toBe(row.expected);
    });
  }

  it('carry/R1 — an OMITTED argument is treated as `null`, which carries no identity', () => {
    expect(doesCarryStableTypeIdentity()).toBe(false);
  });
});

describe('type-identity spec — D: the three criteria (carry/B1)', () => {
  it('the near-miss group is non-empty and names every criterion', () => {
    expect(Object.keys(verificationNearMisses()).sort()).toEqual([
      'dataValuedTag',
      'enumerableTag',
      'getterAndSetterTag',
      'withoutFrozenConstructor',
      'withoutFrozenName',
      'withoutTag',
    ]);
  });

  for (const [key, make] of Object.entries(verificationNearMisses())) {
    it(`${key} → false — every criterion is load-bearing`, () => {
      expect(doesCarryStableTypeIdentity(make()), key).toBe(false);
    });
  }

  it('the near-misses differ from a POSITIVE control in exactly the criterion they drop', () => {
    // without this control the block above would pass against a predicate that
    // answered `false` for everything. An all-negative assertion set needs a
    // positive one beside it, or it is satisfied by a constant.
    const { Frozen } = frozenType('class');

    expect(doesCarryStableTypeIdentity(Frozen)).toBe(true);
  });
});

describe('type-identity spec — D: the boundaries (carry/B2, B4, B5, B6)', () => {
  it('carry/B2 — the read is inert: a throwing tag getter is never invoked', () => {
    const { constructor: Inert, state } = inertReadProbeType();

    expect(doesCarryStableTypeIdentity(Inert)).toBe(true);
    expect(state.invocations, 'descriptors are inspected, values never coerced').toBe(0);

    // the getter really does throw, so the zero above is a property of the
    // predicate rather than of a getter that would have been harmless anyway
    const getter = /** @type {() => unknown} */ (
      ownDescriptorOf(prototypeOf(Inert), Symbol.toStringTag)?.get
    );

    expect(() => getter.call(Inert)).toThrow(TypeError);
    expect(state.invocations).toBe(1);
  });

  it('carry/B4 — an instance may shadow the tag without changing the type’s verdict', () => {
    const { Frozen } = frozenType('class');
    const instance = instantiate(Frozen);

    defineProperty(instance, Symbol.toStringTag, {
      value: 'Shadowed',
      enumerable: false,
      configurable: true,
    });

    expect(tagOf(instance), 'the own tag wins the lookup').toBe('[object Shadowed]');
    expect(
      doesCarryStableTypeIdentity(instance),
      'the verdict is read off the prototype, where the identity lives',
    ).toBe(true);
  });

  it('carry/B5 — an unfrozen subclass answers the parent’s tag and no verdict', () => {
    const { Base, Derived } = freshClassHierarchy();

    expect(callDefine([Base, 'Base']).success).toBe(true);

    const instance = instantiate(Derived);

    expect(tagOf(instance)).toBe('[object Base]');
    expect(doesCarryStableTypeIdentity(instance)).toBe(false);
  });

  it('carry/R9 — a WITHHELD descriptor satisfies no criterion', () => {
    for (const unfrozen of /** @type {const} */ (['name', 'constructor'])) {
      const { honest, hidden } = descriptorWithholdingPair(unfrozen);

      // the honest half fails for a REAL reason — the loose criterion is loose.
      // Without this the vector could not tell "refused because the flags are
      // wrong" from "refused because something else went wrong on the way".
      const loose =
        unfrozen === 'name'
          ? ownDescriptorOf(honest, 'name')
          : ownDescriptorOf(prototypeOf(honest), 'constructor');

      expect(loose, `${unfrozen} — the loose slot`).toMatchObject({ configurable: true });
      expect(doesCarryStableTypeIdentity(honest), `${unfrozen} — honest`).toBe(false);

      // and the trap really does withhold it. Configurability is what makes the
      // withdrawal legal at all, which is the same property that made the
      // criterion fail above — the two are inseparable, and that is the finding.
      const observed =
        unfrozen === 'name'
          ? ownDescriptorOf(hidden, 'name')
          : ownDescriptorOf(prototypeOf(hidden), 'constructor');

      expect(observed, `${unfrozen} — genuinely absent`).toBeNull();
      expect(doesCarryStableTypeIdentity(hidden), `${unfrozen} — the verdict`).toBe(
        false,
      );
    }
  });

  it('carry/R10 — an ACCESSOR under the prototype’s `constructor` key is refused', () => {
    const Accessor = accessorConstructorSlotType();
    const descriptor = ownDescriptorOf(prototypeOf(Accessor), 'constructor');

    expect(typeof descriptor?.get, 'the slot really is an accessor').toBe('function');
    expect(descriptor?.writable, 'an accessor carries no `[[Writable]]`').toBeUndefined();
    expect(
      descriptor?.configurable,
      'and the other two flags are as the criterion wants',
    ).toBe(false);
    expect(descriptor?.enumerable).toBe(false);

    expect(doesCarryStableTypeIdentity(Accessor)).toBe(false);
  });

  it('carry/B7 — the criteria never consult `Object.prototype`', () => {
    const { hidden } = descriptorWithholdingPair('name');
    const { Frozen } = frozenType('class');

    const observed = withPollutedObjectPrototype(() => ({
      // the control FIRST: this is what a `{}` literal would have handed the
      // strict comparison, and it is the whole reason the fallback is blank
      literalInheritsTheFlag: /** @type {Record<string, unknown>} */ ({}).writable,
      withheldVerdict: doesCarryStableTypeIdentity(hidden),
      honestVerdict: doesCarryStableTypeIdentity(Frozen),
    }));

    expect(observed.literalInheritsTheFlag, 'the pollution took effect').toBe(false);
    expect(observed.withheldVerdict, 'no verdict is bought with a polluted flag').toBe(
      false,
    );
    expect(observed.honestVerdict, 'and none is lost to one either').toBe(true);

    expect(
      /** @type {Record<string, unknown>} */ ({}).writable,
      'the realm was restored',
    ).toBeUndefined();
    expect(doesCarryStableTypeIdentity(Frozen), 'and the verdict survived it').toBe(true);
  });

  it('carry/B6 — after an ES3 prototype swap the type loses its verdict and its values do not', () => {
    const { Frozen } = frozenType('es3');
    const before = instantiate(Frozen);

    expect(doesCarryStableTypeIdentity(Frozen)).toBe(true);
    expect(doesCarryStableTypeIdentity(before)).toBe(true);

    withOwnPrototype(Frozen, {});

    expect(doesCarryStableTypeIdentity(Frozen)).toBe(false);
    expect(
      doesCarryStableTypeIdentity(before),
      'the value was built from the frozen prototype, which is untouched',
    ).toBe(true);
  });
});
