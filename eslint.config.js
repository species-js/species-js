import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/docs/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  jsdoc.configs['flat/recommended-typescript-flavor'],
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: ['./packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Allow a blank line after the block description and blank lines between
    // tags — the readable JSDoc spacing used across both this project and the
    // sibling es-async-types. The recommended-typescript-flavor preset is
    // stricter by default; this relaxes it project-wide without forcing blank
    // lines into short JSDoc blocks (`startLines: null` = no requirement).
    rules: {
      'jsdoc/tag-lines': ['warn', 'any', { startLines: null }],
    },
  },
  {
    // `@typescript-eslint/unbound-method` is off project-wide. Its premise —
    // "referencing a method without calling it may lose `this`" — is exactly
    // what this codebase does on purpose: it captures cross-realm-sensitive
    // prototype methods at module load (`const toString = Object.prototype.toString`)
    // and invokes them via `.call(value)`. That cached-prototype-reference
    // pattern is a load-bearing convention (CLAUDE.md → "Cached prototype
    // references"), so the rule fights the design rather than catching bugs here.
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // `@typescript-eslint/prefer-optional-chain` is off project-wide. The
    // realm-fixed-capture idiom pairs a constructor binding typed
    // `typeof X | null` (`const XConstructor = isCallable(X) ? X : null`) with
    // a sibling prototype binding `const xPrototype = XConstructor && XConstructor.prototype`.
    // The `&&` form propagates `null` as the absence sentinel forward, keeping
    // both bindings in the same absence vocabulary. Rewriting to
    // `XConstructor?.prototype` widens the prototype capture's type to
    // `... | undefined`, splitting the absence semantics across paired bindings
    // for no semantic gain. The pattern is load-bearing for cross-realm
    // capability detection (Promise / EventTarget / AbortSignal prototype
    // captures in `thenable.js` and `evented.js`).
    rules: {
      '@typescript-eslint/prefer-optional-chain': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2025,
      },
      sourceType: 'module',
    },
    plugins: {
      jsdoc,
    },
    rules: {
      // --- Core JS hardening ---
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-var': 'error',
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',

      // --- TypeScript-ESLint ---
      '@typescript-eslint/no-this-alias': [
        'error',
        {
          allowDestructuring: false,
          allowedNames: ['origin'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // --- JSDoc discipline ---
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
    },
  },
  // --- .d.ts coverage: project rules apply; JSDoc-presence + inline-type rules off ---
  {
    files: ['**/*.ts', '**/*.d.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/check-tag-names': 'off',
      // In `.d.ts`, types live in the native TS signature; JSDoc is
      // description-only (per CLAUDE.md → "Parallel JSDoc in `.js` and
      // `.d.ts`"). The inline-type rules belong on `.js`, not here.
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
      // The function-type hierarchy (Callable, CallableOrNewable, …) uses
      // call-signature interfaces for declaration-merging extensibility; the
      // pure-call-signature interface is intentional, not a candidate for the
      // function-type shorthand.
      '@typescript-eslint/prefer-function-type': 'off',
    },
  },
  // --- Boxed-primitive types: wrapper-object types are intentional here ---
  {
    files: ['**/src/primitive.d.ts'],
    rules: {
      // `BoxedString = String & object`, `BoxedNumber = Number & object`, … in
      // the primitive module deliberately model the boxed wrapper-object form
      // of each primitive family (the runtime values `new String('x')`,
      // `Object(42)`, `Object(Symbol('y'))`, etc.). The rule's default advice
      // — "prefer the primitive `string` over `String`" — is correct for
      // typical code but wrong here: this is precisely the case where the
      // wrapper-object type is the load-bearing distinction from the primitive
      // form. The `& object` intersection enforces the distinction at the
      // type level.
      '@typescript-eslint/no-wrapper-object-types': 'off',
    },
  },
  // --- Tests + test-support files: JSDoc rules off ---
  // Covers `*.test.js` suites and the `_helpers.js` / `_cross-realm.js`
  // support files under any `test/` directory — fixtures and harness code are
  // not consumer-grade surface and do not carry full JSDoc contracts.
  {
    files: ['**/*.test.js', '**/test/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
    },
  },
  // --- Root config files + tooling scripts: not in any tsconfig; disable type-aware rules + JSDoc ---
  {
    files: ['*.config.js', '*.config.cjs', '*.config.mjs', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['*.config.js', '*.config.cjs', '*.config.mjs', 'scripts/**/*.mjs'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },
);
