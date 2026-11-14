import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedRequest } from '../common/types';

@Controller('api/referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me/stats')
  stats(@Req() req: AuthedRequest) {
    return this.referrals.getMyStats(req.user!.sub);
  }

  @Get('me/list')
  list(@Req() req: AuthedRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.referrals.getMyReferrals(req.user!.sub, Number(page) || 1, Number(limit) || 50);
  }
}
