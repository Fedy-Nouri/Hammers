import { Page } from 'playwright';

export type JoinResult = 'joined' | 'waiting';

const JOIN_BUTTON_SELECTORS = [
  '[data-promo-anchor-id="join-button"]',
  'button[jsname="Qx7uuf"]',
  'button[aria-label*="Join now"]',
  'button[aria-label*="Ask to join"]',
];

const WAITING_ROOM_SELECTORS = [
  '[data-promo-anchor-id="waiting-room"]',
  'div[jsname="r4nke"]',
];

export async function joinMeet(page: Page, meetUrl: string): Promise<JoinResult> {
  await page.goto(meetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Dismiss pre-join camera/mic toggles by finding and clicking "off" state buttons
  await mutePreJoinDevices(page);

  // Wait for join or waiting room
  const joinHandle = await page.waitForSelector(
    [...JOIN_BUTTON_SELECTORS, ...WAITING_ROOM_SELECTORS].join(', '),
    { timeout: 30_000 },
  );

  const isWaitingRoom = await isWaitingRoomElement(page);
  if (isWaitingRoom) {
    // Click "Ask to join" if present
    const askBtn = await page.$('button[aria-label*="Ask to join"]');
    if (askBtn) await askBtn.click();
    return 'waiting';
  }

  if (joinHandle) await joinHandle.click();
  return 'joined';
}

async function mutePreJoinDevices(page: Page): Promise<void> {
  try {
    // Turn off camera before joining (aria-label patterns vary by locale)
    const camSelectors = [
      'button[aria-label*="Turn off camera"]',
      'button[data-is-muted="false"][aria-label*="camera"]',
    ];
    for (const sel of camSelectors) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }

    // Turn off microphone before joining
    const micSelectors = [
      'button[aria-label*="Turn off microphone"]',
      'button[data-is-muted="false"][aria-label*="microphone"]',
    ];
    for (const sel of micSelectors) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
  } catch {
    // Non-fatal — pre-join controls may not be present
  }
}

async function isWaitingRoomElement(page: Page): Promise<boolean> {
  for (const sel of WAITING_ROOM_SELECTORS) {
    const el = await page.$(sel);
    if (el) return true;
  }
  return false;
}

export async function waitForAdmission(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stillWaiting = await isWaitingRoomElement(page);
    if (!stillWaiting) return true;
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return false;
}
