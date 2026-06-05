import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../user/entities/user.entity';
import { SuperAdminEntity } from '../super-admin/entities/super-admin.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import {
  comparePassword,
  hashPassword,
} from '../../common/utils/password.util';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import * as crypto from 'crypto';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(SuperAdminEntity)
    private readonly superAdminRepository: Repository<SuperAdminEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventProducer: EventProducer,
  ) {}

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    let isSuperAdmin = false;
    let superAdminUser: SuperAdminEntity | null = null;

    if (!user) {
      // Check if it is a Super Admin
      superAdminUser = await this.superAdminRepository.findOne({
        where: { email: dto.email },
      });

      if (!superAdminUser) {
        this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
          event_type: AuditEventType.AUTH_LOGIN_FAILED,
          payload: { email: dto.email, reason: 'User not found' },
        });
        throw new UnauthorizedException('Invalid credentials');
      }
      isSuperAdmin = true;
    }

    if (user && !user.is_active) {
      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.AUTH_LOGIN_FAILED,
        payload: { email: dto.email, reason: 'User inactive' },
      });
      throw new UnauthorizedException('User account is inactive');
    }

    if (superAdminUser && !superAdminUser.is_active) {
      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.AUTH_LOGIN_FAILED,
        payload: { email: dto.email, reason: 'SuperAdmin inactive' },
      });
      throw new UnauthorizedException('SuperAdmin account is inactive');
    }

    const passwordHash = isSuperAdmin
      ? superAdminUser!.password_hash
      : user!.password_hash;
    const isMatch = await comparePassword(dto.password, passwordHash);
    if (!isMatch) {
      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.AUTH_LOGIN_FAILED,
        payload: { email: dto.email, reason: 'Invalid password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const { access_token, refresh_token, expires_in } = isSuperAdmin
      ? await this.generateSuperAdminTokens(superAdminUser!)
      : await this.generateTokens(user!);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.AUTH_LOGIN_SUCCESS,
      tenant_id: isSuperAdmin ? undefined : user!.tenant_id,
      actor_id: isSuperAdmin ? superAdminUser!.id : user!.id,
      resource_type: isSuperAdmin ? 'super_admin' : 'user',
      resource_id: isSuperAdmin ? superAdminUser!.id : user!.id,
      payload: { email: dto.email },
    });

    return { access_token, refresh_token, token_type: 'Bearer', expires_in };
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenResponseDto> {
    const [userIdPrefix, actualToken] = dto.refresh_token.split('.');
    if (!userIdPrefix || !actualToken) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const hashedTokens = await this.refreshTokenRepository.find({
      where: { user_id: userIdPrefix },
    });
    let validToken: RefreshTokenEntity | undefined;
    let userId: string = '';

    // Find the matching hash
    for (const token of hashedTokens) {
      if (await comparePassword(actualToken, token.token_hash)) {
        validToken = token;
        userId = token.user_id;
        break;
      }
    }

    if (!validToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (validToken.expires_at < new Date()) {
      await this.refreshTokenRepository.delete(validToken.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User inactive or deleted');
    }

    // Delete the used token
    await this.refreshTokenRepository.delete(validToken.id);

    // Generate new pair
    const { access_token, refresh_token, expires_in } =
      await this.generateTokens(user);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.AUTH_TOKEN_REFRESHED,
      tenant_id: user.tenant_id,
      actor_id: user.id,
      resource_type: 'user',
      resource_id: user.id,
      payload: {},
    });

    return { access_token, refresh_token, token_type: 'Bearer', expires_in };
  }

  async logout(userId: string, tenantId: string): Promise<void> {
    await this.refreshTokenRepository.delete({ user_id: userId });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.AUTH_LOGOUT,
      tenant_id: tenantId,
      actor_id: userId,
      resource_type: 'user',
      resource_id: userId,
      payload: {},
    });
  }

  private async generateTokens(user: UserEntity) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      identity_type: 'USER',
    };

    const accessTtl = this.configService.get<number>('jwt.accessTtl') || 900;
    const refreshTtl =
      this.configService.get<number>('jwt.refreshTtl') || 604800;

    const access_token = this.jwtService.sign(payload, {
      expiresIn: accessTtl,
    });

    // Generate secure random string for refresh token
    const plainRefreshToken = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = await hashPassword(plainRefreshToken);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + refreshTtl);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      user_id: user.id,
      token_hash: hashedRefreshToken,
      expires_at: expiresAt,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      access_token,
      refresh_token: `${user.id}.${plainRefreshToken}`,
      expires_in: accessTtl,
    };
  }

  private async generateSuperAdminTokens(superAdmin: SuperAdminEntity) {
    const payload = {
      sub: superAdmin.id,
      email: superAdmin.email,
      tenant_id: null,
      identity_type: 'SUPER_ADMIN',
    };

    const accessTtl = this.configService.get<number>('jwt.accessTtl') || 900;

    const access_token = this.jwtService.sign(payload, {
      expiresIn: accessTtl,
    });

    const plainRefreshToken = crypto.randomBytes(40).toString('hex');
    // Super admins are not stored in the users table, so we cannot persist
    // a refresh token with a FK → users.id. Return a prefixed opaque token
    // that is accepted by refresh() but will not match any DB row, causing
    // a graceful "Invalid refresh token" error rather than a FK violation.
    return {
      access_token,
      refresh_token: `${superAdmin.id}.${plainRefreshToken}`,
      expires_in: accessTtl,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        tenant_id: true,
        is_active: true,
        manager_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (user) {
      return {
        ...user,
        identity_type: 'USER',
      };
    }

    // Check if it's a SuperAdmin
    const superAdmin = await this.superAdminRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!superAdmin) {
      throw new BadRequestException('User not found');
    }

    return {
      ...superAdmin,
      first_name: 'Super',
      last_name: 'Admin',
      tenant_id: null,
      manager_id: null,
      identity_type: 'SUPER_ADMIN',
    };
  }
}
