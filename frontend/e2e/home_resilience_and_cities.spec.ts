import { test, expect } from '@playwright/test';

interface CityTestSpec {
  id: number;
  name: string;
  slug: string;
  isSeeded: boolean;
}

const ALL_12_CITIES: CityTestSpec[] = [
  // 7 Seeded Production Cities
  { id: 1, name: 'Bengaluru', slug: 'bengaluru', isSeeded: true },
  { id: 2, name: 'Mumbai', slug: 'mumbai', isSeeded: true },
  { id: 3, name: 'Delhi NCR', slug: 'delhi-ncr', isSeeded: true },
  { id: 4, name: 'Hyderabad', slug: 'hyderabad', isSeeded: true },
  { id: 5, name: 'Chennai', slug: 'chennai', isSeeded: true },
  { id: 6, name: 'Pune', slug: 'pune', isSeeded: true },
  { id: 7, name: 'Kolkata', slug: 'kolkata', isSeeded: true },
  // 5 Additional / Simulated Expansion Cities (to verify empty state & resilience)
  { id: 8, name: 'Ahmedabad', slug: 'ahmedabad', isSeeded: false },
  { id: 9, name: 'Chandigarh', slug: 'chandigarh', isSeeded: false },
  { id: 10, name: 'Jaipur', slug: 'jaipur', isSeeded: false },
  { id: 11, name: 'Kochi', slug: 'kochi', isSeeded: false },
  { id: 12, name: 'Lucknow', slug: 'lucknow', isSeeded: false },
];

test.describe('Home Page City Loading, Resilience & Skeleton Prevention', () => {

  test.describe('Production Seeded Cities (Fast Load < 3s, Hero & >=12 Movies, Zero Errors)', () => {
    for (const city of ALL_12_CITIES.filter((c) => c.isSeeded)) {
      test(`City ${city.id}: ${city.name} loads Hero & >=12 movies within 3s with no console errors`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text();
            // Ignore minor third-party or benign favicon/tracker logs if any
            if (!text.includes('favicon') && !text.includes('chrome-extension')) {
              consoleErrors.push(text);
            }
          }
        });

        // Initialize city in localStorage before navigation
        await page.addInitScript(
          ({ id, slug, name }) => {
            localStorage.setItem('cineverse_city', slug);
            localStorage.setItem('cineverse_city_id', id.toString());
            localStorage.setItem('cineverse_city_name', name);
            localStorage.setItem('cineverse_city_modal_dismissed', 'true');
          },
          { id: city.id, slug: city.slug, name: city.name }
        );

        const startTime = Date.now();
        await page.goto('/');

        // 1. Verify Hero is rendered and not stuck on skeleton
        const heroSection = page.locator('[data-testid="hero-movie-of-day"]');
        await expect(heroSection).toBeVisible({ timeout: 3000 });

        // Ensure skeleton is NOT present
        const heroSkeleton = page.locator('[data-testid="hero-skeleton"]');
        await expect(heroSkeleton).toHaveCount(0);

        // Verify Hero contents
        const heroTitle = heroSection.locator('h1');
        await expect(heroTitle).toBeVisible();
        const titleText = await heroTitle.innerText();
        expect(titleText.trim().length).toBeGreaterThan(0);

        // Verify CTAs
        await expect(page.locator('[data-testid="hero-book-tickets-btn"]')).toBeVisible();
        await expect(page.locator('[data-testid="hero-watch-trailer-btn"]')).toBeVisible();

        // 2. Verify Now Showing row is rendered with at least 12 movie cards
        const movieCards = page.locator('[data-testid="movie-card"]');
        await expect(movieCards.first()).toBeVisible({ timeout: 3000 });

        const cardsCount = await movieCards.count();
        expect(cardsCount).toBeGreaterThanOrEqual(12);

        // Verify Now Showing skeleton is gone
        await expect(page.locator('[data-testid="now-showing-skeleton"]')).toHaveCount(0);

        const loadDurationMs = Date.now() - startTime;
        console.log(`[PERF] City ${city.name} (id: ${city.id}): ${cardsCount} movies loaded in ${loadDurationMs}ms`);

        // Check performance constraint: within 3 seconds
        expect(loadDurationMs).toBeLessThan(3000);

        // Check no console errors
        expect(consoleErrors).toEqual([]);
      });
    }
  });

  test.describe('Unscheduled / Empty Cities (Shows Plain Message, Never Stuck on Skeleton)', () => {
    for (const city of ALL_12_CITIES.filter((c) => !c.isSeeded)) {
      test(`City ${city.id}: ${city.name} shows friendly empty state with plain message`, async ({ page }) => {
        await page.addInitScript(
          ({ id, slug, name }) => {
            localStorage.setItem('cineverse_city', slug);
            localStorage.setItem('cineverse_city_id', id.toString());
            localStorage.setItem('cineverse_city_name', name);
            localStorage.setItem('cineverse_city_modal_dismissed', 'true');
          },
          { id: city.id, slug: city.slug, name: city.name }
        );

        await page.goto('/');

        // Verify empty state is displayed rather than infinite skeleton
        const emptyHero = page.locator('[data-testid="hero-empty-state"]');
        await expect(emptyHero).toBeVisible({ timeout: 4500 });
        await expect(emptyHero).toContainText(`No Movies Scheduled in ${city.name}`);

        const emptyNowShowing = page.locator('[data-testid="now-showing-empty-state"]');
        await expect(emptyNowShowing).toBeVisible({ timeout: 4500 });
        await expect(emptyNowShowing).toContainText(`No Movies Currently Showing in ${city.name}`);

        // Confirm skeletons are gone
        await expect(page.locator('[data-testid="hero-skeleton"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="now-showing-skeleton"]')).toHaveCount(0);
      });
    }
  });

  test.describe('Error State & Recovery via Retry Button', () => {
    test('Simulate failing API: shows error state with Retry button, recovers when restored', async ({ page }) => {
      let failApi = true;

      await page.addInitScript(() => {
        localStorage.setItem('cineverse_city', 'bengaluru');
        localStorage.setItem('cineverse_city_id', '1');
        localStorage.setItem('cineverse_city_name', 'Bengaluru');
        localStorage.setItem('cineverse_city_modal_dismissed', 'true');
      });

      // Intercept movie API calls and simulate 500 error when failApi is true
      await page.route(/\/api\/v1\/movies/, async (route) => {
        if (failApi) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Simulated downstream server failure' }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/');

      // Skeletons must NOT stay forever: after timeout & retries, error state must appear
      const heroError = page.locator('[data-testid="hero-error-state"]');
      await expect(heroError).toBeVisible({ timeout: 6000 });
      await expect(heroError).toContainText('Unable to Load Movie of the Day');

      const heroRetryBtn = page.locator('[data-testid="hero-retry-btn"]');
      await expect(heroRetryBtn).toBeVisible();

      const nowShowingError = page.locator('[data-testid="now-showing-error-state"]');
      await expect(nowShowingError).toBeVisible({ timeout: 6000 });
      await expect(nowShowingError).toContainText('Unable to load Now Showing releases');

      const nowShowingRetryBtn = page.locator('[data-testid="now-showing-retry-btn"]');
      await expect(nowShowingRetryBtn).toBeVisible();

      // Confirm skeletons are replaced by error states
      await expect(page.locator('[data-testid="hero-skeleton"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="now-showing-skeleton"]')).toHaveCount(0);

      // Now heal the API
      failApi = false;

      // Click Retry on hero and Now Showing
      await heroRetryBtn.click();
      await nowShowingRetryBtn.click();

      // Verify page recovers gracefully and renders hero + movie cards
      await expect(page.locator('[data-testid="hero-movie-of-day"] h1')).toBeVisible({ timeout: 5000 });
      const cards = page.locator('[data-testid="movie-card"]');
      await expect(cards.first()).toBeVisible({ timeout: 5000 });
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(12);
    });

    test('Hero and Now Showing load independently: hero failure falls back to Now Showing movie', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('cineverse_city', 'bengaluru');
        localStorage.setItem('cineverse_city_id', '1');
        localStorage.setItem('cineverse_city_name', 'Bengaluru');
        localStorage.setItem('cineverse_city_modal_dismissed', 'true');
      });

      // Intercept only the hero-specific call (sort=popularity) to fail
      await page.route(/\/api\/v1\/movies.*sort=popularity/, async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Hero recommendation engine down' }),
        });
      });

      await page.goto('/');

      // Now Showing succeeds independently
      const movieCards = page.locator('[data-testid="movie-card"]');
      await expect(movieCards.first()).toBeVisible({ timeout: 4000 });
      expect(await movieCards.count()).toBeGreaterThanOrEqual(12);

      // Hero gracefully falls back to the first movie from Now Showing instead of showing an error
      const heroSection = page.locator('[data-testid="hero-movie-of-day"]');
      await expect(heroSection).toBeVisible({ timeout: 4000 });
      const heroTitle = await heroSection.locator('h1').innerText();
      expect(heroTitle.trim().length).toBeGreaterThan(0);
    });
  });
});
