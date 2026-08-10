import { expect, test } from '@playwright/test';

async function ouvreExperience(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('pret')
    && window.__sillage?.camera && window.__sillage?.timeline);
  await page.evaluate(() => {
    window.__sillage.sauteIntro();
    const suivre = document.getElementById('suivre');
    if (suivre?.getAttribute('aria-pressed') === 'true') suivre.click();
  });
  await page.waitForFunction(() => ['titre', 'boutons-haut', 'timeline'].every(id => {
    const element = document.getElementById(id);
    return element && Number(getComputedStyle(element).opacity) > 0.98;
  }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(
    () => requestAnimationFrame(resolve))));
}

test('le parcours clavier ouvre une escale, la referme et restitue le focus', async ({ page }) => {
  await ouvreExperience(page);

  const navigation = page.locator('#navigation-escales');
  const resume = navigation.locator('summary');
  await resume.focus();
  await page.keyboard.press('Enter');
  await expect(navigation).toHaveAttribute('open', '');

  const select = page.locator('#escales-select');
  await select.selectOption({ index: 1 });
  const ouvrir = page.locator('#escales-ouvrir');
  await ouvrir.focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__sillage.plongee.metAJour(10));

  await expect(page.locator('#plongee')).toBeVisible();
  await expect(page.locator('#remonter')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#plongee')).toBeHidden();
  await page.evaluate(() => window.__sillage.plongee.metAJour(10));
  await expect(ouvrir).toBeFocused();
});

test('les commandes annoncent leur état et le récit se quitte avec Échap', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  const mode = page.locator('#mode-bouton');
  await expect(mode).toHaveAttribute('aria-label', 'Passer au mode réaliste');
  await mode.click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'photo');
  await expect(mode).toHaveAttribute('aria-label', 'Passer au mode carnet');

  const recit = page.locator('#recit-bouton');
  await recit.click();
  await expect(recit).toHaveAttribute('aria-expanded', 'true');
  await recit.focus();
  await page.keyboard.press('Escape');
  await expect(recit).toHaveAttribute('aria-expanded', 'false');
  await expect(recit).toBeFocused();

  const curseur = page.locator('#curseur');
  const valeurAvant = await curseur.getAttribute('aria-valuetext');
  await curseur.focus();
  await page.keyboard.press('End');
  await expect(curseur).not.toHaveAttribute('aria-valuetext', valeurAvant ?? '');
  await expect(curseur).toHaveAttribute('aria-valuetext', /2014/);
});

test('faire glisser le globe ne déclenche pas une escale, un clic intentionnel oui', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  const trouveMarqueur = () => page.evaluate(() => {
    const { largeur, hauteur } = window.__sillage.etatComposition().viewport;
    return window.__sillage.route.etat().marqueurs.find(m => m.visible
      && m.x > 80 && m.x < largeur - 80 && m.y > 110 && m.y < hauteur - 150);
  });

  let marqueur = await trouveMarqueur();
  expect(marqueur, 'un marqueur visible et dégagé').toBeTruthy();
  await page.mouse.move(marqueur.x, marqueur.y);
  await page.mouse.down();
  await page.mouse.move(marqueur.x + 36, marqueur.y + 18, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__sillage.plongee.enVol
    || window.__sillage.plongee.ouverte), 'aucune plongée après un glissement').toBe(false);

  await page.waitForTimeout(150);
  marqueur = await trouveMarqueur();
  expect(marqueur, 'un marqueur reste accessible après rotation').toBeTruthy();
  await page.mouse.click(marqueur.x, marqueur.y);
  await expect.poll(() => page.evaluate(() => window.__sillage.plongee.enVol
    || window.__sillage.plongee.ouverte)).toBe(true);
});

test('la lightbox piège le focus, se ferme avec Échap et le rend à la photo', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  await page.evaluate(() => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Marquises - Nuku Hiva');
    if (!escale) throw new Error('Escale de test introuvable');
    plongee.vers(escale);
    plongee.metAJour(10);
  });
  await expect(page.locator('#plongee')).toBeVisible();

  const photo = page.locator('.photo-ouvrir').first();
  await expect(photo).toBeVisible();
  await photo.click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#lightbox-fermer')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).toBeHidden();
  await expect(photo).toBeFocused();
});
