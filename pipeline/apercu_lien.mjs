// L'image d'aperçu du lien (1200 × 630), celle que montrent WhatsApp,
// iMessage ou un courriel quand on partage le site : le globe peint, centré
// sur le Pacifique, la route entière et le titre. Rendue par le site lui-même.
//
// Usage : (dans site/) npm run build && npm run preview, puis
//   node pipeline/apercu_lien.mjs [url]   → site/public/apercu-lien.jpg
import { chromium } from '../site/node_modules/@playwright/test/index.mjs';
const OUT = new URL('../site/public/', import.meta.url).pathname;
const [lat, lon, d] = [-5, -150, 3.4];
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'fr-FR', reducedMotion: 'reduce' });
await p.goto(url);
await p.waitForFunction(() => document.body.classList.contains('pret'), null, { timeout: 90000 });
await p.click('#accueil-explorer');
await p.waitForTimeout(1000);
await p.evaluate(([lat, lon, d]) => {
  const s = window.__sillage;
  s.timeline.vaA(new Date('2014-01-13T12:00:00Z').getTime(), true);
  s.controls.dispatchEvent({ type: 'start' });
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  s.camera.position.set(-d * Math.sin(phi) * Math.cos(th), d * Math.cos(phi), d * Math.sin(phi) * Math.sin(th));
  s.camera.lookAt(0, 0, 0); s.controls.update();
  for (const id of ['boutons-haut', 'timeline', 'navigation-escales', 'infobulle']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  document.getAnimations().forEach(a => { try { a.finish(); } catch {} });
}, [lat, lon, d]);
await p.waitForTimeout(1500);
await p.evaluate(([lat, lon, d]) => {
  const s = window.__sillage; s.controls.dispatchEvent({ type: 'start' });
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  s.camera.position.set(-d * Math.sin(phi) * Math.cos(th), d * Math.cos(phi), d * Math.sin(phi) * Math.sin(th));
  s.camera.lookAt(0, 0, 0); s.controls.update();
}, [lat, lon, d]);
await p.waitForTimeout(2000);
await p.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch {} }));
await p.screenshot({ path: `${OUT}apercu-lien.jpg`, type: 'jpeg', quality: 85 });
await b.close();
