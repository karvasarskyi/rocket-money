import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fmt } from '../common/money';

type Tx = Prisma.TransactionClient;

/**
 * All balance mutations live here. Every method that changes money takes a transaction client
 * so callers compose them inside a single prisma.$transaction. Amounts are always Prisma.Decimal.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  /** Credits the one-time registration bonus. Idempotent: only applies if registrationBonus is still 0. */
  async creditRegistrationBonus(tx: Tx, userId: string, amount: Prisma.Decimal): Promise<boolean> {
    if (amount.lte(0)) return false;
    const res = await tx.wallet.updateMany({
      where: { userId, registrationBonus: 0 },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
        registrationBonus: amount,
      },
    });
    if (res.count === 0) return false;
    await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.REGISTRATION_BONUS,
        amount,
        status: TransactionStatus.COMPLETED,
        description: `Welcome bonus $${fmt(amount)}`,
      },
    });
    return true;
  }

  /** Credits a single-level referral reward to the inviter. */
  async creditReferralReward(tx: Tx, inviterId: string, inviteeId: string, inviteeName: string, amount: Prisma.Decimal) {
    await tx.wallet.update({
      where: { userId: inviterId },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
        referralEarnings: { increment: amount },
      },
    });
    await tx.transaction.create({
      data: {
        userId: inviterId,
        type: TransactionType.REFERRAL_REWARD,
        amount,
        status: TransactionStatus.COMPLETED,
        description: `Referral reward for inviting ${inviteeName}`,
        metadata: { inviteeId },
      },
    });
  }

  /** Moves funds from balance to pendingWithdraw. Fails if the available balance is insufficient. */
  async reserveWithdrawal(tx: Tx, userId: string, amount: Prisma.Decimal) {
    const res = await tx.wallet.updateMany({
      where: { userId, balance: { gte: amount } },
      data: {
        balance: { decrement: amount },
        pendingWithdraw: { increment: amount },
      },
    });
    if (res.count === 0) throw new BadRequestException('Insufficient balance');
  }

  /** Withdrawal paid: pending funds leave the system. */
  async releaseWithdrawal(tx: Tx, userId: string, amount: Prisma.Decimal) {
    const res = await tx.wallet.updateMany({
      where: { userId, pendingWithdraw: { gte: amount } },
      data: {
        pendingWithdraw: { decrement: amount },
        totalWithdrawn: { increment: amount },
      },
    });
    if (res.count === 0) throw new BadRequestException('Wallet pending amount is inconsistent with this withdrawal');
  }

  /** Withdrawal rejected: pending funds return to the available balance. */
  async reverseWithdrawal(tx: Tx, userId: string, amount: Prisma.Decimal) {
    const res = await tx.wallet.updateMany({
      where: { userId, pendingWithdraw: { gte: amount } },
      data: {
        pendingWithdraw: { decrement: amount },
        balance: { increment: amount },
      },
    });
    if (res.count === 0) throw new BadRequestException('Wallet pending amount is inconsistent with this withdrawal');
  }
}
