// src/auth/guards/access-jwt.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
@Injectable()
export class AccessJwtGuard extends AuthGuard('jwt') {}
