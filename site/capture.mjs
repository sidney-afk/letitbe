// Capture d'écran du site pour vérification visuelle (dev uniquement).
// Usage : node capture.mjs <url> <sortie.png> [attente_ms] [actions]
//   actions: "play" lance la lecture avant capture
import { chromium } from '@playwright/test';
import path from 'node:path';

const [url = 'http://localhost:4173/', sortie = path.resolve('capture.png'),
  attente = '4000', action = ''] = process.argv.slice(2);

const viewport = action.match(/viewport=(\d+)x(\d+)/);
const taille = viewport
  ? { width: Number(viewport[1]), height: Number(viewport[2]) }
  : { width: 1440, height: 900 };

const navigateur = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await navigateur.newPage({
  viewport: taille,
  colorScheme: 'light',
  locale: 'fr-FR',
  timezoneId: 'UTC',
  reducedMotion: 'reduce',
});
page.on('console', m => console.log('[console]', m.type(), m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForFunction(() => document.body.classList.contains('pret')
  && window.__sillage?.camera
  && window.__sillage?.timeline, null, { timeout: 60_000 });

if (action && !action.includes('intro')) {
  await page.evaluate(() => window.__sillage.sauteIntro?.());
}
if (action.includes('play')) await page.click('#lecture', { force: true });
if (action.includes('recit')) await page.click('#recit-bouton', { force: true });
if (action.includes('photo')) await page.click('#mode-bouton', { force: true });
const zoom = action.match(/zoom=([\d.]+)/);
if (zoom) {
  await page.evaluate((d) => {
    const { camera, controls } = window.__sillage;
    camera.position.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, d)));
  }, Number(zoom[1]));
}
const plonge = action.match(/plonge=([^|]+)/);
if (plonge) {
  await page.evaluate((nom) => {
    const { plongee, route } = window.__sillage;
    const escale = route.escales.find(e => e.nom === nom);
    if (!escale) throw new Error(`escale introuvable : ${nom}`);
    plongee.vers(escale);
  }, plonge[1].trim());
}
const regarde = action.match(/regarde=(-?[\d.]+),(-?[\d.]+)/);
if (regarde) {
  // sinon le suivi du bateau reprend la caméra ({force : l'UI peut animer})
  await page.evaluate(() => document.getElementById('suivre')?.click());
  await page.evaluate(([lat, lon]) => {
    const { camera } = window.__sillage;
    const d = camera.position.length();
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    camera.position.set(
      -d * Math.sin(phi) * Math.cos(theta),
      d * Math.cos(phi),
      d * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(0, 0, 0);
  }, [Number(regarde[1]), Number(regarde[2])]);
}
const date = action.match(/date=([\d-]+)/);
if (date) {
  await page.evaluate((j) => {
    window.__sillage.timeline.vaA(new Date(j + 'T12:00:00Z').getTime(), true);
  }, date[1]);
}
if (action.includes('mi-parcours')) {
  await page.evaluate(() => {
    const c = document.getElementById('curseur');
    c.value = 0.42;
    c.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Détail d'inspection : une vue locale en biais rend visible l'assise des
// deux coques. L'interface est masquée uniquement dans cette capture, jamais
// dans le site, afin de ne pas cacher le bas du bateau derrière la timeline.
if (action.includes('waterline')) {
  await page.evaluate(async () => {
    const api = window.__sillage;
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    const bateau = api.bateau.conteneur.position.clone();
    const verticale = bateau.clone().normalize();
    const cap = api.voyage.tangent(api.timeline.t);
    const tribord = verticale.clone().cross(cap).normalize();
    const oeil = bateau.clone()
      .addScaledVector(verticale, 0.72)
      .addScaledVector(cap, -0.34)
      .addScaledVector(tribord, 0.25);
    api.camera.position.copy(oeil);
    api.camera.lookAt(bateau.clone().addScaledVector(verticale, 0.12));
    api.controls.minDistance = 0.4;
    api.controls.target.copy(bateau);
    api.controls.update();
    api.etiquettes.groupe.visible = false;
    api.route.groupe.visible = false;
    document.querySelectorAll('#titre, #boutons-haut, #timeline, #navigation-escales, #explorer')
      .forEach(element => { element.style.visibility = 'hidden'; });
  });
}

// Vue de maquette : inspection ponctuelle en profil trois-quarts. Elle ne
// change jamais la caméra du site ; elle sert uniquement à vérifier que le
// volume, le mât et les deux coques restent cohérents hors de la vue zénithale.
if (action.includes('boat-profile')) {
  await page.evaluate(async () => {
    const api = window.__sillage;
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    const bateau = api.bateau.conteneur.position.clone();
    const verticale = bateau.clone().normalize();
    const cap = api.voyage.tangent(api.timeline.t);
    const tribord = verticale.clone().cross(cap).normalize();
    const oeil = bateau.clone()
      .addScaledVector(verticale, 0.31)
      .addScaledVector(cap, -0.67)
      .addScaledVector(tribord, 0.42);
    // Garde le haut local du bateau vers le haut de l'image d'inspection.
    // OrbitControls utilise normalement l'axe monde pour l'interface, mais
    // cette vue de maquette doit surtout permettre de lire le mât et le rouf.
    api.camera.up.copy(verticale);
    api.camera.position.copy(oeil);
    api.camera.lookAt(bateau.clone().addScaledVector(verticale, 0.20));
    api.controls.minDistance = 0.4;
    api.controls.target.copy(bateau);
    api.controls.update();
    api.etiquettes.groupe.visible = false;
    api.route.groupe.visible = false;
    document.querySelectorAll('#titre, #boutons-haut, #timeline, #navigation-escales, #explorer')
      .forEach(element => { element.style.visibility = 'hidden'; });
  });
}

// Pour une simple image de contrÃ´le, on fige le rendu une fois l'Ã©tat
// installÃ©. Cela Ã©vite de laisser WebGL tourner Ã  plein rÃ©gime pendant
// l'attente de capture sur les machines sans accÃ©lÃ©ration graphique.
if (action.includes('immobile')) {
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    window.__sillage?.renderer?.setAnimationLoop(null);
  });
}

const defile = action.match(/defile=(\d+)/);
if (defile) {
  await page.waitForTimeout(3500);
  await page.evaluate((y) => {
    document.getElementById('plongee-flux').scrollTo({ top: y });
  }, Number(defile[1]));
}
await page.waitForTimeout(Number(attente));
await page.screenshot({ path: sortie });
await navigateur.close();
console.log('capturé →', sortie);
