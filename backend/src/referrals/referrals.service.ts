import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { buildReferralLink } from '../common/config';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService, private readonly settings: SettingsService) {}

  async getMyStats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } });
    if (!user) throw new NotFoundException('User not found');
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [total, today, reward] = await Promise.all([
      this.prisma.referral.count({ where: { inviterId: userId } }),
      this.prisma.referral.count({ where: { inviterId: userId, createdAt: { gte: startOfDay } } }),
      this.settings.getReferralReward(),
    ]);
    return {
      totalReferrals: total,
      todayReferrals: today,
      referralEarnings: user.wallet?.referralEarnings ?? new Prisma.Decimal(0),
      rewardPerReferral: reward.toFixed(2),
      referralCode: user.referralCode,
      referralLink: buildReferralLink(user.referralCode),
    };
  }

  async getMyReferrals(userId: string, page = 1, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const p = Math.max(page, 1);
    const [items, total] = await Promise.all([
      this.prisma.referral.findMany({
        where: { inviterId: userId },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        include: { invitee: { select: { firstName: true, lastName: true, username: true, createdAt: true } } },
      }),
      this.prisma.referral.count({ where: { inviterId: userId } }),
    ]);
    return {
      items: items.map(r => ({
        id: r.id,
        name: [r.invitee.firstName, r.invitee.lastName].filter(Boolean).join(' '),
        username: r.invitee.username,
        rewardAmount: r.rewardAmount,
        rewardPaid: r.rewardPaid,
        joinedAt: r.createdAt,
      })),
      total,
      page: p,
      limit: take,
    };
  }
}
