# 094 — A slot's SHAPE, not a prediction of `defineProperty`

**Date:** 2026-08-21

**Context.** A definability probe was added to `#utility` on 2026-08-20 as
`canOwnPropertyBeDefined`, extracted while building `type-identity`'s
`defineStableTypeIdentity`, which must know whether it can seal a constructor's `name` and
its prototype's `Symbol.toStringTag` before it tries. The body read one own descriptor and
tested `configurable !== false`.

Within a day the function had been corrected twice, and the spec section carried a growing
table of "divergences" against `Object.defineProperty` — four of them, two optimistic and
two conservative — plus an unqualified claim of "209/209 agreement" that named no oracle.
A predicate that needs a four-row errata table to describe a two-line body is not a
predicate with edge cases. It is a predicate whose contract is wrong.

The diagnosis: the function was named and documented as a **prediction of an operation**,
and it never was one. `Object.defineProperty` branches on whether the key is already
present — an **absent** key succeeds or fails purely on `[[Extensible]]`, a **present**
key purely on `configurable`. A single `configurable !== false` read answers the present
branch and merely guesses at the absent one. Every listed divergence traced back to that
conflation or to measuring against a question the function never claimed to answer.

**Decision.** The predicate answers **"can this own-property slot still take an arbitrary
shape?"**, and is renamed **`canOwnPropertyBeShaped`**.

A property's **shape** is its descriptor form — its kind (data or accessor) and its flags.
**Never its value.** `configurable: false` freezes a property's shape while leaving a
writable value free to change, and reporting exactly that split is the contract.

Three things follow.

**1. One arm per branch of the operation.** An absent key reads `Object.isExtensible`; a
present key reads `configurable !== false`. Mirroring the spec's own branch is what makes
the answer exact rather than approximate.

**2. Exactness is measured, and the oracle is named.** Against the arbitrary-shape
question the predicate and `Object.defineProperty` agree **13/13** across present, absent,
`preventExtensions` / `seal` / `freeze`, data / accessor / writable-data, `[].length`, a
function's `name`, and an absent symbol key. The probe installs maximally-different
descriptors (data→accessor conversion, `configurable: true` restoration, `enumerable`
inversion). The withdrawn "209/209" claim did not state its probe and was therefore not a
measurement at all.

**3. The two remaining boundaries are irreducible, not documented shortcuts.** A `Proxy`
trapping `defineProperty` cannot be foreseen by any read performed earlier (`cOPBS/B4`,
optimistic); a `Proxy` whose `getOwnPropertyDescriptor` trap throws cannot be told apart
from a sealed slot (`cOPBS/B1`, conservative, and the throw-safe answer).

**Consequences.**

The former `cOPBS/B2` — a non-extensible target with an absent key answering `true` while
the define throws — is **WITHDRAWN, not re-documented.** Under #081's reliability tenet an
optimistic answer is a false claim, and a type-detection predicate does not make one; the
extensibility arm removes it. `cOPBS/A7` and `A8` are the corrected vectors.

The supposed conservative gap at a non-configurable-but-writable property (`[].length` the
everyday instance) **was never a gap.** Such a slot genuinely cannot be re-shaped; only
its value moves. It becomes the ordinary vector `cOPBS/R7`, and `cOPBS/B5` is rewritten
from a divergence into the enumeration of what a `false` still permits:

| what still succeeds                               | a real capability?            |
| ------------------------------------------------- | ----------------------------- |
| a no-op define (`{}`, or `SameValue` fields)      | no — nothing changes          |
| a value write to a still-writable property        | no — plain assignment does it |
| the one-way `writable: true` → `false` tightening | **yes**, and the only one     |

So trusting a `false` costs a caller exactly one capability: pinning a value in place
without freezing the shape. The no-op rule compares with `SameValue`, so `-0` onto `+0`
throws while `NaN` onto `NaN` succeeds.

`Object.isExtensible` is captured module-locally in `#utility` from the `globalContext`
already imported from `#config`, and is not exported — #086 holds trivially, and the
public surface is unchanged in size.

**Rejected: a descriptor-aware variant** taking the intended descriptor and running the
`ValidateAndApplyPropertyDescriptor` compatibility rules. It would answer the narrower
"will THIS descriptor apply" question exactly, at the cost of roughly forty lines
mirroring the spec, with drift risk. It exists to close a gap that this decision shows is
not a gap, and no consumer asks it: both packages still to come — `type-identity` and
`custom-namespace` — are sealing packages, which ask the arbitrary-shape question.
Recorded as unbuilt by choice in `architecture/utility.md`, not as an oversight.

**Rejected: splitting into `canOwnPropertyBeAdded` + `canOwnPropertyBeRedefined`**, one
per branch. Each half would be exact, and the names would carry no double duty. But once
the single predicate is exact the split buys only expressiveness for a caller who cares
whether the key is present — and no such caller exists here or downstream. In a foundation
package with six dependents an unused public symbol is a semver commitment bought for
nothing. The split is not foreclosed: the adopted body is precisely the disjunction of the
two, so they can be extracted later, shaped by a real use case.

**Rejected: `canOwnPropertyBeFreelyDefined`.** Proposed to carry the missing quantifier,
which ranges over **descriptors** ("can ANY descriptor be installed"). "Freely" is an
adverb on the act of defining, so it reads as a _manner_ and implies an unfree path — a
forced define — which JavaScript has no referent for. The owner's objection was correct
and the candidate is on record so the reasoning is not rediscovered.

**Naming note (#088, #090).** The rename is the point, not a cosmetic follow-on. Under the
old name a `false` for `[].length` sat next to a working
`Object.defineProperty([], 'length', { value: 5 })` and read as a flat contradiction.
Under the new one it is a plain statement — a value is not a shape. Precision about
_scope_ still lives in the doc rather than the identifier, as it does for
`hasOwnWritablePrototype`; what the identifier owes is the _kind_ of claim, and this one
now names it.

**References.** `UTILITY.spec.md` § `canOwnPropertyBeShaped` (vectors and the measured
oracle) · `architecture/utility.md` § Own-property shapeability · builds on #081
(reliability tenet), #086 (realm-fixed captures), #088 / #090 (naming doctrine).
