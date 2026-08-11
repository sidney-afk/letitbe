import { expect, test } from '@playwright/test';

const viewport = { width: 1366, height: 768 };

test('le catamaran garde son assise, ses proportions et son cap de route', async ({ page }) => {
  await page.setViewportSize(viewport);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('pret')
    && window.__sillage?.bateau && window.__sillage?.voyage?.tangent);

  const poses = await page.evaluate(async () => {
    const api = window.__sillage;
    api.sauteIntro();
    const suivre = document.getElementById('suivre');
    if (suivre?.getAttribute('aria-pressed') === 'true') suivre.click();

    const produitScalaire = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const norme = v => Math.hypot(v.x, v.y, v.z);
    const normalise = v => {
      const n = norme(v);
      return { x: v.x / n, y: v.y / n, z: v.z / n };
    };
    const produitVectoriel = (a, b) => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    });
    const echantillons = [
      { date: '2009-05-27', distance: 3.4 },
      { date: '2010-05-21', distance: 2.1 },
      { date: '2011-01-15', distance: 3.4 },
    ];

    const resultat = [];
    for (const echantillon of echantillons) {
      api.timeline.vaA(new Date(`${echantillon.date}T12:00:00Z`).getTime(), true);
      api.camera.position.setLength(echantillon.distance);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const etat = api.bateau.etat();
      const tangent = api.voyage.tangent(api.timeline.t);
      const normal = api.bateau.conteneur.position.clone().normalize();
      const droiteAttendue = normalise(produitVectoriel(normal, tangent));
      resultat.push({
        ...etat,
        capRoute: produitScalaire(etat.cap, tangent),
        verticaleSurface: produitScalaire(etat.verticale, normal),
        determinant: produitScalaire(etat.tribord, droiteAttendue),
      });
    }

    const avantCamera = api.bateau.etat();
    api.camera.position.set(-2.1, 1.4, 1.8);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const apresCamera = api.bateau.etat();
    return { poses: resultat, avantCamera, apresCamera };
  });

  expect(poses.poses).toHaveLength(3);
  const echelle = poses.poses[0].echelle;
  for (const pose of poses.poses) {
    expect(pose.echelle, 'échelle fixe du modèle').toBeCloseTo(echelle, 12);
    expect(pose.longueur / pose.largeur, 'proportions Bahia 46').toBeGreaterThan(1.75);
    expect(pose.longueur / pose.largeur, 'proportions Bahia 46').toBeLessThan(2.1);
    expect(pose.capRoute, 'étrave dans le cap de route').toBeGreaterThan(0.999);
    expect(pose.verticaleSurface, 'pont parallèle à la surface').toBeGreaterThan(0.999);
    expect(pose.determinant, 'base locale droite sans déformation').toBeGreaterThan(0.999);
    expect(pose.quaternionNorme, 'quaternion unitaire').toBeCloseTo(1, 12);
    expect(pose.coqueBasLocale, 'silhouette réelle des coques sous l’axe local')
      .toBeLessThan(0);
    expect(pose.coqueBasMonde - 1, 'silhouette des coques juste au-dessus de l’océan')
      .toBeGreaterThan(0);
    expect(pose.coqueBasMonde - 1, 'coques sans flottement visible').toBeLessThan(0.0002);
    expect(Math.abs(pose.rotationLocale.x) + Math.abs(pose.rotationLocale.y)
      + Math.abs(pose.rotationLocale.z), 'aucune rotation caméra ou gîte locale').toBeLessThan(1e-9);
  }
  expect(poses.apresCamera.echelle, 'la caméra ne redimensionne pas le bateau')
    .toBeCloseTo(poses.avantCamera.echelle, 12);
  expect(poses.apresCamera.cap.x, 'la caméra ne change pas le cap local')
    .toBeCloseTo(poses.avantCamera.cap.x, 12);
  expect(poses.apresCamera.cap.y, 'la caméra ne change pas le cap local')
    .toBeCloseTo(poses.avantCamera.cap.y, 12);
  expect(poses.apresCamera.cap.z, 'la caméra ne change pas le cap local')
    .toBeCloseTo(poses.avantCamera.cap.z, 12);
});
