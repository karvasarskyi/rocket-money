import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { buildReferralLink, getAdminTelegramIds, getAppUrl } from '../common/config';
import { fmt } from '../common/money';

interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

/** Telegram bot running in webhook mode (no polling) – works inside Vercel serverless functions. */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly settings: SettingsService,
  ) {}

  private get token(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  }

  async callApi<T = any>(method: string, payload: Record<string, unknown>): Promise<T | null> {
    if (!this.token) {
      this.logger.warn(`TELEGRAM_BOT_TOKEN not set – skipping ${method}`);
      return null;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      const data: any = await res.json();
      if (!data.ok) {
        this.logger.warn(`Telegram ${method} failed: ${data.description}`);
        return null;
      }
      return data.result as T;
    } catch (err) {
      this.logger.warn(`Telegram ${method} error: ${(err as Error).message}`);
      return null;
    }
  }

  sendMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
    return this.callApi('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
  }

  async notifyAdmins(text: string) {
    await Promise.all(getAdminTelegramIds().map(id => this.sendMessage(id, text)));
  }

  private webAppKeyboard(label = '🚀 Open Rocket Money') {
    const url = getAppUrl();
    if (!url) return {};
    return { reply_markup: { inline_keyboard: [[{ text: label, web_app: { url } }]] } };
  }

  async handleUpdate(update: TgUpdate): Promise<void> {
    const msg = update.message;
    if (!msg || !msg.text || !msg.from || msg.from.is_bot) return;
    if (msg.chat.type !== 'private') return;

    const [rawCommand, ...args] = msg.text.trim().split(/\s+/);
    const command = rawCommand.split('@')[0].toLowerCase();

    try {
      switch (command) {
        case '/start':
          return await this.onStart(msg, args[0]);
        case '/help':
          return await this.onHelp(msg);
        case '/balance':
          return await this.onBalance(msg);
        case '/referral':
          return await this.onReferral(msg);
        case '/support':
          return await this.onSupport(msg);
        default:
          await this.sendMessage(msg.chat.id, 'Unknown command. Type /help to see what I can do.', this.webAppKeyboard());
      }
    } catch (err) {
      this.logger.error(`Failed to handle ${command}: ${(err as Error).message}`);
      await this.sendMessage(msg.chat.id, '⚠️ Something went wrong. Please try again in a moment.');
    }
  }

  private async onStart(msg: TgMessage, startParam?: string) {
    const from = msg.from!;
    let text: string;
    try {
      const { user, isNew, referralCredited } = await this.users.registerOrGet(from, startParam);
      if (user.isBlocked) {
        await this.sendMessage(msg.chat.id, '⛔ Your account has been blocked. Use /support to contact us.');
        return;
      }
      const bonus = await this.settings.getRegistrationBonus();
      if (isNew) {
        text =
          `🚀 Welcome to Rocket Money, ${from.first_name}!\n\n` +
          `🎁 You just received a $${fmt(bonus)} welcome bonus.\n` +
          (referralCredited ? '🤝 You joined through a friend\'s invite.\n' : '') +
          `\nInvite friends and earn for every friend who joins. Tap the button below to open your dashboard.`;
        if (referralCredited && user.referredById) {
          await this.notifyInviter(user.referredById, from.first_name);
        }
      } else {
        text = `👋 Welcome back, ${from.first_name}!\n\nTap the button below to open Rocket Money.`;
      }
    } catch (err) {
      this.logger.warn(`/start registration failed: ${(err as Error).message}`);
      text = `🚀 Welcome to Rocket Money!\n\n${(err as Error).message || 'Tap the button below to get started.'}`;
    }
    await this.sendMessage(msg.chat.id, text, this.webAppKeyboard());
  }

  private async notifyInviter(inviterId: string, inviteeName: string) {
    const inviter = await this.prisma.user.findUnique({ where: { id: inviterId } });
    if (!inviter) return;
    const reward = await this.settings.getReferralReward();
    await this.sendMessage(inviter.telegramId.toString(), `🎉 ${inviteeName} joined using your link! You earned $${fmt(reward)}.`);
  }

  private async onHelp(msg: TgMessage) {
    const [bonus, reward, min] = await Promise.all([
      this.settings.getRegistrationBonus(),
      this.settings.getReferralReward(),
      this.settings.getMinWithdrawal(),
    ]);
    await this.sendMessage(
      msg.chat.id,
      `🚀 Rocket Money – How it works\n\n` +
        `• Get a $${fmt(bonus)} welcome bonus when you join\n` +
        `• Earn $${fmt(reward)} for every friend who joins with your link\n` +
        `• Withdraw once you reach $${fmt(min)}\n\n` +
        `Commands:\n/start – Open the app\n/balance – Check your balance\n/referral – Get your invite link\n/support – Contact support\n/help – Show this message`,
      this.webAppKeyboard(),
    );
  }

  private async onBalance(msg: TgMessage) {
    const user = await this.users.findByTelegramId(msg.from!.id);
    if (!user || !user.wallet) {
      await this.sendMessage(msg.chat.id, 'You are not registered yet. Send /start to create your account.');
      return;
    }
    const w = user.wallet;
    await this.sendMessage(
      msg.chat.id,
      `💰 Your Rocket Money wallet\n\n` +
        `Available balance: $${fmt(w.balance)}\n` +
        `Pending withdrawal: $${fmt(w.pendingWithdraw)}\n` +
        `Total earned: $${fmt(w.totalEarned)}\n` +
        `Referral earnings: $${fmt(w.referralEarnings)}\n` +
        `Total withdrawn: $${fmt(w.totalWithdrawn)}`,
      this.webAppKeyboard('💼 Open Wallet'),
    );
  }

  private async onReferral(msg: TgMessage) {
    const user = await this.users.findByTelegramId(msg.from!.id);
    if (!user) {
      await this.sendMessage(msg.chat.id, 'You are not registered yet. Send /start to create your account.');
      return;
    }
    const [count, reward] = await Promise.all([
      this.prisma.referral.count({ where: { inviterId: user.id } }),
      this.settings.getReferralReward(),
    ]);
    const link = buildReferralLink(user.referralCode);
    await this.sendMessage(
      msg.chat.id,
      `🤝 Invite friends & earn $${fmt(reward)} per friend!\n\nYour link:\n${link}\n\nFriends invited: ${count}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Share link', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join me on Rocket Money and get a welcome bonus! 🚀')}` }],
          ],
        },
      },
    );
  }

  private async onSupport(msg: TgMessage) {
    const contact = process.env.SUPPORT_CONTACT || '';
    await this.sendMessage(
      msg.chat.id,
      `🛟 Need help?\n\n${contact ? `Contact our support team: ${contact}` : 'Reply to this chat describing your issue and our team will get back to you.'}`,
    );
    if (!contact) {
      // Let admins know a user asked for help so they can reach out.
      const from = msg.from!;
      await this.notifyAdmins(`🛟 Support requested by ${from.username ? '@' + from.username : from.first_name} (id ${from.id})`);
    }
  }
}
