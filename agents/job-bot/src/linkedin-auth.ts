import { Frame, Locator, Page } from 'playwright';

// The password field is the most stable signal that a sign-in form is present.
const PASSWORD_SELECTOR = 'input[type="password"], #password, #session_password';

// Email field IDs vary across LinkedIn's login variants; try the known ones, then
// fall back to "the first real text input in the form".
const EMAIL_SELECTORS = [
  '#username',
  '#session_key',
  'input[autocomplete="username"]',
  'input[name="session_key"]',
  'input[name="email"]',
  'input[type="email"]',
  'form input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="button"])',
];

/**
 * Log the platform LinkedIn account in (mirrors the meeting-bot's google-auth).
 * The persistent browser profile means this only does a full login on the first
 * run; afterwards the saved session is reused.
 *
 * LinkedIn serves several sign-in layouts and sometimes renders the form inside an
 * iframe, so we search every frame for the password field and operate inside the
 * frame that has it. On failure we dump per-frame input diagnostics + a screenshot.
 */
export async function loginToLinkedIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Reuse an existing session if the saved profile is still authenticated.
  await page
    .goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    .catch(() => undefined);
  await dismissCookieBanner(page);
  if (await isLoggedIn(page)) {
    console.log('[linkedin-auth] Session already active, skipping login.');
    return;
  }

  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await dismissCookieBanner(page);

  // The sign-in form may live in the main frame or an iframe — find whichever
  // frame actually contains the password field.
  const frame = await findFormFrame(page, 20_000);
  if (!frame) {
    await snapshot(page);
    await logFrameDiagnostics(page);
    throw new Error(
      `LinkedIn sign-in form not found in any frame (current page: ${page.url()}). ` +
        'Saved linkedin-login-debug.png and logged per-frame inputs above. ' +
        'Try BOT_HEADLESS=false and complete any challenge by hand.',
    );
  }

  const emailField = await firstExisting(frame, EMAIL_SELECTORS);
  if (!emailField) {
    await snapshot(page);
    await logFrameDiagnostics(page);
    throw new Error(
      `Found the LinkedIn password field but not the email field (frame: ${frame.url()}). ` +
        'Saved linkedin-login-debug.png and logged per-frame inputs above.',
    );
  }

  const passwordField = frame.locator(PASSWORD_SELECTOR).filter({ visible: true }).first();
  await emailField.fill(email);
  await passwordField.fill(password);
  await submitSignIn(frame, passwordField);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);

  if (await isLoggedIn(page)) {
    console.log('[linkedin-auth] Logged in.');
    return;
  }

  const after = page.url();
  if (after.includes('/checkpoint') || after.includes('/login') || after.includes('/uas/')) {
    await snapshot(page);
    throw new Error(
      `LinkedIn login failed or hit a checkpoint/CAPTCHA (current page: ${after}). ` +
        'Saved linkedin-login-debug.png.',
    );
  }
}

/**
 * Submit the sign-in form. Matches the button by EXACT accessible name so the
 * "Sign in with Apple" / "Continue with Google" buttons are excluded; falls back
 * to pressing Enter in the password field.
 */
async function submitSignIn(frame: Frame, passwordField: Locator): Promise<void> {
  const button = frame
    .getByRole('button', { name: /^(sign in|se connecter|connexion)$/i })
    .filter({ visible: true });
  if ((await button.count()) > 0) {
    await button.first().click({ timeout: 10_000 }).catch(() => passwordField.press('Enter'));
  } else {
    await passwordField.press('Enter');
  }
}

/** Poll every frame for the password field; return the first frame that has it. */
async function findFormFrame(page: Page, timeoutMs: number): Promise<Frame | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const has = await frame
        .locator(PASSWORD_SELECTOR)
        .filter({ visible: true })
        .count()
        .catch(() => 0);
      if (has > 0) return frame;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

/** Return a locator for the first selector that actually matches, else null. */
async function firstExisting(frame: Frame, selectors: string[]): Promise<Locator | null> {
  for (const sel of selectors) {
    const visible = frame.locator(sel).filter({ visible: true });
    if ((await visible.count()) > 0) return visible.first();
  }
  return null;
}

/**
 * Detect an active session. A logged-out browser gets bounced from /feed to a
 * login/authwall/home page, so the URL is the most reliable signal; we fall back
 * to a DOM check only when the URL is ambiguous.
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('/feed')) return true;
  if (url.includes('/login') || url.includes('/authwall') || url.includes('/uas/login')) {
    return false;
  }
  return page
    .locator('input[placeholder="Search"], .global-nav__me, [data-control-name="identity_welcome_message"]')
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
}

/** Accept LinkedIn's cookie banner if it appears (text varies by region/language). */
async function dismissCookieBanner(page: Page): Promise<void> {
  await page
    .locator(
      'button[action-type="ACCEPT"], button:has-text("Accept"), button:has-text("Accepter"), button:has-text("Agree")',
    )
    .first()
    .click({ timeout: 2_000 })
    .catch(() => undefined);
}

/** Print every input (type/id/name/autocomplete/placeholder) across all frames. */
async function logFrameDiagnostics(page: Page): Promise<void> {
  try {
    const out: unknown[] = [];
    for (const frame of page.frames()) {
      const inputs = await frame
        .locator('input')
        .evaluateAll((els) =>
          els.map((e) => ({
            type: e.getAttribute('type'),
            id: e.id,
            name: e.getAttribute('name'),
            autocomplete: e.getAttribute('autocomplete'),
            placeholder: e.getAttribute('placeholder'),
          })),
        )
        .catch(() => []);
      out.push({ frameUrl: frame.url(), inputs });
    }
    console.error('[linkedin-auth] frame/input diagnostics:\n' + JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('[linkedin-auth] diagnostics failed:', err);
  }
}

async function snapshot(page: Page): Promise<void> {
  await page.screenshot({ path: 'linkedin-login-debug.png', fullPage: true }).catch(() => undefined);
}
