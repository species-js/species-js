// @ts-check

/**
 * @module test/arrow/adversarial
 *
 * Axis 3 — spoof-resistance. What a caller can change about a value, and why
 * none of it moves a verdict.
 *
 * The corpus already carries the accidental confusions (bodies that contain an
 * arrow, the two-comment backtracking shapes, bound and Proxy-wrapped values).
 * This suite covers what a corpus of source spellings cannot: values TAMPERED
 * with after construction, and the one genuine ambiguity in the grammar.
 *
 * Two groups:
 *
 * 1. **Forgeries that do not work** — every writable channel a caller has. Each
 *    asserts the tampering actually took effect BEFORE asserting the verdict is
 *    unmoved, because a forgery that silently failed to apply would make this
 *    suite pass while proving nothing.
 * 2. **The `async(` collision** — the one shape source alone cannot decide. The
 *    tests pin the DECISION PATH, not just the verdict: the two members are
 *    shown to share a source head and to differ only in the spec-defined tag. A
 *    verdict alone cannot show which signal produced it.
 *
 * Every fixture is materialized from source TEXT rather than written as a
 * literal, for the same reason the corpus is: the spelling is the thing under
 * test, and prettier rewrites `async(x)=>x` into `async (x) => x` — a different
 * head than the one this suite compares.
 *
 * Mirrors `docs/spec/ARROW.spec.md` (FROZEN 2026-08-11).
 */

import { describe, it, expect } from 'vitest';

import { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction } from '#index';
import { getFunctionSource, isAsyncFunction } from '@species-js/type-detection';

import { materialize } from './__config.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */

/**
 * Materializes a candidate already narrowed to `Callable`, so the type-detection
 * readers can be called on it directly.
 *
 * @param {string} source - the expression to evaluate
 * @returns {Callable} the resulting callable
 */
const callable = (source) => /** @type {Callable} */ (materialize(source));

/**
 * Materializes a candidate that the tampering steps both redefine properties on
 * and read back through — so it has to be callable AND indexable.
 *
 * @param {string} source - the expression to evaluate
 * @returns {Callable & { name: unknown, toString: () => string }} the value
 */
const tamperable = (source) =>
  /** @type {Callable & { name: unknown, toString: () => string }} */ (
    materialize(source)
  );

describe('arrow — adversarial', () => {
  describe('forgeries that do not work', () => {
    it('renaming a method to look like an arrow changes nothing — `name` is never read', () => {
      const method = tamperable('({ m(){} }).m');
      Object.defineProperty(method, 'name', { value: '(a) => a', configurable: true });

      expect(method.name).toBe('(a) => a');
      expect(isArrowFunction(method)).toBe(false);
      expect(isAnyArrowFunction(method)).toBe(false);
    });

    it('an own `toString` returning arrow source changes nothing — the read is realm-fixed', () => {
      const method = tamperable('({ m(){} }).m');
      Object.defineProperty(method, 'toString', {
        value: () => '(a) => a',
        configurable: true,
      });

      expect(method.toString()).toBe('(a) => a');
      expect(getFunctionSource(method)).not.toBe('(a) => a');
      expect(isArrowFunction(method)).toBe(false);
      expect(isAnyArrowFunction(method)).toBe(false);
    });

    it('deleting `toString` from a real arrow changes nothing either', () => {
      const arrow = tamperable('(a) => a');
      Object.defineProperty(arrow, 'toString', { value: undefined, configurable: true });

      expect(arrow.toString).toBeUndefined();
      expect(isArrowFunction(arrow)).toBe(true);
      expect(isAnyArrowFunction(arrow)).toBe(true);
    });

    it('a forged `Symbol.toStringTag` does not buy the async flavor', () => {
      const arrow = tamperable('(a) => a');
      Object.defineProperty(arrow, Symbol.toStringTag, {
        value: 'AsyncFunction',
        configurable: true,
      });

      expect(Object.prototype.toString.call(arrow)).toBe('[object AsyncFunction]');
      expect(isAsyncArrowFunction(arrow)).toBe(false);
      expect(isArrowFunction(arrow)).toBe(true);
    });

    it('granting a method an own `prototype` does not make it an arrow', () => {
      const method = tamperable('({ m(){} }).m');
      Object.defineProperty(method, 'prototype', { value: {}, configurable: true });

      expect(Object.prototype.hasOwnProperty.call(method, 'prototype')).toBe(true);
      expect(isAnyArrowFunction(method)).toBe(false);
    });

    it('a Proxy whose traps dress it as an arrow is still refused', () => {
      const proxy = new Proxy(callable('({ m(){} }).m'), {
        get(target, key, receiver) {
          if (key === 'name') {
            return '(a) => a';
          }
          if (key === 'toString') {
            return () => '(a) => a';
          }
          return /** @type {unknown} */ (Reflect.get(target, key, receiver));
        },
      });

      expect(proxy.toString()).toBe('(a) => a');
      expect(isAnyArrowFunction(proxy)).toBe(false);
    });

    it('an arrow hidden behind a Proxy is refused too — recall, not precision', () => {
      const proxy = new Proxy(callable('(a) => a'), {});

      expect(typeof proxy).toBe('function');
      expect(isAnyArrowFunction(proxy)).toBe(false);
    });
  });

  describe('the `async(` collision — decided by the tag, not the source', () => {
    const asyncArrow = callable('async(x)=>x');
    const methodNamedAsync = callable('({ async(){} }).async');

    it('both members open with the same source head', () => {
      const arrowHead = (getFunctionSource(asyncArrow) ?? '').slice(0, 6);
      const methodHead = (getFunctionSource(methodNamedAsync) ?? '').slice(0, 6);

      expect(arrowHead).toBe('async(');
      expect(methodHead).toBe('async(');
      expect(arrowHead).toBe(methodHead);
    });

    it('they differ only in the spec-defined tag', () => {
      expect(isAsyncFunction(asyncArrow)).toBe(true);
      expect(isAsyncFunction(methodNamedAsync)).toBe(false);
    });

    it('and the predicates split them accordingly', () => {
      expect(isAsyncArrowFunction(asyncArrow)).toBe(true);
      expect(isAsyncArrowFunction(methodNamedAsync)).toBe(false);

      expect(isAnyArrowFunction(asyncArrow)).toBe(true);
      expect(isAnyArrowFunction(methodNamedAsync)).toBe(false);
    });

    it('a parameter named `async` is the sync flavor, not the modifier', () => {
      const paramNamedAsync = callable('async => async');

      expect(isArrowFunction(paramNamedAsync)).toBe(true);
      expect(isAsyncArrowFunction(paramNamedAsync)).toBe(false);
      expect(isAsyncFunction(paramNamedAsync)).toBe(false);
    });
  });

  describe('the head decides, never the body', () => {
    it('a method returning an arrow is a method', () => {
      const method = callable('({ m() { return (x) => x; } }).m');

      expect(isAnyArrowFunction(method)).toBe(false);
      expect(isAnyArrowFunction(method())).toBe(true);
    });

    it('an arrow returning a method is an arrow', () => {
      const arrow = callable('() => ({ m(){} }).m');

      expect(isArrowFunction(arrow)).toBe(true);
      expect(isAnyArrowFunction(arrow())).toBe(false);
    });
  });
});
