// @ts-check

/**
 * @module test/thenable/cross-realm
 *
 * Axis 2 — cross-realm. The spec's per-predicate cross-realm expectation,
 * confirmed against genuine foreign-realm values (Node `vm` context). A
 * foreign `Promise` fails the local `instanceof` arm, so these vectors
 * exercise the structural (realm-independent) fallback end-to-end.
 *
 * Mirrors the "Cross-realm expectation (axis 2)" notes in
 * `docs/spec/THENABLE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import { isThenable, isPromiseLike, isPromise } from '@/index.js';

import { foreignPromise, foreignPromiseSubclassInstance } from './__config.js';

describe('thenable — cross-realm (foreign-realm Promise)', () => {
  it('isThenable/A5: foreign Promise → true (structural `then` arm)', () => {
    expect(isThenable(foreignPromise())).toBe(true);
  });

  it('isPromiseLike/A4: foreign Promise → true (structural contract arm)', () => {
    expect(isPromiseLike(foreignPromise())).toBe(true);
  });

  it('isPromise/A3: foreign direct Promise → true (tag + ctor-name + contract)', () => {
    expect(isPromise(foreignPromise())).toBe(true);
  });

  it('isPromise/R2: foreign Promise subclass → false (ctor-name resolves to "MyPromise")', () => {
    expect(isPromise(foreignPromiseSubclassInstance())).toBe(false);
  });

  it('isThenable/isPromiseLike admit the foreign subclass (subclass-admitting arms)', () => {
    // The subclass instance still inherits a callable `then` and the full
    // contract from the foreign Promise.prototype — only isPromise is strict.
    expect(isThenable(foreignPromiseSubclassInstance())).toBe(true);
    expect(isPromiseLike(foreignPromiseSubclassInstance())).toBe(true);
  });
});
