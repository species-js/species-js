# 018 — Prose-voice refinement of the documentation style

**Date:** 2026-06-03

**Context.** The Tier-S style from decision #002 had drifted into telegraphic
fragment-chains, em-dash-joined compounds, and parenthetical-heavy asides. The published
TypeDoc consumer experienced the `.d.ts` blocks as concept stacks separated by dashes
rather than as sentences that flow.

**Decision.** Refine the style. Complete sentences over telegraphic fragments. Periods as
default connector; em-dashes reserved for genuine asides. Lead-positive contrast on dual
predicates ("X does Z, whereas Y does W") rather than negation-first ("X does not Y, but
does Z"). Subject precision (source-strings render; classes themselves do not). Numbered
or bulleted lists where structure helps. Underscore italics for emphasis
(`_"tells-what-it-is"_`) to satisfy `jsdoc/no-multi-asterisks` on both `.js` and `.d.ts`
sides without per-file workarounds.

**Rationale.** Each shift fixes a specific failure mode the earlier voice carried. The
shift was demonstrated on one block (`hasAsyncFunctionShape`), confirmed by the user, then
applied package-wide.

**Consequences.** All eight file pairs in `type-detection` were rewritten in the refined
voice in a single pass (2026-06-03 commit `f622188`). The refinement supersedes the
earlier "em-dash-as-connector" tolerance but preserves every other Tier-S principle
(bidirectional `{@link}`, earned `@example`, `@internal` last, list headings, no
commented-out code, member-role docs without type restatement).
