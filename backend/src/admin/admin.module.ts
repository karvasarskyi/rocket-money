import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController, AdminLoginController } from './admin.controller';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';

@Module({
  imports: [WithdrawalsModule],
  controllers: [AdminLoginController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
