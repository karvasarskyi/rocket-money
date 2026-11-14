import { Prisma } from '@prisma/client';

export const Decimal = Prisma.Decimal;
export type DecimalValue = Prisma.Decimal;

/** Parse a user-supplied money amount into a Decimal with at most 2 decimal places. Returns null if invalid. */
export function parseMoney(input: unknown): Prisma.Decimal | null {
  if (input === null || input === undefined) return null;
  const str = String(input).trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(str)) return null;
  return new Prisma.Decimal(str);
}

export function fmt(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}
