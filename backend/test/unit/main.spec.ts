/* eslint-disable @typescript-eslint/no-var-requires */
import type { INestApplication } from '@nestjs/common';

jest.mock('dd-trace', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

const appMock = {
  setGlobalPrefix: jest.fn(),
  enableCors: jest.fn(),
  useGlobalPipes: jest.fn(),
  listen: jest.fn(async () => {}),
} as unknown as INestApplication;

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(async () => appMock),
  },
}));

describe('main.ts bootstrap (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test'; // garante que NÃO auto-executa bootstrap()
    process.env.PORT = '3333';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
  });

  it('bootstrap wires Nest app (prefix + cors + pipes + listen)', async () => {
    const main = require('../../src/main') as typeof import('../../src/main');

    await main.bootstrap();

    expect(appMock.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(appMock.enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:5173',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type, Authorization',
      credentials: true,
    });

    expect(appMock.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(appMock.listen).toHaveBeenCalledWith(3333);
  });

  it('initTracing does nothing in test env', async () => {
    const dd = require('dd-trace').default;
    const main = require('../../src/main') as typeof import('../../src/main');

    main.initTracing();
    expect(dd.init).not.toHaveBeenCalled();
  });
});
