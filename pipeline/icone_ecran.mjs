// L'icône d'écran d'accueil (180 × 180) : ce que montre un iPhone ou un iPad
// quand on ajoute le site à l'écran d'accueil. iOS ne lit pas l'icône SVG de
// l'onglet ; on la redessine donc ici, en carré plein (iOS arrondit les
// coins lui-même), le dessin du favicon un peu rentré dans le ciel.
//
// Usage : node pipeline/icone_ecran.mjs   → site/public/apple-touch-icon.png
import { readFileSync } from 'node:fs';
import { chromium } from '../site/node_modules/@playwright/test/index.mjs';
const PUBLIC = new URL('../site/public/', import.meta.url).pathname;
const svg = readFileSync(`${PUBLIC}favicon.svg`, 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
await p.setContent(`<!doctype html><style>
  html, body { margin: 0; width: 180px; height: 180px; overflow: hidden;
    background: linear-gradient(#9ed1f6, #cfeafc); }
  svg { position: absolute; left: 14px; top: 12px; width: 152px; height: 152px; overflow: visible; }
</style>${svg}`);
await p.screenshot({ path: `${PUBLIC}apple-touch-icon.png`, omitBackground: false });
await b.close();
