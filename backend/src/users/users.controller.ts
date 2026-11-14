import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedRequest } from '../common/types';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.users.getProfile(req.user!.sub);
  }

  @Get('me/transactions')
  transactions(@Req() req: AuthedRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.users.getTransactions(req.user!.sub, Number(page) || 1, Number(limit) || 20);
  }

  @Get('me/referrals')
  referrals(@Req() req: AuthedRequest) {
    return this.users.getReferralsMade(req.user!.sub);
  }
}
