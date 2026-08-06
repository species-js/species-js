# 085 — Curated public entry at the package root, and the gate that makes `@internal` enforceable (overturns #084's deferral)

**Date:** 2026-08-06

**Context.** Three decisions have now circled the same question from different sides. #070
kept `utility` re-exporting `TRUSTED_DATA_CONFIRMATION` so "the public surface stays
byte-identical" — migration safety for a structural change to a shipping surface. #084
retired that clause and, in doing so, found the re-export had silently dropped its
`@internal` tag and was the sentinel's **only** path onto the package's typed surface; it
removed the one bounded piece and **deferred** the wider narrowing to publish-readiness,
declaring the recorded mechanism unusable: `exports["."].types` and `#index` resolve to
the same file, so narrowing it would break all 49 test import sites.

The underlying defect is larger than one re-export. `exports["."]` resolved to
`src/index.d.ts`, which stars all eight subdomains, so the package root published **97
`@internal` exports alongside the 138 documented ones**. Tagging narrowed nothing, because
**`@internal` is a JSDoc tag and no module resolver has ever read one.** Every realm-fixed
capture, module-scope sentinel and `@internal`-for-testability sub-helper was reachable
from `@species-js/type-detection` and binding under Hyrum's law across six planned
dependents. The tag documented an intent that nothing enforced — the same gap #084 hit,
one layer up.

**Decision.** Publish a **curated entry**, and gate it.

`src/public.{js,d.ts}` names the documented surface one export at a time — 135 names in
the declaration file, 79 of them values in the `.js`. Types are erased at runtime, so
naming one in the `.js` would be a dangling binding, and omitting a value would drop it
from the built bundle while the `.d.ts` still promised it. `exports["."]`, `main`,
`module`, `types`, `unpkg` and `jsdelivr` all resolve to it, and the vite entry builds
`public` instead of `index` — so the unfiltered barrel is **never emitted at all**.

`#index` stays wide and unchanged; the test suite keeps its full reach.

`scripts/check-public-surface.mjs` (`surface:check`, wired into `check` and CI) asserts
three things for every package carrying a `src/public.d.ts`: every exported declaration
has a JSDoc block, `public.d.ts` lists exactly the exports whose block lacks `@internal`,
and `public.js` lists exactly the public values.

**The barrel rule**, stated package-independently: _a module whose exports are public
throughout is star-re-exported and may earn a subpath of its own; a module that merely
CONTAINS some public exports gets neither, and the barrel names what escapes it._

**Rationale.**

- **#084's objection dissolves rather than being overridden.** `exports["."].types` and
  `#index` resolve to the same file _only because we pointed them there_. Splitting the
  two roles — a curated entry for consumers, the wide barrel for in-package use — costs
  one build entry and leaves all 49 test imports untouched. The deferral was sound given
  the mechanism recorded at the time; the mechanism was the thing that was wrong. A
  recorded plan reading "the shape is settled, only execution remains" is itself a claim,
  and it decays exactly as a stale fact does — re-deriving this one produced a different
  answer.
- **A documentation tag is not an enforcement mechanism.** An export that is reachable IS
  public, whatever it says about itself. Curation is what narrows the surface; the gate is
  what keeps the curation and the tagging from drifting. **A tag becomes enforcement at
  the moment a script reads it and exits non-zero, never before** — without the gate, a
  curated list just moves the decoration to a different file.
- **Named over star, per the barrel rule.** `export *` republishes whatever a module gains
  later, regardless of tagging, so a star is only safe where the module is public
  throughout. Where it isn't, the barrel must name what escapes — and that omission is
  resolver-enforced in a way the tag never was.
- **Never building the wide barrel** means the unfiltered surface does not exist in
  `dist/`. Verified against the artifact: `getOwnPropertyDescriptor(s)`, `getPrototypeOf`,
  `globalContext`, `isValueOfBoundSet`, `BLANK_DICTIONARY` and `INSTANCE_LESS_CONSTRUCTOR`
  are all absent from the built entry, which none of them were before.
- **A hand-maintained list of this size rots** — #084 said so, and it is the reason the
  gate is not optional. The alternative that removes the list entirely is recorded below.

**Consequences.**

- **The gate found four defects, three of them pre-existing.** `WeakKey` had no JSDoc
  block at all (it follows a `declare global` block, so nothing classified it) — the gate
  refuses to guess rather than defaulting, which is why it surfaced. Five names were
  duplicated in the generated list, being the #079 overload pairs declared twice in the
  `.d.ts`; duplicate named re-exports are an early `SyntaxError`, so `public.js` would not
  have loaded. `function-introspection` was reaching into an `@internal` capture,
  invisible under the star barrel and a compile error the moment the surface was curated.
- **The classifier's own vocabulary was the fourth.** Matching `@internal` anywhere in a
  doc block misclassified any block that merely _mentions_ the tag in prose — it had been
  silently excluding `BlankDictionary`, a type ruled public by owner decision, since the
  list was generated, and it re-hid the first export promoted after the gate shipped. The
  tag now counts only in tag position. A parser's vocabulary is its attack surface — the
  same lesson `decisions:check` taught when `corrects` sat outside its verb list — so this
  one was mutation-probed in both directions afterwards.
- **`function-introspection` is the first adopter, and it adopts the rule structurally
  rather than by list** — its `#utility` is starred nowhere, so its internals never enter
  the bundle without any curation to maintain. Two packages, two mechanisms, one
  guarantee. The rule generalizes; it was decided and paid for here.
- **Open:** `src/public.d.ts` is in no TypeScript program (`include` is `src/**/*.js` and
  nothing imports `#public`), so its type re-exports are checked textually by the gate but
  never by `tsc`. A test importing the public entry would pull the declaration in through
  resolution and close it.
- **TRIP CONDITION for the gate**, recorded in the script: delete it if the packages ever
  stop hand-maintaining a curated entry — for instance if every public module is made
  pure, with internals relocated to modules that are never re-exported, at which point
  `export * as ns from '#mod'` narrows the surface structurally and no list remains to
  drift. That is the more principled end state; it is not adopted here because relocating
  ~97 exports would add eight intra-package edges to a graph that has already produced two
  load-order defects (#070, #083).
- Builds on #084 (whose deferral this overturns) and #070 (the byte-identical clause #084
  retired). Verified before adoption: `attw` green on all nine subpaths plus the new root
  across node10, node16 from CJS and ESM, and bundler; `publint` clean; 3746/3746 tests
  unchanged; the entry-point arena, which derives its set from `exports`, covers the new
  root automatically.

Commits: `e52edb1` (curated entry), `866ea62` (gate).
