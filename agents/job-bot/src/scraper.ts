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

const DETAIL_TIMEOUT_MS = 2_000;

/** Map our remote preference to LinkedIn's `f_WT` workplace-type filter. */
function remoteFilter(pref?: string): string | undefined {
  if (pref === 'onsite') return '1';
  if (pref === 'remote') return '2';
  if (pref === 'hybrid') return '3';
  return undefined;
}

/**
 * Scrape LinkedIn's jobs search for the user's preferences and return up to `max`
 * listings. Discover-only: it reads listings, never applies.
 *
 * NOTE: LinkedIn's DOM changes often and is bot-gated; the selectors below are
 * best-effort with fallbacks and will need tuning against the live site once a
 * platform account + proxy are configured.
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

  const cardSelector =
    '.scaffold-layout__list-item, .jobs-search-results__list-item, .job-card-container';
  await page.waitForSelector(cardSelector, { timeout: 20_000 }).catch(() => undefined);

  const cards = await page.$$(cardSelector);
  const results: ScrapedJob[] = [];

  for (const card of cards.slice(0, max)) {
    try {
      await card.click();
      await page.waitForTimeout(DETAIL_TIMEOUT_MS); // let the detail pane render

      const title = await text(
        page,
        '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title',
      );
      const company = await text(
        page,
        '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name',
      );
      const loc = await text(
        page,
        '.job-details-jobs-unified-top-card__primary-description-container, .jobs-unified-top-card__bullet',
      );
      const description = await text(page, '#job-details, .jobs-description__content');
      const url = page.url();

      if (title && description.length >= 20) {
        results.push({
          url,
          title,
          company,
          location: loc || undefined,
          description: description.slice(0, 6_000),
        });
      }
    } catch {
      // Skip cards that fail to load; keep going.
    }
  }

  return results;
}

async function text(page: Page, selector: string): Promise<string> {
  const value = await page
    .locator(selector)
    .first()
    .textContent()
    .catch(() => '');
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
