import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IncidentsModule } from './incidents/incidents.module';

@Module({
  imports: [PrismaModule, HealthModule, UsersModule, AuthModule, IncidentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
