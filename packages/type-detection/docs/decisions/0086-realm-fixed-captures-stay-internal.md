# 086 — Realm-fixed captures stay `@internal`; each package captures its own

**Date:** 2026-08-06

**Context.** #085 curated the package root, which turned a previously invisible coupling
into a compile error: `@species-js/function-introspection` imported
`getOwnPropertyDescriptors` from this package, and that export is `@internal`. Under the
star barrel it had been reachable, so nothing ever said otherwise; the moment the surface
was named, `tsc` reported `TS2724`.

That forced a question the package had never had to answer. `#config` holds 8 public
exports and 23 `@internal` ones, and the split is not arbitrary: everything public is a
**value-add** — the four descriptor presets, the two shape types, and the two retypes
(`objectHasOwn`, which falls back to a cached `hasOwn` below the ES2021 floor, and
`objectCreate`, which closes a lib `any`-gap). Everything internal is a **raw realm-fixed
capture** of a platform native, plus two module-scope sentinels.

> **Census updated 2026-08-19 — the decision itself is untouched.** The two counts above
> are as of this record's date and have since moved on the public side. The descriptor
> rework replaced the four presets with ten and gave each a paired `*Options` interface,
> so `#config` now exposes **24 public entries — 12 values (the ten presets,
> `objectHasOwn`, `objectCreate`) and 12 types (the ten `*Options` interfaces,
> `BlankType`, `BlankDictionary`) — against the same 23 `@internal` exports**, 47 in
> total.
>
> The magnitude is not what this decision rests on; the **shape** of the split is, and
> that is unchanged. Every one of the 24 public entries is still a value-add — a curated
> preset, the type that pins its flags, a shape vocabulary, or a retype. No raw
> realm-fixed capture has crossed the line, and the `@internal` side has neither grown nor
> shrunk.

`getOwnPropertyDescriptors` was briefly promoted to public. It sat alone as the only raw
capture among the value-adds, with the singular `getOwnPropertyDescriptor` beside it
staying internal and no principle separating the two. **The exception was not a design; it
was the footprint of the one downstream file that happened to need it.**

**Decision.** Raw realm-fixed captures of platform natives **stay `@internal`**. A package
that needs one **captures it itself**, in its own `#config`.

A cross-package edge is earned only by a value that carries **identity** — a sentinel
compared by reference, a registry, a token — or by a genuine **value-add**: a retype, a
polyfill fallback, a curated preset. A property read off `Object` is neither.

**Rationale.**

- **Idempotence versus identity — this is the whole distinction.** Capturing
  `Object.getOwnPropertyDescriptors` in two packages yields **the very same function
  object**. Capturing twice cannot diverge, so there is no shared state to centralize and
  nothing that can drift. A sentinel is the opposite: #064's companion ruling homed
  `INSTANCE_LESS_CONSTRUCTOR` in `#config` precisely because it had been defined in two
  modules, and a value compared by `!==` with two definitions is a latent
  identity-mismatch landmine even while currently self-consistent. **Duplicate what is
  idempotent; centralize what carries identity.**
- **The cost asymmetry runs the wrong way for promotion.** A public export is a permanent
  contract binding six planned dependents under Hyrum's law, and #085 has just made that
  surface deliberate. The alternative it would save is _one line_ — in a `#config` module
  every package needs anyway, since reading intrinsics through a captured `globalThis` is
  what works around module runners (vitest among them) that fail to resolve a bare
  intrinsic inside a project module's scope.
- **type-detection is a type-detection library, not a utility belt.** The platform's
  natives are the platform's. Exporting them because a neighbor found them handy is scope
  creep dressed as convenience, and it would erode the public/internal line #085 just
  drew.
- **A shared `@species-js/platform` package is rejected.** A package whose entire content
  is one-line re-exports of globals costs more than the duplication it removes, and it
  plants a new dependency at the very bottom of the load graph — exactly where #070's
  temporal-dead-zone crash lived.
- **The one case that would reverse this**, named so it is recognizable rather than
  rediscovered: a capture that needs a **fallback or polyfill decision**, the way
  `objectHasOwn` chooses between `Object.hasOwn` and the cached `hasOwn`. That is a
  value-add, and it belongs in one place so every consumer inherits the same choice.

**Consequences.**

- `getOwnPropertyDescriptors` is `@internal` again, restored byte-exactly so the
  promote-and-revert leaves no trace and the export matches its twenty sibling captures.
  `function-introspection` captures its own in `#config`, with the reasoning recorded at
  the symbol so the next reader does not "fix" it back into a cross-package import.
- **The promotion was not wasted — it exposed a defect in #085's gate.** The doc block
  written for the public version explained that the _singular_ form stays `@internal`, and
  the classifier matched the tag anywhere in a block, so it silently re-hid the very
  export being promoted. Recorded in #085's Consequences; the tag now counts only in tag
  position.
- `#config`'s public API is unchanged by this decision and now has a statable rule rather
  than a list: the **value-adds** downstream should use, never the raw captures or the
  sentinels. This sharpens the two-tier framing reached in the `CONFIG.spec`
  reconciliation of 2026-07-29.
- **Forward rule for the remaining four packages** (`type-identity`, `custom-domain`, and
  the downstream projects): each owns its realm-fixed captures. Reach across a package
  boundary only for identity or a value-add, and expect the curated surface to say no
  otherwise — which is now a compile error rather than a convention.
- Relates to #075 (`config` as a runtime leaf) and #064 (shape carriers and the
  single-identity ruling). Builds on #085, whose curation surfaced the question at all.
