import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WithdrawalStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAdminGuard } from '../auth/jwt-admin.guard';
import { AuthedRequest } from '../common/types';
import { AdminLoginDto, UpdateSettingsDto } from './dto';
import { UpdateWithdrawalDto } from '../withdrawals/dto';

@Controller('api/admin')
export class AdminLoginController {
  constructor(private readonly admin: AdminService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: AdminLoginDto) {
    return this.admin.login(dto.username, dto.password);
  }
}

@Controller('api/admin')
@UseGuards(JwtAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.admin.me(req.user!.sub);
  }

  @Get('stats')
  stats() {
    return this.admin.getStats();
  }

  @Get('users')
  users(@Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('blocked') blocked?: string) {
    return this.admin.getUsers({ search, page: Number(page) || 1, limit: Number(limit) || 20, blocked });
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.getUserById(id);
  }

  @Post('users/:id/block')
  @HttpCode(200)
  block(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.admin.blockUser(req.user!.sub, id);
  }

  @Post('users/:id/unblock')
  @HttpCode(200)
  unblock(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.admin.unblockUser(req.user!.sub, id);
  }

  @Get('transactions')
  transactions(@Query('type') type?: string, @Query('userId') userId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getTransactions({ type, userId, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Get('withdrawals')
  withdrawals(@Query('status') status?: string, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getWithdrawals({ status, search, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Patch('withdrawals/:id')
  updateWithdrawal(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateWithdrawalDto) {
    return this.admin.updateWithdrawal(req.user!.sub, id, dto.status as WithdrawalStatus, dto.adminNote);
  }

  @Get('settings')
  settings() {
    return this.admin.getSettings();
  }

  @Put('settings')
  updateSettings(@Req() req: AuthedRequest, @Body() dto: UpdateSettingsDto) {
    return this.admin.updateSettings(req.user!.sub, dto.settings);
  }

  @Get('audit-logs')
  auditLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getAuditLogs(Number(page) || 1, Number(limit) || 50);
  }
}
