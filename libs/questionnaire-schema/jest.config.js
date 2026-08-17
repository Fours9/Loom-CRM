/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@loom/employee-contacts$': '<rootDir>/../employee-contacts/src/index.ts',
    '^@loom/position-skill-catalog$':
      '<rootDir>/../position-skill-catalog/src/index.ts',
  },
};
