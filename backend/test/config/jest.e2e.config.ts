import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'e2e/.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['../src/**/*.ts', '!../src/main.ts'],
  coverageDirectory: '../coverage/e2e',
  testEnvironment: 'node',
  clearMocks: true,
};

export default config;
