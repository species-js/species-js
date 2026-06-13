# 011 — `Set<string>` primitive for shape-presence probes

**Date:** 2026-06-02 → 2026-06-03

**Context.** Early implementation used a joined-string approach:
`getOwnPropertyDescriptorsKeysSignature` returned a sorted, `_`-joined string of own keys.
Shape predicates compared these strings against fixed expected values (e.g.
`'length_name'` for an async function). The approach was too strict (rejects extras, even
legitimate ones) and not strict enough (loses descriptor-flag precision).

**Decision.** Replace the joined-string helper with `getOwnPropertyDescriptorsKeySet`,
returning `Set<string>`. Shape predicates probe membership via `.has(key)` rather than
full-set equality. The joined string is removed; the joined form can still be computed
locally as `[...keySet].sort().join('_')` if a consumer ever wants it as a hash key.

**Rationale.** Set membership matches the spec's actual guarantees. The spec promises
certain own keys _exist_ on `%AsyncFunction.prototype%`, not that they are the only keys.
A prototype with an engine-added or framework-added own property is still semantically
async. Full-set equality rejects legitimate extras; per-key membership admits them. The
Set also sidesteps the `_`-collision boundary the joined string carries (`{a_b: 1}` and
`{a: 1, b: 1}` produce the same signature).

**Consequences.** All shape predicates now use `.has('constructor')` and
`!.has('prototype')` (for async) or `.has('constructor') && .has('prototype')` (for the
generator family) instead of full-string comparison. The Set primitive is the proto-side
discriminator for the rest of the package and downstream consumers.
