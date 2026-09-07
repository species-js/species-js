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
 * marker identically, on a line of its own above the doc block, and both spell
 * the declaration `export function`. The `declare` and `const` alternatives are
 * accepted so a const-bound or ambient-declared marked export cannot slip past
 * unseen — a parser that silently matches nothing is the failure mode this file
 * exists to prevent, so an unnamed match throws rather than being dropped, and
 * so does a marker line the expression failed to bind.
 *
 * The marker is recognized by its LINE, not by the token: a doc block naming
 * the marker in prose is documentation, not a declaration, and an unanchored
 * token silently enlarges the parsed set. This file may therefore discuss the
 * marker freely — it only ever reads files under `src/`, never itself.
 */

import { readFileSync } from 'node:fs';

/**
 * The marker in its canonical line-form — the whole line, nothing else on it.
 *
 * Anchored rather than matching the bare token anywhere, because a doc block
 * that MENTIONS the marker is not a marker. An unanchored token bound to the
 * next export and silently enlarged the parsed set, which the oracle then
 * reported as source drift; the same mention placed above an already-marked
 * export would not have been visible at all.
 */
const MARKER_LINE = /^\/\* @@throw-safe \*\/$/gm;

/**
 * A marker line, the doc block it sits above, and the export declaration that
 * follows. The span is lazy so it stops at the FIRST declaration after the
 * marker rather than swallowing the next one too.
 */
const MARKED_EXPORT =
  /^\/\* @@throw-safe \*\/$[\s\S]*?export (?:declare )?(?:function|const) (\w+)/gm;

/**
 * Parses the `@@throw-safe`-marked export names out of a package source file.
 *
 * @param {string} relativePath - a path relative to the package's `src/`, e.g.
 *  `bound.js` or `utility/index.d.ts`
 * @returns {string[]} the marked export names, sorted
 * @throws {Error} when a marker matches without yielding an export name, or
 *  when the file carries more marker lines than names were parsed out of it —
 *  either way the declaration form drifted past what this parser recognizes,
 *  and reporting a short list would read as "nothing is marked"
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

  // Anchoring narrowed what counts as a marker, which is exactly how a parser
  // starts matching too little. Every marker line must have produced a name, so
  // a marker this expression no longer reaches is a throw rather than a shorter
  // list — the same reason the unnamed-match branch above exists.
  const markerLines = source.match(MARKER_LINE)?.length ?? 0;

  if (markerLines !== names.length) {
    throw new Error(
      `${relativePath} carries ${String(markerLines)} @@throw-safe marker line(s) ` +
        `but ${String(names.length)} were bound to an export declaration`,
    );
  }

  return names.sort();
}
