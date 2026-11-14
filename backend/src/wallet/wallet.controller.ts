import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedRequest } from '../common/types';
import { SettingsService } from '../settings/settings.service';

@Controller('api')
export class WalletController {
  constructor(private readonly wallet: WalletService, private readonly settings: SettingsService) {}

  @Get('wallet/me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthedRequest) {
    const [wallet, minWithdrawal] = await Promise.all([this.wallet.getWallet(req.user!.sub), this.settings.getMinWithdrawal()]);
    return { ...wallet, minWithdrawal: minWithdrawal.toFixed(2) };
  }

  @Get('settings/withdrawal-methods')
  async methods() {
    const [methods, minWithdrawal, registrationBonus, referralReward] = await Promise.all([
      this.settings.getWithdrawalMethods(),
      this.settings.getMinWithdrawal(),
      this.settings.getRegistrationBonus(),
      this.settings.getReferralReward(),
    ]);
    return {
      methods,
      minWithdrawal: minWithdrawal.toFixed(2),
      registrationBonus: registrationBonus.toFixed(2),
      referralReward: referralReward.toFixed(2),
    };
  }
}
