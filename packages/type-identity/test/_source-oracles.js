// @ts-check

/**
 * @module test/_source-oracles
 *
 * The two oracles that read the package's own SOURCE rather than running it.
 *
 * Both answer a question no verdict can. A suite that scores behavior proves
 * the answers it asks for are right; neither of these asks about an answer.
 * They ask whether anything is going unasked — a new `@@throw-safe` export
 * arriving with no vectors behind it, or a thirteenth rejection condition
 * arriving with no vector and no twin.
 *
 * One file for two parsers rather than the sibling package's single-purpose
 * `_marked-exports.js`, because the second oracle exists only here: this is
 * the package whose contract IS an ordered list, and CLAUDE.md records the
 * exact drift it guards — `defineStableTypeIdentity`'s decider list sat at
 * eleven for a round after its contract went to twelve.
 *
 * Both read files under `src/` and never this one, so the marker and the list
 * form may be discussed freely here.
 */

import { readFileSync } from 'node:fs';

/**
 * The throw-safety marker in its canonical line-form — the whole line, nothing
 * else on it.
 *
 * Anchored rather than matching the bare token anywhere: a doc block that
 * MENTIONS the marker is not a marker, and an unanchored token silently
 * enlarges the parsed set.
 */
const MARKER_LINE = /^\/\* @@throw-safe \*\/$/gm;

/**
 * A marker line and the first declaration below it, with the `export` keyword
 * captured separately.
 *
 * The `.js` marks module-private helpers as well as exported ones — the
 * marker is a promise about a function, and a function does not stop making it
 * by staying local — so the two groups are told apart here rather than being
 * flattened into one list the `.d.ts` could never match.
 */
const MARKED_DECLARATION =
  /^\/\* @@throw-safe \*\/$[\s\S]*?^(export )?(?:declare )?(?:function|const) (\w+)/gm;

/** A numbered item opening a line inside a JSDoc block. */
const NUMBERED_ITEM = /^\s*\*\s+(\d+)\.\s/gm;

/**
 * Reads a package source file.
 *
 * @param {string} relativePath - a path relative to the package's `src/`
 * @returns {string} the file's contents
 */
function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

/**
 * Parses the `@@throw-safe`-marked declarations out of a package source file,
 * split by whether the declaration is exported.
 *
 * @param {string} relativePath - a path relative to the package's `src/`, e.g.
 *  `index.js` or `index.d.ts`
 * @returns {{ exported: string[], internal: string[] }} the marked names, each
 *  group sorted
 * @throws {Error} when a marker matches without yielding a declaration name, or
 *  when the file carries more marker lines than names were parsed out of it —
 *  either way the declaration form drifted past what this parser recognizes,
 *  and reporting a short list would read as "nothing is marked"
 */
export function parseMarkedDeclarations(relativePath) {
  const source = readSource(relativePath);

  /** @type {string[]} */
  const exported = [];
  /** @type {string[]} */
  const internal = [];

  for (const match of source.matchAll(MARKED_DECLARATION)) {
    const name = match[2];

    if (name === undefined) {
      throw new Error(`a @@throw-safe marker in ${relativePath} yielded no name`);
    }
    (match[1] === undefined ? internal : exported).push(name);
  }

  // A narrowed expression is exactly how a parser starts matching too little.
  // Every marker line must have bound to a declaration, so one this expression
  // no longer reaches is a throw rather than a shorter list.
  const markerLines = source.match(MARKER_LINE)?.length ?? 0;
  const bound = exported.length + internal.length;

  if (markerLines !== bound) {
    throw new Error(
      `${relativePath} carries ${String(markerLines)} @@throw-safe marker line(s) ` +
        `but ${String(bound)} were bound to a declaration`,
    );
  }

  return { exported: exported.sort(), internal: internal.sort() };
}

/**
 * Parses every numbered list in a source file into its runs, in file order.
 *
 * A run starts wherever the numbering returns to `1`, so the two rejection-order
 * lists come back as two runs without this parser needing to know which doc
 * block it is standing in. What a caller then asserts is their LENGTH and their
 * contiguity — the mechanically checkable half of the twin-list rule.
 *
 * Only the `.d.ts` is worth parsing this way. The `.js` twin is permitted to
 * group ranges (`1.–2.`, `3.–6.`) as long as they tile the same numbering, so
 * its items are not one-per-condition and a count there would mean nothing.
 *
 * @param {string} relativePath - a path relative to the package's `src/`
 * @returns {number[][]} each numbered run, in the order the file carries them
 * @throws {Error} when the file carries no numbered item at all — a parser that
 *  matched nothing must say so rather than report an empty corpus as agreement
 */
export function parseNumberedRuns(relativePath) {
  const source = readSource(relativePath);

  /** @type {number[][]} */
  const runs = [];

  for (const match of source.matchAll(NUMBERED_ITEM)) {
    const item = Number(match[1]);

    if (item === 1 || runs.length === 0) {
      runs.push([]);
    }
    runs[runs.length - 1]?.push(item);
  }

  if (runs.length === 0) {
    throw new Error(`${relativePath} carries no numbered list item at all`);
  }

  return runs;
}
