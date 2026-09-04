# 098 — No `isCustomNamespace`; a namespace is recognized by reference

**Date:** 2026-09-04

**Context.** `isDictionaryObject` refuses a custom namespace (`ns/R1`), and that refusal
is correct — the brand is doing its job. The spec drew the obvious conclusion and listed a
dedicated recognizer as owed: structural, reading the null prototype, the brand and the
`String()` shape, perhaps with a realm `WeakSet` alongside it. It was deferred rather than
built, on the grounds that the shape should be settled by a consumer that exists.

With the spec frozen the shape is no longer in doubt, which raised the question again:
build it now? Asking what it would be _for_ answered it differently.

**Decision.** Do not build `isCustomNamespace`. This is a decline, not a deferral.

**Rationale.**

- **The consumer already holds the namespace.** Calling `createCustomNamespace` is how you
  get one, and the returned value is trackable by reference from that point on. A consumer
  wanting a predicate for their own namespace can write one that targets exactly that
  value — more precise than anything this package could ship.

- **A structural check cannot tell "made by us" from "made the same way".** The observable
  shape is documented, so reproducing it is six lines of ordinary JavaScript. Probed
  2026-09-04: a hand-built `Object.freeze(Object.assign(Object.create(null), …))` carrying
  the tag and a matching `Symbol.toPrimitive` passes every layer such a predicate could
  check. Unlike a `Map` or a `Promise`, a namespace has no internal slot underneath the
  shape to bottom out on — it is an ordinary frozen object wearing a name.

- **The one unspoofable layer is reference tracking under another name.** The same probe
  showed a builder-side `WeakSet` rejecting the spoof. But a `WeakSet` of what the builder
  returned is exactly the identity the caller already has; shipping it would re-implement
  the consumer's own bookkeeping inside the package and hand it back as a feature. It is
  also same-realm only, so it cannot cover the case a structural check exists for.

**Consequences.**

- The package keeps one export. `ns/R1` stands as specified, and the spec's Open items 1
  and 2 close — item 2 asked what to do if a second module earned a spec, and there is no
  second module.

- **#097's trip condition (1) stays as written but is now unlikely to fire.** It named
  this recognizer as the likeliest second module; the barrel/public split still applies if
  a second module ever arrives by another route.

- **Re-open trigger.** Two situations defeat both a reference and a `WeakSet`, leaving a
  structural brand as the only answer: a namespace passed _between packages_ as part of a
  public API, and two copies of this library in one dependency tree. Neither exists in the
  pipeline today. If either appears, build the recognizer structurally and document
  plainly that it identifies a shape, not an origin.
