# type-detection — Decision log

A chronological record of architectural and design decisions in
`@species-js/type-detection`, captured as ADRs (Architecture Decision Records). Each file
is self-contained: Context, Decision, Rationale, Consequences. Later decisions that
supersede earlier ones add new files with explicit pointers back, rather than mutating the
historical record.

ADR filenames follow `NNNN-short-kebab-slug.md`. Decision numbers within prose are
referenced as `#NNN` (without zero-padding) for readability.

Open architectural questions live in [open-questions.md](./open-questions.md).

## Decisions by domain

### Foundational

| #                                                         | Title                                                                        | Date       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| [001](./0001-branding-rejected-for-type-name-strings.md)  | Branding rejected for type-name string aliases                               | 2026-05-29 |
| [002](./0002-tier-s-documentation-style.md)               | Tier-S documentation style established + codified package-wide               | 2026-05-29 |
| [018](./0018-prose-voice-refinement.md)                   | Prose-voice refinement of the documentation style                            | 2026-06-03 |
| [020](./0020-spec-shape-determines-access-path.md)        | Spec-shape determines the access path                                        | 2026-06-03 |
| [021](./0021-spec-shape-rule-predicate-over-inherited.md) | Spec-shape rule extended — descriptor-walk for inspection without invocation | 2026-06-04 |
| [025](./0025-parameter-default-to-null.md)                | Parameter-default-to-`null` for strict-equality nullish unification          | 2026-06-04 |

### type-detection / function

| #                                                                  | Title                                                                | Date       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------- |
| [003](./0003-three-species-newable-lattice.md)                     | Three-species newable lattice                                        | 2026-06-01 |
| [004](./0004-async-function-kin-to-async-function-intrinsic.md)    | `AsyncFunction` is kin to `%AsyncFunction%`                          | 2026-06-01 |
| [005](./0005-bound-admission-asymmetry.md)                         | Bound-admission asymmetry by spec mechanics                          | 2026-06-01 |
| [006](./0006-orchestrator-plus-shape-helper-pattern.md)            | Orchestrator + shape-helper pattern for non-newable predicates       | 2026-06-01 |
| [007](./0007-newable-function-intrinsic-cast.md)                   | Intrinsic constructor capture cast type: `NewableFunction`           | 2026-06-01 |
| [009](./0009-empirical-fingerprint-matrix.md)                      | Empirical fingerprint matrix as the discrimination signal            | 2026-06-02 |
| [010](./0010-conservative-narrowing-posture.md)                    | Conservative-narrowing posture for shape predicates                  | 2026-06-02 |
| [011](./0011-set-string-primitive-for-shape-probes.md)             | `Set<string>` primitive for shape-presence probes                    | 2026-06-02 |
| [012](./0012-family-level-abstraction.md)                          | Family-level abstraction over per-species duplication                | 2026-06-02 |
| [013](./0013-spec-defined-source-string-stays-in-detection.md)     | Spec-defined source-string checks stay in detection                  | 2026-06-02 |
| [014](./0014-helper-grouped-shape-predicates.md)                   | Helper-grouped shape predicates with sub-helper extraction           | 2026-06-02 |
| [015](./0015-sub-helpers-exported-with-dts.md)                     | All sub-helpers exported with parallel `.d.ts` declarations          | 2026-06-03 |
| [016](./0016-singular-composite-naming.md)                         | Singular composite naming: `*IdentitySignal` and `*PrototypeSurface` | 2026-06-03 |
| [019](./0019-callable-or-newable-kept.md)                          | `CallableOrNewable` kept as third-party-consumable surface           | 2026-06-03 |
| [031](./0031-generic-typed-predicates-function.md)                 | Generic-typed predicates: `<T = unknown>(value?: T): value is T & X` | 2026-06-05 |
| [036](./0036-generic-predicate-extended-thenable-evented-error.md) | Generic-predicate pattern extended to thenable / evented / error     | 2026-06-05 |

### type-detection / thenable

| #                                                                | Title                                                                                           | Date       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| [022](./0022-promise-like-richer-than-lib.md)                    | `PromiseLike<T>` defined as richer than TypeScript's lib                                        | 2026-06-04 |
| [023](./0023-is-promise-rejects-subclasses.md)                   | `isPromise` rejects subclasses by strict constructor-name equality                              | 2026-06-04 |
| [024](./0024-has-inert-method-factored-to-utility.md)            | `hasInertMethod` factored as `@/utility` primitive                                              | 2026-06-04 |
| [037](./0037-abortable-thenable-placement.md)                    | `AbortableThenable<T>` placement and design                                                     | 2026-06-06 |
| [050](./0050-lift-from-like-cascade-strict-identity.md)          | Lift-from-`Like`-cascade: two-axis dispatch at the strict-identity entry point                  | 2026-06-16 |
| [052](./0052-promise-prototype-graft-structurally-unsealable.md) | `Promise` prototype-graft is structurally unsealable; accept-and-document                       | 2026-06-18 |
| [054](./0054-is-promise-cross-realm-structural-equivalence.md)   | `isPromise` cross-realm arm factored into structural-equivalence; `assumePrototype` generalized | 2026-06-23 |

### type-detection / evented

| #                                                                                    | Title                                                                                          | Date       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------- |
| [027](./0027-event-target-like-defined-locally.md)                                   | `EventTargetLike` / `AbortSignalLike` defined locally                                          | 2026-06-04 |
| [028](./0028-is-event-target-rejects-subclasses.md)                                  | `isEventTarget` / `isAbortSignal` reject subclasses                                            | 2026-06-04 |
| [029](./0029-aborted-accessor-direct-read-exception.md)                              | `aborted` accessor direct-read exception                                                       | 2026-06-04 |
| [030](./0030-abort-signal-like-minimum-surface.md)                                   | `AbortSignalLike` minimum-surface choice                                                       | 2026-06-04 |
| [060](./0060-instance-less-constructor-sentinel-throw-safe-instanceof.md)            | INSTANCE_LESS_CONSTRUCTOR sentinel; throw-safe `instanceof` realm guard                        | 2026-07-01 |
| [061](./0061-evented-cross-realm-prototype-equivalence-strict-like-decomposition.md) | Evented strict identity lifted to cross-realm prototype-equivalence; strict/Like decomposition | 2026-07-01 |
| [062](./0062-strict-identity-predicates-excluded-from-generic-family.md)             | Strict identity predicates excluded from the generic `<T = unknown>` family                    | 2026-07-01 |
| [063](./0063-own-level-contract-shadow-rejection-strict-predicates.md)               | Own-level contract-shadow rejection in the strict identity predicates                          | 2026-07-01 |

### type-detection / error

| #                                                    | Title                                                                  | Date       |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| [032](./0032-error-predicates-native-or-polyfill.md) | Error predicates: layered composition with native-or-polyfill capture  | 2026-06-05 |
| [033](./0033-polyfill-widening-error-data.md)        | Polyfill widening semantics over the unobservable `[[ErrorData]]` slot | 2026-06-05 |
| [035](./0035-abort-error-name-suffix-refinement.md)  | `AbortError` as a name-suffix refinement via template-literal type     | 2026-06-05 |

### type-detection / primitive

| #                                                           | Title                                                                        | Date       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| [038](./0038-primitive-module-migration.md)                 | Primitive module migration: full surface across five families                | 2026-06-07 |
| [039](./0039-generic-predicate-extended-primitive.md)       | Generic-predicate pattern extended to the primitive family                   | 2026-06-07 |
| [042](./0042-four-marker-boxed-primitive-discrimination.md) | Four-marker boxed-primitive discrimination via `[[XData]]` slot probe        | 2026-06-07 |
| [043](./0043-per-family-equality-and-object-is-capture.md)  | Per-family equality strategies and `objectIs` capture                        | 2026-06-07 |
| [049](./0049-instanceof-shortcut-predicate-entry-points.md) | Local-realm `instanceof` at predicate entry points, per-case shape           | 2026-06-14 |
| [051](./0051-generic-primitive-future-proof-exclusion.md)   | Generic-primitive predicates with future-proof exclusion shape               | 2026-06-16 |
| [053](./0053-export-boxed-primitive-resolution-helpers.md)  | Export boxed-primitive realm-resolution helpers for single-realm testability | 2026-06-18 |

### type-detection / object

| #                                                                | Title                                                       | Date       |
| ---------------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| [040](./0040-object-module-structural-subtype-hierarchy.md)      | Object module: structural subtype hierarchy over branding   | 2026-06-06 |
| [041](./0041-strict-is-plain-object-vs-lodash.md)                | Strict `isPlainObject` vs lodash `_.isPlainObject`          | 2026-06-06 |
| [044](./0044-structural-anchor-is-plain-object.md)               | Structural anchor for `isPlainObject` — five-marker chain   | 2026-06-08 |
| [045](./0045-tag-signature-cross-validator-dictionary-object.md) | Tag-signature cross-validator added to `isDictionaryObject` | 2026-06-08 |
| [046](./0046-plain-or-dictionary-object-fused-predicate.md)      | `PlainOrDictionaryObject` union type and fused predicate    | 2026-06-08 |

### type-detection / utility

| #                                                                                     | Title                                                                                                                                                 | Date       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [008](./0008-boundary-retyping-to-function-string.md)                                 | Boundary-retyping at `@/config` for `toFunctionString`                                                                                                | 2026-06-01 |
| [017](./0017-boundary-retyping-get-prototype-of.md)                                   | Boundary-retyping at `@/config` for `getPrototypeOf`                                                                                                  | 2026-06-03 |
| [026](./0026-is-valid-property-key-tightened.md)                                      | `isValidPropertyKey` tightened to safe-integer + three new `Number` type-guards                                                                       | 2026-06-04 |
| [034](./0034-boundary-retyping-object-create.md)                                      | Boundary-retyping at `@/config` for `objectCreate`                                                                                                    | 2026-06-05 |
| [047](./0047-get-defined-constructor-pivot-and-walk.md)                               | `getDefinedConstructor` rewritten as inert pivot-and-walk                                                                                             | 2026-06-09 |
| [048](./0048-resolve-type-two-axis-dispatch.md)                                       | `resolveType` lowercase-name precedence (two-axis dispatch)                                                                                           | 2026-06-13 |
| [055](./0055-constructor-registries-per-interpretation-keying.md)                     | Constructor registries keyed by `(value, assumePrototype)`; #054 deferral overturned                                                                  | 2026-06-23 |
| [056](./0056-get-defined-constructor-throw-safe-via-inert-descriptor.md)              | `getDefinedConstructor` routed through `getInertDescriptor`; honest-throw retracted                                                                   | 2026-06-23 |
| [057](./0057-drop-prototype-registry-guarded-get-prototype-of-throw-safe-only.md)     | `prototypeRegistry` dropped (benchmark-driven); `getInertPrototypeOf` throw-safe-only                                                                 | 2026-06-23 |
| [058](./0058-descriptor-batching-and-descriptor-memo-rejected.md)                     | Descriptor-batching and descriptor-memoization rejected (benchmark-driven)                                                                            | 2026-06-24 |
| [059](./0059-drop-constructor-registries-thread-constructor-get-verified-own-name.md) | Constructor registries dropped (benchmark-driven); intra-call constructor threading + `getVerifiedOwnName`; `isValidWeakKey` kept as public candidate | 2026-06-25 |

## Decisions by date (chronological)

For an at-a-glance read of the project's evolution. Decision numbers in chronological
order with one-line summaries:

| Date       | #                                                                                     | Summary                                                                                        |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 2026-05-29 | [001](./0001-branding-rejected-for-type-name-strings.md)                              | Branding rejected for type-name string aliases                                                 |
| 2026-05-29 | [002](./0002-tier-s-documentation-style.md)                                           | Tier-S documentation style established                                                         |
| 2026-06-01 | [003](./0003-three-species-newable-lattice.md)                                        | Three-species newable lattice                                                                  |
| 2026-06-01 | [004](./0004-async-function-kin-to-async-function-intrinsic.md)                       | `AsyncFunction` family map                                                                     |
| 2026-06-01 | [005](./0005-bound-admission-asymmetry.md)                                            | Bound-admission asymmetry by spec mechanics                                                    |
| 2026-06-01 | [006](./0006-orchestrator-plus-shape-helper-pattern.md)                               | Orchestrator + shape-helper pattern                                                            |
| 2026-06-01 | [007](./0007-newable-function-intrinsic-cast.md)                                      | `NewableFunction` intrinsic cast                                                               |
| 2026-06-01 | [008](./0008-boundary-retyping-to-function-string.md)                                 | Boundary-retyping for `toFunctionString`                                                       |
| 2026-06-02 | [009](./0009-empirical-fingerprint-matrix.md)                                         | Empirical fingerprint matrix                                                                   |
| 2026-06-02 | [010](./0010-conservative-narrowing-posture.md)                                       | Conservative-narrowing posture                                                                 |
| 2026-06-02 | [011](./0011-set-string-primitive-for-shape-probes.md)                                | `Set<string>` primitive for shape-presence                                                     |
| 2026-06-02 | [012](./0012-family-level-abstraction.md)                                             | Family-level abstraction                                                                       |
| 2026-06-02 | [013](./0013-spec-defined-source-string-stays-in-detection.md)                        | Spec-defined source-string stays in detection                                                  |
| 2026-06-02 | [014](./0014-helper-grouped-shape-predicates.md)                                      | Helper-grouped shape predicates                                                                |
| 2026-06-03 | [015](./0015-sub-helpers-exported-with-dts.md)                                        | All sub-helpers exported                                                                       |
| 2026-06-03 | [016](./0016-singular-composite-naming.md)                                            | Singular composite naming                                                                      |
| 2026-06-03 | [017](./0017-boundary-retyping-get-prototype-of.md)                                   | Boundary-retyping for `getPrototypeOf`                                                         |
| 2026-06-03 | [018](./0018-prose-voice-refinement.md)                                               | Prose-voice refinement                                                                         |
| 2026-06-03 | [019](./0019-callable-or-newable-kept.md)                                             | `CallableOrNewable` kept                                                                       |
| 2026-06-03 | [020](./0020-spec-shape-determines-access-path.md)                                    | Spec-shape determines access path                                                              |
| 2026-06-04 | [021](./0021-spec-shape-rule-predicate-over-inherited.md)                             | Spec-shape rule's third pattern                                                                |
| 2026-06-04 | [022](./0022-promise-like-richer-than-lib.md)                                         | `PromiseLike<T>` richer than lib                                                               |
| 2026-06-04 | [023](./0023-is-promise-rejects-subclasses.md)                                        | `isPromise` rejects subclasses                                                                 |
| 2026-06-04 | [024](./0024-has-inert-method-factored-to-utility.md)                                 | `hasInertMethod` factored to `@/utility`                                                       |
| 2026-06-04 | [025](./0025-parameter-default-to-null.md)                                            | Parameter-default-to-`null`                                                                    |
| 2026-06-04 | [026](./0026-is-valid-property-key-tightened.md)                                      | `isValidPropertyKey` tightened                                                                 |
| 2026-06-04 | [027](./0027-event-target-like-defined-locally.md)                                    | `EventTargetLike` defined locally                                                              |
| 2026-06-04 | [028](./0028-is-event-target-rejects-subclasses.md)                                   | `isEventTarget` rejects subclasses                                                             |
| 2026-06-04 | [029](./0029-aborted-accessor-direct-read-exception.md)                               | `aborted` accessor direct-read                                                                 |
| 2026-06-04 | [030](./0030-abort-signal-like-minimum-surface.md)                                    | `AbortSignalLike` minimum surface                                                              |
| 2026-06-05 | [031](./0031-generic-typed-predicates-function.md)                                    | Generic-typed predicates (function)                                                            |
| 2026-06-05 | [032](./0032-error-predicates-native-or-polyfill.md)                                  | Error predicates: native-or-polyfill                                                           |
| 2026-06-05 | [033](./0033-polyfill-widening-error-data.md)                                         | Polyfill widening over `[[ErrorData]]`                                                         |
| 2026-06-05 | [034](./0034-boundary-retyping-object-create.md)                                      | Boundary-retyping for `objectCreate`                                                           |
| 2026-06-05 | [035](./0035-abort-error-name-suffix-refinement.md)                                   | `AbortError` as name-suffix refinement                                                         |
| 2026-06-05 | [036](./0036-generic-predicate-extended-thenable-evented-error.md)                    | Generic-predicate extended                                                                     |
| 2026-06-06 | [037](./0037-abortable-thenable-placement.md)                                         | `AbortableThenable<T>` placement                                                               |
| 2026-06-06 | [040](./0040-object-module-structural-subtype-hierarchy.md)                           | Object structural subtype hierarchy                                                            |
| 2026-06-06 | [041](./0041-strict-is-plain-object-vs-lodash.md)                                     | Strict `isPlainObject` vs lodash                                                               |
| 2026-06-07 | [038](./0038-primitive-module-migration.md)                                           | Primitive module migration                                                                     |
| 2026-06-07 | [039](./0039-generic-predicate-extended-primitive.md)                                 | Generic-predicate extended to primitive                                                        |
| 2026-06-07 | [042](./0042-four-marker-boxed-primitive-discrimination.md)                           | Four-marker boxed-primitive discrimination                                                     |
| 2026-06-07 | [043](./0043-per-family-equality-and-object-is-capture.md)                            | Per-family equality + `objectIs` capture                                                       |
| 2026-06-08 | [044](./0044-structural-anchor-is-plain-object.md)                                    | Structural anchor for `isPlainObject`                                                          |
| 2026-06-08 | [045](./0045-tag-signature-cross-validator-dictionary-object.md)                      | Tag-signature cross-validator (dictionary)                                                     |
| 2026-06-08 | [046](./0046-plain-or-dictionary-object-fused-predicate.md)                           | `PlainOrDictionaryObject` fused predicate                                                      |
| 2026-06-09 | [047](./0047-get-defined-constructor-pivot-and-walk.md)                               | `getDefinedConstructor` pivot-and-walk                                                         |
| 2026-06-13 | [048](./0048-resolve-type-two-axis-dispatch.md)                                       | `resolveType` two-axis dispatch                                                                |
| 2026-06-14 | [049](./0049-instanceof-shortcut-predicate-entry-points.md)                           | `instanceof` shortcut at predicate entry points                                                |
| 2026-06-16 | [050](./0050-lift-from-like-cascade-strict-identity.md)                               | Lift-from-`Like`-cascade: two-axis at strict                                                   |
| 2026-06-16 | [051](./0051-generic-primitive-future-proof-exclusion.md)                             | Generic-primitive future-proof exclusion                                                       |
| 2026-06-18 | [052](./0052-promise-prototype-graft-structurally-unsealable.md)                      | `Promise` prototype-graft structurally unsealable                                              |
| 2026-06-18 | [053](./0053-export-boxed-primitive-resolution-helpers.md)                            | Export boxed-primitive resolution helpers (testability)                                        |
| 2026-06-23 | [054](./0054-is-promise-cross-realm-structural-equivalence.md)                        | `isPromise` cross-realm structural-equivalence + `assumePrototype`                             |
| 2026-06-23 | [055](./0055-constructor-registries-per-interpretation-keying.md)                     | Constructor registries keyed by `(value, assumePrototype)`                                     |
| 2026-06-23 | [056](./0056-get-defined-constructor-throw-safe-via-inert-descriptor.md)              | `getDefinedConstructor` throw-safe via `getInertDescriptor`                                    |
| 2026-06-23 | [057](./0057-drop-prototype-registry-guarded-get-prototype-of-throw-safe-only.md)     | `prototypeRegistry` dropped (benchmark-driven)                                                 |
| 2026-06-24 | [058](./0058-descriptor-batching-and-descriptor-memo-rejected.md)                     | Descriptor-batching + descriptor-memo rejected (benchmark-driven)                              |
| 2026-06-25 | [059](./0059-drop-constructor-registries-thread-constructor-get-verified-own-name.md) | Constructor registries dropped; intra-call threading + `getVerifiedOwnName`                    |
| 2026-07-01 | [060](./0060-instance-less-constructor-sentinel-throw-safe-instanceof.md)             | INSTANCE_LESS_CONSTRUCTOR sentinel; throw-safe `instanceof` realm guard                        |
| 2026-07-01 | [061](./0061-evented-cross-realm-prototype-equivalence-strict-like-decomposition.md)  | Evented strict identity lifted to cross-realm prototype-equivalence; strict/Like decomposition |
| 2026-07-01 | [062](./0062-strict-identity-predicates-excluded-from-generic-family.md)              | Strict identity predicates excluded from the generic `<T = unknown>` family                    |
| 2026-07-01 | [063](./0063-own-level-contract-shadow-rejection-strict-predicates.md)                | Own-level contract-shadow rejection in the strict identity predicates                          |
