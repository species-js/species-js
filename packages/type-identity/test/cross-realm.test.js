// @ts-check

/**
 * @module test/cross-realm
 *
 * Axis 2 — the foreign-realm claims. The `realm/*` band of
 * `docs/spec/TYPE-IDENTITY.spec.md` (FROZEN 2026-09-09), plus the three
 * vectors from other bands whose candidate comes from another realm:
 * `define/A12`, `carry/A5` and `shape/A2`.
 *
 * A `node:vm` context is a separate realm, so `instanceof` against a local
 * constructor answers `false` for a value produced inside it. That is the
 * condition the package exists for, and the reason its reads are descriptor
 * reads: structure travels, references do not.
 *
 * ## Two vectors are here for a different reason
 *
 * `realm/B1` is not about a foreign value at all — it is the mechanism behind
 * every other vector in this file, and the spec says it is checkable by grep as
 * well as by vector. So it is checked that way: the word `instanceof` must
 * appear in this package's source only inside prose.
 *
 * `brand/B1` is here because its effect is PERMANENT. Branding a built-in
 * renames it for the rest of the process, so the vector runs against a private
 * realm's `Math.max` and then asserts that this realm's is untouched — which
 * turns the isolation from a precaution into a claim.
 */

import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';

import { doesCarryStableTypeIdentity, isSupportedConstructor } from '#index';
import { isNewableFunction } from '@species-js/type-detection';

import { callBrand, callDefine, conditionOfMessage } from './__config.js';
import {
  foreignBuiltin,
  foreignClass,
  foreignES3,
  foreignRealmWithBuiltinCallable,
  foreignRealmWithHeldClass,
  instantiate,
  ownDescriptorOf,
  tagOf,
} from './__fixtures.js';

/** @typedef {import('@species-js/type-detection').NewableFunction} NewableFunction */

/**
 * A source file with its comments removed, so a word can be asked for in the
 * CODE rather than anywhere in the file.
 *
 * Block comments first, then line comments. Neither expression understands
 * strings, which is sound for this package — no string literal in `src/`
 * contains a comment opener — and the positive control beside every use is what
 * would catch it if that ever stopped being true.
 *
 * @param {string} relativePath - a path relative to `src/`
 * @returns {{ raw: string, code: string }} the file, whole and stripped
 */
function readStripped(relativePath) {
  const raw = readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

  return { raw, code: raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '') };
}

describe('type-identity spec — F: cross-realm (realm/*)', () => {
  it('realm/A1 — a foreign class freezes from here, and reads back from inside its realm', () => {
    const { evaluate, Foreign } = foreignRealmWithHeldClass();

    expect(callDefine([Foreign, 'Held'])).toEqual({ success: true });

    expect(doesCarryStableTypeIdentity(Foreign)).toBe(true);
    expect(doesCarryStableTypeIdentity(instantiate(Foreign))).toBe(true);
    expect(tagOf(instantiate(Foreign)), 'read from HERE').toBe('[object Held]');

    expect(
      evaluate('Object.prototype.toString.call(new globalThis.Held())'),
      'read from INSIDE that realm',
    ).toBe('[object Held]');
    expect(evaluate('globalThis.Held.name')).toBe('Held');
  });

  it('realm/A2 — a foreign ES3 constructor function is admitted and freezes', () => {
    const Foreign = foreignES3();

    expect(callDefine([Foreign, 'ForeignES3'])).toEqual({ success: true });
    expect(Foreign.name).toBe('ForeignES3');
    expect(doesCarryStableTypeIdentity(Foreign)).toBe(true);
    expect(tagOf(instantiate(Foreign))).toBe('[object ForeignES3]');
  });

  it('realm/R1 — a foreign built-in is refused at condition 2, exactly as a local one is', () => {
    const result = callDefine([foreignBuiltin(), 'Foo']);

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error('realm/R1 — the call succeeded');
    }
    expect(conditionOfMessage('defineStableTypeIdentity', result.reason.message)).toBe(2);
  });

  it('define/A12 — a foreign class freezes exactly as a local one does', () => {
    const Foreign = foreignClass();

    expect(callDefine([Foreign, 'ForeignClass', 'ForeignTag'])).toEqual({
      success: true,
      warning:
        '2 different identifiers have been assigned, "ForeignClass" as constructor name and "ForeignTag" as tagged type.',
    });
    expect(ownDescriptorOf(Foreign, 'name')).toEqual({
      value: 'ForeignClass',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  });

  it('carry/A5 — a frozen foreign constructor and its instances answer `true`', () => {
    const Foreign = foreignES3();

    expect(callDefine([Foreign, 'ForeignCarrier']).success).toBe(true);
    expect(doesCarryStableTypeIdentity(Foreign)).toBe(true);
    expect(doesCarryStableTypeIdentity(instantiate(Foreign))).toBe(true);

    // and the negative control from the same realm, so the `true` above is not
    // simply what this predicate answers for anything foreign
    expect(doesCarryStableTypeIdentity(foreignES3())).toBe(false);
  });

  it('shape/A2 — the shape gate reads structure, so it has no realm dependence to lose', () => {
    const foreign = foreignES3();

    expect(isNewableFunction(foreign)).toBe(true);
    expect(isSupportedConstructor(/** @type {NewableFunction} */ (foreign))).toBe(true);
    expect(
      isSupportedConstructor(/** @type {NewableFunction} */ (foreignBuiltin())),
      'a foreign built-in is refused for the same reason a local one is',
    ).toBe(false);
  });

  it('realm/B1 — nothing in the implementation uses `instanceof`', () => {
    const sources = ['index.js', 'index.d.ts', 'config/index.js', 'config/index.d.ts'];
    /** @type {string[]} */
    const mentions = [];

    for (const relativePath of sources) {
      const { raw, code } = readStripped(relativePath);

      expect(raw.length, `${relativePath} was read as empty`).toBeGreaterThan(0);
      expect(code, `${relativePath} carries \`instanceof\` in CODE`).not.toMatch(
        /\binstanceof\b/,
      );

      if (/\binstanceof\b/.test(raw)) {
        mentions.push(relativePath);
      }
    }

    // the positive control: the word IS in the corpus, in prose. Without this
    // the block would pass just as happily against a stripper that returned
    // the empty string for every file.
    expect(
      mentions,
      'the word appears in prose, which is what makes the check real',
    ).toEqual(['index.js', 'index.d.ts']);
  });
});

describe('type-identity spec — C: branding a built-in (brand/B1)', () => {
  it('a built-in is admitted, the change is permanent, and it stays inside its realm', () => {
    const { evaluate, maximum } = foreignRealmWithBuiltinCallable();

    expect(evaluate('Math.max.name'), 'before').toBe('max');

    expect(callBrand([maximum, 'maximum'])).toEqual({ success: true });

    expect(evaluate('Math.max.name'), 'after — and for good').toBe('maximum');
    expect(ownDescriptorOf(maximum, 'name')).toEqual({
      value: 'maximum',
      writable: false,
      enumerable: false,
      configurable: false,
    });

    // the one-way door, on a value nobody can make a fresh copy of
    const again = callBrand([maximum, 'other']);

    expect(again.success).toBe(false);
    expect(evaluate('Math.max.name')).toBe('maximum');

    // and the isolation, asserted rather than assumed: this realm's built-in is
    // what every other fixture in the suite reads, and it was never touched
    expect(Math.max.name, "this realm's `Math.max`").toBe('max');
    expect(parseInt.name).toBe('parseInt');
  });

  it('branding a built-in installs no identity, exactly as it installs none anywhere', () => {
    const { maximum } = foreignRealmWithBuiltinCallable();

    expect(callBrand([maximum, 'maximum']).success).toBe(true);
    expect(doesCarryStableTypeIdentity(maximum)).toBe(false);
  });

  it('the freezing entry still refuses a built-in — the shape it requires, not a policy', () => {
    const { maximum } = foreignRealmWithBuiltinCallable();
    const result = callDefine([maximum, 'maximum']);

    expect(result.success).toBe(false);
  });
});
