import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { TokenResponse } from '../../core/interfaces';
import { Types } from 'mongoose';
import { JwtConfigService } from 'src/modules/jwt/jwt-config.service';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../user/user.schema';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UserService,
    private readonly jwtConfigService: JwtConfigService,
  ) {}

  public async updateRefreshToken(
    userId: string | Types.ObjectId,
    refreshToken: string,
  ): Promise<UserDocument> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    return await this.usersService.updateRefreshToken(userId, {
      refreshToken: hashedRefreshToken,
    });
  }

  public async generateAccessToken(
    userId: string | Types.ObjectId,
    username: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, username },
      this.getJwtOptions(),
    );
  }

  public async generateRefreshToken(
    userId: string | Types.ObjectId,
    username: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, username },
      this.getRefreshToken(),
    );
  }

  public async refreshToken(
    userId: string | Types.ObjectId,
    refreshToken: string,
  ): Promise<string> {
    const user = await this.usersService.findById(userId);

    if (!user) throw new BadRequestException('User not found');

    if (!user.refreshToken) {
      throw new ForbiddenException('Refresh token is not found');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      user.refreshToken,
      refreshToken,
    );

    if (!isRefreshTokenValid) throw new ForbiddenException('Access Denied');

    const accessToken = await this.generateAccessToken(user._id, user.username);

    const newRefreshToken = await this.generateRefreshToken(
      user._id,
      user.username,
    );

    await this.updateRefreshToken(user._id, newRefreshToken);

    return accessToken;
  }

  public async generateAndSaveTokens(
    userId: string | Types.ObjectId,
    username: string,
  ): Promise<TokenResponse> {
    const accessToken = await this.generateAccessToken(userId, username);
    const refreshToken = await this.generateRefreshToken(userId, username);
    await this.updateRefreshToken(userId, refreshToken);

    return { accessToken, refreshToken };
  }

  private getJwtOptions(): JwtSignOptions {
    return this.jwtConfigService.createJwtOptions();
  }

  private getRefreshToken(): JwtSignOptions {
    return this.jwtConfigService.createJwtRefreshToken();
  }
}
