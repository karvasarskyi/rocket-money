import { Request } from 'express';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface JwtPayload {
  sub: string;
  admin?: boolean;
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
  telegramUser?: TelegramUser;
  telegramStartParam?: string;
}
