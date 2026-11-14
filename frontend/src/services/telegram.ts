import WebApp from '@twa-dev/sdk';

/** True when the page is opened inside Telegram (initData is present). */
export const isInTelegram = () => Boolean(WebApp?.initData);

export function haptic(type: 'success' | 'error' | 'light' = 'light') {
  try {
    if (type === 'light') WebApp.HapticFeedback.impactOccurred('light');
    else WebApp.HapticFeedback.notificationOccurred(type);
  } catch {
    /* not available outside Telegram */
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function shareLink(link: string, text = 'Join me on Rocket Money and get a welcome bonus! 🚀') {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  try {
    if (isInTelegram()) {
      WebApp.openTelegramLink(url);
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(url, '_blank');
}

export { WebApp };
