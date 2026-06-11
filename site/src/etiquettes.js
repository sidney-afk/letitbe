// Les noms des lieux du voyage, posés sur le globe — seulement ceux que
// la famille a visités, en encre discrète : on sait où l'on est sans
// transformer le globe en atlas.

import * as THREE from 'three';
import { latLonVers3D } from './geo.js';

const LIEUX = [
  ['Martinique', 14.6, -61.0, 1],
  ['Los Roques', 11.95, -66.67, 0],
  ['Aruba', 12.5, -70.04, 0],
  ['San Blas', 9.55, -78.95, 0],
  ['Panamá', 8.9, -79.6, 1],
  ['Galápagos', -0.75, -90.31, 1],
  ['Gambier', -23.12, -134.97, 1],
  ['Marquises', -9.5, -139.5, 1],
  ['Tuamotu', -15.9, -146.2, 1],
  ['Tahiti', -17.53, -149.57, 1],
  ['Bora Bora', -16.5, -151.74, 0],
  ['Îles Cook', -20.0, -159.78, 0],
  ['Niue', -19.05, -169.92, 0],
  ['Tonga', -18.65, -173.98, 0],
  ['Fidji', -17.8, 178.0, 1],
  ['Nouvelle-Zélande', -38.5, 175.5, 1],
  ['Hawaï', 20.6, -156.5, 1],
  ['Colombie-Britannique', 52.5, -127.5, 1],
  ['San Francisco', 37.81, -122.44, 1],
  ['San Diego', 32.72, -117.23, 1],
  ['Costa Rica', 10.5, -84.8, 0],
];

function spriteTexte(texte, important) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  // gros caractères : la texture reste nette même quand l'étiquette grossit
  const police = `italic 600 ${important ? 150 : 122}px Iowan Old Style, Palatino, Georgia, serif`;
  ctx.font = police;
  const largeur = Math.ceil(ctx.measureText(texte).width) + 110;
  c.width = largeur;
  c.height = 220;
  ctx.font = police;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // halo parchemin épais : lisible sur l'océan comme sur la terre
  ctx.shadowColor = 'rgba(255,250,234,0.98)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#5b3d1e';
  for (let i = 0; i < 3; i++) ctx.fillText(texte, largeur / 2, 112);
  ctx.shadowBlur = 0;
  ctx.fillText(texte, largeur / 2, 112);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, ratio: largeur / 220 };
}

export function creerEtiquettes() {
  const groupe = new THREE.Group();
  const sprites = [];

  for (const [nom, lat, lon, important] of LIEUX) {
    const { texture, ratio } = spriteTexte(nom, important);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }));
    sprite.position.copy(latLonVers3D(lat, lon, 1.012));
    sprites.push({ sprite, ratio, important });
    groupe.add(sprite);
  }

  function anime(camera) {
    // bien lisible de loin, et qui grossit encore quand on s'approche
    // (en angle apparent) ; estompée très près et derrière le globe
    const d = camera.position.length();
    // angle apparent : ~85 px de loin, jusqu'à ~170 px en s'approchant
    const theta = THREE.MathUtils.clamp(0.04 + (3.4 - d) * 0.02, 0.04, 0.09);
    const h = Math.min(theta * (d - 1), 0.1);
    for (const { sprite, ratio, important } of sprites) {
      const hh = h * (important ? 1 : 0.72);
      sprite.scale.set(hh * ratio, hh, 1);
      const devant = sprite.position.dot(camera.position) > 0.9;
      sprite.material.opacity = devant
        ? THREE.MathUtils.clamp((d - 1.1) / 0.2, 0, 0.95) : 0;
    }
  }

  return { groupe, anime };
}
