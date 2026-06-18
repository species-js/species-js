# 052 — `Promise` prototype-graft is structurally unsealable; accept-and-document

**Date:** 2026-06-18

**Context.** The boxed-primitive predicates close the prototype-graft spoofing surface —
`Object.create(String.prototype)` and similar — with an engine-attested `[[XData]]`
internal-slot probe (decision #042): a captured `X.prototype.valueOf.call(value)` that
throws on any receiver lacking the slot. The slot cannot be forged from userland, so the
probe is the spoof-proof bottom seal.

`isPromise` has no analogous seal. A value built as `Object.create(Promise.prototype)`
inherits everything the structural markers read — the `Symbol.toStringTag` data property
(`'Promise'`), the `then` / `catch` / `finally` methods, and `Promise.prototype` as its
`[[Prototype]]` — yet carries no `[[PromiseState]]` internal slot. It therefore passes
every marker `isPromise` applies: the local-realm arm (`instanceof Promise` +
`getPrototypeOf === Promise.prototype`), and, were it to reach the cross-realm arm, the
`[[Class]]` tag, the constructor-name walk, and `doesMatchPromiseContract`. The spec
captured this as vector `isPromise/B2` in `THENABLE.spec.md` and re-surfaced it while
drafting `PRIMITIVE.spec.md`, where the contrast is sharp: the boxed predicates reject the
analogous graft, `isPromise` admits it.

The question raised: can the `Promise` graft be sealed the way boxed primitives are?

**Decision.** No — accept-and-document. `isThenable`, `isPromiseLike`, and `isPromise`
admit the `Object.create(Promise.prototype)` graft as a known structural boundary.
Structural detection verifies _shape, not liveness_: the graft is Promise-shaped and will
throw the instant anyone `await`s or `.then`s it, so admitting it as Promise-shaped is
honest. A `then`-invocation probe is rejected, and host-backed hardening is deferred (see
Q.005).

The decision rests on a general principle worth stating once:

> A runtime type is **structurally sealable** against prototype-graft spoofing if and only
> if it exposes an **inert** prototype accessor or method — side-effect-free, invoking no
> user code — that reads one of its characteristic internal slots and throws on an
> incompatible receiver. Such a method is a spoof-proof bottom seal: the slot cannot be
> forged from userland, and the inert read can run during type-inspection without
> violating the inspect-without-invoke contract.

By this principle most slot-bearing built-ins are sealable, and `Promise` is a rare
exception. Empirically confirmed 2026-06-18:

| Type             | Inert slot reader                          | Graft sealable? |
| ---------------- | ------------------------------------------ | --------------- |
| boxed primitives | `X.prototype.valueOf` (`[[XData]]`)        | yes (#042)      |
| `Map` / `Set`    | `get size` (`[[MapData]]` / `[[SetData]]`) | yes             |
| `Date`           | `getTime` / `valueOf` (`[[DateValue]]`)    | yes             |
| `WeakRef`        | `deref` (`[[WeakRefTarget]]`)              | yes             |
| **`Promise`**    | **none**                                   | **no**          |

`Object.getOwnPropertyNames`/`getOwnPropertySymbols(Promise.prototype)` yields **zero
accessors**. The only methods that read `[[PromiseState]]` are `then` / `catch` /
`finally`, and they are **not inert**: while the `IsPromise(this)` receiver check throws
_before_ any side effect (so `then.call(graft)` does throw), the success path on a genuine
promise runs `SpeciesConstructor` — reading `this.constructor` and
`this.constructor[Symbol.species]`, i.e. arbitrary user code (verified: an overridden
`@@species` getter fires) — allocates a derived promise, and schedules a microtask if the
promise is settled.

**Rationale.**

- **Inspect-without-invoke outranks closing a benign graft.** Using `then` as a slot probe
  would turn `isPromise` into a side-effecting operation that invokes arbitrary user code
  on hostile inputs — the exact failure the package's inert-method discipline (decision
  #021, `hasInertMethod`) exists to prevent. That is a worse contract violation than
  admitting a graft that is itself inert and harmless.
- **The graft is harmless and self-revealing.** A `Promise.prototype`-grafted object with
  no `[[PromiseState]]` throws on first real use. Admitting it as "Promise-shaped" matches
  what structural detection promises: it reads structure, it does not certify liveness or
  engine-internal state that has no inert observation path.
- **The principle generalizes the boxed-primitive seal rather than special-casing
  `Promise`.** It explains _why_ #042 works (boxed primitives have `valueOf`) and predicts
  which future predicates can gain a slot-seal (`isMap` / `isSet` / `isDate` /
  `isWeakRef`, via their inert accessors) and which cannot (`Promise`). The asymmetry is a
  property of the spec surface, not of this package's implementation choices.

**Consequences.**

- `THENABLE.spec.md` vector `isPromise/B2` (and the related `isThenable/B3`,
  `isPromiseLike/B2`) stands as a documented structural boundary citing this decision; no
  code change. `PRIMITIVE.spec.md` cites this decision for the boxed-vs-Promise contrast.
- The sealability principle is recorded as a cross-cutting pattern in
  [`../architecture/README.md`](../architecture/README.md) and applied in
  [`../architecture/thenable.md`](../architecture/thenable.md).
- Future slot-bearing predicates (`isMap`, `isSet`, `isDate`, `isWeakRef`, …) should reach
  for their inert slot accessor as the bottom seal, mirroring #042.
- A host-backed hardening tier (e.g. Node `util.types.isPromise`, a C++ slot check) exists
  but is environment-divergent — it would reject the graft in Node and admit it in
  browsers. Deferred to Q.005; if adopted it belongs in an opt-in downstream adapter, not
  in the portable ES2020-floor foundation.

Docs-only decision; no runtime change. Empirical confirmation captured in the
[[boxed-primitive-discrimination]] memory and `THENABLE.spec.md` / `PRIMITIVE.spec.md`.
