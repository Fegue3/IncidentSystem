/* eslint-disable @typescript-eslint/no-var-requires */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

const makeAppMock = () =>
  ({
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    useGlobalPipes: jest.fn(),
    listen: jest.fn(async () => {}),
  }) as unknown as INestApplication;

const flush = () => new Promise((r) => setImmediate(r));

describe('main.ts (unit) - 100% coverage', () => {
  let appMock: INestApplication;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // defaults
    delete process.env.DD_TRACE_SAMPLE_RATE;
    delete process.env.DD_SERVICE;
    delete process.env.DD_ENV;
    delete process.env.DD_VERSION;
    delete process.env.PORT;

    appMock = makeAppMock();
  });

  function setupMocks() {
    jest.doMock('dd-trace', () => ({
      __esModule: true,
      default: { init: jest.fn() },
    }));

    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn(async () => appMock),
      },
    }));
  }

  it('DD_TRACE_SAMPLE_RATE undefined => sampleRate=1 e PORT undefined => listen(3000)', async () => {
    setupMocks();

    jest.isolateModules(() => {
      require('../../src/main'); // corre tracer.init + bootstrap() automaticamente
    });

    await flush();

    const dd = require('dd-trace').default;
    expect(dd.init).toHaveBeenCalledTimes(1);

    const initArg = (dd.init as jest.Mock).mock.calls[0][0];
    expect(initArg.sampleRate).toBe(1);
    expect(initArg.logInjection).toBe(true);
    expect(initArg.runtimeMetrics).toBe(true);

    expect(appMock.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(appMock.enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:5173',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type, Authorization',
      credentials: true,
    });

    // garante que pipe foi aplicado
    expect(appMock.useGlobalPipes).toHaveBeenCalledTimes(1);
    const pipeArg = (appMock.useGlobalPipes as jest.Mock).mock.calls[0][0];
    expect(pipeArg).toBeInstanceOf(ValidationPipe);

    // PORT default (branch do ternário)
    expect(appMock.listen).toHaveBeenCalledWith(3000);
  });

  it('DD_TRACE_SAMPLE_RATE inválido => sampleRate=1 (branch Number.isNaN)', async () => {
    process.env.DD_TRACE_SAMPLE_RATE = 'nope';
    setupMocks();

    jest.isolateModules(() => {
      require('../../src/main');
    });

    await flush();

    const dd = require('dd-trace').default;
    const initArg = (dd.init as jest.Mock).mock.calls[0][0];
    expect(initArg.sampleRate).toBe(1);
  });

  it('DD_TRACE_SAMPLE_RATE válido + envs DD_* + PORT => listen(Number(PORT))', async () => {
    process.env.DD_TRACE_SAMPLE_RATE = '0.25';
    process.env.DD_SERVICE = 'my-service';
    process.env.DD_ENV = 'ci';
    process.env.DD_VERSION = '1.2.3';
    process.env.PORT = '3333';
    setupMocks();

    jest.isolateModules(() => {
      require('../../src/main');
    });

    await flush();

    const dd = require('dd-trace').default;
    expect(dd.init).toHaveBeenCalledTimes(1);

    const initArg = (dd.init as jest.Mock).mock.calls[0][0];
    expect(initArg.service).toBe('my-service');
    expect(initArg.env).toBe('ci');
    expect(initArg.version).toBe('1.2.3');
    expect(initArg.sampleRate).toBe(0.25);

    expect(appMock.listen).toHaveBeenCalledWith(3333);
  });
});
