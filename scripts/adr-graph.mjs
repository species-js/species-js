// @ts-check

/**
 * ADR supersession graph — reciprocity and citation-staleness checker.
 *
 * The decision record encodes two kinds of edge in prose:
 *
 *   forward   an ADR declaring what it acts on     "Supersedes #033", "Amends #074"
 *   inbound   an ADR annotated with what acted on it   "Amended by #075 (2026-07-24)"
 *
 * The inbound annotation is what makes a superseded decision self-declaring: a
 * reader who lands on #074 sees that #075 revised it without having to know #075
 * exists. Where a forward edge has no matching inbound annotation, the target
 * reads as current when it is not — and every document citing that target
 * inherits the error. That failure mode has no other guard: code has tests,
 * decisions get re-read when touched, but the prose rationale attached to a
 * decision is checked by nobody. This script is that check.
 *
 * It reports:
 *   R1  forward edges with no reciprocal inbound annotation
 *   R2  citations, from source and prose, to ADRs that were later acted on
 *   R3  ADR-to-ADR citations that post-date the amendment they ignore
 *
 * Only R1 is a hard gate — it exits 1, because an unannounced supersession is
 * unambiguously a defect the record can repair. R2 and R3 are a risk radar, not
 * an error list: a citation to a superseded decision is often legitimate
 * provenance ("Builds on #054", where #054's model stands and only its registry
 * portion died), and the parser cannot tell provenance from live reliance. They
 * print for a human to triage; they never fail the run.
 *
 * No dependencies. Peer of `audit.mjs` and `check-toolchain-sync.mjs` — a
 * remembered check kept red instead of in a reviewer's head.
 *
 * Usage: node scripts/adr-graph.mjs [--json] [--all]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Zero-pad an ADR number to the three-digit `NNN` form the record uses.
 * @param {number} n - the ADR number
 * @returns {string} the padded string, e.g. `54` becomes `054`
 */
const pad = (n) => String(n).padStart(3, '0');

/**
 * Emit one line to stdout — the reporter's output channel (keeps `--json`
 * pipeable, unlike the `warn`/`error` streams the sibling gates use).
 * @param {string} [line] - the line to write; a blank line when omitted
 * @returns {void}
 */
const print = (line = '') => void process.stdout.write(`${line}\n`);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const SHOW_ALL = process.argv.includes('--all');

/* ----- ----- ----- collection ----- ----- ----- */

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'docs/api']);
const CITING_EXT = new Set(['.js', '.ts', '.cjs', '.mjs', '.md', '.json']);

/**
 * Recursively collect citation-bearing files under a directory.
 * @param {string} dir - directory to walk
 * @param {string[]} [out] - accumulator
 * @returns {string[]} absolute paths of every citing file found
 */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) {
        continue;
      }
      walk(full, out);
    } else if (CITING_EXT.has(extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Locate every `docs/decisions` directory in the workspace.
 * @returns {string[]} absolute paths of the decision directories
 */
function findDecisionDirs() {
  const dirs = [];
  const pkgRoot = join(ROOT, 'packages');
  let pkgs = [];
  try {
    pkgs = readdirSync(pkgRoot);
  } catch {
    /* single-package repo */
  }
  for (const p of pkgs) {
    const d = join(pkgRoot, p, 'docs', 'decisions');
    try {
      if (statSync(d).isDirectory()) {
        dirs.push(d);
      }
    } catch {
      /* not every package keeps decisions */
    }
  }
  return dirs;
}

/* ----- ----- ----- parsing ----- ----- ----- */

const NUM = String.raw`#(\d{2,4})\b`;

/**
 * Forward: this ADR acts on the numbers that follow the verb.
 * Deliberately anchored at a clause start so prose like "the rule #021 codified"
 * does not read as an edge. The trailing `(?!-)` rejects the verb when it is the
 * head of a hyphenated compound — "amend-vs-append discipline (#054)" names a
 * discipline the citing ADR FOLLOWS, not an edge that amends #054.
 *
 * `corrects` earns its place (added 2026-08-04) even though a correction often
 * leaves the target's DECISION standing: #083 corrects #070's deletability
 * prediction while #070 itself stands, yet a reader landing on #070 still
 * inherits a claim now known false. That is precisely the failure this script
 * exists to prevent, so a corrected claim owes a reciprocal annotation exactly
 * like a superseded one. It was the vocabulary's one real gap — found by
 * mutation-probing the parser rather than by reading the corpus.
 *
 * `extends` is deliberately NOT a verb here. Every corpus use is provenance,
 * not an edge — #078 says outright "Extends the #070 / #071 delivery-seam
 * cluster; supersedes nothing." Admitting it would manufacture false R1 hits.
 */
const FORWARD_VERB =
  /\b(supersed(?:es|ing)|amends?|retires?|replaces?|reverses?|refines?|narrows|overturns?|revises?|obsoletes?|corrects?)\b(?!-)/gi;

/** Inbound: this ADR was acted on by the numbers that follow "by". */
const INBOUND =
  /\b(superseded|amended|revised|reversed|retired|replaced|refined|narrowed|carved out|overturned|corrected)\b[^.\n]{0,60}?\bby\b[^.\n]{0,60}?#(\d{2,4})/gi;

/** Any bare ADR reference. */
const CITATION = new RegExp(NUM, 'g');

/**
 * Words that end the verb's object and begin a mere cross-reference. A number
 * after one of these is context, not a target: "refines #050 ...; follows #015"
 * names one target and one antecedent, not two targets.
 */
const REFERENCE_PIVOT =
  /\b(see|follows?|per|cf|after|alongside|introduced in|established in|from|noted in|recorded in|as in|like)\b/i;

/**
 * Pull forward edges. For each verb hit, take the clause that follows it —
 * bounded by sentence end, semicolon, or newline — and collect the ADR numbers
 * that stand as the verb's object.
 * @param {string} body - the ADR markdown body
 * @returns {Array<{target:number,verb:string,quote:string}>} forward edges
 */
function forwardEdges(body) {
  /** @type {Map<string, {target:number,verb:string,quote:string}>} */
  const edges = new Map();
  for (const m of body.matchAll(FORWARD_VERB)) {
    const start = m.index ?? 0;
    const window = body.slice(start, start + 160);

    // The inbound pattern reuses these verbs; skip "superseded ... by #N".
    if (/^\w+\b[^.\n]{0,60}?\bby\b[^.\n]{0,40}#\d/.test(window)) {
      continue;
    }

    // Attribution guard: "#077's strategy (which revises #039)" inside #051 is
    // #077's edge being reported, not #051's. If another ADR number governs the
    // clause immediately before the verb, the edge is not this file's to claim.
    const lookback = body.slice(Math.max(0, start - 70), start);
    if (!/[.\n]\s*$/.test(lookback) && /#\d{2,4}[^.\n]{0,40}$/.test(lookback)) {
      continue;
    }

    // One clause only.
    let clause = window.split(/(?<=\.)[\s*]|;|\n/)[0] ?? '';
    // Negation: "revises #039's uniformity, not #031's intent" names one target.
    clause = clause.split(/,?\s+not\s+/)[0] ?? clause;
    // Drop everything past the first cross-reference pivot.
    const pivot = REFERENCE_PIVOT.exec(clause.slice(m[1].length));
    if (pivot) {
      clause = clause.slice(0, m[1].length + pivot.index);
    }

    for (const m2 of clause.matchAll(CITATION)) {
      // The object has to sit close to the verb; a distant number is prose.
      if ((m2.index ?? 0) > 70) {
        continue;
      }
      const key = `${m2[1]}`;
      if (!edges.has(key)) {
        edges.set(key, {
          target: Number(m2[1]),
          verb: m[1].toLowerCase(),
          quote: squash(clause),
        });
      }
    }
  }
  return [...edges.values()];
}

/**
 * Pull inbound annotations — the "acted on by #N" back-references.
 * @param {string} body - the ADR markdown body
 * @returns {Array<{source:number,verb:string,quote:string}>} inbound edges
 */
function inboundEdges(body) {
  const edges = [];
  for (const m of body.matchAll(INBOUND)) {
    edges.push({ source: Number(m[2]), verb: m[1].toLowerCase(), quote: squash(m[0]) });
  }
  return edges;
}

/**
 * Collapse whitespace and clip a quote to a readable length.
 * @param {string} s - the raw text
 * @returns {string} the squashed, clipped quote
 */
function squash(s) {
  return s.replace(/\s+/g, ' ').trim().slice(0, 110);
}

/* ----- ----- ----- build ----- ----- ----- */

/**
 * @type {Map<number, {num:number,file:string,title:string,date:string,forward:Array<{target:number,verb:string,quote:string}>,inbound:Array<{source:number,verb:string,quote:string}>}>}
 */
const adrs = new Map();

for (const dir of findDecisionDirs()) {
  for (const name of readdirSync(dir).sort()) {
    const m = /^(\d{3,4})-.+\.md$/.exec(name);
    if (!m) {
      continue;
    }
    const file = join(dir, name);
    const body = readFileSync(file, 'utf8');
    const num = Number(m[1]);
    adrs.set(num, {
      num,
      file: relative(ROOT, file),
      title: (/^#\s*\d+\s*[—–-]\s*(.+)$/m.exec(body)?.[1] ?? name).trim(),
      date: /\*\*Date:\*\*\s*([\d-]+)/.exec(body)?.[1] ?? '',
      forward: forwardEdges(body),
      inbound: inboundEdges(body),
    });
  }
}

/* R1 — forward edges lacking a reciprocal inbound annotation */

const r1 = [];
for (const adr of adrs.values()) {
  for (const e of adr.forward) {
    if (e.target === adr.num) {
      continue;
    }
    const target = adrs.get(e.target);
    if (!target) {
      continue;
    }
    const annotated = target.inbound.some((i) => i.source === adr.num);
    if (!annotated) {
      r1.push({ from: adr.num, to: e.target, verb: e.verb, quote: e.quote, target });
    }
  }
}

/** ADRs that have been acted on by something, whether or not they say so. */
/** @type {Map<number, number[]>} */
const actedOn = new Map();
for (const adr of adrs.values()) {
  for (const e of adr.forward) {
    if (e.target === adr.num || !adrs.has(e.target)) {
      continue;
    }
    if (!actedOn.has(e.target)) {
      actedOn.set(e.target, []);
    }
    const list = actedOn.get(e.target);
    if (list && !list.includes(adr.num)) {
      list.push(adr.num);
    }
  }
}

/** Subset that is silent about it — the ones a citer cannot discover locally. */
const silentlyActedOn = new Map(
  [...actedOn].filter(([target, sources]) => {
    const t = adrs.get(target);
    return sources.some((s) => !t?.inbound.some((i) => i.source === s));
  }),
);

/* R2 / R3 — citation walk */

const CITE_SITES = ['packages', 'CLAUDE.md', 'CONTRIBUTING.md', 'README.md'];
const files = [];
for (const site of CITE_SITES) {
  const p = join(ROOT, site);
  try {
    files.push(...(statSync(p).isDirectory() ? walk(p) : [p]));
  } catch {
    /* optional site */
  }
}

const r2 = [];
const r3 = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  const isAdr = /docs[/\\]decisions[/\\]\d{3,4}-/.test(rel);
  const selfNum = isAdr ? Number(/(\d{3,4})-/.exec(rel)?.[1]) : null;
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    for (const m of line.matchAll(CITATION)) {
      const cited = Number(m[1]);
      if (!adrs.has(cited)) {
        continue;
      }
      if (selfNum === cited) {
        continue;
      }
      let amenders = (SHOW_ALL ? actedOn : silentlyActedOn).get(cited);
      if (!amenders?.length) {
        continue;
      }

      // A cited range — "#054–#059" — already carries its own amendments.
      const ranges = [...line.matchAll(/#(\d{2,4})\s*[–—-]\s*#?(\d{2,4})/g)].map((r) => [
        Number(r[1]),
        Number(r[2]),
      ]);
      amenders = amenders.filter(
        (a) =>
          !line.includes(`#${pad(a)}`) && !ranges.some(([lo, hi]) => a >= lo && a <= hi),
      );
      if (!amenders.length) {
        continue;
      }

      const hit = { file: rel, line: i + 1, cited, amenders, text: squash(line) };
      if (isAdr && selfNum) {
        // Only interesting if the citing ADR is newer than the amendment it ignores.
        const later = amenders.filter((a) => a < selfNum && !line.includes(`#${a}`));
        if (later.length) {
          r3.push({ ...hit, amenders: later, self: selfNum });
        }
      } else {
        r2.push(hit);
      }
    }
  });
}

/* ----- ----- ----- report ----- ----- ----- */

if (JSON_OUT) {
  print(JSON.stringify({ adrs: adrs.size, r1, r2, r3 }, null, 2));
  process.exit(r1.length ? 1 : 0);
}

print(`ADR supersession graph — ${adrs.size} decisions parsed\n`);

print(`R1  unannounced supersessions (${r1.length})`);
print(`    a forward edge whose target carries no reciprocal annotation\n`);
for (const f of r1) {
  print(`  #${pad(f.from)} ${f.verb} #${pad(f.to)}   ${f.target.title}`);
  print(`      target: ${f.target.file}`);
  print(`      claim : "${f.quote}"`);
  print('');
}

print(`R2  citations to silently-amended decisions (${r2.length})`);
print(`    source and prose referring to a decision that was later acted on\n`);
const byFile = new Map();
for (const h of r2) {
  if (!byFile.has(h.file)) {
    byFile.set(h.file, []);
  }
  byFile.get(h.file).push(h);
}
for (const [file, hits] of [...byFile].sort()) {
  print(`  ${file}`);
  for (const h of hits) {
    print(
      `      :${h.line}  cites #${pad(h.cited)}  acted on by ${h.amenders.map((a) => '#' + pad(a)).join(', ')}`,
    );
    print(`              ${h.text}`);
  }
  print('');
}

print(`R3  ADRs citing an amendment they post-date (${r3.length})\n`);
for (const h of r3) {
  print(
    `  #${pad(h.self)} cites #${pad(h.cited)} without #${h.amenders.map((a) => pad(a)).join('/#')}`,
  );
  print(`      ${h.file}:${h.line}`);
  print(`      ${h.text}`);
  print('');
}

print(
  `summary: R1=${r1.length} R2=${r2.length} R3=${r3.length}` +
    (r1.length ? '  — reciprocity incomplete' : '  — reciprocity complete'),
);
process.exit(r1.length ? 1 : 0);
