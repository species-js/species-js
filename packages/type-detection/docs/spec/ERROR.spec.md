# error — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`error.d.ts` + `error.js`, both re-documented
> 2026-07-10 to the current implementation) and **confirmed by a decidability run
> 2026-07-10** — an ephemeral suite over all four public predicates + the 17 `@internal`
> helpers via the `#index` barrel, real implementations, Node 22 (V8, no native
> `Error.isError`, so the polyfill path was exercised) plus `vm` cross-realm fixtures; 41
> cases / ~90 vector-inputs, **zero corrections**. Status: **FROZEN 2026-07-10** — owner
> design review passed; the behavioral vectors are the axis-1 oracle, and post-freeze
> refinements append in place (per the thenable / evented precedent). Replaces the retired
> `ERROR.spec.md`, which described the pre-`72afe3e` tag-classifier (a different module:
> its `isGenericError` was the `@internal` polyfill union body that ADMITTED
> `DOMException`, inverted from the shipped public predicate).
>
> **Canon.** The redesign is recorded in the ADR cluster — **#065** (redesign:
> identity-capture + realm partition + three-predicate split; supersedes the #032
> structure), **#066** (stack-capability machinery; converges-not-widens; supersedes
> #033), **#067** (`DOMException` a distinct arm; `AnyError` two-armed; `DOMExceptionLike`
> cut), **#068** (`isDOMException` descriptor-kind contract; #063 own-shadow not applied),
> **#069** (`isGenericError` excludes `DOMException` by identity; partition-leak fix +
> realm asymmetry) — plus the surviving #035 (AbortError suffix) and #036 (generic
> surface) — and in `architecture/error.md` (rewritten 2026-07-10). The full canon (ADRs +
> architecture + this spec + the re-documented `.d.ts`/`.js`) is internally consistent.
>
> **Post-freeze amendment (2026-07-11 — test round).** The six-file config-driven suite
> under `test/error/` was built and the spec↔test vector diff run both ways. Two vector-ID
> refinements landed (no behavioral vector changed): `dIGEPC/R3` was split into `R3`
> (`ownKeys`-trap) + `R4` (tag-getter-throw) to name the two distinct helper-level
> throw-safe boundaries the tests pin, and the `isAnyError` helper IDs were standardized
> to the `iAE/*` abbreviation. The diff is now EMPTY in-test-not-in-spec, and
> in-spec-not-in-test is exactly six documented exclusions unreachable in the Node-22/V8
> test env or asserting nothing: `dIGEC/B1`, `dPEGF/A2`, `dPEGF/B1` (the non-stack-capable
> regime), `iCRDEI/B1` (the no-`DOMException`-realm sentinel), `isError/B2` (native
> `Error.isError`, absent here), and `isAbortError/B1` (refuses-to-claim — abort-channel
> mechanics).
>
> **Back-sweep Phase 2 (2026-07-29):** a new axis-5 completeness-oracle section for the 19
> `@@throw-safe` markers; the R2 cross-artifact pass found the canon already truthful (no
> mechanism-drift). No admit/reject vector changed, the **FROZEN 2026-07-10** oracle
> stands; see Open/resolved item #6.

## Module contract

`type-detection / error` discriminates the spec-defined error set and splits it into two
disjoint arms, then refines one arm to the abort-channel naming convention. Unlike the
thenable / evented `Like`→identity lattices, this module is a **partition plus a
refinement**:

```
                    isError  (public — native `Error.isError`, else the isAnyError polyfill)
                       │      narrows to AnyError = Error | DOMException
          ┌────────────┴────────────┐
   isGenericError              isDOMException          (public; DISJOINT arms)
   (an Error, NOT a            (any DOMException;
    DOMException)               sole generic predicate,
          │                     no *Like, no *Strict)
   isAbortError  (public — refines isError by a `name` suffix match)
```

The load-bearing invariant, verified empirically across current- and foreign-realm inputs:

> **`isError` ≡ `isGenericError` ⊎ `isDOMException`** — a disjoint, engine-independent
> cover. Every error is exactly one of the two arms, never both, never (for a well-formed
> value) neither.

Three design commitments make that cover sound:

1. **`DOMException` is not modeled as an `Error` subtype** (neither at the type level —
   see `AnyError` — nor in the runtime partition). Engines disagree on whether
   `new DOMException() instanceof Error` holds, so pinning `DOMException` as its own
   always-excluded arm keeps `isGenericError`'s membership deterministic across engines
   rather than moving with the runtime's subclass decision. This is why `AnyError` stays
   two-armed.
2. **Realm partition.** Each predicate captures its realm's `Error` / `DOMException`
   constructor-and-prototype once at module-load, validated against the spec-defined
   prototype shape, then dispatches: a current-realm value via an inexpensive throw-safe
   `instanceof` fast-path plus a structural contract, a foreign-realm value via a
   throw-safe prototype walk that matches the captured shape.
3. **Stack-graft filter (the polyfill's `[[ErrorData]]` proxy).** The `Error` arm cannot
   read the unobservable `[[ErrorData]]` slot, so it approximates it: the module probes at
   load whether the environment populates `Error` stacks at all (`ERROR_STACK_CAPABLE`)
   and, where it does, rejects error-shaped values that expose no reachable `stack` — the
   observable side effect of construction that separates a genuine error from an
   `Object.create(Error.prototype)` graft. The polyfill therefore **converges** on the
   native verdict (both reject the graft) in stack-capable engines rather than
   **widening** past it; only where no stacks are populated does the filter stand down and
   the polyfill admit grafts native would reject.

The `DOMException` arm deliberately does NOT use the stack filter — its discriminator is
the **getter shape** of `name` / `message` (WebIDL accessors backed by an internal slot),
which is engine-independent. This is what keeps `isError(new DOMException())` `true` in a
browser, where a `DOMException` carries no `stack`.

### Throw-safety (the universal invariant)

Every public predicate answers a boolean on **every** input, including hostile ones, and
never propagates a throw: `isGenericError` / `isDOMException` / `isError` / `isAbortError`
return their honest verdict on any throw on any path, and every `@internal` helper returns
its sentinel (`undefined` for the `retrieveErrorStack` reader, `false` for the boolean
probes) so the composing predicate collapses to `false`. The hostile-input classes this
module's reads are exposed to, and the throw-safe reader each routes through:

- **hasInstance-trap** (a poisoned `Symbol.hasInstance`, a throwing prototype-walk) → the
  `try/catch` inside `isCurrentRealm{GenericError,DOMException}Instance` (#060);
- **prototype-trap** (a `Proxy` whose `getPrototypeOf` throws) → `getSafePrototypeOf` in
  the alien walks;
- **descriptor-trap** (a `Proxy` whose `getOwnPropertyDescriptor` throws — on a pivoted
  `[[Prototype]]` or a hostile `constructor`) → `getNextAvailableSafeDescriptor`,
  `getVerifiedOwnName`, `isClass`, and the `hasInertGetter` reads of the DOMException
  contract;
- **ownKeys-trap** (a `Proxy` whose `ownKeys` throws) → the `try/catch`-wrapped
  `getOwnPropertyDescriptors` inside
  `doesImplement{GenericError,DOMException}PrototypeContract`;
- **accessor-throw** (a throwing `name` / `message` / `stack` getter) → the `try/catch` in
  `doesImplementMinimumErrorContract`, `retrieveErrorStack`, and
  `doesImplementDOMExceptionPrototypeContract` (which invokes the spec accessors on a live
  receiver);
- **tag-getter-throw** (a throwing `Symbol.toStringTag`) → `getTypeSignature`.

The exhaustive `hostile-class × predicate` proof lives in the test suite (axis 3), not
here — see [`./README.md`](./README.md) → "Throw-safety — the universal invariant".

## Surface inventory

**Public predicates (axis 1):** `isGenericError`, `isDOMException`, `isError` (an
`export const` — native-or-polyfill bound at module-load; typed as a function in the
`.d.ts`), `isAbortError`.

**Exported `@internal` helpers (axis 4):** seventeen.

- stack-capability internals — `retrieveErrorStack` (a reader, not a predicate; carries
  its own `mode`), `errorStackMode` (`'gated-slot' | 'plain-data'`), `ERROR_STACK_CAPABLE`
  (`boolean`), `hasReachableErrorStack`, `doesPassErrorGraftFilter`.
- structural contracts — `doesImplementMinimumErrorContract`,
  `doesImplementGenericErrorContract`, `doesImplementDOMExceptionContract`.
- prototype contracts — `doesImplementGenericErrorPrototypeContract`,
  `doesImplementDOMExceptionPrototypeContract`.
- prototype-equivalence — `isGenericErrorPrototypeEquivalent`,
  `isDOMExceptionPrototypeEquivalent`.
- realm arms — `isAlienRealmGenericError`, `isAlienRealmDOMException`,
  `isCurrentRealmGenericErrorInstance`, `isCurrentRealmDOMExceptionInstance`.
- polyfill body — `isAnyError` (the `isError` fallback; exported for tests and for callers
  wanting polyfill semantics regardless of the runtime's native `Error.isError`).

**Exported types without a predicate:** `AnyError` (`Error | DOMException`),
`DOMException` (package-owned WebIDL model, deliberately NOT `extends Error`),
`DOMExceptionLegacyCodes`, `ErrorConstructorES2025` (`@internal`), `AbortErrorName`
(`` `${string}AbortError` ``), `AbortError` (`AnyError & { name: AbortErrorName }`). No
`DOMExceptionLike` — there is no `isDOMExceptionLike` predicate (unlike thenable/evented's
`*Like` pairs), so the orphan type was cut.

Re-confirmation gate: 21 `.js` runtime exports each carry a `.d.ts` declaration, plus the
6 type-only exports above — no surface gap.

**Test-environment note:** the probe run executes in Node 22 (vitest). `Error`,
`TypeError`, `DOMException`, `AbortController` are present. Native `Error.isError` is
**absent** (Node ≥ 23 / modern browsers only), so `isError` binds to the `isAnyError`
polyfill and the polyfill path is what the axis-1 suite exercises here; the native binding
is covered runtime-agnostically (see `isError/B2`). A `vm` realm exposes foreign `Error`
(an ECMAScript intrinsic) but NOT `DOMException` (a WHATWG global, not an intrinsic), so
cross-realm `DOMException` vectors use a **foreign synthetic** — a foreign `class`
carrying the `[object DOMException]` tag plus WeakMap-backed `name` / `message` getters —
as the real-world browser `DOMException` stand-in.

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted → rejected by every public predicate (each
  leads with `!!value`, and every downstream helper is nullish-safe).
- **CC/non-error-object** — `{}`, `{ name: 'Error', message: '' }` → rejected everywhere
  (not `instanceof` the captured constructors; no prototype-equivalent level; the plain
  object's `name` / `message` are data properties, so the DOMException getter contract
  fails and — in a stack-capable engine — the generic contract's graft filter fails on the
  missing `stack`).

---

## `isGenericError`

`isGenericError<T = unknown>(value?: T): value is T & Error` Composition:
`if (!value || isCurrentRealmDOMExceptionInstance(value)) return false; if (isCurrentRealmGenericErrorInstance(value)) return doesImplementGenericErrorContract(value); return isAlienRealmGenericError(value)`
Spec basis: the Error-not-DOMException arm of the partition; **identity-first**
DOMException exclusion; the converges-not-widens graft filter (pending cluster, supersedes
#033); #036 generic surface.

**Admits**

- `isGenericError/A1` — `new Error('boom')`, `new TypeError('x')`, `new RangeError()` →
  true (current-realm `Error` instance; generic contract holds — reachable stack + string
  `name`/`message`).
- `isGenericError/A2` — `new (class extends Error {})()` → true (subclass instance is a
  current-realm `Error` instance).
- `isGenericError/A3` — an `Error` subclass with an own data `name`,
  `new (class extends Error { name = 'X'; })()` → true (`Error` is a legitimate
  data-carrier — it OWNS `name` / `message` / `stack` — so an own data `name` is not a
  tamper, unlike the DOMException case; no own-shadow guard applies, cf. #063 scope).
- `isGenericError/A4` — a cross-realm `Error` / subclass (fixture) → true (alien-realm
  walk finds an `Error.prototype`-equivalent level).

**Rejects**

- `isGenericError/R1` — `new DOMException('m', 'AbortError')` → false (current-realm
  `DOMException` instance, excluded up front by identity).
- `isGenericError/R2` — a `DOMException` subclass keeping the getter `name`,
  `new (class extends DOMException { constructor(m) { super(m, 'X'); } })('m')` → false
  (still `instanceof DOMException`; identity exclusion).
- `isGenericError/R3` — a `DOMException` subclass that FLATTENS `name` to an own data
  field, `new (class extends DOMException { name = 'X'; })('m')` → false.
  **Load-bearing:** this value's DOMException contract is broken (own data `name`), so
  `isDOMException` rejects it too — yet it is still `instanceof DOMException`, and the
  identity exclusion catches it where a contract-based exclusion would let it leak into
  the generic arm. This is the whole reason the exclusion is anchored on identity, not
  contract.
- `isGenericError/R4` — `Object.create(Error.prototype)` graft → false in a stack-capable
  engine (current-realm `Error` instance, but the generic contract's graft filter rejects
  the missing reachable `stack`). See `B1`.
- `isGenericError/R5` — `{ name: 'Error', message: '' }` → false (not `instanceof Error`;
  the alien walk finds no `Error.prototype`-equivalent level). (plus CC/nullish.)

**Testable boundaries**

- `isGenericError/B1` — the `Object.create(Error.prototype)` graft's verdict is
  environment-gated: **false** where `ERROR_STACK_CAPABLE` (the stack-graft filter rejects
  it, converging on native), **true** where the environment populates no stacks (filter
  disabled, the polyfill widens). Pinned in a stack-capable engine as `R4`; asserted
  runtime-agnostically against `ERROR_STACK_CAPABLE`.
- `isGenericError/B2` — a foreign-realm `DOMException` whose contract is broken (a
  flattened own data `name`, subclassing the foreign `Error`, carrying a reachable
  `stack`) → **true** (classified as a generic `Error`). The current-realm identity
  exclusion has no cross-realm equivalent, and the structural arm reads the value as an
  `Error`. The one accepted realm-asymmetry — see the subsection below.

**Refuses to claim**

- The `[[ErrorData]]` slot directly (unobservable) — the `Error` identity is approximated
  structurally (instanceof + graft filter + minimum duck-type).
- Exactness of the DOMException exclusion across realms — it is **exact by identity** in
  the current realm and **structural (by contract)** across realms; a broken-contract
  foreign `DOMException` is not recognized as one (`B2`).

**Cross-realm (axis 2):** admit foreign-realm `Error` + subclasses; exclude a well-formed
foreign `DOMException` (via `isAlienRealmDOMException` inside the walk); a broken-contract
foreign `DOMException` leaks as a generic `Error` (`B2`). **Spoof (axis 3):** a
current-realm `DOMException` cannot masquerade as generic (identity exclusion, robust to a
broken contract); a stackless graft is rejected (graft filter); throw-safe on
`name`/`message`/ `stack`/prototype/descriptor traps. **Composition note (axis 4):**
identity-first `isCurrentRealmDOMExceptionInstance` exclusion;
`isCurrentRealmGenericErrorInstance` + `doesImplementGenericErrorContract` fast path;
`isAlienRealmGenericError` alien fallback.

### Realm asymmetry on the DOMException exclusion (deliberate)

`isGenericError` excludes `DOMException` by two different means, and for a
**broken-contract** `DOMException` they can disagree by realm:

- **Current realm** — the exclusion is `isCurrentRealmDOMExceptionInstance` (an
  `instanceof` check against the captured `DOMException`). It reads **identity**, so it
  cannot be fooled: a subclass that flattens `name` to a data property is still
  `instanceof DOMException` and is excluded (`R3`).
- **Foreign realm** — `instanceof` cannot reach a foreign constructor, so the alien arm
  excludes structurally, via `isAlienRealmDOMException` (the getter contract + a
  prototype-equivalence walk). A foreign `DOMException` whose `name` is flattened to a
  data property fails that contract, so it is not recognized as a `DOMException` and —
  being otherwise Error-shaped, with a reachable `stack` — is classified as a generic
  `Error` (`B2`).

A **well-formed** `DOMException` of either realm is excluded; divergence appears only for
a value that is, by provenance, a `DOMException` but has broken its own identity surface.
Accepted and documented, not reconciled — the current-realm identity guard has no
cross-realm equivalent without reintroducing tag-reliance the design avoids, matching the
`isPlainObject` / evented realm-asymmetry rulings.

---

## `isDOMException`

`isDOMException<T = unknown>(value?: T): value is T & DOMException` Composition:
`!!value && isCurrentRealmDOMExceptionInstance(value) ? doesImplementDOMExceptionContract(value) : isAlienRealmDOMException(value)`
Spec basis: the `DOMException` arm of the partition — the sole generic `DOMException`
predicate (no `*Like`, no `*Strict`); the getter-shape contract (descriptor-kind policy);
`DOMException` not modeled as an `Error` subtype.

**Admits**

- `isDOMException/A1` — `new DOMException('m', 'AbortError')` → true (current-realm
  instance
  - getter contract).
- `isDOMException/A2` — a `DOMException` subclass keeping the inherited getter,
  `new (class extends DOMException { constructor(m) { super(m, 'X'); } })('m')` → true
  (the `name` / `message` getters are inherited-reachable; the idiomatic subclass keeps
  them).
- `isDOMException/A3` — an own-getter `name`,
  `Object.create(DOMException.prototype, { name: { get: () => 'X' } })` → true (a
  get-gated `name` is admitted wherever it lives, own or inherited — descriptor-kind
  policy).
- `isDOMException/A4` — a valid cross-realm `DOMException` (foreign synthetic) → true
  (alien-realm walk).
- `isDOMException/A5` — a "Chrome-style" `DOMException`: valid `name`/`message` getters
  but NO reachable `stack`,
  `Object.create(DOMException.prototype, { name: { get }, message: { get } })` → true. The
  contract is getter-shape, NOT stack, so it is engine-independent — this is what keeps
  `isError(new DOMException())` `true` in a browser (see `iAE/B1`).

**Rejects**

- `isDOMException/R1` — `new Error('x')`, `new TypeError()` → false (`name` / `message`
  are DATA properties on `Error`, not getters).
- `isDOMException/R2` — a `DOMException` subclass that FLATTENS `name` to an own data
  field, `new (class extends DOMException { name = 'X'; })('m')` → false (the own data
  `name` shadows the inherited getter; the "dumb data name" the descriptor-kind policy
  rejects).
- `isDOMException/R3` — an own-data `name`,
  `Object.create(DOMException.prototype, { name: { value: 'X' } })` → false (data
  descriptor first-match wins → not a getter).
- `isDOMException/R4` — an own-data `message`,
  `Object.create(DOMException.prototype, { message: { value: 'm' } })` → false (symmetric
  — `message` is held to the identical getter bar as `name`).
- `isDOMException/R5` — `{ name: 'AbortError', message: 'x' }` → false (data props, no
  getters, not `instanceof`, no prototype-equivalent level). (plus CC/nullish.)

**Testable boundaries**

- `isDOMException/B1` — the bare `Object.create(DOMException.prototype)` graft → **true**.
  The contract reads getter PRESENCE (`hasInertGetter`, never invoked), and the graft
  inherits the real prototype's `name`/`message` getters, so a never-constructed shell is
  admitted. Provenance / liveness is not probed current-realm (the inherited getter would
  throw if actually invoked on the graft — wrong receiver — but the contract never invokes
  it). Parallels the evented bare-graft admit; pinned as an admit, not a leak.

**Refuses to claim**

- Liveness / provenance — a bare or own-getter graft on the real prototype is admitted
  (`B1`, `A3`); the current-realm contract checks descriptor shape, never invokes the
  getter. (The cross-realm arm DOES invoke, threading a live receiver.)
- The legacy numeric `code` — deliberately not tested (discouraged; no discriminating
  value).
- Own-shadow rejection (#063) is **deliberately NOT applied** — see the descriptor-kind
  subsection.

### Descriptor-kind policy — getter admits, data rejects (the crux)

`isDOMException` accepts `name` and `message` only as **accessors** (a `get`), reachable
anywhere from the value's own slot up to the first-matching prototype (own-first,
first-match-wins, via the chain-walking `getNextAvailableSafeDescriptor`); a plain
**data** `value` is rejected wherever it sits. The rule is **symmetric** on `name` and
`message`.

Consequence: "every `DOMException` instance is admitted" precisely means "every one that
keeps its getter-backed contract". An idiomatic subclass that names itself through
`super(message, name)` keeps the inherited getter and is admitted (`A2`); one that
flattens `name` to a data field via a class field or `defineProperty` is the "dumb data
name" case and is rejected (`R2`) — even though it is a genuine `DOMException` instance
(that value lands as NEITHER arm; see `iAE/R1`).

This is why the #063 own-shadow guard is **not** applied here: #063 rejects a contract
member on OWN-KEY PRESENCE regardless of descriptor kind, which would over-reject the
own-getter `name` (`A3`) this policy deliberately admits. The getter-vs-data test is the
finer, correct discriminator for a getter-backed contract. (`isGenericError`'s own-shadow
question is separately N/A — `Error` is a data-carrier that owns its contract by design.)

**Cross-realm (axis 2):** admit a valid foreign `DOMException` (synthetic); reject a
foreign `Error`; a broken-contract foreign `DOMException` → false here (and leaks to
generic, see `isGenericError/B2`). **Spoof (axis 3):** a tag-spoof
`{ [Symbol.toStringTag]: 'DOMException' }` → false (no getters, not `instanceof`,
cross-realm prototype-equivalence fails); throw-safe. **Composition note (axis 4):**
`isCurrentRealmDOMExceptionInstance` + `doesImplementDOMExceptionContract` (getter
presence, never invoked); `isAlienRealmDOMException` walk (invokes the getters on a live
receiver via `doesImplementDOMExceptionPrototypeContract`).

---

## `isError`

`isError<T = unknown>(value?: T): value is T & AnyError` Composition (bound once at
module-load): `const isError = isFunction(nativeIsError) ? nativeIsError : isAnyError` —
native ECMA-262 `Error.isError` when the captured realm provides it, the `isAnyError`
polyfill otherwise. Spec basis: the `AnyError` union; native-or-polyfill binding;
converges-not-widens (pending cluster, supersedes #032/#033); #036 generic surface.

**Admits (native and polyfill)**

- `isError/A1` — `new Error('boom')`, `new TypeError('x')`, `new RangeError()` → true.
- `isError/A2` — `new DOMException('msg', 'XError')` → true (the DOMException arm; the
  polyfill guarantees this via the getter contract, native side per `B2`).
- `isError/A3` — subclass instances (`class X extends Error`, an idiomatic `DOMException`
  subclass) → true.
- `isError/A4` — cross-realm `Error` / `DOMException` (fixtures) → true.

**Rejects (native and polyfill)**

- `isError/R1` — `{ name: 'Error', message: '' }` → false (no slot; not `instanceof`; no
  prototype-equivalent level).
- `isError/R2` — `42`, `'Error'`, `null`, `undefined`, `{}` → false.
- `isError/R3` — the flattened-name `DOMException` subclass (`isDOMException/R2`) → false
  (a malformed `DOMException`: the DOMException arm is selected by `instanceof` then fails
  its contract, with no fall-through to the Error arm — classified as NEITHER, keeping
  `isError ≡ isGenericError ⊎ isDOMException` consistent at `false = false ⊎ false`).

**Testable boundaries**

- `isError/B1` — `Object.create(Error.prototype)` graft → environment-gated: **false**
  under native (no `[[ErrorData]]`), **false** under the polyfill in a stack-capable
  engine (graft filter, converging), **true** under the polyfill only where the
  environment populates no stacks (filter disabled, widening). In every stack-capable
  engine — native or polyfill — → false.
- `isError/B2` — native `Error.isError(new DOMException())` membership is
  **engine-dependent and not under our control**: the polyfill GUARANTEES admission
  (`A2`), but the public binding defers to native when present, and whether native admits
  a `DOMException` depends on the engine granting it `[[ErrorData]]`. Assert `A2`
  runtime-agnostically; do not bake in a native verdict. (Node 22 has no native
  `Error.isError`, so the probe run exercised the polyfill only — the guarantee side.)

**Refuses to claim**

- The `[[ErrorData]]` slot directly (native reads it; the polyfill approximates via
  structural + stack-graft) — hence the `B1` native-vs-polyfill divergence on the graft in
  a non-stack-capable engine.

**Cross-realm (axis 2):** admit foreign `Error` + `DOMException` (both arms of the
polyfill walk). **Spoof (axis 3):** grafts filtered as `B1`; throw-safe. **Composition
note (axis 4):** binds `nativeIsError` (captured, realm-fixed) or the `isAnyError`
polyfill body; the generic `T` surface is applied even though native `Error.isError` is
non-generic per its ES2025 declaration (runtime unchanged, only the type widens).

---

## `isAbortError`

`isAbortError<T = unknown>(value?: T): value is T & AbortError` Composition:
`isError(value) && isStringValue(value.name) && value.name.endsWith('AbortError')` Spec
basis: #035 — the abort-channel `name`-suffix refinement over `isError`.

**Admits**

- `isAbortError/A1` — `new DOMException('aborted', 'AbortError')` → true (`isError` true;
  `name` suffix matches).
- `isAbortError/A2` —
  `new (class TimeoutAbortError extends Error { name = 'TimeoutAbortError'; })()` → true
  (qualified prefix; suffix matches).
- `isAbortError/A3` — `Object.assign(new Error(), { name: 'AbortError' })` → true (own
  `name` override on a real `Error`).

**Rejects**

- `isAbortError/R1` — `new Error('plain')` (name `'Error'`) → false (no suffix).
- `isAbortError/R2` — `{ name: 'AbortError' }` → false (not an error — the `isError` gate
  fails).
- `isAbortError/R3` — the load-bearing string-type gate:
  `Object.defineProperty(new Error(), 'name', { value: 42 })` → false (passes `isError`,
  but `name` is not a string; the `isStringValue` gate prevents `42.endsWith` throwing).
  (plus CC/nullish.)

**Refuses to claim**

- `isAbortError/B1` — abort-channel _mechanics_: no inspection of `AbortSignal.aborted` or
  a link to an `AbortController`. Purely a `name`-suffix check; producer-side abort
  inspection belongs to the `evented` module (`isAbortSignal` / `isAbortSignalLike`).

**Composition note (axis 4):** drives `isError` + `isStringValue` (`#primitive`).

---

## Helper specification (axis 4)

### Stack-capability internals

#### `retrieveErrorStack(value)` — `@internal` (reader; carries `.mode`)

Reads a value's `stack` string, or `undefined` when none is reachable. The access strategy
is fixed once at module-load: `gated-slot` (V8 — invoke the captured `stack` getter with
`value` as receiver) or `plain-data` (read directly + `isStringValue`). Throw-safe →
`undefined`.

- `rES/A1` — `new Error()` → its `stack` string (gated-slot: the getter yields it).
- `rES/R1` — `Object.create(Error.prototype)` → `undefined` (gated-slot: the getter,
  invoked on a graft with no internal stack, yields `undefined`).
- `rES/R2` — `{ get stack() { throw new Error(); } }` → `undefined` (throw-safe).
- `rES/R3` — `{}` → `undefined`.

#### `errorStackMode` / `ERROR_STACK_CAPABLE` — `@internal` (load-time constants)

Environment-probed once at load; not per-input predicates. `errorStackMode` is
`'gated-slot'` when `Error.prototype` exposes `stack` as an accessor, `'plain-data'` when
a data property. `ERROR_STACK_CAPABLE` is `true` when throwing-and-catching a
captured-constructor `Error` yields a string `stack`. In V8 / Node:
`errorStackMode === 'gated-slot'`, `ERROR_STACK_CAPABLE === true`. Asserted against the
running engine (axis 5 / environment), not enumerated per input.

#### `hasReachableErrorStack(value)` — `@internal`

`isStringValue(retrieveErrorStack(value))`.

- `hRES/A1` — `new Error()` → true. `hRES/R1` — `Object.create(Error.prototype)` → false
  (getter yields `undefined`). `hRES/R2` — `{}` → false.

#### `doesPassErrorGraftFilter(value)` — `@internal`

`!ERROR_STACK_CAPABLE || hasReachableErrorStack(value)`.

- `dPEGF/A1` — (stack-capable) `new Error()` → true. `dPEGF/A2` — (non-stack-capable) any
  value → true (filter disabled — environment boundary). `dPEGF/R1` — (stack-capable)
  `Object.create(Error.prototype)` → false. `dPEGF/B1` — discrimination is
  environment-gated (disabled where `!ERROR_STACK_CAPABLE`).

### Structural contracts

#### `doesImplementMinimumErrorContract(value)` — `@internal`

`try { isStringValue(value.message) && isStringValue(value.name) } catch { false }`. The
floor shared by every `Error` and `DOMException`; the only claim that holds without the
prototype or a `[[Class]]` tag.

- `dIMEC/A1` — `new Error('m')` → true. `dIMEC/A2` — `new DOMException('m', 'X')` → true
  (getters yield strings). `dIMEC/A3` — `{ name: 'x', message: 'y' }` → true (the floor
  admits a plain object — the graft filter and `instanceof` gates are what tighten it).
- `dIMEC/R1` — `{ name: 'x' }` (no `message`) → false. `dIMEC/R2` —
  `Object.defineProperty(new Error(), 'name', { value: 42 })` → false (non-string `name`).
  `dIMEC/R3` — `{ get name() { throw; } }` → false (throw-safe). `dIMEC/R4` — `null` →
  false (throw-safe).

#### `doesImplementGenericErrorContract(value)` — `@internal`

`doesPassErrorGraftFilter(value) && doesImplementMinimumErrorContract(value)` — graft
filter FIRST by deliberate precedence (rejects a grafted shell before its coincidental
`name` / `message` are read).

- `dIGEC/A1` — `new Error()` → true. `dIGEC/R1` — (stack-capable)
  `Object.create(Error.prototype)` → false (graft filter). `dIGEC/R2` — (stack-capable)
  `{ name: 'x', message: 'y' }` → false (min contract alone would pass; graft filter
  rejects the missing stack). `dIGEC/B1` — `R1`/`R2` invert to `true` in a
  non-stack-capable engine.

#### `doesImplementDOMExceptionContract(value)` — `@internal`

`hasInertGetter(value, 'message') && hasInertGetter(value, 'name')` — getter PRESENCE
(chain-walked, own-first), never invoked. The descriptor-kind discriminator.

- `dIDEC/A1` — `new DOMException()` → true. `dIDEC/A2` —
  `Object.create(DOMException.prototype)` → true (inherited getters present). `dIDEC/A3` —
  an own-getter `name` → true.
- `dIDEC/R1` — `new Error()` → false (data props, no getters). `dIDEC/R2` — an own-DATA
  `name` shadowing the inherited getter → false. `dIDEC/R3` — `{}` → false.

### Prototype contracts

#### `doesImplementGenericErrorPrototypeContract(prototype)` — `@internal`

`try { own callable toString && string own name && string own message && toString.call(prototype) === 'Error' && name === 'Error' && message === '' } catch { false }`.
Pins the ROOT `Error.prototype` values, so it identifies `Error.prototype` ITSELF, not any
error-named prototype.

- `dIGEPC/A1` — `Error.prototype` → true. `dIGEPC/R1` — `TypeError.prototype` → false (own
  `name` is `'TypeError'`; `toString.call` → `'TypeError'`). `dIGEPC/R2` —
  `Object.prototype` → false. `dIGEPC/R3` — a `Proxy` prototype whose `ownKeys` trap
  throws → false, not thrown (the `getOwnPropertyDescriptors` try/catch — a helper-level
  boundary; the public path fails the graft filter first). `dIGEPC/R4` — a prototype whose
  `Symbol.toStringTag` getter throws → false, not thrown (`getTypeSignature` throw-safe;
  helper-level for the same reason).

#### `doesImplementDOMExceptionPrototypeContract(prototype, value)` — `@internal`

`try { name is a getter (no setter) yielding a string when invoked as name.get.call(value) && message likewise } catch { false }`.
Invokes the spec accessors on the live `value` receiver; pins no specific strings.

- `dIDEPC/A1` — `(DOMException.prototype, new DOMException())` → true. `dIDEPC/R1` —
  `(Error.prototype, new Error())` → false (`name`/`message` are data, no getter).
  `dIDEPC/R2` — `(DOMException.prototype, {})` → false (the getter, invoked on a
  non-DOMException receiver, throws → `try/catch` → false — the very reason a live
  receiver must be threaded). `dIDEPC/R3` — a prototype whose `name` getter also has a
  setter → false (readonly-accessor shape required).

### Prototype-equivalence

#### `isGenericErrorPrototypeEquivalent(prototype, constructor)` — `@internal`

`getTypeSignature(prototype) === '[object Object]' && getVerifiedOwnName(constructor) === 'Error' && isClass(constructor) && getNextAvailableSafeDescriptor(constructor, 'prototype')?.value === prototype && doesImplementGenericErrorPrototypeContract(prototype)`.

- `iGEPE/A1` — `(Error.prototype, Error)` → true. `iGEPE/R1` —
  `(TypeError.prototype, TypeError)` → false (prototype-contract pins the root values —
  `name 'TypeError'`). `iGEPE/R2` — `(Error.prototype, function Error() {})` → false
  (`isClass` fails — a plain function has a writable `prototype`). `iGEPE/R3` — a
  prototype tagging `'[object DOMException]'` → false (tag mismatch).

#### `isDOMExceptionPrototypeEquivalent(prototype, constructor, value)` — `@internal`

`getTypeSignature(prototype) === '[object DOMException]' && getVerifiedOwnName(constructor) === 'DOMException' && isClass(constructor) && getNextAvailableSafeDescriptor(constructor, 'prototype')?.value === prototype && doesImplementDOMExceptionPrototypeContract(prototype, value)`.

- `iDEPE/A1` — `(DOMException.prototype, DOMException, new DOMException())` → true.
  `iDEPE/R1` — `(Error.prototype, Error, new Error())` → false (tag `'[object Object]'`;
  name `'Error'`). `iDEPE/R2` — `(DOMException.prototype, DOMException, {})` → false (the
  prototype contract's getter invocation on a `{}` receiver throws → false).

### Realm arms

#### `isAlienRealmGenericError(value)` — `@internal`

`if (!value || !doesImplementGenericErrorContract(value) || isAlienRealmDOMException(value)) return false;`
then walk the chain, reading each level's OWN `constructor` back-reference, for an
`isGenericErrorPrototypeEquivalent` level. The `|| isAlienRealmDOMException` exclusion is
mandatory — where `DOMException` subclasses `Error` it also passes the generic contract.

- `iARGE/A1` — a foreign `Error` / `TypeError` / subclass (fixture) → true. `iARGE/R1` — a
  valid foreign `DOMException` → false (`isAlienRealmDOMException` excludes). `iARGE/R2` —
  a foreign plain object → false (no `Error.prototype`-equivalent level). `iARGE/B1` — a
  foreign FLATTENED `DOMException` (broken contract, subclass of foreign `Error`,
  reachable stack) → true (the accepted asymmetry — the exclusion is contract-gated and
  the broken contract slips past; cf. `isGenericError/B2`).

#### `isAlienRealmDOMException(value)` — `@internal`

`if (!value || !doesImplementDOMExceptionContract(value)) return false;` then walk for an
`isDOMExceptionPrototypeEquivalent` level, threading the ORIGINAL root `value` as the
getter receiver (the walked node must never be the receiver).

- `iARDE/A1` — a valid foreign `DOMException` synthetic → true. `iARDE/R1` — a foreign
  `Error` → false (no getters). `iARDE/R2` — a foreign flattened `DOMException` (own data
  `name`) → false (contract fails).

#### `isCurrentRealmGenericErrorInstance(value)` — `@internal`

`try { value instanceof GenericErrorConstructor } catch { false }`. Subclass-admitting;
admits current-realm `DOMException` where it subclasses `Error` (the caller subtracts
that).

- `iCRGEI/A1` — `new Error`, `new TypeError`, a subclass → true. `iCRGEI/A2` —
  `new DOMException()` in Node → true (`instanceof Error`). `iCRGEI/R1` — a foreign
  `Error` → false (local capture). `iCRGEI/R2` — `{}` → false.

#### `isCurrentRealmDOMExceptionInstance(value)` — `@internal`

`try { value instanceof DOMExceptionConstructor } catch { false }`.

- `iCRDEI/A1` — `new DOMException()`, a `DOMException` subclass → true. `iCRDEI/A2` —
  `Object.create(DOMException.prototype)` → true (proto chain). `iCRDEI/R1` —
  `new Error()` → false. `iCRDEI/R2` — a foreign `DOMException` synthetic → false (local
  capture). `iCRDEI/B1` — a realm without `DOMException`: the capture is the
  `INSTANCE_LESS_CONSTRUCTOR` sentinel (#060), so this is uniformly `false` without
  throwing.

### Polyfill body

#### `isAnyError(value)` — `@internal` (the `isError` fallback)

`!!value && isCurrentRealmDOMExceptionInstance(value) ? doesImplementDOMExceptionContract(value) : isCurrentRealmGenericErrorInstance(value) ? doesImplementGenericErrorContract(value) : isAlienRealmDOMException(value) || isAlienRealmGenericError(value)`.
DOMException arm ordered FIRST (a Node `DOMException` is also `instanceof Error`, so the
more specific arm must win); admits both arms, so no cross-exclusion.

- `iAE/A1` — `new Error`, `new DOMException`, subclasses → true. `iAE/A2` — cross-realm
  `Error` / `DOMException` → true. `iAE/R1` — the flattened-name `DOMException` subclass →
  false (DOMException arm selected by `instanceof`, contract fails, no fall-through — the
  value is NEITHER; = `isError/R3`). `iAE/R2` — (stack-capable)
  `Object.create(Error.prototype)` → false (graft filter). `iAE/R3` — `{}`, `null` →
  false.
- `iAE/B1` — a "Chrome-style" `DOMException` (valid getters, NO reachable stack) →
  **true**. The DOMException arm uses `doesImplementDOMExceptionContract` (getter shape),
  NOT the stack contract, so a stackless-but-valid `DOMException` is admitted — the
  engine-independence that keeps `isError(new DOMException())` true in a browser.
  (Contrast: routing DOMExceptions through the generic/stack contract would reject them in
  Chrome — a rejected design.)

---

## Throw-safety (axis 5) — completeness oracle

The module marks **19** exports `@@throw-safe` (ADRs #073, #076): each must answer its
sentinel (`undefined` for the `retrieveErrorStack` reader, `false` for the boolean probes)
on every hostile input and never propagate a throw. This is the module surface's
realization of the universal throw-safety invariant (see the Module contract's
_Throw-safety_ paragraph). The marked set is the completeness oracle — the axis-5
`hostile × marked-export` matrix the test round builds must score exactly this set (source
order):

`retrieveErrorStack`, `hasReachableErrorStack`, `doesPassErrorGraftFilter`,
`doesImplementMinimumErrorContract`, `doesImplementGenericErrorContract`,
`doesImplementDOMExceptionContract`, `doesImplementGenericErrorPrototypeContract`,
`doesImplementDOMExceptionPrototypeContract`, `isGenericErrorPrototypeEquivalent`,
`isDOMExceptionPrototypeEquivalent`, `isAlienRealmGenericError`,
`isAlienRealmDOMException`, `isCurrentRealmGenericErrorInstance`,
`isCurrentRealmDOMExceptionInstance`, `isGenericError`, `isDOMException`, `isAnyError`,
`isError`, `isAbortError`.

The marked set is **19 of the 21 runtime exports** — the 4 public predicates PLUS 15 of
the 17 `@internal` helpers. The two omitted are the load-time value constants
`errorStackMode` (`'gated-slot' | 'plain-data'`) and `ERROR_STACK_CAPABLE` (`boolean`):
plain probed values, not per-input readers, so they carry no throw surface to mark (they
are asserted against the running engine — the axis-5 / environment concern, see the helper
spec). Two of the marked exports are `export const` bindings, not `export function` —
`retrieveErrorStack` (a reader carrying its own `.mode`) and `isError` (native-or-polyfill
bound at load) — so the source marker parse matches `export (function|const)`.

The four public predicates additionally carry the honest by-contract verdict per hostile
class (the axis-3 `hostile × predicate` matrix, `throw-safety.test.js`). Axis-5 extends
that suite to the 15 marked `@internal` helpers, routing the hostile value into each
export's own read surface (several gate on a threaded `isClass` constructor / receiver, so
a naive single-value call would short-circuit before the hostile value reached the
throwing read), and triple-locks the scored set against BOTH the `@@throw-safe` markers
parsed from `src/error.js` (source drift) AND the imported set (test drift). Source,
oracle, and tests are triple-locked. The `ownKeys` trap and `tag-getter-throw` classes
stay additionally pinned as the helper-level `dIGEPC/R3`, `dIGEPC/R4`, `dIDEPC/R2`
boundaries (the public path fails the graft-filter / getter-presence gate before the
prototype-contract walk runs).

---

## Open / resolved items

1. **Own-shadow guard NOT applied to `isDOMException` — RESOLVED.** #063 rejects a
   contract member on own-KEY presence regardless of descriptor kind; the DOMException
   policy is descriptor-KIND based (getter admits, data rejects). #063 would over-reject
   the own-getter `name` (`isDOMException/A3`) the policy deliberately admits, so the
   getter-vs-data contract is the correct, finer discriminator. `isGenericError`'s
   own-shadow question is separately N/A (`Error` is a data-carrier that owns its
   contract).

2. **Flattened-name `DOMException` classified as NEITHER (current realm) — RESOLVED.** Via
   the identity-first exclusion in `isGenericError` (`R3`) plus the DOMException contract
   rejection (`isDOMException/R2`): the value is neither a generic error nor a
   `DOMException` (`isError/R3`, `iAE/R1`), preserving
   `isError ≡ isGenericError ⊎ isDOMException`. The FOREIGN counterpart is classified as a
   generic `Error` (`isGenericError/B2`, `iARGE/B1`) — the accepted realm-asymmetry
   (identity current-realm / structural cross-realm), documented not reconciled.

3. **Native `Error.isError(new DOMException())` — POLICY FLAG (open, environment).**
   Membership is engine-dependent and not under our control; the polyfill guarantees
   admission. Assert `isError/A2` runtime-agnostically; the native path could diverge in
   an engine that withholds `[[ErrorData]]` from `DOMException`. Verify per-engine at
   axis-2/browser time; do not freeze a native verdict.

4. **`GenericError` type alias — OPEN (owner decision).** Whether to add a package-owned
   `type GenericError = Error` to regularize the family (`isGenericError → GenericError`,
   matching `isDOMException → DOMException`, `isError/isAnyError → AnyError`) and let
   `AnyError = GenericError | DOMException`. Nominal (TS has no negation; `Error` already
   excludes `DOMException` structurally), so it changes no vector — a documentation /
   symmetry call.

5. **Canon complete — RESOLVED.** The redesign is recorded in ADRs #065–#069 (#065
   redesign
   - partition, #066 stack machinery / converges-not-widens, #067 `DOMException` distinct
     arm / `AnyError` two-armed, #068 `isDOMException` descriptor-kind contract, #069
     `isGenericError` identity exclusion), with the surviving #035 / #036, and in
     `architecture/error.md` (rewritten 2026-07-10). This spec cites the real ADR numbers;
     the full canon (ADRs + architecture + this spec + the re-documented `.d.ts`/`.js`) is
     internally consistent.

6. **Back-sweep Phase 2 (docs + tests, 2026-07-29) — RESOLVED.** Finalizing `error` under
   the standards invented after it shipped (the back-sweep). The cross-artifact R2 pass
   found the canon already truthful — no stale mechanism-descriptions (unlike `thenable` /
   `evented`): the ADR cluster + the 2026-07-10 architecture rewrite kept
   spec/`.js`/`.d.ts`/architecture aligned (verified the Error/DOMException capture
   descriptions and the composition tables against the shipped code). The one owed item
   was the **axis-5 completeness-oracle section** (above), documenting the 19
   `@@throw-safe` marked exports as the triple-locked oracle the upgraded
   `throw-safety.test.js` scores — the parallel to the function/thenable/object/evented
   sections. No admit/reject verdict changed; the FROZEN oracle stands. No ADR
   (mechanical + the package-wide #076 marker convention on a module that predated it).
   Items 3–4 remain open owner policy flags.

FROZEN 2026-07-10 — decidability run passed (see the header) and owner design review
complete. Items 3–4 remain open policy flags that bind no behavioral vector (item 3
environment-dependent, item 4 a nominal type-symmetry call); items 5–6 resolved. Base for
the axis-1 suite; axes 2–4 derive alongside.
