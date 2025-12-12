import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

function tryRequire(paths: string[]): any | null {
  for (const p of paths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(p);
      // tenta exports comuns
      return (
        mod?.JwtAuthGuard ??
        mod?.jwtAuthGuard ??
        mod?.AuthGuard ??
        mod?.RolesGuard ??
        mod?.default ??
        null
      );
    } catch {
      // ignore
    }
  }
  return null;
}

export async function createIntegrationApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  // tenta encontrar o JwtAuthGuard em paths típicos do Nest
  const JwtAuthGuardClass =
    tryRequire([
      '../../../src/auth/jwt-auth.guard',
      '../../../src/auth/guards/jwt-auth.guard',
      '../../../src/auth/guards/jwt.guard',
      '../../../src/auth/jwt.guard',
      '../../../src/common/guards/jwt-auth.guard',
    ]) ?? null;

  const RolesGuardClass =
    tryRequire([
      '../../../src/auth/roles.guard',
      '../../../src/auth/guards/roles.guard',
      '../../../src/common/guards/roles.guard',
    ]) ?? null;

  const builder = Test.createTestingModule({
    imports: [AppModule],
  });

  const moduleRef = await builder.compile();

  // cria um novo módulo com overrides (precisa do .overrideGuard antes do compile)
  const builder2 = Test.createTestingModule({
    imports: [AppModule],
  });

  if (JwtAuthGuardClass) {
    builder2.overrideGuard(JwtAuthGuardClass).useValue({ canActivate: () => true });
  }

  if (RolesGuardClass) {
    builder2.overrideGuard(RolesGuardClass).useValue({ canActivate: () => true });
  }

  const moduleRef2 = await builder2.compile();

  const app = moduleRef2.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}
