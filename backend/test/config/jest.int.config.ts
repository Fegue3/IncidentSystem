import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'integration/.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['../src/**/*.ts', '!../src/main.ts'],
  coverageDirectory: '../coverage/integration',
  testEnvironment: 'node',
  clearMocks: true,
};

export default config;
