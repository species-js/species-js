# 079 — Omitted-argument honesty for accept-`undefined` predicates (carves out #025)

**Date:** 2026-07-27

**Context.** The `#primitive` floor predicates `isNullishPrimitive` and `isPrimitiveValue`
both count `undefined` a positive — `undefined` is a nullish primitive, and it is a
primitive value. Each reached that verdict through the parameter-default-to-`null` idiom
(#025): `isNullishPrimitive(value = null) => value === null`, and
`isPrimitiveValue(value) => isNullishPrimitive(value) || isBoxablePrimitive(value)`. #025
normalizes an omitted call AND an explicit `undefined` argument to the same `null` at the
parameter binding — it deliberately conflates the two.

For a value-returning helper that walks to a terminal (`hasInertMethod`,
`getNextAvailablePropertyDescriptor`), that conflation is correct: "no argument,"
"`undefined`," and "`null`" are all "nothing more to walk." For a PREDICATE whose
accept-set contains `undefined`, it is dishonest. `isNullishPrimitive()` answered `true` —
the predicate confidently classifying a value that was never supplied. There is no value
to be nullish; the honest verdict for an omitted call is `false`. Presence is a property
of the CALL (its arity), and a defaulted named parameter erases it:
`isPrimitiveValue(value)` re-emitted an omitted call to `isNullishPrimitive` as a present
`undefined`, so even a corrected `isNullishPrimitive` could not observe the omission
through it.

The `#utility` readers `getTypeSignature` / `getTaggedType` / `resolveType` already solved
the same problem for value-returning functions: a rest parameter with an `args.length`
gate distinguishes an omitted call (degenerate `undefined`) from an explicit `undefined`
(the tag). The accept-`undefined` predicates are that same problem in boolean clothing.

**Decision.**

1. **A predicate must not classify a value that was never supplied.** When `undefined` is
   a member of a predicate's accept-set (`p(undefined) === true`), an omitted call returns
   the honest degenerate — `false` for a boolean predicate — NOT the positive it gives an
   explicit `undefined`.
2. **Detect presence via arity, not a default.** The implementation takes a rest parameter
   and gates on `args.length`, mirroring the reader trio:
   `isNullishPrimitive(...args) => args.length > 0 && (args[0] ?? null) === null`;
   `isPrimitiveValue(...args) => args.length > 0 && (isNullishPrimitive(args[0]) || isBoxablePrimitive(args[0]))`.
   A composing predicate MUST forward presence (spread `...args`, or gate itself before
   delegating) — never funnel a named `value`, which destroys the omission at the
   boundary.
3. **The `.d.ts` carries the distinction as an overload pair** —
   `(value: unknown): value is X` plus `(): false` — the boolean-predicate analogue of the
   readers' `(): undefined` no-argument overload.
4. **This carves out #025, it does not retire it.** The parameter-default-to-`null` idiom
   stays correct for functions that treat omitted / `undefined` / `null` as one terminal
   case (the value-returning descriptor and prototype walkers). It is withdrawn only where
   a predicate's truth depends on argument presence — i.e. where `undefined` is in the
   accept-set.

**The diagnostic rule (forward-applicable).** A predicate is compromised by an omitted
argument iff `undefined` is in its accept-set AND it does not gate on `arguments.length`.
Omission binds the parameter to `undefined`; if `undefined` is a positive, the predicate
fabricates a value that was never supplied and classifies it. Predicates whose accept-set
excludes `undefined` are honest-by-construction (omitted → `undefined` → `false`) and need
no gate — adding one would imply an arity distinction that does not exist. So
`isBoxablePrimitive`, whose `typeof`-result exclusion already rejects `undefined`, keeps
its plain `(value)` form.

**Rationale.**

- **Honesty is the package thesis.** A runtime detector answers an absolute question about
  a value. "Is the value you didn't give me nullish?" has no honest `true` — there is no
  value. Answering `true` is a truthful statement about a fabricated input, the same class
  of dishonesty as a leaked narrow.
- **Presence lives in arity, not value.** The only bit separating `f()` from
  `f(undefined)` is `arguments.length`; a named parameter with a default collapses both to
  one binding and throws that bit away. The reader trio learned this first; these
  predicates are the same lesson.
- **Scope discipline.** The three floor predicates split cleanly by accept-set:
  `isNullishPrimitive` (∋ `undefined`) and `isPrimitiveValue` (∋ `undefined`) qualify;
  `isBoxablePrimitive` (∌) does not. Only two predicates in the whole module were ever
  compromised, and one (`isPrimitiveValue`) only through composition.

**Consequences.**

- `primitive.{js,d.ts}`: `isNullishPrimitive` and `isPrimitiveValue` are arity-gated
  `(...args)` in the `.js` and overloaded (`(value: unknown): value is X` + `(): false`)
  in the `.d.ts`; their docs are rewritten off the #025 idiom. `isBoxablePrimitive` is
  unchanged (a brief `...args` experiment was rolled back — it was never compromised). No
  external callers exist in the four packages, so the stricter overload is contained.
  `tsc` green.
- **Behavior change at the omitted boundary:** `isNullishPrimitive()` and
  `isPrimitiveValue()` (no argument) now return `false` (were `true`). Explicit
  `isNullishPrimitive(undefined)` / `isPrimitiveValue(undefined)` still return `true`.
  This is a real accept-set change.
- `PRIMITIVE.spec.md` (frozen) amended in place (dated banner, #054): the `CC/nullish`
  cross-cutting vector splits provided-nullish (admitted by the two) from omitted
  (rejected by all), and the `isNullishPrimitive` / `isPrimitiveValue` sections gain an
  omitted → `false` boundary vector. `test/primitive/spec.test.js` moved to the new
  oracle.
- Carves out the predicate scope of #025; #025 stands for the value-returning
  nullish-terminal helpers. A pointer is added to #025's header.
- **Forward work:** the diagnostic rule is to be swept across the other modules
  (`#function`, `#thenable`, `#object`, `#evented`, `#error`, `#utility`, `#config`) —
  every predicate with `undefined` in its accept-set gets the same audit. Sequenced with
  the broader cross-artifact retro-audit.
