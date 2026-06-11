// Capture d'écran du site pour vérification visuelle (dev uniquement).
// Usage : node capture.mjs <url> <sortie.png> [attente_ms] [actions]
//   actions: "play" lance la lecture avant capture
import { chromium } from 'playwright-core';

const [url = 'http://localhost:4173/', sortie = '/tmp/capture.png',
  attente = '4000', action = ''] = process.argv.slice(2);

const navigateur = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => console.log('[console]', m.type(), m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });

if (action.includes('play')) await page.click('#lecture');
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
