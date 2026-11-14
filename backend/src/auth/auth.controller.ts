import { Body, Controller, ForbiddenException, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InitAuthDto } from './dto';
import { AuthedRequest } from '../common/types';
import { UsersService } from '../users/users.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly users: UsersService) {}

  /** Mini App sign-in: verifies Telegram initData and returns a session JWT. `/init` kept as an alias. */
  @Post(['telegram', 'init'])
  @HttpCode(200)
  @UseGuards(TelegramAuthGuard)
  async init(@Req() req: AuthedRequest, @Body() _body: InitAuthDto) {
    const { user, isNew } = await this.users.registerOrGet(req.telegramUser!, req.telegramStartParam);
    if (user.isBlocked) throw new ForbiddenException('Your account has been blocked. Contact support.');
    const profile = await this.users.getProfile(user.id);
    return {
      token: this.auth.generateUserToken(user.id),
      user: profile.user,
      wallet: profile.wallet,
      isNew,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  refresh(@Req() req: AuthedRequest) {
    return { token: this.auth.generateUserToken(req.user!.sub) };
  }
}
