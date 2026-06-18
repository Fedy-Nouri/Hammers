import { Page } from 'playwright';

export async function loginToGoogle(page: Page, email: string, password: string): Promise<void> {
  await page.goto('https://accounts.google.com/signin/v2/identifier', {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  await page.fill('input[type="email"]', email);
  await page.click('#identifierNext');

  await page.waitForSelector('input[type="password"]', { timeout: 15_000 });
  await page.fill('input[type="password"]', password);
  await page.click('#passwordNext');

  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20_000 });

  if (page.url().includes('accounts.google.com')) {
    throw new Error('Google login failed — still on accounts.google.com after login');
  }
}
