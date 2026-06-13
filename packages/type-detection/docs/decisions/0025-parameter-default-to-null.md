# 025 — Parameter-default-to-`null` for strict-equality nullish unification

**Date:** 2026-06-04

**Context.** During the `hasInertMethod` refactor (post-thenable round, commit `71dff73`),
chasing the lint friction on a clean nullish guard surfaced the pattern. `value == null`
is the canonical idiom for catching both `null` and `undefined` in one comparison, but it
trips `@typescript-eslint/eqeqeq`, which enforces strict equality. Two strict checks
(`value !== null && value !== undefined`) work but cost a line and read as bookkeeping;
configuring `eqeqeq` with `null: 'ignore'` would also work but touches eslint config.

**Decision.** When a function accepts an optional or `unknown`-typed value and the body
benefits from a single nullish check, declare the parameter with a default of `null`
(`param = null`). An omitted call or an explicit `undefined` argument coerces to `null` at
the parameter-binding step, so only one nullish value reaches the body. Downstream
`param !== null` is strict-equality clean and covers both nullish cases via the
binding-time normalization.

**Rationale.** The trick pushes the normalization to the parameter binding — JS coerces an
omitted or `undefined` argument to the default — so only `null` reaches the body. The
resulting strict check covers both nullish cases without lint friction. Bonus: parameters
typed `unknown` with a `= null` default narrow cleanly through `!== null` to `unknown`
minus null. Falsy primitives (`0`, `''`, `false`, `NaN`, `0n`) flow through unaffected,
which is the right behavior for predicates that should treat each value type-correctly.
The naive alternatives (`!!value`, `(value ?? void 0) && …`) short-circuit on every falsy
input and silently reject primitives that have legitimate methods (`(0).toString` is
callable and inherited from `Number.prototype`).

**Consequences.** Applied to `hasInertMethod(type = null, key)` and to
`getNextAvailablePropertyDescriptor(value = null, key)` — the latter widened from `object`
to `unknown` to make the cast at the only `hasInertMethod` call site vanish. The pattern
composes — apply at each helper signature so the normalization happens once at the
outermost binding, and inner helpers can assume non-null without rechecking. Codified in
[[design-rulings]] as a forward-applicable rule. The bug fix it carries is real: the
previous `(value || null) && ...` form rejected `(0).toString` because `0` short-circuited
the falsy guard despite being a legitimate auto-boxed receiver of the inherited method.
