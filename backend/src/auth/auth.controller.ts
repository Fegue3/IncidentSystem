// backend/src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { AccessJwtGuard } from './guards/access-jwt.guard';
import { RefreshJwtGuard } from './guards/refresh-jwt.guard';

type ReqUser = {
  sub: string;
  email: string;
  role?: string;
  refreshToken?: string;
  teamId?: string | null;
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('logout')
  @UseGuards(AccessJwtGuard)
  async logout(@Req() req: { user: ReqUser }) {
    return this.auth.logout(req.user.sub);
  }

  @Post('refresh')
  @UseGuards(RefreshJwtGuard)
  async refresh(@Req() req: { user: ReqUser }, @Body() b: any) {
    return this.auth.refresh(
      req.user.sub,
      b?.refreshToken ?? req.user.refreshToken!,
    );
  }

  @Get('me')
  @UseGuards(AccessJwtGuard)
  me(@Req() req: { user: ReqUser }) {
    return {
      userId: req.user.sub,
      email: req.user.email,
      role: req.user.role,
      teamId: req.user.teamId ?? null, 
    };
  }

  @Post('change-password')
  @UseGuards(AccessJwtGuard)
  changePassword(@Req() req: { user: ReqUser }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      req.user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  @Delete('delete-account')
  @UseGuards(AccessJwtGuard)
  deleteAccount(@Req() req: { user: ReqUser }) {
    return this.auth.deleteAccount(req.user.sub);
  }

  @Post('request-password-reset')
  async requestReset(@Body() b: any) {
    return this.auth.requestPasswordReset(b.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
