# species-js

Foundation monorepo for runtime type infrastructure. All downstream projects
(`cadence-js`, `equip-js`, `cambium-js`, `talented-js`, `modulate-js`, `inflect-js`)
depend on these packages.

## Packages

| Package                              | Purpose                                                           | Dependencies   |
| ------------------------------------ | ----------------------------------------------------------------- | -------------- |
| `@species-js/type-detection`         | Runtime type checking, cross-realm discrimination                 | none           |
| `@species-js/function-introspection` | Function classification (class, generator, async, arrow, concise) | type-detection |
| `@species-js/type-identity`          | Type branding, constructor sealing, multi-layer validation        | type-detection |
| `@species-js/custom-domain`          | Prototype-less namespace objects for sealed method grouping       | type-detection |

## Code conventions

- **Manually crafted `.js` and `.d.ts` pairs** — vanilla JS with `// @ts-check` paired
  with sibling declaration files that define contracts; no transpilation, no codegen on
  either side
- **File-level headers** — `.js` opens with `// @ts-check` (line 1), then an `@module`
  JSDoc block. `.d.ts` opens with the same `@module` JSDoc block. Both files name the
  module, give a one-paragraph description, and include an `@example` block where the
  module's surface warrants one.
- **Parallel JSDoc in `.js` and `.d.ts`** — both files document every export. The `.d.ts`
  is the canonical surface (typedoc consumes it) and wins on conflicts; the `.js`
  documentation is parallel, not optional. Each file earns its documentation:
  - `.d.ts` describes the **contract** from a consumer's perspective.
  - `.js` describes the **implementation's relationship to the contract** — free to
    include details like "from the module-scoped `WeakMap`", "registered in the realm's
    `WeakSet`", or other internal mechanics that don't belong in consumer-facing docs.
  - Descriptions may differ in phrasing or detail, but never in semantics — if they
    diverge, `.d.ts` is the source of truth.
- **Types live where the file's syntax expects them** — `.js` carries types via JSDoc
  `@param {…}` and `@returns {…}`; `.d.ts` carries types via native TS parameter/return
  signatures with JSDoc `@param name - desc` and `@returns desc` (description only, no
  inline type — the type is in the TS signature). Inline `/** @type {…} */ (expr)` casts
  in `.js` are the standard tool for type-narrowing and lib-gap acknowledgement (the
  `objectHasOwn` pattern). Use `@typedef {import('@/module').Name} Name` at the top of
  `.js` files to bring named types (a sibling `.d.ts` or another module) into JSDoc scope.
  Like every module reference in the package, these use the `@/` alias.
- **`@internal` tag** — present in both files for non-public surface. Place it on its own
  line, **last** (after the description and any other tags), in both `.js` and `.d.ts`.
  Never put it first (the following description is then parsed as the tag's content →
  `jsdoc/empty-tags`) and never inline on a single-line block (→
  `jsdoc/escape-inline-tags`). A documented internal export is therefore always a
  multi-line block, even when the description is a single line.
- **Doc voice and tag form** — one-line `@param name - desc` / `@returns desc` (lowercase
  start, no trailing period; the type is in the TS signature for `.d.ts`, in the JSDoc
  `{…}` for `.js`). Multi-paragraph prose uses em-dash (`—`) for asides; backticks for
  code, types, and internal slots (`[[Call]]`, `[[Construct]]`). Lead descriptions with
  what the symbol _is_ or _does_ ("The floor of JavaScript callability…", "Narrows a value
  to…"), not meta-framing ("Type guard that checks whether…"). When a predicate has
  meaningful boundaries — what it deliberately does NOT verify — name them; what a check
  _refuses_ to claim is first-class information. Interface-member docs name the role
  (`/** The sole guarantee — the [[Call]] internal method. */`), never restate the type;
  omit member docs that would just repeat the signature. `@example` is _earned_ — added
  when narrowing flow, edge cases, or typical returns are non-obvious, not added to every
  export. `## Subsection` markdown headings are allowed inside long doc blocks for
  enumerated lists. Implementation comments inside `.js` bodies follow the same "WHY
  non-obvious" rule as elsewhere — drop `// guard.` / `// explicitly return undefined`
  style noise; keep substantive context (fallthrough rationale, replaced-slot semantics).
  Reference examples of the unified style: `function.{js,d.ts}`, `primitive.{js,d.ts}`,
  `utility/index.{js,d.ts}`, `config/index.{js,d.ts}`. Markdown emphasis (`*italic*`) in
  `.js` JSDoc trips `jsdoc/no-multi-asterisks`; use plain text or backticks instead.
  Cross-module `{@link Foo}` in a `.d.ts` only resolves cleanly when `Foo` is in TS scope
  (imported and _used_ as a TS type); if the import would be unused (`noUnusedLocals`
  flag), fall back to backticks rather than a contrived use.
- **Section separators** — multi-block ASCII, identical shape in `.js` and `.d.ts`,
  matching the sibling `es-async-types` convention:
  ```
  // ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
  //
  //  Property Descriptor Options
  //
  // ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
  ```
  Tight two-line form (open + close dashes only, no title) is acceptable as a thematic
  divider between adjacent sections of the same surface.
- **No commented-out code in committed files** — git history is the archive. If an
  alternative was deliberately rejected and is worth recording, capture it as prose in a
  JSDoc block or in SCAFFOLD.md, never as `//`-commented code.
- **`@/` alias** — resolves to `src/` in each package (tsc paths + vite alias). Used
  uniformly in **both** `.js` and `.d.ts` (imports and JSDoc `import()` specifiers); no
  relative-path exception. A phantom `TS2307` on a `@/` import in a freshly-created
  `.d.ts` is an IDE TS-server indexing artifact — tsc and vite resolve it — so restart the
  TS service / re-index rather than switching to a relative path.
- **Per-domain barrel layout** — each package has `src/index.{js,d.ts}` plus sibling
  `name.{js,d.ts}` pairs (or `name/index.{js,d.ts}` for substantial subdomains); each
  subdomain gets its own subpath export. See `SCAFFOLD.md` → "Per-package subdomain
  layout".
- **`unknown` over `any`** — always, except where strictFunctionTypes contravariance
  demands it
- **Property names are nouns** — methods are verbs; `executionPath` not `execPath`
- **Prototype-less state** — `Object.assign(Object.create(null), {...})`
- **Symbol.toStringTag is a getter** — test `desc.get`, not `desc.value`
- **ES2020 floor** — no ES2021+ APIs (`Object.hasOwn`, `Array.prototype.at`,
  `String.prototype.replaceAll`, `Object.groupBy`, …). Syntax features are lowered by
  esbuild; runtime APIs are not.
- **Cached prototype references** — `const hasOwn = Object.prototype.hasOwnProperty;` at
  module top; call as `hasOwn.call(o, k)`. Same pattern for any cross-realm-sensitive
  method. Never call `Object.hasOwn` directly.

## Commands

```sh
pnpm run check          # typecheck + lint + format + docs + audit + test:coverage (the one command)
pnpm run check:full     # check + build + pack:check (full CI mirror; slower)
pnpm run typecheck      # tsc per package
pnpm run lint           # eslint
pnpm run test           # vitest (all packages)
pnpm run test:coverage  # with V8 coverage
pnpm run test:watch     # watch mode
pnpm run test:ui        # vitest UI
pnpm run build          # node + browser + umd (all packages)
pnpm run build:node     # ESM + CJS
pnpm run build:browser  # ESM only
pnpm run build:umd      # UMD (ES2020 target, minified)
pnpm run format         # prettier
pnpm run docs           # typedoc
pnpm run changeset      # declare version intent
pnpm run clean          # remove dist/ and coverage/ (workspace-wide)
```

Run tests for a single package: `pnpm --filter @species-js/type-detection run test`

## Testing discipline

- Tests derive from **specification**, not implementation
- Every assertion must be **guaranteed to execute** — no empty loops, no try/catch-only
- Use `await expect(p).rejects.toSatisfy(...)`, not `try/catch`
- Use `toBe(expected)` for identity, not `toBeDefined()`
- Verify exact sets with `.toEqual(expectedKeys)`, not "at least one exists"
- Vitest with explicit imports (`import { describe, it, expect } from 'vitest'`)
- Run only affected tests, not the full suite
- After contract changes, run downstream tests empirically — never claim compatibility
  from code-trace alone

## Collaboration model

We pair. User has first and last word on architectural decisions; AI is the throughput
multiplier for everything else. Different parts of the work flow in different directions —
sometimes user leads, sometimes AI advises and leads tactical execution — but design
authority stays with the user.

- **Session start** — restore context from memory, wait for direction before starting new
  work. Within a session, normal pair-programming flow applies: AI proposes, user confirms
  or redirects, AI executes.
- **AI handles volume** — specs, tests, documentation, mechanical audits, cross-file
  consistency work, repetitive refactors, scoped migrations. Offloading volume is the
  point; it keeps the user's focus where it belongs — on design coherence and semantic
  precision.
- **User owns design** — architectural decisions, contracts, naming, API surface,
  structural rules. AI proposes options with trade-offs; user decides.
- **Migrations are paired, not solo** — user keeps design control (what moves where,
  naming, ordering, sequencing); AI does the mechanical work (file moves, config wiring,
  reference updates, batch edits) once direction is clear. The user doesn't have to grind
  through every file move alone — that drains the focus they need for design.
- **Think-aloud sessions are real work** — casual exploration produces real design
  outcomes (executionPath → error-context infrastructure in es-async-types; the `.js`-only
  include rule in species-js). Engage fully, push back honestly, don't redirect toward
  "concrete tasks". The concrete outcomes emerge from the exploration.
- **"Recall" means synthesize from context** — don't batch-read every memory file unless a
  specific detail is missing.
- **Thorough audit = mechanical completeness first** — check EVERY declaration for
  docs/types, then the semantic pass. Don't conflate the two or skip the boring one.
- **Empirical verification when stakes warrant** — for genuinely novel structural rules
  with monorepo-wide blast radius (tsconfig shape, build-pipeline changes), test on one
  representative case before adopting everywhere. Day-to-day pair work doesn't need this
  gate.

## Architecture notes

See `SCAFFOLD.md` for all configuration rationale. Per-package architecture and decisions
live under `packages/<name>/docs/`:

- `packages/<name>/docs/architecture/` — one file per module (mental model, cross-realm
  safety, predicate composition, open questions). `README.md` indexes the module files and
  lists cross-cutting patterns.
- `packages/<name>/docs/decisions/` — one ADR file per decision (`NNNN-slug.md`).
  `README.md` indexes by domain and chronologically; `open-questions.md` tracks unresolved
  policy/scope questions.
- `packages/<name>/docs/spec/` — behavioral specs per module (test-driving).

Key patterns from the sibling project (`es-async-types` / `cadence-js`):

- Cross-realm type detection uses 4-7 layer validation pipelines
- `defineStableTypeIdentity` seals constructor name, prototype, Symbol.toStringTag
- Smart-alien test pattern: alien mocks defer to real implementations via WeakSet tracking
- Memoization and context binding are caller concerns, not type concerns
- Composition/traits rejected for runtime types (V8 inline cache performance)
