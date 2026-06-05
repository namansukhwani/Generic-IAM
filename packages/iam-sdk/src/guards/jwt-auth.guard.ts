/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject('JWT_SECRET') private readonly jwtSecret: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      this.logger.log('JWTAuth | Public route');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;

      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      request.user = payload;
      this.logger.log('JWTAuth | Valid token');
      return true;
    } catch (e) {
      this.logger.log('JWTAuth | Invalid token', e);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
