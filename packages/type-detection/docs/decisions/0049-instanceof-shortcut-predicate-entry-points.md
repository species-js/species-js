# 049 — Local-realm `instanceof` at predicate entry points, per-case shape

**Date:** 2026-06-14

**Context.** Several public predicates lacked a same-realm identity fast path entirely.
`isThenable` ran a structural descriptor walk on every input. The five boxed-primitive
predicates ran a four-marker structural chain (`isObject` + `[[Class]]` tag + resolved
constructor name + `[[XData]]` slot probe) on every input. The chain is correct, but on
the common local-realm case it pays the cost of the tag read and the constructor walk
before reaching the engine-attested seal — even when a single prototype walk
(`instanceof X` against a realm-fixed capture) would settle the identity question in O(1).

The existing fast-path pattern was already canon elsewhere:

- `isPromiseLike`, `isEventTargetLike`, `isAbortSignalLike` use `value instanceof X` with
  a structural fallback (`Like` variants admit subclasses).
- The async / generator function species use `value instanceof %X%` against the captured
  intrinsic with `hasXxxFunctionShape` as fallback.
- `isError` composes `value instanceof Error || doesMatchErrorContract(value)`.
- `isPlainObject`, `isPlainOrDictionaryObject` use
  `getPrototypeOf(value) === Object.prototype` (the proto-identity equivalent — more
  spec-correct than `instanceof Object`).

The thenable and boxed-primitive predicates were the remaining surface that hadn't picked
up an entry-point identity shortcut.

A naive "add `instanceof X` to every predicate that lacks one" is wrong. Each predicate's
contract — subclass admission vs. subclass rejection, identity-bearing vs. structural
narrowing target, real constructor vs. factory function — determines what the shortcut
should look like (or whether it should exist at all).

**Decision.** Apply a local-realm `instanceof` shortcut at the public entry point of
predicates that lack one, with the shape varying per case along three axes:

1. **Bare `instanceof X`** — used by subclass-admitting predicates. The shortcut is a
   sufficient short-circuit; the structural fallback handles everything else. Applied to:
   - **`isThenable`** — `(value instanceof Promise) || hasInertMethod(value, 'then')`.
     Every `Promise` is a _thenable_ (`then` lives on `Promise.prototype`); the
     implication does not run the other way, so the `instanceof` arm admits but does not
     define.

2. **`instanceof X && getPrototypeOf(value) === X.prototype`** — used by
   subclass-rejecting predicates. The pair preserves the strict narrowing the existing
   structural chain provided (subclasses pass `instanceof` but fail proto-identity), in
   O(1). Applied to:
   - **`isBoxedString`**, **`isBoxedNumber`**, **`isBoxedBoolean`** — two-branch identity
     check: the local-realm `instanceof + proto-identity` pair, or the cross-realm
     `[[Class]]` tag + resolved constructor name. The `[[XData]]` slot probe seals either
     branch (engine-attested, spoof-proof).

3. **No `instanceof` shortcut** — used when the intrinsic is a factory function rather
   than a constructor. `new X()` throws, and although `Object(X(...)) instanceof X`
   returns `true` under the default `OrdinaryHasInstance` algorithm, that result is
   incidental to prototype-chain walking rather than a meaningful identity test. Applied
   to:
   - **`isBoxedSymbol`**, **`isBoxedBigInt`** — four-marker structural chain unchanged.

**Rationale.** Three forces converge:

- **The public entry point is where the shortcut belongs.** Cascading through a `Like`
  sibling (as `isPromise` does through `isPromiseLike`) provides the `instanceof`
  admission but still runs the strict markers afterward — wasted work when the local-realm
  pair could have settled the case directly. For predicates with no `Like` sibling
  (`isThenable`, the five boxed predicates), there was no inherited shortcut at all. The
  entry point is where the case-specific shape is decided and where the hot-path cost is
  paid.

- **Subclass policy decides the shape.** A subclass-admitting predicate (`isThenable`,
  `isPromiseLike`) is happy with bare `instanceof`; a subclass-rejecting predicate
  (`isBoxedString`) needs proto-identity on top to preserve strictness. There is no single
  pattern that solves each case equally — the contract decides.

- **Factory functions are not constructors.** `Symbol` and `BigInt` cannot be invoked with
  `new`. `Object(Symbol('x')) instanceof Symbol` returns `true` only because
  `Function.prototype[@@hasInstance]` walks the prototype chain regardless of whether the
  function on the right is `new`-callable. Treating that result as a meaningful identity
  check would lean on a coincidence of the default algorithm rather than on a deliberate
  spec-level identity relation. The four-marker structural chain is the honest
  discriminator for these families.

**Consequences.** Observable behavior is unchanged across all six predicates: `isThenable`
admits the same set as before, the five boxed predicates admit the same set as before. The
local-realm hot path on `isBoxedString` / `isBoxedNumber` / `isBoxedBoolean` is faster —
the tag computation and constructor walk are skipped when the local-realm
`instanceof + proto-identity` pair succeeds. The slot probe still runs as the bottom seal.

`primitive.js` gains module-top captures:

- `StringConstructor`, `NumberConstructor`, `BooleanConstructor` — realm-fixed `String` /
  `Number` / `Boolean` for the `instanceof` arms.
- `stringPrototype`, `numberPrototype`, `booleanPrototype` — realm-fixed `X.prototype` for
  the proto-identity arms.
- `symbolPrototype`, `bigIntPrototype` — kept for the existing `toSymbolValue` /
  `toBigIntValue` slot-probe cascade; no constructor capture (no `instanceof` branch).
- `getPrototypeOf` newly imported from `@/config`.

`thenable.js` reuses the existing module-top `PromiseConstructor` capture (already in
place for `isPromiseLike`).

The per-family split on the boxed primitives extends decision #042's
conservative-narrowing posture. The factory-function carve-out is the new design ruling
that lives at the intersection of two prior rulings — spec-shape determines the access
path (#020) and conservative-narrowing posture (#010) — applied to the question of whether
`instanceof` itself is a meaningful identity probe for a given intrinsic.

The "entry-point `instanceof` shortcut, per-case shape" framing is now the canonical
guidance for any new public predicate.

Commit pending. See [`../architecture/primitive.md`](../architecture/primitive.md) for the
updated module overview.
