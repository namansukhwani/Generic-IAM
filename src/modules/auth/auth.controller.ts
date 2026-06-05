import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser, Public } from '@iam/nestjs-sdk';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sub, user.tenant_id as string);
  }

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
