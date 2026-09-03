module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Package scopes
        'type-detection',
        'function-introspection',
        'type-identity',
        'custom-namespace',
        // Cross-cutting scopes
        'ci',
        'deps',
        'scaffold',
        'docs',
      ],
    ],
  },
};
