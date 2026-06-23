import { Page } from 'playwright';

/**
 * Log the platform LinkedIn account in (mirrors the meeting-bot's google-auth).
 * The persistent browser profile means this only does a full login on the first
 * run; afterwards the saved session is reused.
 *
 * NOTE: LinkedIn aggressively detects automation. A checkpoint / CAPTCHA / 2FA
 * page is treated as a failure here — running behind a stable proxy and a warmed
 * profile reduces how often that happens.
 */
export async function loginToLinkedIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Reuse an existing session if the saved profile is still authenticated.
  await page
    .goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 20_000 })
    .catch(() => undefined);
  const url = page.url();
  if (!url.includes('/login') && !url.includes('/authwall') && !url.includes('/uas/login')) {
    const loggedIn = await page
      .locator('input[placeholder*="Search"], .global-nav')
      .first()
      .isVisible()
      .catch(() => false);
    if (loggedIn) {
      console.log('[linkedin-auth] Session already active, skipping login.');
      return;
    }
  }

  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.fill('#username', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);

  const after = page.url();
  if (after.includes('/checkpoint') || after.includes('/login')) {
    throw new Error('LinkedIn login failed or hit a checkpoint (CAPTCHA/2FA)');
  }
  console.log('[linkedin-auth] Logged in.');
}
