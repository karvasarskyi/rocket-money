import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WalletService } from '../wallet/wallet.service';
import { TelegramUser } from '../common/types';
import { buildReferralLink } from '../common/config';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export interface RegistrationResult {
  user: User;
  isNew: boolean;
  referralCredited: boolean;
  inviterId?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly wallet: WalletService,
  ) {}

  findByTelegramId(telegramId: number | bigint) {
    return this.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) }, include: { wallet: true } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { wallet: true } });
  }

  /**
   * Finds an existing user or registers a new one. For new users, atomically (single DB transaction):
   * creates user + wallet, credits the registration bonus and, if a valid referral code is given,
   * creates the referral and credits the inviter. Safe against concurrent duplicate registration.
   */
  async registerOrGet(tg: TelegramUser, startParam?: string): Promise<RegistrationResult> {
    const telegramId = BigInt(tg.id);
    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (existing) {
      await this.syncProfile(existing, tg);
      return { user: existing, isNew: false, referralCredited: false };
    }

    if (!(await this.settings.isRegistrationEnabled())) {
      throw new ForbiddenException('Registration is temporarily closed.');
    }

    const [bonus, reward, referralEnabled] = await Promise.all([
      this.settings.getRegistrationBonus(),
      this.settings.getReferralReward(),
      this.settings.isReferralEnabled(),
    ]);
    const refCode = this.normalizeCode(startParam);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async tx => {
          const user = await tx.user.create({
            data: {
              telegramId,
              username: tg.username || null,
              firstName: (tg.first_name || 'User').slice(0, 64),
              lastName: tg.last_name ? tg.last_name.slice(0, 64) : null,
              referralCode: generateReferralCode(),
              wallet: { create: {} },
            },
          });

          await this.wallet.creditRegistrationBonus(tx, user.id, bonus);

          let referralCredited = false;
          let inviterId: string | undefined;
          if (refCode && referralEnabled) {
            const inviter = await tx.user.findUnique({ where: { referralCode: refCode } });
            const valid = inviter && inviter.id !== user.id && inviter.telegramId !== telegramId && !inviter.isBlocked;
            if (valid) {
              await tx.referral.create({
                data: { inviterId: inviter.id, inviteeId: user.id, rewardPaid: true, rewardAmount: reward },
              });
              await tx.user.update({ where: { id: user.id }, data: { referredById: inviter.id } });
              await this.wallet.creditReferralReward(tx, inviter.id, user.id, this.displayName(user), reward);
              referralCredited = true;
              inviterId = inviter.id;
            }
          }
          return { user, isNew: true, referralCredited, inviterId };
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = String((err.meta as any)?.target || '');
          // Another request registered this Telegram user concurrently -> return that user.
          const raced = await this.prisma.user.findUnique({ where: { telegramId } });
          if (raced) return { user: raced, isNew: false, referralCredited: false };
          if (target.includes('referral_code') || target.includes('referralCode')) continue; // code collision, retry
        }
        throw err;
      }
    }
    throw new Error('Could not generate a unique referral code');
  }

  private normalizeCode(code?: string): string | undefined {
    if (!code) return undefined;
    const c = code.trim().replace(/^ref_?/i, '').toUpperCase();
    return /^[A-Z0-9]{4,32}$/.test(c) ? c : undefined;
  }

  private async syncProfile(user: User, tg: TelegramUser) {
    const username = tg.username || null;
    const firstName = (tg.first_name || user.firstName).slice(0, 64);
    const lastName = tg.last_name ? tg.last_name.slice(0, 64) : null;
    if (user.username !== username || user.firstName !== firstName || user.lastName !== lastName) {
      await this.prisma.user.update({ where: { id: user.id }, data: { username, firstName, lastName } }).catch(e => {
        this.logger.warn(`Profile sync failed: ${e.message}`);
      });
    }
  }

  displayName(u: Pick<User, 'firstName' | 'username'>): string {
    return u.username ? `@${u.username}` : u.firstName;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, _count: { select: { referralsMade: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const { wallet, _count, ...rest } = user;
    return {
      user: {
        ...rest,
        referralCount: _count.referralsMade,
        referralLink: buildReferralLink(user.referralCode),
      },
      wallet,
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const p = Math.max(Number(page) || 1, 1);
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);
    return { items, total, page: p, limit: take, pages: Math.ceil(total / take) };
  }

  async getReferralsMade(userId: string) {
    const refs = await this.prisma.referral.findMany({
      where: { inviterId: userId },
      orderBy: { createdAt: 'desc' },
      include: { invitee: { select: { id: true, firstName: true, lastName: true, username: true, createdAt: true } } },
    });
    return refs.map(r => ({
      id: r.id,
      rewardAmount: r.rewardAmount,
      rewardPaid: r.rewardPaid,
      createdAt: r.createdAt,
      invitee: r.invitee,
    }));
  }
}
