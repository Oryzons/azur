import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import type { AuthUser } from '@bleu-calanque/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    cfg: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
