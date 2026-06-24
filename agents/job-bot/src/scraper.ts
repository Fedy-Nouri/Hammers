import { Page } from 'playwright';

export interface ScrapePreferences {
  desiredTitles?: string[];
  locations?: string[];
  remotePref?: string;
  keywords?: string[];
  salaryMin?: number | null;
}

export interface ScrapedJob {
  url: string;
  title: string;
  company: string;
  location?: string;
  description: string;
}

const DETAIL_WAIT_MS = 2_500;

// The left-column job cards — LinkedIn's authenticated jobs list. We try several
// and use whichever matches the most elements (logged for diagnosis).
const CARD_SELECTORS = [
  'li[data-occludable-job-id]',
  'div.job-card-container',
  'li.scaffold-layout__list-item',
  '.jobs-search-results__list-item',
  '.scaffold-layout__list-item',
];

const TITLE_SELECTOR =
  '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .t-24';
const COMPANY_SELECTOR =
  '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name';
const LOCATION_SELECTOR =
  '.job-details-jobs-unified-top-card__primary-description-container, .jobs-unified-top-card__bullet';
const DESC_SELECTOR =
  '#job-details, .jobs-description__content, .jobs-description-content__text';

/** Map our remote preference to LinkedIn's `f_WT` workplace-type filter. */
function remoteFilter(pref?: string): string | undefined {
  if (pref === 'onsite') return '1';
  if (pref === 'remote') return '2';
  if (pref === 'hybrid') return '3';
  return undefined;
}

/**
 * Scrape LinkedIn's authenticated jobs search for the user's preferences. Logs
 * per-selector card counts and saves linkedin-jobs-debug.png so the listing DOM
 * can be diagnosed. Discover-only: reads listings, never applies.
 */
export async function scrapeJobs(
  page: Page,
  prefs: ScrapePreferences,
  max: number,
): Promise<ScrapedJob[]> {
  const keywords = [...(prefs.desiredTitles ?? []), ...(prefs.keywords ?? [])]
    .filter(Boolean)
    .join(' ');
  const location = (prefs.locations ?? []).filter(Boolean)[0] ?? '';

  const params = new URLSearchParams();
  if (keywords) params.set('keywords', keywords);
  if (location) params.set('location', location);
  const wt = remoteFilter(prefs.remotePref);
  if (wt) params.set('f_WT', wt);

  const searchUrl = `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3_000); // let the results list render

  // Diagnostics: which card selector matches, and how many.
  let cardSel = CARD_SELECTORS[0];
  let best = 0;
  for (const sel of CARD_SELECTORS) {
    const count = await page.locator(sel).count().catch(() => 0);
    console.log(`[scraper] card selector "${sel}" → ${count}`);
    if (count > best) {
      best = count;
      cardSel = sel;
    }
  }
  await page.screenshot({ path: 'linkedin-jobs-debug.png' }).catch(() => undefined);
  console.log(`[scraper] using "${cardSel}" (${best} cards) at ${page.url()}`);
  if (best === 0) return [];

  await autoScrollList(page, cardSel);

  const total = Math.min(await page.locator(cardSel).count(), max);
  const results: ScrapedJob[] = [];

  for (let i = 0; i < total; i++) {
    try {
      const card = page.locator(cardSel).nth(i);
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.click({ timeout: 5_000 });
      await page.waitForTimeout(DETAIL_WAIT_MS); // let the detail pane render

      const title = await text(page, TITLE_SELECTOR);
      const company = await text(page, COMPANY_SELECTOR);
      const loc = await text(page, LOCATION_SELECTOR);
      const description = await text(page, DESC_SELECTOR);

      if (title && description.length >= 20) {
        results.push({
          url: page.url(),
          title,
          company,
          location: loc || undefined,
          description: description.slice(0, 6_000),
        });
      } else {
        console.log(
          `[scraper] card ${i} skipped (title="${title.slice(0, 40)}" descLen=${description.length})`,
        );
      }
    } catch (err) {
      console.log(`[scraper] card ${i} failed: ${String(err)}`);
    }
  }

  console.log(`[scraper] extracted ${results.length}/${total} job(s)`);
  return results;
}

/** Scroll the last card into view repeatedly to trigger LinkedIn's lazy loading. */
async function autoScrollList(page: Page, cardSel: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const n = await page.locator(cardSel).count().catch(() => 0);
    if (n === 0) break;
    await page
      .locator(cardSel)
      .nth(n - 1)
      .scrollIntoViewIfNeeded()
      .catch(() => undefined);
    await page.waitForTimeout(1_000);
  }
}

async function text(page: Page, selector: string): Promise<string> {
  const value = await page
    .locator(selector)
    .first()
    .textContent()
    .catch(() => '');
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
