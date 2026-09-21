/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@loom/questionnaire-schema$':
      '<rootDir>/../../libs/questionnaire-schema/src/index.ts',
    '^@loom/contracts-questionnaires$':
      '<rootDir>/../../libs/contracts/questionnaires/src/index.ts',
    '^@loom/position-skill-catalog$':
      '<rootDir>/../../libs/position-skill-catalog/src/index.ts',
    '^@loom/employee-about-catalog$':
      '<rootDir>/../../libs/employee-about-catalog/src/index.ts',
    '^@loom/contracts-employees$':
      '<rootDir>/../../libs/contracts/employees/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
};
