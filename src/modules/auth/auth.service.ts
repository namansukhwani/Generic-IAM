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
    if (!user) {
      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.AUTH_LOGIN_FAILED,
        payload: { email: dto.email, reason: 'User not found' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.AUTH_LOGIN_FAILED,
        payload: { email: dto.email, reason: 'User inactive' },
      });
      throw new UnauthorizedException('User account is inactive');
    }

    const isMatch = await comparePassword(dto.password, user.password_hash);
    if (!isMatch) {
      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.AUTH_LOGIN_FAILED,
        payload: { email: dto.email, reason: 'Invalid password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const { access_token, refresh_token, expires_in } =
      await this.generateTokens(user);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.AUTH_LOGIN_SUCCESS,
      tenant_id: user.tenant_id,
      actor_id: user.id,
      resource_type: 'user',
      resource_id: user.id,
      payload: { email: user.email },
    });

    return { access_token, refresh_token, token_type: 'Bearer', expires_in };
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenResponseDto> {
    const hashedTokens = await this.refreshTokenRepository.find();
    let validToken: RefreshTokenEntity | undefined;
    let userId: string = '';

    // Find the matching hash
    for (const token of hashedTokens) {
      if (await comparePassword(dto.refresh_token, token.token_hash)) {
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
      refresh_token: plainRefreshToken,
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
    if (!user) throw new BadRequestException('User not found');
    return user;
  }
}
