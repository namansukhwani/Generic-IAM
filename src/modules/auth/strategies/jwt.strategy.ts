import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default_secret',
    });
  }

  async validate(payload: JwtPayload) {
    // This payload is the decoded JWT token.
    // The passport strategy automatically attaches the returned object to the Request as req.user
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }
    return {
      sub: payload.sub,
      userId: payload.sub,
      tenant_id: payload.tenant_id,
      tenantId: payload.tenant_id,
      identity_type: payload.identity_type || 'USER',
      identityType: payload.identity_type || 'USER',
      email: payload.email,
    };
  }
}
