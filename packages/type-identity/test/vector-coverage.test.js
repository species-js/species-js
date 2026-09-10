// @ts-check

/**
 * @module test/vector-coverage
 *
 * The oracle over the SUITE rather than over the package: every vector the
 * frozen spec declares is cited somewhere here, nothing is cited that the spec
 * does not declare, and the spec's own headline count is the one its IDs
 * actually add up to.
 *
 * ## Why this is a test and not a one-off script
 *
 * The suite was written against a frozen spec, so today the two agree. The
 * question this file exists for is what happens on the day they stop: a vector
 * added by an amendment (#054 permits exactly that, in place, with a dated
 * banner) lands in a document nothing reads, and every existing test keeps
 * passing. A count checked once, by hand, at the moment of writing, is a claim
 * about a past state of two files.
 *
 * ## Citation is not assertion, and the difference is where it matters
 *
 * A vector ID appearing in this package's `test/` proves only that somebody
 * wrote it down. What makes the citation load-bearing is where it sits:
 *
 * - in the matrix-driven bands the ID travels IN THE ROW, and the `it` title is
 *   generated from the same row that runs the assertion — so an ID cannot be
 *   present while its assertion is not;
 * - in the hand-written blocks the ID is in the `it` title of the block that
 *   asserts it, which is the convention the workspace's suites already use;
 * - in `type-contract.js` the ID labels the compile-time construct directly
 *   below it, and the gate there is `tsc` rather than vitest.
 *
 * So this file closes the gap between the spec and the suite. It does not close
 * the gap between a citation and a good assertion — nothing mechanical does,
 * which is what the mutation probes in the round's commit message are for.
 */

import { describe, it, expect } from 'vitest';

import { readFileSync, readdirSync } from 'node:fs';

/** Every vector ID form the spec uses: a band prefix, a class letter, a number. */
const VECTOR_ID =
  /\b(ident|define|ord|brand|carry|shape|cause|realm|cap|type)\/([ABRT]\d+)\b/g;

/**
 * The spec's headline sentence, which states the total and the per-band
 * breakdown. Parsed rather than transcribed: a copy here would agree with
 * itself forever.
 */
const HEADLINE = /This spec holds \*\*(\d+) vectors\*\* — (.+?)\.\s/s;

const specSource = readFileSync(
  new URL('../docs/spec/TYPE-IDENTITY.spec.md', import.meta.url),
  'utf8',
);

/**
 * @param {string} source - text to scan
 * @returns {string[]} every vector ID it carries, de-duplicated and sorted
 */
const idsIn = (source) =>
  [
    ...new Set(
      [...source.matchAll(VECTOR_ID)].map(
        (match) => `${match[1] ?? ''}/${match[2] ?? ''}`,
      ),
    ),
  ].sort();

/** The IDs cited across every file in `test/`, mapped to the files citing them. */
const citations = (() => {
  const testDirectory = new URL('./', import.meta.url);
  /** @type {Map<string, string[]>} */
  const found = new Map();

  for (const name of readdirSync(testDirectory).sort()) {
    if (!name.endsWith('.js') || name === 'vector-coverage.test.js') {
      continue;
    }

    const source = readFileSync(new URL(name, testDirectory), 'utf8');

    for (const id of idsIn(source)) {
      found.set(id, [...(found.get(id) ?? []), name]);
    }
  }

  return found;
})();

describe('type-identity — the suite against the frozen spec', () => {
  it('the spec was read, and it carries vectors', () => {
    expect(specSource.length, 'the spec was read as empty').toBeGreaterThan(0);
    expect(idsIn(specSource).length).toBeGreaterThan(0);
  });

  it('more than one test file was scanned, so the citation set is not one file’s', () => {
    const files = new Set([...citations.values()].flat());

    expect(files.size).toBeGreaterThan(1);
  });

  it('every vector the spec declares is cited somewhere in the suite', () => {
    const uncited = idsIn(specSource).filter((id) => !citations.has(id));

    expect(uncited, 'declared in the spec, cited by nothing').toEqual([]);
  });

  it('nothing is cited that the spec does not declare', () => {
    const declared = new Set(idsIn(specSource));
    const invented = [...citations.keys()].filter((id) => !declared.has(id)).sort();

    expect(invented, 'cited by the suite, absent from the spec').toEqual([]);
  });

  it('the spec’s headline total is the number its own IDs add up to', () => {
    const headline = HEADLINE.exec(specSource);

    if (headline === null) {
      throw new Error('the spec states no headline vector count to check against');
    }
    expect(Number(headline[1])).toBe(idsIn(specSource).length);
  });

  it('the spec’s per-band breakdown is the one its IDs add up to', () => {
    const headline = HEADLINE.exec(specSource);

    if (headline?.[2] === undefined) {
      throw new Error('the spec states no per-band breakdown to check against');
    }

    /** @type {Record<string, number>} */
    const stated = {};

    for (const [, band, count] of headline[2].matchAll(/`(\w+)`\s+(\d+)/g)) {
      if (band !== undefined && count !== undefined) {
        stated[band] = Number(count);
      }
    }

    /** @type {Record<string, number>} */
    const derived = {};

    for (const id of idsIn(specSource)) {
      const band = id.split('/')[0] ?? '';

      derived[band] = (derived[band] ?? 0) + 1;
    }

    expect(
      Object.keys(stated).length,
      'no band was parsed out of the headline',
    ).toBeGreaterThan(0);
    expect(derived).toEqual(stated);
  });
});
