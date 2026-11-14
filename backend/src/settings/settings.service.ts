import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const DEFAULTS = [
  { key: 'REGISTRATION_BONUS', value: '5.00', description: 'Bonus credited to new users on registration (USD)' },
  { key: 'REFERRAL_REWARD', value: '0.25', description: 'Reward credited to inviter for each successful referral (USD)' },
  { key: 'MIN_WITHDRAWAL', value: '25.00', description: 'Minimum amount allowed for withdrawal (USD)' },
  { key: 'WITHDRAWAL_METHODS', value: JSON.stringify(['Bank Transfer', 'USDT TRC-20', 'PayPal']), description: 'Available withdrawal methods (JSON array)' },
  { key: 'REFERRAL_SYSTEM_ENABLED', value: 'true', description: 'Enable or disable the referral system' },
  { key: 'REGISTRATION_ENABLED', value: 'true', description: 'Enable or disable new user registration' },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDefaults();
    } catch (err) {
      // Never crash the app on startup (e.g. migrations not applied yet); defaults are used as fallback.
      console.error('[settings] Could not ensure default settings:', (err as Error).message);
    }
  }

  async ensureDefaults() {
    const existing = await this.prisma.systemSettings.findMany({ select: { key: true } });
    const keys = new Set(existing.map(e => e.key));
    const missing = DEFAULTS.filter(d => !keys.has(d.key));
    if (missing.length) {
      await this.prisma.systemSettings.createMany({ data: missing, skipDuplicates: true });
    }
  }

  static readonly DEFAULTS = DEFAULTS;

  async get(key: string): Promise<string> {
    const setting = await this.prisma.systemSettings.findUnique({ where: { key } });
    if (!setting) {
      const def = DEFAULTS.find(d => d.key === key);
      return def ? def.value : '';
    }
    return setting.value;
  }

  async getRegistrationBonus(): Promise<Decimal> {
    const val = await this.get('REGISTRATION_BONUS');
    return new Decimal(val);
  }

  async getReferralReward(): Promise<Decimal> {
    const val = await this.get('REFERRAL_REWARD');
    return new Decimal(val);
  }

  async getMinWithdrawal(): Promise<Decimal> {
    const val = await this.get('MIN_WITHDRAWAL');
    return new Decimal(val);
  }

  async getWithdrawalMethods(): Promise<string[]> {
    const val = await this.get('WITHDRAWAL_METHODS');
    try {
      return JSON.parse(val);
    } catch {
      return ['Bank Transfer', 'USDT TRC-20', 'PayPal'];
    }
  }

  async isReferralEnabled(): Promise<boolean> {
    const val = await this.get('REFERRAL_SYSTEM_ENABLED');
    return val === 'true';
  }

  async isRegistrationEnabled(): Promise<boolean> {
    const val = await this.get('REGISTRATION_ENABLED');
    return val === 'true';
  }

  async getAll() {
    return this.prisma.systemSettings.findMany({ orderBy: { key: 'asc' } });
  }

  async update(key: string, value: string) {
    return this.prisma.systemSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
