import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { UsersRepository } from '../src/users/users.repository';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    validatePassword: jest.fn(),
    changePassword: jest.fn(),
  };

  const usersRepoMock = {
    setRefreshToken: jest.fn(),
    delete: jest.fn(),
    setPassword: jest.fn(),
    setResetToken: jest.fn(),
    clearResetToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    // Segredos antes de criar o módulo
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'b';

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UsersRepository, useValue: usersRepoMock },
        JwtService,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('register -> returns user + tokens', async () => {
    usersServiceMock.create.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      name: '',
    });

    const res = await service.register('a@a.com', 'password');
    expect(res.user.id).toBe('u1');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('login invalid -> throws', async () => {
    usersServiceMock.findByEmail.mockResolvedValue(null);
    await expect(service.login('x@x.com', '123')).rejects.toBeTruthy();
  });
});
