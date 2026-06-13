# type-detection / utility

## Mental model

The utility module hosts cross-realm-safe primitives that feed the domain-specific
predicates: descriptor walks (`getNextAvailablePropertyDescriptor`), inert method and
accessor probes (`hasInertMethod`, `hasInertGetter`, `hasInertSetter`, `hasInertValue`),
tag and type-signature readers (`getTypeSignature`, `getTaggedType`), the inert
constructor walk (`getDefinedConstructor` and `getDefinedConstructorName` — decision
#047), and the user-facing type-name resolver (`resolveType`).

The discipline is uniform: every property read is descriptor-based, accessor invocation is
deliberately avoided, and the helpers compose into the predicates the type-domain modules
export. The module sits below every domain in the dependency graph and carries no
domain-specific knowledge of its own.

## Type Resolution

`resolveType` is the single public composer of the constructor-name and the tagged-type
signals. It codifies a two-axis dispatch rule.

**Axis 1 — PascalCase-leading constructor name wins outright.** Checked via the
module-local `startsWithUpperCase = /^\p{Lu}/u` regex. Every built-in and every
well-written user class carries a Unicode uppercase-leading name; when present, it is the
most precise type signal available and the tag is not consulted.

**Axis 2 — Non-empty lowercase name beats the uninformative `'Object'` tag.** A lowercase
name (e.g., `'foo'` from `function foo () {}`) carries more information than the
structural `'Object'` tag, which by itself says only "this is an object." In every other
conflict the tag wins, including the anonymous-empty-name case (`name === ''`), where the
empty string carries no information and the tag is the only honest signal.

The dispatch composes with #047's tamper-resistant `getDefinedConstructor` walk: a
`Symbol.toStringTag` override on a value whose constructor name is PascalCase (the common
spoofing surface) is short-circuited at the first guard, and a tampered `constructor` data
property on the value cannot influence the read in the first place. The function's output
is uniformly grounded in the structural type rather than in user-supplied overrides. See
decisions #047 (inert constructor walk) and #048 (lowercase-name precedence).

## Open architectural questions

_Section currently empty — the utility module's public surface is complete pending the
test round._
