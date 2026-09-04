/**
 * @module __types
 *
 * TypeScript declarations the `type/T*` fixture needs and JSDoc cannot express.
 *
 * `test/type-contract.js` is a `// @ts-check`ed `.js` file like every other
 * source in this workspace, and JSDoc's `@typedef` produces a TYPE ALIAS.
 * TypeScript grants an object type alias an implicit index signature and grants
 * an `interface` none — which is the entire subject of `type/T5`. The vector is
 * therefore unwritable in JSDoc: asserting it needs a real `interface`
 * declaration, and this file is where the package keeps one.
 *
 * There is no `.js` twin, because there is nothing to implement. The fixture
 * reaches this file by a relative specifier, the way test-support modules are
 * referenced throughout the workspace (`__config.js` in the sibling packages);
 * the `#`-subpath scheme covers `src/` modules, which this is not.
 */

/**
 * A consumer's exports bag, declared as an `interface`.
 *
 * The declaration FORM is what matters here, not the members. An `interface`
 * has no implicit index signature, so it satisfies `object` and fails
 * `Record<PropertyKey, unknown>` — the two constraints `type/T5` separates.
 */
export interface NamespaceExports {
  a: number;
}
