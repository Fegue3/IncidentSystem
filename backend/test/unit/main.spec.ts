/**
 * @file test/unit/main.spec.ts
 * @module tests/unit/main
 *
 * @summary
 *  - Testes unitários do ficheiro main.ts (efeitos colaterais no bootstrap).
 *
 * @description
 *  - Cobre:
 *    - inicialização do dd-trace (init) com sampleRate correto
 *    - criação da app via NestFactory.create
 *    - configuração: global prefix, CORS, ValidationPipe
 *    - app.listen com PORT default ou definido
 *
 * @dependencies
 *  - dd-trace: mockado para capturar init args.
 *  - @nestjs/core NestFactory: mockado para retornar um INestApplication fake.
 *
 * @testability
 *  - main.ts executa bootstrap() no import; este teste usa require() e aguarda o microtask queue.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import type { INestApplication } from '@nestjs/common';

const ddInitMock = jest.fn();

/**
 * dd-trace: cobre:
 * - require('dd-trace').init
 * - require('dd-trace').default.init
 * - import tracer from 'dd-trace'
 */
jest.mock('dd-trace', () => {
  const tracer = { init: ddInitMock };
  return Object.assign(tracer, {
    __esModule: true,
    default: tracer,
  });
});

const createMock = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: (...args: any[]) => createMock(...args),
  },
}));

function makeAppMock(): INestApplication {
  return {
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    useGlobalPipes: jest.fn(),
    listen: jest.fn(async () => {}),
  } as any;
}

function flushAsync() {
  return new Promise((r) => setImmediate(r));
}

describe('main.ts (unit) - cover main.ts side-effects', () => {
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
    createMock.mockResolvedValue(appMock);
  });

  it('DD_TRACE_SAMPLE_RATE undefined => sampleRate=1, PORT undefined => listen(3000)', async () => {
    require('../../src/main');

    // bootstrap() é async e foi chamado sem await; deixamos a Promise completar
    await flushAsync();

    expect(ddInitMock).toHaveBeenCalledTimes(1);
    const initArg = ddInitMock.mock.calls[0][0];
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

    // Matcher estável (evita depender de instanceof/interop)
    const pipeArg = (appMock as any).useGlobalPipes.mock.calls[0][0];
    expect(pipeArg).toBeTruthy();
    expect(pipeArg.validatorOptions).toMatchObject({ whitelist: true });

    expect((appMock as any).listen).toHaveBeenCalledWith(3000);
  });

  it('DD_TRACE_SAMPLE_RATE inválido => Number.isNaN branch => sampleRate=1', async () => {
    process.env.DD_TRACE_SAMPLE_RATE = 'nope';

    require('../../src/main');
    await flushAsync();

    expect(ddInitMock).toHaveBeenCalledTimes(1);
    const initArg = ddInitMock.mock.calls[0][0];
    expect(initArg.sampleRate).toBe(1);
  });

  it('DD_TRACE_SAMPLE_RATE válido + DD_* + PORT => sampleRate number e listen(Number(PORT))', async () => {
    process.env.DD_TRACE_SAMPLE_RATE = '0.25';
    process.env.DD_SERVICE = 'my-service';
    process.env.DD_ENV = 'ci';
    process.env.DD_VERSION = '1.2.3';
    process.env.PORT = '3333';

    require('../../src/main');
    await flushAsync();

    expect(ddInitMock).toHaveBeenCalledTimes(1);
    const initArg = ddInitMock.mock.calls[0][0];
    expect(initArg.service).toBe('my-service');
    expect(initArg.env).toBe('ci');
    expect(initArg.version).toBe('1.2.3');
    expect(initArg.sampleRate).toBe(0.25);

    expect((appMock as any).listen).toHaveBeenCalledWith(3333);
  });
});
