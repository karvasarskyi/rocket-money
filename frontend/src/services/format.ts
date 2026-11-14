/** Display helpers. Amounts arrive from the API as decimal strings and are only formatted, never used for math. */
export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Compare two decimal strings with up to 2 decimals without floating point errors. */
export function toCents(value: string): number | null {
  const m = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 100 + parseInt((m[2] || '0').padEnd(2, '0'), 10);
}
