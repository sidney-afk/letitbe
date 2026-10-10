import { expect, test } from '@playwright/test';

test('parcours principal multi-navigateur', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const erreurs = [];
  page.on('pageerror', erreur => erreurs.push(erreur.message));
  page.on('console', message => {
    if (message.type() === 'error') erreurs.push(message.text());
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('pret')
    && window.__sillage?.camera && window.__sillage?.timeline);
  await page.evaluate(() => window.__sillage.sauteIntro());

  const mode = page.locator('#mode-bouton');
  await mode.click();
  // the first switch waits for the on-demand realistic textures, whose
  // software decode can outlast the default 8 s on a busy runner
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'photo', { timeout: 30_000 });
  await mode.click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'carnet');

  const recit = page.locator('#recit-bouton');
  await recit.click();
  await expect(recit).toHaveAttribute('aria-expanded', 'true');
  await recit.focus();
  await page.keyboard.press('Escape');
  await expect(recit).toHaveAttribute('aria-expanded', 'false');

  const curseur = page.locator('#curseur');
  await curseur.focus();
  await page.keyboard.press('End');
  await expect(curseur).toHaveAttribute('aria-valuetext', /2014/);
  expect(erreurs).toEqual([]);
});

test('fallback 2D multi-navigateur sur téléphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?force-fallback=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sillage?.fallback === true);
  await expect(page.locator('#fallback-2d')).toBeVisible();
  await expect(page.locator('#fallback-trace .fallback-route-ligne').first()).toBeVisible();
  expect(await page.locator('#fallback-liste li').count()).toBeGreaterThan(0);
  expect(await page.locator('#escales-select option').count()).toBeGreaterThan(1);
});

test('le roadtrip de 2013 figure dans le carnet du repli 2D', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?force-fallback=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sillage?.fallback === true);
  await page.evaluate(() => {
    const details = [...document.querySelectorAll('#fallback-liste details')]
      .find(d => d.querySelector('strong')?.textContent === 'San Francisco');
    details.open = true;
  });
  await expect(page.locator('.fallback-carnet .roadtrip-carte img')).toBeVisible();
  await expect(page.locator('.fallback-carnet #fallback-billet-540')).toBeAttached();
});

test('un lien vers un billet l’ouvre aussi dans le repli 2D', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?force-fallback=1#sidney-2013-08-20/billet-531', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sillage?.fallback === true);
  await expect(page.locator('#fallback-billet-531')).toBeInViewport();
  // the quoted mention of a nearby stop leads there too
  await page.evaluate(() => {
    const details = [...document.querySelectorAll('#fallback-liste details')]
      .find(d => d.querySelector('strong')?.textContent === 'Neah Bay');
    details.open = true;
  });
  await expect(page.locator('#fallback-liste .evoque-lien')).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#neah-bay-2013-09-04');
});
