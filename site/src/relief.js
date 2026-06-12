// Le relief sculpté de la miniature : une carte d'élévation (SRTM adoucie)
// échantillonnée en JS pour déplacer les sommets du globe — de vraies
// montagnes en volume, exagérées comme sur une figurine. Le même
// échantillonneur sert à draper la route, le bateau, les étiquettes et
// les vues aériennes sur le terrain.

import * as THREE from 'three';
import { RAYON } from './geo.js';

// Everest ≈ +4 % du rayon : les chaînes de montagnes se découpent
// franchement sur l'horizon — c'est une figurine, pas un géoïde.
export const EXAGERATION = 0.04;

export async function chargeRelief(url) {
  const image = await new THREE.ImageLoader().loadAsync(url);
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

  // hauteur 0..1 (niveau de la mer → Everest), interpolation bilinéaire
  function hauteurUV(u, v) {
    const x = (u * width - 0.5 + width) % width;
    const y = THREE.MathUtils.clamp(v * height - 0.5, 0, height - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = (x0 + 1) % width, y1 = Math.min(y0 + 1, height - 1);
    const fx = x - x0, fy = y - y0;
    const e = (xx, yy) => data[(yy * width + xx) * 4];
    const h = e(x0, y0) * (1 - fx) * (1 - fy) + e(x1, y0) * fx * (1 - fy)
      + e(x0, y1) * (1 - fx) * fy + e(x1, y1) * fx * fy;
    return h / 255;
  }

  function hauteur(lat, lon) {
    return hauteurUV(((lon + 180) / 360) % 1, (90 - lat) / 180);
  }

  const dirTmp = new THREE.Vector3();
  function hauteurDir(v) {
    dirTmp.copy(v).normalize();
    const lat = THREE.MathUtils.radToDeg(Math.asin(dirTmp.y));
    const lon = THREE.MathUtils.radToDeg(Math.atan2(dirTmp.z, -dirTmp.x)) - 180;
    return hauteur(lat, lon);
  }

  // rayon « posé sur le terrain » pour une direction donnée
  function altitude(v, garde = 0) {
    return RAYON * (1 + hauteurDir(v) * EXAGERATION) + garde;
  }

  /**
   * Déplace radialement chaque sommet d'une géométrie sphérique pour
   * épouser le terrain (sommets supposés centrés sur l'origine).
   * `garde` est une surcote constante (pour flotter au-dessus du sol).
   */
  function drape(geometrie, garde = 0) {
    const pos = geometrie.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = altitude(v, garde);
      v.normalize().multiplyScalar(r);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geometrie.computeVertexNormals();
    return geometrie;
  }

  return { hauteur, hauteurDir, altitude, drape };
}

/** Relief neutre (mer partout) si la carte d'élévation manque. */
export function reliefPlat() {
  return {
    hauteur: () => 0,
    hauteurDir: () => 0,
    altitude: (v, garde = 0) => RAYON + garde,
    drape: (g) => g,
  };
}
