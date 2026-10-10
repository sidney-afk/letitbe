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
  // The menu folds away once a journal is opened; focus returns to it.
  await expect(navigation).not.toHaveAttribute('open', '');
  await expect(resume).toBeFocused();
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

test('Makogai restores its rich aerial arrival without a fallback marker or journal hero', async ({ page }) => {
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
    .toMatchObject({
      actif: true,
      pret: true,
      visible: true,
      fichier: 'media/aerien-detail/makogai-sentinel-2026-05-07-detail-v2.webp',
    });
  await expect.poll(() => page.evaluate(() => ({
    routeVisible: window.__sillage.route.groupe.visible,
    route: window.__sillage.route.etat(),
    fov: window.__sillage.camera.fov,
    repereVisible: window.__sillage.plongee.repereVisible,
    bateauVisible: window.__sillage.bateau.conteneur.visible,
    ecumeVisible: window.__sillage.bateau.ecume.visible,
  }))).toMatchObject({
    routeVisible: false,
    route: { marqueursVisibles: 0, chevronsVisibles: 0 },
    fov: 3.5,
    repereVisible: false,
    bateauVisible: false,
    ecumeVisible: false,
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.camera.position.length()))
    .toBeCloseTo(1.02, 5);
  await expect(page.locator('#plongee-scene-caption')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__sillage.plongee.repereType)).toBeNull();
  await expect(page.locator('.plongee-hero-carnet')).toHaveCount(0);
  await page.evaluate(async () => {
    const { plongee } = window.__sillage;
    plongee.remonte();
    plongee.metAJour(10);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.globe.etatDetail().actif)).toBe(false);
});

test('Opua uses its reviewed LINZ aerial arrival and hides before its crop edge', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  await page.evaluate(async () => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Nlle Zélande - Opua');
    if (!escale) throw new Error('Escale Opua introuvable');
    await plongee.vers(escale);
    plongee.metAJour(10);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  await expect.poll(() => page.evaluate(() => window.__sillage.globe.etatDetail()))
    .toMatchObject({
      actif: true,
      pret: true,
      visible: true,
      fichier: 'media/aerien-detail/opua-linz-120064-context-z15-2048.webp',
    });
  await expect.poll(() => page.evaluate(() => ({
    fov: window.__sillage.camera.fov,
    repereVisible: window.__sillage.plongee.repereVisible,
    routeVisible: window.__sillage.route.groupe.visible,
    bateauVisible: window.__sillage.bateau.conteneur.visible,
  }))).toMatchObject({
    fov: 3.4,
    repereVisible: false,
    routeVisible: false,
    bateauVisible: false,
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.camera.position.length()))
    .toBeCloseTo(1.012, 5);
  await expect(page.locator('#plongee-scene-caption')).toBeHidden();
  await expect(page.locator('.plongee-hero-carnet')).toHaveCount(0);

  const detailHorsCadre = await page.evaluate(() => {
    const { camera, plongee, globe } = window.__sillage;
    camera.position.setLength(1.014);
    camera.fov = 3.46;
    camera.updateProjectionMatrix();
    plongee.metAJour(0);
    globe.anime(1);
    return globe.etatDetail();
  });
  expect(detailHorsCadre).toMatchObject({ pret: true, visible: false, opacite: 0 });
});

test('aerial imagery stays hidden during the dive and before its edge can re-enter', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  const etatAvantArrivee = await page.evaluate(async () => {
    const { plongee, route, globe } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Fidji - Makogai');
    if (!escale) throw new Error('Escale Makogai introuvable');
    await plongee.vers(escale);
    return {
      detail: globe.etatDetail(),
      enVol: plongee.enVol,
    };
  });
  expect(etatAvantArrivee).toMatchObject({
    detail: { actif: true, pret: true, visible: false, opacite: 0 },
    enVol: true,
  });

  const etatMilieuVol = await page.evaluate(() => {
    const { plongee, globe } = window.__sillage;
    plongee.metAJour(1.3);
    globe.anime(1);
    return globe.etatDetail();
  });
  expect(etatMilieuVol).toMatchObject({ pret: true, visible: false, opacite: 0 });

  await page.evaluate(() => {
    const { plongee, globe } = window.__sillage;
    plongee.metAJour(10);
    globe.anime(1);
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.globe.etatDetail()))
    .toMatchObject({ pret: true, visible: true, opacite: 1 });

  const etatZoomSortant = await page.evaluate(() => {
    const { camera, plongee, globe } = window.__sillage;
    camera.position.setLength(1.04);
    camera.fov = 4.2;
    camera.updateProjectionMatrix();
    plongee.metAJour(0);
    globe.anime(1);
    return globe.etatDetail();
  });
  expect(etatZoomSortant).toMatchObject({
    actif: true,
    pret: true,
    visible: false,
    opacite: 0,
    fichier: 'media/aerien-detail/makogai-sentinel-2026-05-07-detail-v2.webp',
  });

  await page.evaluate(() => {
    const { camera, plongee, globe } = window.__sillage;
    camera.position.setLength(1.02);
    camera.fov = 3.5;
    camera.updateProjectionMatrix();
    plongee.metAJour(0);
    globe.anime(1);
  });
  await expect.poll(() => page.evaluate(() => window.__sillage.globe.etatDetail()))
    .toMatchObject({ pret: true, visible: true, opacite: 1 });
});

test('a reviewed aerial switches scales only while the sea wash fully covers the canvas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ouvreExperience(page, { width: 1366, height: 768 });

  await page.evaluate(async () => {
    const { plongee, route, globe, controls } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Fidji - Makogai');
    if (!escale) throw new Error('Escale Makogai introuvable');
    await plongee.vers(escale);
    // From here the test steps time itself. Pausing the live loop keeps real
    // frames from advancing the 0.34 s wash between two evaluate() calls
    // (which made this check flaky on fast or slow runners).
    window.__sillage.renderer.setAnimationLoop(null);
    // The ordinary overview rotation has finished; the scale handoff has
    // started but is still transparent, so the camera must remain atlas-safe.
    plongee.metAJour(2.6);
    globe.anime(2.6);
    // The app calls this every frame even while controls are disabled. Keep
    // the exact renderer-time behavior in the test: a close-crop cap must
    // not pull this overview leg back down before the sea wash takes over.
    controls.update();
  });

  const avantSaut = await page.evaluate(() => ({
    distance: window.__sillage.camera.position.length(),
    fov: window.__sillage.camera.fov,
    maxDistance: window.__sillage.controls.maxDistance,
    detail: window.__sillage.globe.etatDetail(),
    washHidden: document.getElementById('raccord-lod').hidden,
  }));
  expect(avantSaut).toMatchObject({
    detail: { pret: true, visible: false, opacite: 0 },
    washHidden: false,
  });
  expect(avantSaut.distance).toBeCloseTo(3, 5);
  expect(avantSaut.maxDistance).toBeGreaterThan(3);

  const pendantSaut = await page.evaluate(() => {
    const { plongee, globe, camera } = window.__sillage;
    plongee.metAJour(.17);
    globe.anime(.17);
    return {
      distance: camera.position.length(),
      fov: camera.fov,
      detail: globe.etatDetail(),
      wash: document.getElementById('raccord-lod').style
        .getPropertyValue('--raccord-lod-opacite'),
    };
  });
  expect(pendantSaut).toMatchObject({
    fov: 3.5,
    detail: { pret: true, visible: true, opacite: 1 },
    wash: '1',
  });
  expect(pendantSaut.distance).toBeCloseTo(1.02, 5);

  const retourSousLavage = await page.evaluate(() => {
    const { plongee, globe, camera } = window.__sillage;
    plongee.remonte();
    plongee.metAJour(.17);
    globe.anime(.17);
    return {
      distance: camera.position.length(),
      fov: camera.fov,
      detail: globe.etatDetail(),
      wash: document.getElementById('raccord-lod').style
        .getPropertyValue('--raccord-lod-opacite'),
    };
  });
  expect(retourSousLavage).toMatchObject({
    detail: { pret: true, visible: false, opacite: 0 },
    wash: '1',
  });
  expect(retourSousLavage.distance).toBeCloseTo(3, 5);
  expect(retourSousLavage.fov).toBeCloseTo(38, 5);
});

test('a stop without a reviewed close-up opens on its satellite porthole', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });

  for (const nom of ['Galapagos']) {
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
      fov: 24,
      routeVisible: false,
      bateauVisible: false,
      ecumeVisible: false,
      // the porthole's anchor marks the mooring; no pennant on the globe
      repereVisible: false,
    });
    await expect.poll(() => page.evaluate(() => window.__sillage.camera.position.length()))
      .toBeCloseTo(1.52, 5);
    const hublot = page.locator('#plongee-flux figure.vue-du-ciel');
    await expect(hublot).toHaveCount(1);
    await expect(hublot.locator('img')).toHaveAttribute('src', /media\/aerien\/\d+\.webp$/);
    await expect(hublot.locator('figcaption')).toContainText(`Vue du ciel · ${nom}`);
    await expect(hublot.locator('figcaption')).toContainText('Esri');
    // wide screen, Carnet mode: the porthole floats in the scene, beside the
    // journal, and replaces the bottom-left scene caption
    const boite = await hublot.boundingBox();
    const panneau = await page.locator('#plongee').boundingBox();
    expect(boite.x + boite.width).toBeLessThanOrEqual(panneau.x + 1);
    await expect(page.locator('#plongee-scene-caption')).toBeHidden();
    await expect(page.locator('#plongee-scene-caption-a11y')).toContainText(`À l’ancre · ${nom}`);
    const hero = page.locator('.plongee-hero-carnet');
    await expect(hero).toHaveCount(1);
    await expect(hero.locator('.plongee-hero-carnet-etiquette')).toHaveText('Photographie du carnet');
    await expect(hero.locator('img')).toHaveAttribute('src', new RegExp(
      'Tech/Image/Blog/2009_07_12/iguane\\.webp$'));
    await expect(hero.locator('figcaption')).toContainText('Un mâle (ça se voit, non ?)');

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

test('un album photo s’ouvre depuis le carnet et se feuillette au clavier', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  await page.evaluate(async () => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(item => item.nom === 'Fakarava');
    await plongee.vers(escale);
    plongee.metAJour(10);
  });
  const carte = page.locator('#plongee-flux .album-carte').first();
  await expect(carte).toBeVisible();
  await expect(carte).toHaveAttribute('aria-label', /Tuamotu/);
  await carte.click();
  const compteur = page.locator('#lightbox-compteur');
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(compteur).toHaveText(/1 \/ \d+$/);
  await expect(page.locator('#lightbox-album-complet')).toHaveAttribute('href', /^https:\/\/www\.laruel\.be\//);
  await page.keyboard.press('ArrowRight');
  await expect(compteur).toHaveText(/2 \/ \d+$/);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(compteur).not.toHaveText(/ 1 \//);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).toBeHidden();
  await expect(carte).toBeFocused();
  // a single journal photo keeps the plain viewer, without series controls
  await page.locator('#plongee-flux article .photo-ouvrir').first().click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#lightbox-suivante')).toBeHidden();
  await page.keyboard.press('Escape');
});

test('la page de garde se quitte au clavier et rend la main à la carte', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('pret'));
  await expect(page.locator('#accueil-traversee')).toBeFocused();
  // the focus stays inside the card while it is open
  await page.keyboard.press('Tab');
  await expect(page.locator('#accueil-explorer')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/accueil-ouvert/);
  await expect(page.locator('#chargement')).toHaveJSProperty('inert', true);
  await expect(page.locator('#navigation-escales summary')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#lecture')).toBeFocused();
});

test('le roadtrip de 2013 se lit sur le globe et ouvre le carnet au bon billet', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  await page.waitForFunction(() => window.__sillage.roadtrip);
  // over the western parks, close enough for the stops to show
  await page.evaluate(() => {
    const { camera, controls } = window.__sillage;
    controls.dispatchEvent({ type: 'start' });
    const [lat, lon, d] = [40, -114, 1.75];
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    camera.position.set(-d * Math.sin(phi) * Math.cos(theta), d * Math.cos(phi),
      d * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(0, 0, 0);
    controls.update();
  });
  await page.waitForFunction(() => window.__sillage.etatComposition().roadtrip?.points >= 8);
  const etat = await page.evaluate(() => window.__sillage.etatComposition().roadtrip);
  expect(etat.visible).toBe(true);
  const cible = etat.marqueurs.find(m => m.nom === 'Bryce Canyon' && m.x !== undefined)
    ?? etat.marqueurs.find(m => m.x !== undefined);
  await page.mouse.move(cible.x, cible.y);
  await expect(page.locator('#infobulle')).toBeVisible();
  await expect(page.locator('#infobulle')).toContainText('en camping-car');
  await page.mouse.click(cible.x, cible.y);
  await page.waitForFunction(() => window.__sillage.plongee.ouverte, null, { timeout: 30_000 });
  await expect(page.locator('#plongee-nom')).toHaveText('San Francisco');
  // the journal opens on that stop's post, not at the top
  await page.waitForFunction((id) => {
    const flux = document.getElementById('plongee-flux');
    const billet = document.getElementById(`billet-${id}`);
    return billet && Math.abs(flux.scrollTop - (billet.offsetTop - 14)) < 4;
  }, cible.billet);
  // the trip's own map and list sit in the same journal
  await expect(page.locator('#roadtrip .roadtrip-point')).toHaveCount(etat.lieux);
  await expect(page.locator('#roadtrip .roadtrip-liste li')).toHaveCount(23);
  await page.locator('#roadtrip .roadtrip-liste summary').click();
  await page.locator('#roadtrip .roadtrip-liste li').first().locator('button').click();
  await page.waitForFunction(() => {
    const flux = document.getElementById('plongee-flux');
    const billet = document.getElementById('billet-540');
    return Math.abs(flux.scrollTop - (billet.offsetTop - 14)) < 4;
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__sillage.plongee.ouverte && !window.__sillage.plongee.enVol);
  await page.waitForFunction(() => window.__sillage.etatComposition().roadtrip?.visible === true);
});

test('le carnet se lit d’escale en escale, même depuis une vue rapprochée', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  const depart = await page.evaluate(async () => {
    const { plongee, route, camera } = window.__sillage;
    const fov = camera.fov;
    const i = route.escales.findIndex(e => e.nom === 'Fidji - Makogai');
    await plongee.vers(route.escales[i]);
    plongee.metAJour(10);
    return { fov, suivante: route.escales[i + 1].nom, precedente: route.escales[i - 1].nom };
  });
  await expect(page.locator('#plongee-nom')).toHaveText('Fidji - Makogai');
  const nav = page.locator('#plongee-flux .plongee-suite');
  await expect(nav.locator('.suite-precedente .suite-nom')).toHaveText(depart.precedente);
  await expect(nav.locator('.suite-suivante .suite-nom')).toHaveText(depart.suivante);
  await nav.locator('.suite-suivante').click();
  // out of the close-up through the sea wash, then on to the next stop
  await expect.poll(async () => {
    await page.evaluate(() => window.__sillage.plongee.metAJour(10));
    return page.evaluate(() => window.__sillage.plongee.ouverte
      && document.getElementById('plongee-nom').textContent);
  }, { timeout: 20_000 }).toBe(depart.suivante);
  expect(await page.evaluate(() => window.__sillage.globe.etatDetail().actif)).toBe(false);
  // the way back still returns to the map as the visitor left it
  await page.keyboard.press('Escape');
  await expect.poll(async () => {
    await page.evaluate(() => window.__sillage.plongee.metAJour(10));
    return page.evaluate(() => !window.__sillage.plongee.ouverte && !window.__sillage.plongee.enVol);
  }).toBe(true);
  expect(await page.evaluate(() => window.__sillage.camera.fov)).toBeCloseTo(depart.fov, 3);
  await expect.poll(() => page.evaluate(() => window.__sillage.route.groupe.visible)).toBe(true);

  // a stop without a post still leads on
  await page.evaluate(async () => {
    const { plongee, route } = window.__sillage;
    await plongee.vers(route.escales.find(e => e.nom === 'Fidji - Vanua Lailai'));
    plongee.metAJour(10);
  });
  await expect(page.locator('#plongee-flux .plongee-vide')).toBeVisible();
  await expect(page.locator('#plongee-flux .plongee-suite button')).toHaveCount(2);
});

test('le sommaire retrouve un billet et ouvre son carnet à cet endroit', async ({ page }) => {
  await ouvreExperience(page, { width: 1366, height: 768 });
  await page.locator('#navigation-escales summary').click();
  await page.locator('#navigation-escales .lien-sommaire').click();
  await expect(page.locator('#sommaire')).toBeVisible();
  await expect(page.locator('#sommaire-recherche')).toBeFocused();
  // every post of the archive is there, the ones written at sea included
  await expect(page.locator('#sommaire-compte')).toContainText('537 billets');
  await page.locator('#sommaire-recherche').fill('traversee du pacifique j3');
  await expect(page.locator('#sommaire-compte')).toHaveText('1 billet, 1 escale');
  await page.locator('#sommaire-recherche').fill('noel hiva');
  const billet = page.locator('.sommaire-escale:not([hidden]) li:not([hidden]) button').first();
  await expect(billet).toContainText('Noël à Hiva Oa');
  await billet.click();
  await expect(page.locator('#sommaire')).toBeHidden();
  await page.waitForFunction(() => window.__sillage.plongee.ouverte, null, { timeout: 30_000 });
  await expect(page.locator('#plongee-nom')).toHaveText('Marquises - Hiva Oa');
  await page.waitForFunction(() => {
    const flux = document.getElementById('plongee-flux');
    const titre = [...flux.querySelectorAll('article h3')].find(h => h.textContent === 'Noël à Hiva Oa');
    const article = titre?.closest('article');
    return article && Math.abs(flux.scrollTop - (article.offsetTop - 14)) < 4;
  });
  // Escape closes the journal, and the menu that led there has folded away
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__sillage.plongee.ouverte && !window.__sillage.plongee.enVol);
  expect(await page.evaluate(() => document.getElementById('navigation-escales').open)).toBe(false);
});
