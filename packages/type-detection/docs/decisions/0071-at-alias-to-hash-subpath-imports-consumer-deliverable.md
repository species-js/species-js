# 071 — `@/` path alias → `#` Node subpath imports: package-internal specifiers that reach the consumer

**Date:** 2026-07-16

**Context.** The package ships its type surface as source declarations — `package.json`
`types` (and every `exports` subpath's `types`) points at `./src/*.d.ts`, not a built
artifact. Those `.d.ts` files carried `@/…` specifiers, and the `@/` alias exists only in
this workspace's tsconfig `paths` + vite `resolve.alias`. A consumer's TypeScript has
neither, so every internal `import` in a shipped declaration is `TS2307` at the
destination — the contract is internally true and **undeliverable**. Surfaced by the same
outside review as #070 (a delivery-seam blindness: both parties always work inside the
resolved workspace, where `@/` functions, so no check ever stood in a consumer's
position). Empirically reproduced: a consumer-style `tsc` (no `@/` paths,
`moduleResolution: bundler`) over `src/config/index.d.ts` →
`error TS2307: Cannot find module '@/function'`.

**Decision.** Replace `@/` with **Node subpath imports** — `#<module>` specifiers declared
in each package's `package.json` `imports` map, resolving to `src/`. The specifiers mirror
the public `exports` subpaths: **`#foo` internal ↔ `/foo` external**. The map is
**explicit per module**, not a `#src/*` wildcard: the file/folder split (`#function` →
`function.js` vs `#config` → `config/index.js`) has no ESM directory-index, so a wildcard
cannot resolve both, and the `src/` segment a wildcard implies would re-encode the
physical layout the migration exists to decouple from. The tsconfig `@/*` `paths` +
`baseUrl` and the vite `@` alias are dropped; `moduleResolution: bundler` reads the
`imports` map natively, as do vite/Rollup and Node's runtime resolver. Removing `baseUrl`
package-wide also lets the base tsconfig drop `ignoreDeprecations: "6.0"` — it existed
only to silence the `baseUrl` deprecation — which **resolves the deferred TS 6/7 `baseUrl`
question** (SCAFFOLD).

**Rationale.** A `#`-import travels with the package: the `imports` map lives in
`package.json`, which ships, so `#…` specifiers in a shipped `.d.ts` resolve at any
consumer's compiler (TS ≥ 5.4 under `bundler` / `nodenext`) and at Node runtime — the
exact property `@/` lacked. `@/` was a private dialect that resolved only where its
definition lived; `TS2307` at the consumer was the alias behaving exactly as designed,
outside its jurisdiction. The `#foo ↔ /foo` symmetry and the explicit map keep a specifier
meaning the same thing in every context (dev, test, published, Node, bundler), and
re-encode neither the physical location (`src`) nor the privacy the `#` sigil already
guarantees by spec.

**Consequences.** Verified empirically before adoption: the consumer-style `tsc` that gave
`TS2307` on `@/` now resolves `#function` / `#object` **into their declarations** (bare
`.js` `imports` targets — TS finds the `.d.ts` sibling, no `types` condition needed);
local `tsc` across all four packages is clean; vite/vitest resolve `#` natively (throwaway
probe + the full 555-test type-detection suite + the three skeleton packages' `#index`
barrel tests); and Node resolves `#` subpath entries natively.

The entry-point arena (#070) **simplifies**: with source on `#`, Node resolves a subpath
entry's internal specifiers natively, so the arena's custom `@/`-resolver shim
(`test/_arena/register.js` + `resolve.js`) is deleted and the spawn loads each subpath
directly — the exact "the shim deletes itself" the review predicted. The load-order guard
still bites: an isolated native negative control (reverted-#070 fix, self-pointing
`#imports`) exits non-zero with
`Cannot access 'TRUSTED_DATA_CONFIRMATION' before initialization`.

Scope: all four workspace packages migrated — type-detection's 18 `@/` files plus the
three skeleton packages' single barrel-test import each. `@/` now survives only in the
append-only ADRs (historical record, unchanged) and is swept from the current-state spec /
architecture docs in a separate `docs:` change. Builds on #070; together they close the
delivery-seam cluster's structural fixes. The remaining fifth-axis facet — a permanent
consumer-side type-resolution check — is worth adding next so this property is guarded,
not just verified once here.
