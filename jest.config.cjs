module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  testTimeout: 30000,
  clearMocks: true,
  // sanitize-html's parser uses ESM; compile its small dependency graph for Jest's CJS VM.
  transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: { allowJs: true } }] },
  transformIgnorePatterns: ['node_modules[/\\\\](?!(htmlparser2|domhandler|domutils|domelementtype|entities|dom-serializer)[/\\\\])'],
};
