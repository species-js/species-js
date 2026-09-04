# 099 — Whatever `exports["."]` resolves to is the public surface (retires #085's enforcement scope and #097's threshold)

**Date:** 2026-09-04

**Context.** #085 made `@internal` enforceable at the package root by publishing a curated
`src/public.{js,d.ts}` and gating it with `surface:check`. #097 then answered the question
#085 implied — when does a package earn that second file? — with a threshold: the split
earns itself per MODULE, not per export.

Two rules, and a gate that reads one of them. `check-public-surface.mjs:137` does
`if (!existsSync(src/public.d.ts)) continue;`, and the script fails only when NO package
carries one. With two that do, it prints a confident green while `custom-namespace` and
`type-identity` are never examined.

On 2026-09-04 the skip was found occupied. **`type-identity`'s published entry exports
`resolveErrorWithCause` and the `ErrorWithCauseConstructor` type, both tagged
`@internal`**, and `exports["."]` resolves straight to it. #097 named that exact situation
as its trip condition — and wrote that the package "may yet prove to export something
`@internal`" without checking. It was already true the day #097 was written.

The defect is not the layout. `custom-namespace` genuinely has nothing to curate, and #097
was right to refuse it a second file. The defect is that a structural precondition was
standing in for the invariant, so a package that did not meet the precondition left the
invariant unchecked.

**Decision.** One invariant, replacing both rules:

> **Whatever `exports["."]` resolves to is the public surface, and nothing `@internal` may
> be exported from it.**

`surface:check` resolves the entry from `exports["."].types` — the field `entries:check`
already validates and `check-bundle-smoke.mjs` already reads — instead of testing for the
presence of `public.d.ts`. Coverage becomes universal by construction.

**Rationale.**

- **It deletes a rule rather than adding a file.** The per-MODULE threshold leaves live
  prose and becomes a gate result. A contributor decides nothing up front; if their entry
  exports something `@internal`, the gate says so, and they learn about `public.js` at the
  only moment it is useful.
- **The "measuring nothing" state becomes unreachable rather than guarded.** The
  `no package carries a src/public.d.ts` special case exists because the gate could
  otherwise pass vacuously. Resolving the entry from a field every package has removes the
  condition instead of checking for it.
- **Coverage stops depending on memory.** Two of four packages today; four of four after,
  and every future package enrolled automatically rather than by someone remembering.
- **No new source of truth.** `exports["."].types` is already gated at both ends.
- **Uniformity was NOT the reason.** Mirroring the multi-module packages was considered
  and refused: a `public.js` re-exporting a single name is a second documentation home
  filtering nothing, and this repository has twice paid for a second home — a stale claim
  in `custom-namespace/src/config/`, and a freeze date that needed sweeping out of a
  second file.

**Consequences.**

- **`type-detection` and `function-introspection` are unaffected.** Their entries already
  resolve to a curated `public.d.ts`; the gate reaches them by a different route and
  reports the same thing.
- **`custom-namespace` is unaffected, and #097's decision stands.** One export, public,
  nothing to filter. It gains gate coverage without gaining a file.
- **`type-identity` goes RED**, correctly. Its curation decision — stop exporting the
  helper from the entry, or add a curated entry — belongs to that package's arc and is
  forced by a tool rather than by recall.
- **Sequencing: land this WITH the `type-identity` arc, not before.** The universal gate
  is red until that package is resolved, so shipping it earlier means either a red `main`
  or fixing `type-identity` blind, ahead of its own audit.
- **#085's curated-entry decision is untouched** — only the scope its gate enforces.
  #097's decision is untouched — only its generalized threshold.
- **Built artifact filenames stay divergent, deliberately.** The entry's source name
  drives the output name, so a curated package emits `public.umd.js` and a direct-entry
  one `index.umd.js`. Unifying them would buy nothing enforceable; the practice that does
  is **read `unpkg`, never assemble a `dist/` path**, which both harness scripts follow.
