import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto, LoginDto, ChangePasswordDto, ResetPasswordDto } from '../../src/auth/dto/auth.dto';

describe('Auth DTOs (unit)', () => {
  it('RegisterDto: email inválido + password curta => erros', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'nope', password: '123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('RegisterDto: ok => 0 erros', async () => {
    const dto = plainToInstance(RegisterDto, { email: 'a@a.com', password: 'StrongPass1!' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('LoginDto: precisa de email válido', async () => {
    const dto = plainToInstance(LoginDto, { email: 'x', password: 'pw' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ChangePasswordDto: newPassword min 8', async () => {
    const dto = plainToInstance(ChangePasswordDto, { oldPassword: 'old', newPassword: '123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ResetPasswordDto: token + newPassword', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: '', newPassword: 'StrongPass1!' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
