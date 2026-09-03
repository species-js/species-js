// @ts-check

/**
 * Documentation sweep — the terminating condition for a documentation-hardening
 * round.
 *
 * ## Why it exists
 *
 * Every rule in this repo about documentation is a rule about a SET: a claim
 * lives in several files, a `.js` block has a `.d.ts` twin, a typedef import has
 * call sites. The recurring failure is not writing a wrong sentence — it is
 * fixing one member of the set, looking at the file in hand, and calling it
 * done. One package's one-line description survived in FIVE files after being
 * corrected in one; a Node-floor claim once survived in five READMEs the same
 * way. (Neither phrase is quoted here — a sweep tool that contains the very
 * strings it hunts reports itself forever.)
 *
 * Judgment cannot close that gap, because the members where the change does not
 * yet bite look exactly like the ones already handled. Only an instrument can:
 * this script turns "I believe I got them all" into an exit code.
 *
 * ## What it asserts
 *
 * Always, over every package source pair:
 *
 * 1. **No duplicate `@param <name>` inside one JSDoc block.** An edit that
 *    inserts prose ahead of the tag block silently doubles the tags; neither
 *    `tsc` nor `eslint` reports it.
 * 2. **No dead `@typedef {import(…)} X`.** `noUnusedLocals` does not reach JSDoc
 *    typedefs. A typedef whose name appears nowhere else in the file is residue
 *    from a removed cast.
 * 3. **Every value a `.js` exports is declared in its sibling `.d.ts`.** The
 *    `.d.ts` is the canonical surface; a value it omits is undocumented in the
 *    generated API docs and absent from the typed contract.
 *
 * Additionally, when phrases are supplied as arguments:
 *
 * 4. **No prose surface still carries the OLD claim.** Module blocks, JSDoc,
 *    both READMEs, `package.json` descriptions, `CLAUDE.md` — and project-local
 *    tool config that git ignores. Matched against a whitespace-flattened form
 *    of each file, so a claim the ~78-column wrap split across two lines is
 *    still found; see {@link normalizeProse}.
 *
 * ## Why check 4 cannot be automated, and what that costs
 *
 * The phrases ARE the round's changed wording, which exists only in the head of
 * whoever changed it. Nothing in CI can supply them, so CI runs this bare and
 * checks 1-3 are the whole of what a green build asserts about documentation.
 * Check 4 is invoked by hand, per round, per claim — the procedure is in
 * `CLAUDE.md` under "Documentation hardening".
 *
 * The success line therefore names which half ran. A bare run must not read as
 * a swept round; that overstatement is the very defect the script exists to
 * catch, and it went unnoticed here for a month of green builds.
 *
 * The standing gap is that a wording retired in one round can creep back in a
 * later one with nobody sweeping for it. See SCAFFOLD.md, "The retired-wording
 * ratchet", for the deferred follow-up and the two constraints it has to
 * respect.
 *
 * ## Two corpora, and why they differ
 *
 * The structural checks read what a COMMIT would carry (`git ls-files --cached
 * --others --exclude-standard`) — they are about the repo's source pairs, and a
 * hand-rolled walk kept re-discovering generated output as phantom findings.
 *
 * The claim sweep reads what is PRESENT ON DISK, generated trees excluded by
 * name. A claim is swept when the old wording is gone from the project, not
 * merely from the part of it git tracks. The narrower corpus once reported a
 * package rename fully swept while five stale paths sat in an ignored
 * `.claude/settings.local.json` — a false clean, which is strictly worse than
 * the miss it was meant to prevent, because the whole point is to replace
 * judgment.
 *
 * ## Guarding against a green run that measured nothing
 *
 * A sweep that matches no files is indistinguishable from a clean sweep unless
 * the corpus size is reported, so every run prints how many files it scanned —
 * both counts when a claim is swept — and exits non-zero when the count is zero.
 * Re-export barrels (`export { … } from`) carry no declarations of their own;
 * they are counted and reported separately rather than passing check 3 silently
 * — `surface:check` is what covers those.
 *
 * ## TRIP CONDITION
 *
 * Delete this script if the `.js` / `.d.ts` pair convention is ever replaced by
 * generated declarations, which would make checks 1–3 the generator's problem.
 *
 * @module scripts/sweep-docs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PROSE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.md', '.json']);

// - Generated or vendored trees. Everything else on disk is in scope for the
//   CLAIM sweep, including files git ignores: project-local tool config
//   (`.claude/`, `.vscode/`) references project paths and goes stale on a
//   rename exactly like committed prose does, while being invisible to
//   `git ls-files`. That blind spot let a package rename report "swept" with
//   five stale paths still on disk.
const GENERATED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.vite']);
const GENERATED_PATHS = new Set(['docs/api']);

/**
 * Every file the sweep considers a prose surface, repo-relative.
 *
 * The corpus is whatever a commit would carry — tracked files plus untracked
 * ones git would not ignore. A hand-rolled directory walk kept re-discovering
 * generated output (`docs/api` is a typedoc build containing a COPY of
 * `CLAUDE.md`), and every such copy is a phantom hit that trains a reader to
 * ignore the tool.
 *
 * @returns {string[]} repo-relative paths
 */
function collectFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .filter((path) => path !== '' && PROSE_EXTENSIONS.has(extname(path)));
}

/**
 * Every prose surface present on disk, repo-relative — the CLAIM sweep's corpus.
 *
 * Deliberately wider than {@link collectFiles}: a claim is swept when the old
 * wording is gone from the PROJECT, not merely from what a commit would carry.
 * Ignored-but-present files are included and generated trees excluded by name,
 * which is the pairing the two corpora exist to express.
 *
 * @param {string} [dir] - directory to walk
 * @param {string[]} [collected] - accumulator
 * @returns {string[]} repo-relative paths
 */
function collectPresentFiles(dir = ROOT, collected = []) {
  for (const entry of readdirSync(dir)) {
    if (GENERATED_DIRS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const rel = relative(ROOT, full);

    if (GENERATED_PATHS.has(rel)) {
      continue;
    }
    if (statSync(full).isDirectory()) {
      collectPresentFiles(full, collected);
    } else if (PROSE_EXTENSIONS.has(extname(entry))) {
      collected.push(rel);
    }
  }
  return collected;
}

/**
 * Flattens a prose surface to one whitespace-normalized line, keeping the
 * offset at which each source line's contribution begins.
 *
 * A claim is a SENTENCE, and every prose surface here is hard-wrapped at ~78
 * columns, so a claim of more than a few words is almost always split across
 * lines — with a JSDoc gutter between the halves inside a comment block.
 * Matching line by line therefore reported "swept" for nearly every phrase
 * worth sweeping. That is the false clean this whole script exists to prevent,
 * so producing one here was worse than the miss it caused.
 *
 * Each line is stripped of a leading JSDoc gutter or markdown list marker,
 * collapsed internally, and joined to the next with a single space. Blank lines
 * are dropped rather than joined as empty segments, so a claim is still found
 * when an edit split it across a paragraph break.
 *
 * Offsets are recorded per SEGMENT rather than per character: a hit still
 * reports a real line number — which a naive whole-file `replace` would have
 * thrown away — without an array the length of the file.
 *
 * @param {string} text - file contents
 * @returns {{ prose: string, segments: { start: number, line: number }[] }} the
 *  lowercased flattened text, and each segment's offset with its 1-based line
 */
function normalizeProse(text) {
  /** @type {string[]} */
  const parts = [];
  /** @type {{ start: number, line: number }[]} */
  const segments = [];
  let length = 0;

  text.split('\n').forEach((raw, index) => {
    const stripped = raw
      .replace(/^\s*(?:\*+\/?|[-+]|\d+\.)\s?/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (stripped === '') {
      return;
    }
    if (parts.length > 0) {
      parts.push(' ');
      length += 1;
    }
    segments.push({ start: length, line: index + 1 });
    parts.push(stripped);
    length += stripped.length;
  });
  return { prose: parts.join('').toLowerCase(), segments };
}

/**
 * The source line a flattened-text offset came from.
 *
 * A linear scan, not a binary search: the segment list is one file's non-blank
 * lines and the scan runs once per HIT, which is a number the caller is about
 * to fix by hand.
 *
 * @param {{ start: number, line: number }[]} segments - from {@link normalizeProse}
 * @param {number} at - offset into the flattened text
 * @returns {number} the 1-based source line
 */
function lineOfOffset(segments, at) {
  let line = 1;

  for (const segment of segments) {
    if (segment.start > at) {
      break;
    }
    line = segment.line;
  }
  return line;
}

/**
 * Splits a source text into its JSDoc blocks, keeping each block's start line.
 *
 * @param {string} text - file contents
 * @returns {{ startLine: number, body: string }[]} the blocks
 */
function jsdocBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  /** @type {string[] | null} */
  let current = null;
  let startLine = 0;

  lines.forEach((line, index) => {
    if (current === null && line.trimStart().startsWith('/**')) {
      current = [line];
      startLine = index + 1;
    } else if (current !== null) {
      current.push(line);

      if (line.includes('*/')) {
        blocks.push({ startLine, body: current.join('\n') });
        current = null;
      }
    }
  });
  return blocks;
}

const files = collectFiles();

if (files.length === 0) {
  console.error(
    '✗ the sweep matched no files — the corpus walk is broken, not the docs.',
  );
  process.exit(2);
}

/** @type {string[]} */
const problems = [];

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  1 + 2 — per-file JSDoc hygiene
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const sourceFiles = files.filter((f) => /\.(js|mjs|ts)$/.test(f));

for (const file of sourceFiles) {
  const text = readFileSync(join(ROOT, file), 'utf8');

  for (const { startLine, body } of jsdocBlocks(text)) {
    /** @type {Map<string, number>} */
    const seen = new Map();

    // - the trailing `(?![\w$.])` matters twice over. `@param value.message`
    //   documents a MEMBER of an already-declared `value`, not a second one, so
    //   the dot has to disqualify the match. And the class must exclude
    //   identifier characters too, or the engine simply backtracks to a shorter
    //   name — `value.message` then matches as `valu`, which is worse than the
    //   false positive it was meant to remove.
    for (const match of body.matchAll(
      /^\s*\*\s*@param\s+(?:\{[^}]*\}\s*)?\[?([A-Za-z_$][\w$]*)(?![\w$.])/gm,
    )) {
      const name = match[1];
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        problems.push(
          `${file}:${startLine} — @param '${name}' declared ${count}× in one block`,
        );
      }
    }
  }

  // - anchored to the canonical one-line house form. Matching loose `@typedef`
  //   text would also hit this script's own regex literal and any prose that
  //   MENTIONS the convention — an instrument that flags its own documentation
  //   is not one anybody keeps running.
  const TYPEDEF_LINE =
    /^\s*\/\*\*\s*@typedef\s*\{import\([^)]*\)\.[\w$]+\}\s*([A-Za-z_$][\w$]*)\s*\*\/\s*$/gm;

  for (const match of text.matchAll(TYPEDEF_LINE)) {
    const name = match[1];
    const uses = text.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0;

    // - two occurrences is the typedef's own `{import(…).Name} Name` pair.
    if (uses <= 2) {
      problems.push(`${file} — @typedef '${name}' is never used (dead typedef import)`);
    }
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  3 — .js value exports must be declared in the sibling .d.ts
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const DECLARED = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm;

let pairsCompared = 0;
let barrelsSkipped = 0;

for (const file of sourceFiles.filter((f) => f.endsWith('.js') && f.includes('/src/'))) {
  const siblingPath = join(ROOT, file.replace(/\.js$/, '.d.ts'));
  let sibling;

  try {
    sibling = readFileSync(siblingPath, 'utf8');
  } catch {
    continue;
  }
  const jsText = readFileSync(join(ROOT, file), 'utf8');
  const jsNames = [...jsText.matchAll(DECLARED)].map((m) => m[1]);

  if (jsNames.length === 0 && /^export\s*\{/m.test(jsText)) {
    barrelsSkipped += 1;
    continue;
  }
  pairsCompared += 1;

  for (const name of jsNames) {
    if (!new RegExp(`\\b${name}\\b`).test(sibling)) {
      problems.push(
        `${file} — exports '${name}' but the sibling .d.ts does not declare it`,
      );
    }
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  4 — the claim sweep
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const phrases = process.argv.slice(2).filter((a) => a.trim() !== '');
/** @type {string[]} */
const claimHits = [];

const presentFiles = phrases.length > 0 ? collectPresentFiles() : [];

for (const phrase of phrases) {
  // - the SAME normalization on both sides, which is what makes a phrase
  //   pasted straight out of a JSDoc block — gutter, wrap and all — match as
  //   well as one typed as a single sentence. Collapsing whitespace on the
  //   needle alone is not enough: the pasted form still carries its `*`.
  const needle = normalizeProse(phrase).prose;

  for (const file of presentFiles) {
    const { prose, segments } = normalizeProse(readFileSync(join(ROOT, file), 'utf8'));

    for (let at = prose.indexOf(needle); at !== -1; at = prose.indexOf(needle, at + 1)) {
      claimHits.push(`"${phrase}" → ${file}:${lineOfOffset(segments, at)}`);
    }
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const scanned =
  `scanned ${files.length} prose surfaces` +
  (phrases.length > 0
    ? ` (${presentFiles.length} incl. git-ignored, for the claim sweep)`
    : '') +
  `, ${pairsCompared} .js/.d.ts pairs` +
  `${barrelsSkipped > 0 ? `, ${barrelsSkipped} re-export barrel${barrelsSkipped === 1 ? '' : 's'} left to surface:check` : ''}`;

if (problems.length > 0 || claimHits.length > 0) {
  console.error(
    `✗ documentation sweep found ${problems.length + claimHits.length} issue(s)\n`,
  );

  for (const problem of problems) {
    console.error(`    ${problem}`);
  }
  for (const hit of claimHits) {
    console.error(`    ${hit}`);
  }
  console.error(`\n  ${scanned}`);
  // - the guidance has to follow what actually failed, not what was asked for.
  //   Reporting "a claim still appears" over four dead typedefs sends the reader
  //   hunting for a phrase that is not there.
  console.error(
    claimHits.length > 0
      ? `\n  → a claim that still appears anywhere has not been swept. Fix every hit, then re-run.`
      : `\n  → fix each finding, then re-run.`,
  );
  process.exit(1);
}

// - the two runs report differently ON PURPOSE. A bare run proves the STRUCTURE
//   is sound and nothing at all about any claim, and CI only ever makes a bare
//   run — so a success line reading "documentation sweep clean" there would be
//   the same overstatement this script exists to catch, printed by the script
//   itself. Say which half ran.
console.warn(
  phrases.length > 0
    ? `✓ documentation sweep clean — structure and claim — ${scanned}; no occurrence of ${phrases.map((p) => `"${p}"`).join(', ')}`
    : `✓ structural checks clean — ${scanned}. No claim was swept: pass the OLD wording as arguments to sweep one.`,
);
