import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WithdrawalsService } from './withdrawals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedRequest } from '../common/types';
import { CreateWithdrawalDto } from './dto';

@Controller('api/withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@Req() req: AuthedRequest, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawals.create(req.user!.sub, dto);
  }

  @Get('my')
  my(@Req() req: AuthedRequest) {
    return this.withdrawals.getMyWithdrawals(req.user!.sub);
  }
}
