import { chromium } from 'playwright';
import path from 'path';

const USER_DATA_DIR =
  process.env.BOT_USER_DATA_DIR ?? path.join(process.cwd(), '.bot-profile');

async function main() {
  console.log(`[login] Opening browser with profile at: ${USER_DATA_DIR}`);
  console.log('[login] Log into the bot Google account, then close the browser window.');

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: 'chrome',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await context.newPage();
  await page.goto('https://accounts.google.com');

  await context.waitForEvent('close').catch(() => {});
  console.log('[login] Session saved. You can now run: npm run dev');
}

main().catch(console.error);
