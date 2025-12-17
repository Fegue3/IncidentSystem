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

function flushMicrotasks() {
  return new Promise((r) => setImmediate(r));
}

describe('main.ts (unit) - 100% coverage', () => {
  let appMock: INestApplication;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    delete process.env.DD_TRACE_SAMPLE_RATE;
    delete process.env.DD_SERVICE;
    delete process.env.DD_ENV;
    delete process.env.DD_VERSION;
    delete process.env.PORT;

    appMock = makeAppMock();
  });

  function setupMocks() {
    // dd-trace pode ser importado como default OU como módulo CJS direto
    jest.doMock('dd-trace', () => {
      const init = jest.fn();
      const tracer = { init };
      return {
        __esModule: true,
        default: tracer, // para "import tracer from 'dd-trace'"
        init,            // para require('dd-trace').init (alguns interops)
      };
    });

    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn(async () => appMock),
      },
    }));
  }

  function getDdInitMock(): jest.Mock {
    const dd = require('dd-trace');
    return (dd?.default?.init ?? dd?.init) as jest.Mock;
  }

  it('DD_TRACE_SAMPLE_RATE undefined => sampleRate=1 e PORT undefined => listen(3000)', async () => {
    setupMocks();

    jest.isolateModules(() => {
      require('../../src/main'); // corre tracer.init + bootstrap() automaticamente
    });

    await flushMicrotasks();

    const initMock = getDdInitMock();
    expect(initMock).toHaveBeenCalledTimes(1);

    const initArg = initMock.mock.calls[0][0];
    expect(initArg.sampleRate).toBe(1);
    expect(initArg.logInjection).toBe(true);
    expect(initArg.runtimeMetrics).toBe(true);

    expect((appMock as any).setGlobalPrefix).toHaveBeenCalledWith('api');
    expect((appMock as any).enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:5173',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type, Authorization',
      credentials: true,
    });

    expect((appMock as any).useGlobalPipes).toHaveBeenCalledTimes(1);
    const pipeArg = (appMock as any).useGlobalPipes.mock.calls[0][0];
    expect(pipeArg).toBeInstanceOf(ValidationPipe);

    expect((appMock as any).listen).toHaveBeenCalledWith(3000);
  });

  it('DD_TRACE_SAMPLE_RATE inválido => sampleRate=1 (branch Number.isNaN)', async () => {
    process.env.DD_TRACE_SAMPLE_RATE = 'nope';
    setupMocks();

    jest.isolateModules(() => {
      require('../../src/main');
    });

    await flushMicrotasks();

    const initMock = getDdInitMock();
    expect(initMock).toHaveBeenCalledTimes(1);

    const initArg = initMock.mock.calls[0][0];
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

    await flushMicrotasks();

    const initMock = getDdInitMock();
    expect(initMock).toHaveBeenCalledTimes(1);

    const initArg = initMock.mock.calls[0][0];
    expect(initArg.service).toBe('my-service');
    expect(initArg.env).toBe('ci');
    expect(initArg.version).toBe('1.2.3');
    expect(initArg.sampleRate).toBe(0.25);

    expect((appMock as any).listen).toHaveBeenCalledWith(3333);
  });
});
