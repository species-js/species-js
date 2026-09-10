// @ts-check

/**
 * @module test/vector-coverage
 *
 * The oracle over the SUITE rather than over the package: every vector the
 * frozen spec declares is cited somewhere here, nothing is cited that the spec
 * does not declare, and every live home of the vector count agrees with what
 * the spec's own IDs add up to.
 *
 * ## Why this exists in a finished package
 *
 * The suite was written against a frozen spec, so today the two agree. The
 * question this file answers is what happens on the day they stop — a vector
 * added by an amendment (#054 permits exactly that, in place, with a dated
 * banner) lands in a document nothing reads, and every existing test keeps
 * passing. A count checked once, by hand, at the moment of writing, is a claim
 * about a past state of two files.
 *
 * The count half is the second instance of a pattern `type-identity` introduced
 * on 2026-09-10, and the reason it was generalized here rather than left there:
 * this package's README states `all 54 of its vectors` and nothing was holding
 * that number to the spec. `CLAUDE.md` → Documentation hardening carries the
 * rule — a count quoted in more than one file gets an oracle, not a reminder,
 * because the reminder's needle has to be recalled and that is the half that
 * slips.
 *
 * ## Citation is not assertion, and the difference is where it matters
 *
 * A vector ID appearing in `test/` proves only that somebody wrote it down.
 * What makes the citation load-bearing is where it sits: in the `it` title of
 * the block that asserts it, which is the convention this suite already
 * follows, or beside the compile-time construct in `type-contract.js`, whose
 * gate is `tsc` rather than vitest. So this file closes the gap between spec
 * and suite; it does not close the gap between a citation and a good assertion.
 */

import { describe, it, expect } from 'vitest';

import { readFileSync, readdirSync } from 'node:fs';

/** Every vector ID form this spec uses: a band prefix, a class letter, a number. */
const VECTOR_ID = /\b(cap|ccn|fail|mem|ns|prim|type)\/([ABRTX]\d+)\b/g;

/**
 * Every file that states the vector count as a LIVE claim, and must therefore
 * agree with what the spec's own IDs add up to.
 *
 * A dated historical record is deliberately NOT here: an ADR annotation states
 * what was true when it was written and must stay frozen when the count moves.
 * The test for inclusion is whether a reader would act on the number TODAY.
 */
const COUNT_HOMES = ['docs/spec/CUSTOM-NAMESPACE.spec.md', 'README.md'];

/** A number stating a vector count: an integer with `vectors` close behind it. */
const STATED_COUNT = /(\d+)(?=[^.]{0,24}\bvectors\b)/g;

const specSource = readFileSync(
  new URL('../docs/spec/CUSTOM-NAMESPACE.spec.md', import.meta.url),
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

describe('custom-namespace — the suite against the frozen spec', () => {
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

  it('every LIVE home of the vector count agrees with the derived total', () => {
    const derived = idsIn(specSource).length;

    for (const home of COUNT_HOMES) {
      const source = readFileSync(new URL(`../${home}`, import.meta.url), 'utf8');
      const stated = [...source.matchAll(STATED_COUNT)].map(([n]) => Number(n));

      // the vacuity guard, and the whole reason this test exists: a home that
      // REWORDS its way out of stating the count would otherwise drop silently
      // out of the check and pass forever. Saying nothing is not agreement.
      expect(stated.length, `${home} states no vector count at all`).toBeGreaterThan(0);

      for (const count of stated) {
        expect(count, `${home} states a count the spec's IDs do not support`).toBe(
          derived,
        );
      }
    }
  });
});
