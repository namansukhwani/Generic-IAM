import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { IdentityType } from '../../../common/constants/identity-types.constant';

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
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }

    const identityType =
      (payload.identity_type as IdentityType) || IdentityType.USER;

    if (identityType !== IdentityType.SUPER_ADMIN && !payload.tenant_id) {
      throw new UnauthorizedException('Missing tenant context');
    }

    return {
      sub: payload.sub,
      userId: payload.sub,
      tenant_id: payload.tenant_id,
      tenantId: payload.tenant_id,
      identity_type: identityType,
      identityType: identityType,
      email: payload.email,
    };
  }
}
