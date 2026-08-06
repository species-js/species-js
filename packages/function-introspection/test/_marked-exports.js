// @ts-check

/**
 * @module test/_marked-exports
 *
 * Shared parser for the `@@throw-safe` markers carried by the package's source
 * files — the first leg of every module's axis-5 completeness oracle.
 *
 * Each module declares its marked set as a canonical list in its own
 * `__config.js`; this parser reads the set the SOURCE actually carries, so the
 * two can be compared. A marker added or removed without updating the list
 * turns the module's throw-safety suite red, which is the only thing that makes
 * `@@throw-safe` more than a comment.
 *
 * Both dialects are parsed by the same expression: `.js` and `.d.ts` write the
 * marker identically, above the doc block, and both spell the declaration
 * `export function`. The `declare` and `const` alternatives are accepted so a
 * const-bound or ambient-declared marked export cannot slip past unseen — a
 * parser that silently matches nothing is the failure mode this file exists to
 * prevent, so an unnamed match throws rather than being dropped.
 */

import { readFileSync } from 'node:fs';

/**
 * A `@@throw-safe` marker, the doc block it sits above, and the export
 * declaration that follows. The span is lazy so it stops at the FIRST
 * declaration after the marker rather than swallowing the next one too.
 */
const MARKED_EXPORT = /@@throw-safe[\s\S]*?export (?:declare )?(?:function|const) (\w+)/g;

/**
 * Parses the `@@throw-safe`-marked export names out of a package source file.
 *
 * @param {string} relativePath - a path relative to the package's `src/`, e.g.
 *  `bound.js` or `utility/index.d.ts`
 * @returns {string[]} the marked export names, sorted
 * @throws {Error} when a marker matches without yielding an export name — the
 *  declaration form drifted past what this parser recognizes, and reporting a
 *  short list would read as "nothing is marked"
 */
export function parseMarkedExports(relativePath) {
  const source = readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

  /** @type {string[]} */
  const names = [];

  for (const match of source.matchAll(MARKED_EXPORT)) {
    const name = match[1];

    if (name === undefined) {
      throw new Error(`a @@throw-safe marker in ${relativePath} yielded no export name`);
    }
    names.push(name);
  }

  return names.sort();
}
