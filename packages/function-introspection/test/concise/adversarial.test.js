// @ts-check

/**
 * @module test/concise/adversarial
 *
 * Axis 3 — spoof-resistance and the two collisions with a function expression.
 *
 * The corpus carries the accidental confusions. This suite covers what a table
 * of source spellings cannot: values TAMPERED with after construction, and the
 * two shapes where a method and a function expression stringify identically.
 *
 * The pair blocks pin the MECHANISM, not just the verdict. For the decidable
 * pair it is not enough that one member is admitted — the test shows both share
 * a source and that `hasOwnPrototype` is what separates them, because a verdict
 * alone cannot reveal which signal produced it. For the undecidable pair it
 * shows the two agree on every observable the module reads, which is what makes
 * refusing them honest rather than lazy.
 *
 * Every fixture is materialized from source TEXT rather than written as a
 * literal, for the same reason the corpus is: the spelling is the thing under
 * test and prettier rewrites literals.
 *
 * Mirrors `docs/spec/CONCISE.spec.md` (FROZEN 2026-08-11).
 */

import { describe, it, expect } from 'vitest';

import {
  isPlainConciseMethod,
  isConciseAsyncMethod,
  isConciseGeneratorMethod,
  isAnyConciseMethod,
} from '#index';
import {
  getFunctionSource,
  hasOwnPrototype,
  isAsyncFunction,
} from '@species-js/type-detection';

import { UNDECIDABLE_PAIRS, DECIDABLE_PAIRS, materialize } from './__config.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */

/**
 * Materializes a candidate already narrowed to `Callable`.
 *
 * @param {string} source - the expression to evaluate
 * @returns {Callable} the resulting callable
 */
const callable = (source) => /** @type {Callable} */ (materialize(source));

/**
 * Materializes a candidate the tampering steps redefine properties on and read
 * back through — so it has to be callable AND indexable.
 *
 * @param {string} source - the expression to evaluate
 * @returns {Callable & { name: unknown, toString: () => string }} the value
 */
const tamperable = (source) =>
  /** @type {Callable & { name: unknown, toString: () => string }} */ (
    materialize(source)
  );

/**
 * Materializes a candidate whose `name` is read back.
 *
 * @param {string} source - the expression to evaluate
 * @returns {Callable & { name: string }} the resulting callable
 */
const named = (source) =>
  /** @type {Callable & { name: string }} */ (materialize(source));

describe('concise — adversarial', () => {
  describe('forgeries that do not work', () => {
    it('renaming a function expression to look like a method changes nothing', () => {
      const expression = tamperable('(function () {})');
      Object.defineProperty(expression, 'name', { value: 'foo', configurable: true });

      expect(expression.name).toBe('foo');
      expect(isPlainConciseMethod(expression)).toBe(false);
      expect(isAnyConciseMethod(expression)).toBe(false);
    });

    it('an own `toString` returning method source changes nothing — the read is realm-fixed', () => {
      const expression = tamperable('(function () {})');
      Object.defineProperty(expression, 'toString', {
        value: () => 'foo() {}',
        configurable: true,
      });

      expect(expression.toString()).toBe('foo() {}');
      expect(getFunctionSource(expression)).not.toBe('foo() {}');
      expect(isAnyConciseMethod(expression)).toBe(false);
    });

    it('a forged `Symbol.toStringTag` does not buy a modified flavor', () => {
      const method = tamperable('({ foo() {} }).foo');
      Object.defineProperty(method, Symbol.toStringTag, {
        value: 'GeneratorFunction',
        configurable: true,
      });

      expect(Object.prototype.toString.call(method)).toBe('[object GeneratorFunction]');
      expect(isConciseGeneratorMethod(method)).toBe(false);
      expect(isPlainConciseMethod(method)).toBe(true);
    });

    it('a Proxy dressed as a method is refused — its source is the native form', () => {
      const proxy = new Proxy(callable('({ foo() {} }).foo'), {
        get(target, key, receiver) {
          if (key === 'toString') {
            return () => 'foo() {}';
          }
          return /** @type {unknown} */ (Reflect.get(target, key, receiver));
        },
      });

      expect(proxy.toString()).toBe('foo() {}');
      expect(isAnyConciseMethod(proxy)).toBe(false);
    });

    it('a bound method is refused — recall, not precision', () => {
      const bound = callable('({ foo() {} }).foo.bind(null)');

      expect(typeof bound).toBe('function');
      expect(isAnyConciseMethod(bound)).toBe(false);
    });
  });

  describe('tampering with `prototype` — the one place recall is lost', () => {
    it('a method given an own `prototype` is STILL admitted for an ordinary key', () => {
      const method = tamperable('({ foo() {} }).foo');
      Object.defineProperty(method, 'prototype', { value: {}, configurable: true });

      expect(hasOwnPrototype(method)).toBe(true);
      expect(isPlainConciseMethod(method)).toBe(true);
    });

    it('but a method NAMED `function` given one is refused — the gate is scoped there', () => {
      const method = tamperable('({ function() {} }).function');
      Object.defineProperty(method, 'prototype', { value: {}, configurable: true });

      expect(hasOwnPrototype(method)).toBe(true);
      expect(isPlainConciseMethod(method)).toBe(false);
    });
  });

  describe('the DECIDABLE pair — `function(){}`', () => {
    for (const [name, pair] of Object.entries(DECIDABLE_PAIRS)) {
      describe(name, () => {
        it('both members stringify to the same source', () => {
          const conciseSource = getFunctionSource(callable(pair.concise));
          const otherSource = getFunctionSource(callable(pair.other));

          expect(conciseSource).toBe(pair.sharedSource);
          expect(otherSource).toBe(pair.sharedSource);
        });

        it('`hasOwnPrototype` is what separates them', () => {
          expect(hasOwnPrototype(materialize(pair.concise))).toBe(false);
          expect(hasOwnPrototype(materialize(pair.other))).toBe(true);
        });

        it('so the method is admitted and the function expression is not', () => {
          expect(isAnyConciseMethod(materialize(pair.concise))).toBe(true);
          expect(isAnyConciseMethod(materialize(pair.other))).toBe(false);
        });
      });
    }
  });

  describe('the UNDECIDABLE pair — `async function(){}`', () => {
    for (const [name, pair] of Object.entries(UNDECIDABLE_PAIRS)) {
      describe(name, () => {
        it('both members stringify to the same source', () => {
          expect(getFunctionSource(callable(pair.concise))).toBe(pair.sharedSource);
          expect(getFunctionSource(callable(pair.other))).toBe(pair.sharedSource);
        });

        it('and agree on every observable the module READS', () => {
          const conciseValue = materialize(pair.concise);
          const otherValue = materialize(pair.other);

          expect(isAsyncFunction(conciseValue)).toBe(isAsyncFunction(otherValue));
          expect(hasOwnPrototype(conciseValue)).toBe(hasOwnPrototype(otherValue));
        });

        it('`name` does not rescue the distinction either, once NamedEvaluation applies', () => {
          // The corpus vector is a BARE expression, which takes no name at all
          // in an eval position. The shape that makes the pair undecidable in
          // real code is the assigned one: an anonymous async function
          // expression assigned to a property named `function` is given that
          // name by NamedEvaluation, exactly matching the method's.
          const method = named('({ async function(){} }).function');
          const assigned = named('({ function: async function(){} }).function');

          expect(method.name).toBe('function');
          expect(assigned.name).toBe('function');
          expect(getFunctionSource(method)).toBe(getFunctionSource(assigned));

          // and the assigned twin is refused too, for the same reason
          expect(isAnyConciseMethod(assigned)).toBe(false);
        });

        it('so BOTH are refused — the same verdict, which is the honest answer', () => {
          const onConcise = isAnyConciseMethod(materialize(pair.concise));
          const onOther = isAnyConciseMethod(materialize(pair.other));

          expect(onConcise).toBe(onOther);
          expect(onConcise).toBe(false);
        });
      });
    }
  });

  describe('a method named `async` — the one input that pays a rejecting tag read', () => {
    it('is a plain method, not an async one', () => {
      const method = callable('({ async(){} }).async');

      expect(isPlainConciseMethod(method)).toBe(true);
      expect(isConciseAsyncMethod(method)).toBe(false);
      expect(isAnyConciseMethod(method)).toBe(true);
    });

    it('while a method named `async` that IS async is the async flavor', () => {
      const method = callable('({ async async(){} }).async');

      expect(isConciseAsyncMethod(method)).toBe(true);
      expect(isPlainConciseMethod(method)).toBe(false);
    });

    it('and a parenthesized async arrow wearing the same head is refused', () => {
      const arrow = callable('async(x) => x');

      expect(getFunctionSource(arrow)?.startsWith('async(')).toBe(true);
      expect(isAnyConciseMethod(arrow)).toBe(false);
    });
  });

  describe('the head decides, never the body', () => {
    it('a method whose body holds another method is still a method', () => {
      const method = callable('({ m() { return ({ inner(){} }).inner; } }).m');

      expect(isPlainConciseMethod(method)).toBe(true);
    });

    it('a function whose body holds a method is not one', () => {
      const expression = callable('(function f() { return ({ inner(){} }).inner; })');

      expect(isAnyConciseMethod(expression)).toBe(false);
    });

    it('an arrow whose body holds a method is not one either', () => {
      const arrow = callable('() => ({ inner(){} }).inner');

      expect(isAnyConciseMethod(arrow)).toBe(false);
    });
  });
});
