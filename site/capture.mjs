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
    const { camera } = window.__sillage;
    camera.position.setLength(d);
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
