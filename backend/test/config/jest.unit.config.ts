import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..', // /backend/test
  testRegex: 'unit/.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['../src/**/*.ts', '!../src/main.ts'],
  coverageDirectory: '../coverage/unit',
  testEnvironment: 'node',
  clearMocks: true,
};

export default config;
