import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType, WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WalletService } from '../wallet/wallet.service';
import { TelegramService } from '../telegram/telegram.service';
import { fmt, parseMoney } from '../common/money';
import { CreateWithdrawalDto } from './dto';

/** Allowed status transitions. PAID and REJECTED are final. */
const TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  PENDING: ['PROCESSING', 'APPROVED', 'REJECTED', 'PAID'],
  PROCESSING: ['APPROVED', 'REJECTED', 'PAID'],
  APPROVED: ['PROCESSING', 'REJECTED', 'PAID'],
  REJECTED: [],
  PAID: [],
};

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly wallet: WalletService,
    private readonly telegram: TelegramService,
  ) {}

  async create(userId: string, dto: CreateWithdrawalDto) {
    const amount = parseMoney(dto.amount);
    if (!amount || amount.lte(0)) throw new BadRequestException('Invalid amount');
    const [min, methods] = await Promise.all([this.settings.getMinWithdrawal(), this.settings.getWithdrawalMethods()]);
    if (amount.lt(min)) throw new BadRequestException(`Minimum withdrawal is $${fmt(min)}`);
    if (!methods.includes(dto.method)) throw new BadRequestException('Unsupported withdrawal method');
    const details = dto.paymentDetails.trim();
    if (details.length < 3) throw new BadRequestException('Payment details are too short');

    const withdrawal = await this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
      if (!user || user.isBlocked) throw new BadRequestException('Account is not allowed to withdraw');
      await this.wallet.reserveWithdrawal(tx, userId, amount);
      const w = await tx.withdrawal.create({
        data: { userId, amount, method: dto.method, paymentDetails: details, status: WithdrawalStatus.PENDING },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.WITHDRAWAL,
          amount: amount.negated(),
          status: TransactionStatus.PENDING,
          description: `Withdrawal via ${dto.method}`,
          metadata: { withdrawalId: w.id },
        },
      });
      return w;
    });

    // Awaited (with errors swallowed) so the message is sent before a serverless function freezes.
    await this.telegram
      .notifyAdmins(`💸 New withdrawal request: $${fmt(amount)} via ${dto.method}\nID: ${withdrawal.id}`)
      .catch(() => undefined);
    return withdrawal;
  }

  getMyWithdrawals(userId: string) {
    return this.prisma.withdrawal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getAll(params: { status?: string; page?: number; limit?: number; search?: string }) {
    const take = Math.min(Math.max(params.limit || 20, 1), 100);
    const page = Math.max(params.page || 1, 1);
    const where: Prisma.WithdrawalWhereInput = {};
    if (params.status && params.status in WithdrawalStatus) where.status = params.status as WithdrawalStatus;
    if (params.search) {
      const s = params.search.trim();
      where.OR = [
        { id: { contains: s } },
        { user: { username: { contains: s, mode: 'insensitive' } } },
        { user: { firstName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { user: { select: { id: true, telegramId: true, username: true, firstName: true, lastName: true } } },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return { items, total, page, limit: take, pages: Math.ceil(total / take) };
  }

  /** Change withdrawal status with wallet side effects and an audit log entry, all in one DB transaction. */
  async updateStatus(id: string, status: WithdrawalStatus, adminId: string, adminNote?: string) {
    const result = await this.prisma.$transaction(async tx => {
      const w = await tx.withdrawal.findUnique({ where: { id } });
      if (!w) throw new NotFoundException('Withdrawal not found');
      if (w.status === status) throw new BadRequestException(`Withdrawal is already ${status}`);
      if (!TRANSITIONS[w.status].includes(status)) {
        throw new BadRequestException(`Cannot change status from ${w.status} to ${status}`);
      }

      // Optimistic lock: only update if status has not changed concurrently.
      const upd = await tx.withdrawal.updateMany({
        where: { id, status: w.status },
        data: { status, adminNote: adminNote ?? w.adminNote, processedById: adminId },
      });
      if (upd.count === 0) throw new BadRequestException('Withdrawal was modified by someone else. Refresh and retry.');

      const linkedTx = await tx.transaction.findFirst({
        where: { userId: w.userId, type: TransactionType.WITHDRAWAL, metadata: { path: ['withdrawalId'], equals: w.id } },
      });

      if (status === WithdrawalStatus.PAID) {
        await this.wallet.releaseWithdrawal(tx, w.userId, w.amount);
        if (linkedTx) await tx.transaction.update({ where: { id: linkedTx.id }, data: { status: TransactionStatus.COMPLETED } });
      } else if (status === WithdrawalStatus.REJECTED) {
        await this.wallet.reverseWithdrawal(tx, w.userId, w.amount);
        if (linkedTx) await tx.transaction.update({ where: { id: linkedTx.id }, data: { status: TransactionStatus.REVERSED } });
        await tx.transaction.create({
          data: {
            userId: w.userId,
            type: TransactionType.WITHDRAWAL_REVERSAL,
            amount: w.amount,
            status: TransactionStatus.COMPLETED,
            description: `Withdrawal rejected – funds returned${adminNote ? `: ${adminNote}` : ''}`,
            metadata: { withdrawalId: w.id },
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: `WITHDRAWAL_${status}`,
          target: w.id,
          details: { from: w.status, to: status, amount: fmt(w.amount), userId: w.userId, adminNote: adminNote || null },
        },
      });

      return tx.withdrawal.findUnique({ where: { id }, include: { user: true } });
    });

    if (result?.user) {
      const messages: Partial<Record<WithdrawalStatus, string>> = {
        APPROVED: `✅ Your withdrawal of $${fmt(result.amount)} has been approved and will be paid soon.`,
        PROCESSING: `⏳ Your withdrawal of $${fmt(result.amount)} is being processed.`,
        PAID: `🎉 Your withdrawal of $${fmt(result.amount)} via ${result.method} has been paid!`,
        REJECTED: `❌ Your withdrawal of $${fmt(result.amount)} was rejected. The funds were returned to your balance.${adminNote ? `\nReason: ${adminNote}` : ''}`,
      };
      const msg = messages[status];
      if (msg) await this.telegram.sendMessage(result.user.telegramId.toString(), msg).catch(() => undefined);
    }
    return result;
  }
}
