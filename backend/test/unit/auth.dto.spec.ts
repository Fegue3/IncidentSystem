/**
 * @file test/unit/auth.dto.spec.ts
 * @module tests/unit/auth-dtos
 *
 * @summary
 *  - Testes unitários de validação dos DTOs de Auth (class-validator).
 *
 * @description
 *  - Garante que as anotações de validação nos DTOs estão a funcionar como esperado.
 *  - Usa plainToInstance + validate para simular transformação/validação.
 *
 * @dependencies
 *  - class-transformer: plainToInstance()
 *  - class-validator: validate()
 *
 * @notes
 *  - Estes testes não envolvem Nest, controller ou service. São puros (fast tests).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto, LoginDto, ChangePasswordDto, ResetPasswordDto } from '../../src/auth/dto/auth.dto';

describe('Auth DTOs (unit)', () => {
  it('RegisterDto: email inválido + password curta => erros', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'nope',
      password: '123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('RegisterDto: ok => 0 erros', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@a.com',
      password: 'StrongPass1!',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('LoginDto: precisa de email válido', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'x',
      password: 'pw',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ChangePasswordDto: newPassword min 8', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      oldPassword: 'old',
      newPassword: '123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ResetPasswordDto: token ausente => erros', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      newPassword: 'StrongPass1!',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ResetPasswordDto: token vazio é aceite (sem @IsNotEmpty) => 0 erros', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: '',
      newPassword: 'StrongPass1!',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
