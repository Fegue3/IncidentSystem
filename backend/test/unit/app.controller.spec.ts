/**
 * @file test/unit/app.controller.spec.ts
 * @module tests/unit/app-controller
 *
 * @summary
 *  - Testes unitários do AppController.
 *
 * @description
 *  - Valida o comportamento básico do endpoint raiz (handler getHello()).
 *  - Usa TestingModule do Nest para instanciar o controller com o AppService real (sem mocks),
 *    porque o objetivo aqui é apenas validar o wiring e o retorno esperado.
 *
 * @dependencies
 *  - @nestjs/testing: cria um módulo isolado para testes unitários.
 *  - AppController/AppService: classes do módulo base.
 *
 * @errors
 *  - Sem casos de erro: apenas valida string retornada.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';

describe('AppController (unit)', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('deve devolver "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
