# 056 — `getDefinedConstructor` routed through `getInertDescriptor`; the "honest throw" retracted

**Date:** 2026-06-23

**Context.** Decision #047 rewrote `getDefinedConstructor` as an inert pivot-and-walk —
"inert" meaning it never INVOKES an accessor getter (it reads descriptors). But it left
the descriptor walk itself RAW: both stages called `getNextAvailablePropertyDescriptor`
directly, which propagates any throw from a hostile `getOwnPropertyDescriptor` /
`getPrototypeOf` Proxy-trap. A doc note rationalized this as callers "wanting the honest
throw."

The throw-safety campaign that followed hardened every OTHER introspection surface — the
`#029` spec-defined-accessor trust boundary was extended to the descriptor-walk reads via
the private `getInertDescriptor` (a `try/catch` wrapper around
`getNextAvailablePropertyDescriptor`) used by the inert probes, and `getTypeSignature` and
the thenable `instanceof` reads were wrapped. `getDefinedConstructor`'s walk was the lone
residual.

Adversarial analysis then confirmed the residual is a real defect, not a stylistic choice.
A value with an own `Symbol.toStringTag` of `'Promise'` and an own
`then`/`catch`/`finally` contract, whose `[[Prototype]]` is a `Proxy` with a throwing
`getOwnPropertyDescriptor` trap, makes `isPromise` **throw** — its cross-realm arm calls
`getDefinedConstructorName` → `getDefinedConstructor`, whose raw walk pivots into the
hostile proto and propagates. That violates the spec's own throw-safety commitment
(`isPromise/B3`: a predicate answers, it does not throw), and the same gap is inherited by
every constructor-walk consumer: `isPlainObject` / `isDictionaryObject` (`@/object`), the
async/generator predicates (`@/function`), the boxed-primitive checks (`@/primitive`), and
`@/evented`.

**Decision.** Route both of `getDefinedConstructor`'s descriptor reads through the
existing throw-safe `getInertDescriptor` instead of the raw
`getNextAvailablePropertyDescriptor`. A hostile trap now yields `undefined` ("no reachable
constructor") rather than propagating. The "honest throw" stance is **retracted**.

```js
const creator = getInertDescriptor(type, 'constructor')?.value ?? null;
// …generator-family meta-walk…
const constructor = getInertDescriptor(creator, 'constructor')?.value;
```

**Rationale.**

- **`undefined` is the contract-consistent answer, and the more honest one.**
  `getDefinedConstructor` already returns `undefined` for every other "not reachable" case
  — `Object.create(null)`, a tampered or non-function `constructor`, no reachable
  constructor at all. A hostile trap that blocks the walk is simply another instance of
  "could not determine a constructor." Throwing was an inconsistent carve-out: it singled
  out one flavor of "couldn't determine" for exceptional control flow. "Honest" means
  accurately reporting what was structurally determinable; `undefined` says exactly that.
  A throw reports the same truth via an unhandled escape that leaks an implementation
  detail (that introspection used `getOwnPropertyDescriptor` and a trap fired) onto every
  caller.

- **No consumer wanted the throw.** Every `getDefinedConstructor` /
  `getDefinedConstructorName` call site treats `undefined` as "fall through / not this
  type" — verified across `@/thenable`, `@/object`, `@/function`, `@/primitive`,
  `@/evented`. The throw had zero beneficiaries; it only forced (or, where absent, failed
  to force) defensive `try/catch` at each predicate.

- **Consistency with the package's own posture.** This is the `#029` trust boundary — the
  very principle that produced `getInertDescriptor`. Applying it to the constructor walk
  removes the one place the posture was left unapplied; it is not a new departure.

- **A true drop-in, masking nothing.** `getInertDescriptor` has the identical signature
  and return (`PropertyDescriptor | undefined`); on non-hostile inputs it returns exactly
  what the raw walk returns. The only throws on the walk come from hostile Proxy traps (a
  normal `getOwnPropertyDescriptor` / `getPrototypeOf` cannot throw), so no legitimate
  exception is swallowed. `try/catch` is effectively free on the no-throw path.

**Consequences.**

- **`isPromise` is now throw-safe** on this surface — the constructor-walk was its last
  unguarded throw site (after the `getTypeSignature` and `instanceof` wraps). New spec
  vector `isPromise/B5` + an adversarial test pin it.

- **Every constructor-walk consumer becomes throw-safe for free** — `@/object`,
  `@/function`, `@/primitive`, `@/evented`. Their rounds should assert the analogous
  throw-safety vector rather than re-fixing it; the one-change root fix replaces the
  per-module wrapping that would otherwise have been needed.

- **No behavioral change on legitimate inputs.** `getInertDescriptor` equals the raw walk
  except on throwing traps, so no admit/reject verdict and no spec vector beyond the new
  `isPromise/B5` changes. This is a robustness fix, not a contract change.

- **Doc corrections.** `getInertDescriptor`'s note that "the raw walk stays unguarded for
  callers (e.g. `getDefinedConstructor`) that want the honest throw" is retracted;
  `getDefinedConstructor` (`.js` + `.d.ts`) now documents the throw-safe behavior. The
  `#047`-era honest-throw doc stance (a defensive doc-only response to audit item F2.1) is
  superseded.

- **Raw `getNextAvailablePropertyDescriptor` is retained** as the building block of
  `getInertDescriptor` and for `getValidatedStandardConstructorAndPrototypeTuple`, which
  supplies its own `try/catch` around the walk.

Builds on #047 (pivot-and-walk inertness), #029 (trust boundary), and #024
(`hasInertMethod` / `getInertDescriptor` lineage). Independent of #055 (registry keying);
together #055 + #056 close the two adversarial findings from the thenable post-freeze
round.

Commit: _pending_ (batched with the thenable structural-equivalence refactor).
