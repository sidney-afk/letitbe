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
  await expect.poll(() => page.evaluate(() => ({
    bateau: window.__sillage.bateau.conteneur.visible,
    ecume: window.__sillage.bateau.ecume.visible,
    route: window.__sillage.route.groupe.visible,
  }))).toEqual({ bateau: false, ecume: false, route: false });
  await page.evaluate(() => window.__sillage.plongee.metAJour(10));

  await expect(page.locator('#plongee')).toBeVisible();
  await expect(page.locator('#remonter')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#plongee')).toBeHidden();
  await page.evaluate(() => window.__sillage.plongee.metAJour(10));
  await expect.poll(() => page.evaluate(() => ({
    bateau: window.__sillage.bateau.conteneur.visible,
    ecume: window.__sillage.bateau.ecume.visible,
    route: window.__sillage.route.groupe.visible,
  }))).toEqual({ bateau: true, ecume: true, route: true });
  await expect(ouvrir).toBeFocused();
});

test('la rotation est fortement amortie pendant une plongée puis revient à la carte', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  const vitesseCarte = await page.evaluate(() => window.__sillage.controls.rotateSpeed);

  await page.evaluate(async () => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Marquises - Nuku Hiva');
    if (!escale) throw new Error('Escale de test introuvable');
    await plongee.vers(escale);
    plongee.metAJour(10);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const vitessePlongee = await page.evaluate(() => window.__sillage.controls.rotateSpeed);
  expect(vitessePlongee).toBeLessThan(vitesseCarte * 0.05);

  await page.evaluate(async () => {
    const { plongee } = window.__sillage;
    plongee.remonte();
    plongee.metAJour(10);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const vitesseRetour = await page.evaluate(() => window.__sillage.controls.rotateSpeed);
  expect(vitesseRetour).toBeGreaterThan(vitessePlongee * 10);
});

test('Makogai without approved detail keeps the calm arrival state with its curated journal hero', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  await page.evaluate(async () => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Fidji - Makogai');
    if (!escale) throw new Error('Escale Makogai introuvable');
    await plongee.vers(escale);
    plongee.metAJour(10);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  await expect.poll(() => page.evaluate(() => window.__sillage.globe.etatDetail()))
    .toMatchObject({ actif: false, fichier: null });
  await expect.poll(() => page.evaluate(() => ({
    routeVisible: window.__sillage.route.groupe.visible,
    route: window.__sillage.route.etat(),
    fov: window.__sillage.camera.fov,
    repereVisible: window.__sillage.plongee.repereVisible,
  }))).toMatchObject({
    routeVisible: false,
    route: { marqueursVisibles: 0, chevronsVisibles: 0 },
    fov: 38,
    repereVisible: true,
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.camera.position.length()))
    .toBeCloseTo(1.90, 5);
  await expect(page.locator('#plongee-scene-caption')).toBeVisible();
  await expect(page.locator('#plongee-scene-caption')).toContainText('À l’ancre · Fidji - Makogai');
  await expect.poll(() => page.evaluate(() => window.__sillage.plongee.repereType))
    .toBe('pavillon');
  const hero = page.locator('.plongee-hero-carnet');
  await expect(hero).toHaveCount(1);
  await expect(hero.locator('.plongee-hero-carnet-etiquette')).toHaveText('Photographie du carnet');
  await expect(hero.locator('img')).toHaveAttribute('src', /heros-escales\/makogai-bay\.webp$/);
  await expect(hero.locator('img')).toHaveAttribute('alt', 'Let It Be, dans la baie de Makogai.');
  await expect(hero.locator('figcaption')).toHaveText('Let It Be, dans la baie de Makogai.');
  await page.evaluate(async () => {
    const { plongee } = window.__sillage;
    plongee.remonte();
    plongee.metAJour(10);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.globe.etatDetail().actif)).toBe(false);
});

test('unreviewed archive imagery opens the calm illustrated arrival state', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  for (const nom of [
    'Galapagos',
    'Nlle Zélande - Opua',
  ]) {
    await page.evaluate(async nomEscale => {
      const { plongee, route } = window.__sillage;
      const escale = route.escales.find(item => item.nom === nomEscale);
      if (!escale) throw new Error(`Test anchorage not found: ${nomEscale}`);
      await plongee.vers(escale);
      plongee.metAJour(10);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, nom);

    await expect.poll(() => page.evaluate(() => ({
      detail: window.__sillage.globe.etatDetail(),
      fov: window.__sillage.camera.fov,
      distance: window.__sillage.camera.position.length(),
      routeVisible: window.__sillage.route.groupe.visible,
      bateauVisible: window.__sillage.bateau.conteneur.visible,
      ecumeVisible: window.__sillage.bateau.ecume.visible,
      repereVisible: window.__sillage.plongee.repereVisible,
      repereType: window.__sillage.plongee.repereType,
    }))).toMatchObject({
      detail: { actif: false, fichier: null },
      fov: 38,
      routeVisible: false,
      bateauVisible: false,
      ecumeVisible: false,
      repereVisible: true,
      repereType: 'pavillon',
    });
    await expect.poll(() => page.evaluate(() => window.__sillage.camera.position.length()))
      .toBeCloseTo(1.90, 5);
    await expect(page.locator('#plongee-scene-caption')).toBeVisible();
    await expect(page.locator('#plongee-scene-caption')).toContainText(`À l’ancre · ${nom}`);
    await expect(page.locator('#plongee-scene-caption-a11y')).toContainText(`À l’ancre · ${nom}`);
    const hero = page.locator('.plongee-hero-carnet');
    await expect(hero).toHaveCount(1);
    await expect(hero.locator('.plongee-hero-carnet-etiquette')).toHaveText('Photographie du carnet');
    await expect(hero.locator('img')).toHaveAttribute('src', new RegExp(
      nom === 'Galapagos'
        ? 'Tech/Image/Blog/2009_07_12/iguane\\.webp$'
        : 'Tech/Blog/NZ/2010-12-10/P5\\.webp$'));
    await expect(hero.locator('figcaption')).toContainText(nom === 'Galapagos'
      ? 'Un mâle (ça se voit, non ?)' : 'Plage à l’est du nord.');

    await page.evaluate(async () => {
      const { plongee } = window.__sillage;
      plongee.remonte();
      plongee.metAJour(10);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(page.locator('#plongee-scene-caption')).toBeHidden();
    await expect(page.locator('#plongee-scene-caption-a11y')).toBeEmpty();
  }
});

test('la maquette importée est exactement à la moitié de son ancienne échelle fixe', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  const bateau = await page.evaluate(() => window.__sillage.bateau.etat());
  expect(bateau.maquette).toBe('gltf');
  expect(bateau.facteurEchelleAsset).toBe(0.5);
  expect(bateau.echelle).toBeCloseTo(0.06, 8);
  expect(bateau.coqueBasMonde).toBeCloseTo(1.00007, 5);
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
  await page.evaluate(async () => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Marquises - Nuku Hiva');
    if (!escale) throw new Error('Escale de test introuvable');
    await plongee.vers(escale);
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
