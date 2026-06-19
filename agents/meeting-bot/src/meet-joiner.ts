import { Page } from 'playwright';

export type JoinResult = 'joined' | 'waiting';

export async function joinMeet(page: Page, meetUrl: string): Promise<JoinResult> {
  console.log(`[meet-joiner] Navigating to ${meetUrl}`);
  await page.goto(meetUrl, { waitUntil: 'networkidle', timeout: 45_000 });
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

  await mutePreJoinDevices(page);

  // Wait for either the "Join now" or "Ask to join" button — try role-based first, then text
  console.log('[meet-joiner] Waiting for join button…');
  const joinButton = await Promise.race([
    page.getByRole('button', { name: /join now/i }).waitFor({ timeout: 60_000 }).then(() =>
      page.getByRole('button', { name: /join now/i })
    ),
    page.getByRole('button', { name: /ask to join/i }).waitFor({ timeout: 60_000 }).then(() =>
      page.getByRole('button', { name: /ask to join/i })
    ),
  ]).catch(async () => {
    // Fallback: aria-label attribute selectors
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

  const isAskToJoin = /ask to join/i.test(label);
  await joinButton.click();
  console.log(`[meet-joiner] Clicked button — result: ${isAskToJoin ? 'waiting' : 'joined'}`);

  return isAskToJoin ? 'waiting' : 'joined';
}

async function mutePreJoinDevices(page: Page): Promise<void> {
  // Turn off camera
  await page.getByRole('button', { name: /turn off camera/i }).click({ timeout: 5_000 }).catch(() => {});
  await page.$('button[aria-label*="Turn off camera"]').then((b) => b?.click()).catch(() => {});

  // Turn off microphone
  await page.getByRole('button', { name: /turn off microphone/i }).click({ timeout: 5_000 }).catch(() => {});
  await page.$('button[aria-label*="Turn off microphone"]').then((b) => b?.click()).catch(() => {});

  console.log('[meet-joiner] Pre-join cam/mic muted');
}

export async function waitForAdmission(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    // If the "Ask to join" button is gone, we were admitted
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
