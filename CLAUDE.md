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
- **JSDoc** — `@typedef` imports from `.d.ts`; types live in declarations, not in JSDoc
- **`@/` alias** — resolves to `src/` in each package (tsc paths + vite alias)
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

- **Do not auto-start coding** — wait for direction
- **AI handles volume** — docs, tests, mechanical audits, analysis
- **User owns design** — contracts, naming, API surface, architecture
- **Think-aloud sessions are real work** — engage fully, push back honestly
- **"Recall" means synthesize from context** — don't re-read files
- **Thorough audit = mechanical completeness first** — check EVERY declaration, then
  semantics

## Architecture notes

See `SCAFFOLD.md` for all configuration rationale.

Key patterns from the sibling project (`es-async-types` / `cadence-js`):

- Cross-realm type detection uses 4-7 layer validation pipelines
- `defineStableTypeIdentity` seals constructor name, prototype, Symbol.toStringTag
- Smart-alien test pattern: alien mocks defer to real implementations via WeakSet tracking
- Memoization and context binding are caller concerns, not type concerns
- Composition/traits rejected for runtime types (V8 inline cache performance)
