import { Page } from 'playwright';

export type JoinResult = 'joined' | 'waiting';

export async function joinMeet(page: Page, meetUrl: string): Promise<JoinResult> {
  // Force English UI regardless of account language settings
  const url = meetUrl.includes('?') ? `${meetUrl}&hl=en` : `${meetUrl}?hl=en`;
  console.log(`[meet-joiner] Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  console.log(`[meet-joiner] Page loaded — current URL: ${page.url()}`);

  // Detect hard error screens before doing anything else
  const pageText = await page.textContent('body').catch(() => '');
  if (pageText) {
    if (/you can't join this (video )?call/i.test(pageText)) {
      throw new Error('Google Meet rejected join: "You can\'t join this call"');
    }
    if (/this meeting (hasn't|has not) started/i.test(pageText)) {
      throw new Error('Google Meet: meeting has not started yet');
    }
    if (/you need permission/i.test(pageText)) {
      throw new Error('Google Meet: bot account needs permission to join');
    }
  }

  // Dismiss any feature-suggestion popup (e.g. "Improve your video")
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByRole('button', { name: /not now|dismiss|skip|no thanks/i })
    .click({ timeout: 3_000 })
    .catch(() => {});
  await page.waitForTimeout(500);

  // Wait for the join button — its appearance signals the pre-join screen is fully rendered
  console.log('[meet-joiner] Waiting for join button…');
  const joinButton = await Promise.race([
    page.getByRole('button', { name: /join now/i }).waitFor({ timeout: 60_000 }).then(() =>
      page.getByRole('button', { name: /join now/i })
    ),
    page.getByRole('button', { name: /ask to join/i }).waitFor({ timeout: 60_000 }).then(() =>
      page.getByRole('button', { name: /ask to join/i })
    ),
  ]).catch(async () => {
    const fallbacks = [
      'button[aria-label*="Join now"]',
      'button[aria-label*="Ask to join"]',
      'button[aria-label*="Join"]',
    ];
    for (const sel of fallbacks) {
      const el = await page.$(sel);
      if (el) return el;
    }
    return null;
  });

  if (!joinButton) {
    throw new Error('Could not find a join button on the Google Meet page after 60s');
  }

  const buttonText = await joinButton.textContent().catch(() => '');
  const buttonLabel = await joinButton.getAttribute('aria-label').catch(() => '');
  const label = (buttonText ?? buttonLabel ?? '').trim();
  console.log(`[meet-joiner] Found button: "${label}"`);

  // Mute cam/mic AFTER join button is visible (pre-join screen fully rendered)
  await mutePreJoinDevices(page);

  const isAskToJoin = /ask to join/i.test(label);
  await joinButton.click();
  console.log(`[meet-joiner] Clicked button — result: ${isAskToJoin ? 'waiting' : 'joined'}`);

  return isAskToJoin ? 'waiting' : 'joined';
}

async function mutePreJoinDevices(page: Page): Promise<void> {
  // Small settle delay after the join button appeared
  await page.waitForTimeout(500);

  // Use page.evaluate so clicks run directly in the DOM — bypasses Playwright
  // actionability checks that can silently skip partially-rendered buttons
  const clicked = await page.evaluate(() => {
    const results: string[] = [];
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]'));
    for (const btn of buttons) {
      const label = btn.getAttribute('aria-label') ?? '';
      if (/turn off (camera|video|microphone)/i.test(label)) {
        btn.click();
        results.push(label);
      }
    }
    return results;
  });

  console.log(`[meet-joiner] Muted devices: ${clicked.length ? clicked.join(', ') : 'none found'}`);
}

export async function leaveMeet(page: Page): Promise<void> {
  try {
    await page.click('button[aria-label="Leave call"]', { timeout: 5_000 });
    console.log('[meet-joiner] Left meeting via Leave call button');
  } catch {
    try {
      await page.getByRole('button', { name: /leave call/i }).click({ timeout: 3_000 });
      console.log('[meet-joiner] Left meeting via Leave call button (role)');
    } catch {
      console.log('[meet-joiner] Leave button not found — browser will close anyway');
    }
  }
}

export async function waitForAdmission(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    const askBtn = await page.getByRole('button', { name: /ask to join/i }).count().catch(() => 0);
    if (askBtn === 0) {
      console.log(`[meet-joiner] Admitted after ${attempt} poll(s)`);
      return true;
    }
    console.log(`[meet-joiner] Still waiting for admission (poll ${attempt})…`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return false;
}
