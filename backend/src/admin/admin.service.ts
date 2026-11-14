import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, TransactionType, WithdrawalStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { parseMoney } from '../common/money';

// Real bcrypt hash of a random string, used so unknown usernames take the same time as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync(Math.random().toString(36), 10);

const MONEY_KEYS = ['REGISTRATION_BONUS', 'REFERRAL_REWARD', 'MIN_WITHDRAWAL'];
const BOOL_KEYS = ['REFERRAL_SYSTEM_ENABLED', 'REGISTRATION_ENABLED'];
const JSON_ARRAY_KEYS = ['WITHDRAWAL_METHODS'];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    // Compare against a dummy hash when the admin does not exist to keep timing uniform.
    const hash = admin?.password || DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!admin || !ok) throw new UnauthorizedException('Invalid username or password');
    await this.audit(admin.id, 'ADMIN_LOGIN', admin.id);
    return { token: this.auth.generateAdminToken(admin.id), admin: { id: admin.id, username: admin.username } };
  }

  async me(adminId: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId }, select: { id: true, username: true, createdAt: true } });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  private audit(adminId: string, action: string, target?: string, details?: Prisma.InputJsonValue) {
    return this.prisma.adminAuditLog.create({ data: { adminId, action, target, details } });
  }

  async getStats() {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [totalUsers, newUsersToday, blockedUsers, totalReferrals, referralsToday, walletAgg, pending, paid, bonuses, rewards] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
        this.prisma.user.count({ where: { isBlocked: true } }),
        this.prisma.referral.count(),
        this.prisma.referral.count({ where: { createdAt: { gte: startOfDay } } }),
        this.prisma.wallet.aggregate({ _sum: { balance: true, pendingWithdraw: true, totalEarned: true, totalWithdrawn: true } }),
        this.prisma.withdrawal.aggregate({
          where: { status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING, WithdrawalStatus.APPROVED] } },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.withdrawal.aggregate({ where: { status: WithdrawalStatus.PAID }, _sum: { amount: true }, _count: true }),
        this.prisma.transaction.aggregate({ where: { type: TransactionType.REGISTRATION_BONUS }, _sum: { amount: true } }),
        this.prisma.transaction.aggregate({ where: { type: TransactionType.REFERRAL_REWARD }, _sum: { amount: true } }),
      ]);
    const zero = new Prisma.Decimal(0);
    return {
      totalUsers,
      newUsersToday,
      blockedUsers,
      totalReferrals,
      referralsToday,
      totalBalance: walletAgg._sum.balance ?? zero,
      totalPendingWithdraw: walletAgg._sum.pendingWithdraw ?? zero,
      totalEarned: walletAgg._sum.totalEarned ?? zero,
      totalWithdrawn: walletAgg._sum.totalWithdrawn ?? zero,
      pendingWithdrawals: { count: pending._count, amount: pending._sum.amount ?? zero },
      paidWithdrawals: { count: paid._count, amount: paid._sum.amount ?? zero },
      totalBonusesPaid: bonuses._sum.amount ?? zero,
      totalReferralRewardsPaid: rewards._sum.amount ?? zero,
    };
  }

  async getUsers(params: { search?: string; page?: number; limit?: number; blocked?: string }) {
    const take = Math.min(Math.max(params.limit || 20, 1), 100);
    const page = Math.max(params.page || 1, 1);
    const where: Prisma.UserWhereInput = {};
    if (params.blocked === 'true') where.isBlocked = true;
    if (params.blocked === 'false') where.isBlocked = false;
    if (params.search) {
      const s = params.search.trim().replace(/^@/, '');
      const or: Prisma.UserWhereInput[] = [
        { username: { contains: s, mode: 'insensitive' } },
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { referralCode: { equals: s.toUpperCase() } },
        { id: s },
      ];
      if (/^\d{1,19}$/.test(s)) or.push({ telegramId: BigInt(s) });
      where.OR = or;
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { wallet: true, _count: { select: { referralsMade: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit: take, pages: Math.ceil(total / take) };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        referredBy: { select: { id: true, firstName: true, username: true, referralCode: true } },
        referralsMade: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { invitee: { select: { id: true, firstName: true, username: true, createdAt: true } } },
        },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
        withdrawals: { orderBy: { createdAt: 'desc' }, take: 50 },
        _count: { select: { referralsMade: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setBlocked(adminId: string, id: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isBlocked: blocked } }),
      this.prisma.adminAuditLog.create({
        data: { adminId, action: blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', target: id, details: { telegramId: user.telegramId.toString() } },
      }),
    ]);
    return updated;
  }

  blockUser(adminId: string, id: string) {
    return this.setBlocked(adminId, id, true);
  }

  unblockUser(adminId: string, id: string) {
    return this.setBlocked(adminId, id, false);
  }

  async getTransactions(params: { type?: string; userId?: string; page?: number; limit?: number }) {
    const take = Math.min(Math.max(params.limit || 20, 1), 100);
    const page = Math.max(params.page || 1, 1);
    const where: Prisma.TransactionWhereInput = {};
    if (params.type && params.type in TransactionType) where.type = params.type as TransactionType;
    if (params.userId) where.userId = params.userId;
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { user: { select: { id: true, firstName: true, username: true, telegramId: true } } },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items, total, page, limit: take, pages: Math.ceil(total / take) };
  }

  getWithdrawals(params: { status?: string; page?: number; limit?: number; search?: string }) {
    return this.withdrawals.getAll(params);
  }

  updateWithdrawal(adminId: string, id: string, status: WithdrawalStatus, adminNote?: string) {
    return this.withdrawals.updateStatus(id, status, adminId, adminNote);
  }

  getSettings() {
    return this.settings.getAll();
  }

  async updateSettings(adminId: string, input: Record<string, string>) {
    const known = new Set(SettingsService.DEFAULTS.map(d => d.key));
    const changes: Record<string, string> = {};
    for (const [key, raw] of Object.entries(input || {})) {
      if (!known.has(key)) throw new BadRequestException(`Unknown setting: ${key}`);
      let value = String(raw).trim();
      if (MONEY_KEYS.includes(key)) {
        const d = parseMoney(value);
        if (!d) throw new BadRequestException(`${key} must be a non-negative amount with up to 2 decimals`);
        value = d.toFixed(2);
      } else if (BOOL_KEYS.includes(key)) {
        if (!['true', 'false'].includes(value)) throw new BadRequestException(`${key} must be true or false`);
      } else if (JSON_ARRAY_KEYS.includes(key)) {
        let arr: unknown;
        try {
          arr = JSON.parse(value);
        } catch {
          throw new BadRequestException(`${key} must be a JSON array of strings`);
        }
        if (!Array.isArray(arr) || !arr.length || !arr.every(m => typeof m === 'string' && m.trim().length > 0)) {
          throw new BadRequestException(`${key} must be a non-empty JSON array of strings`);
        }
        value = JSON.stringify(arr.map(m => (m as string).trim()));
      }
      changes[key] = value;
    }
    if (!Object.keys(changes).length) throw new BadRequestException('No settings provided');
    await this.prisma.$transaction([
      ...Object.entries(changes).map(([key, value]) =>
        this.prisma.systemSettings.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
      this.prisma.adminAuditLog.create({ data: { adminId, action: 'SETTINGS_UPDATED', details: changes } }),
    ]);
    return this.settings.getAll();
  }

  async getAuditLogs(page = 1, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const p = Math.max(page, 1);
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        include: { admin: { select: { username: true } } },
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    return { items, total, page: p, limit: take, pages: Math.ceil(total / take) };
  }
}
