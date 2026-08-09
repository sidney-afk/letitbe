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
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'photo');
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
