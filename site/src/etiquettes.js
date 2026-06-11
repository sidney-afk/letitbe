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
  const police = `italic ${important ? 64 : 52}px Iowan Old Style, Palatino, Georgia, serif`;
  ctx.font = police;
  const largeur = Math.ceil(ctx.measureText(texte).width) + 48;
  c.width = largeur;
  c.height = 96;
  ctx.font = police;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // halo crème pour rester lisible sur l'océan comme sur la terre
  ctx.shadowColor = 'rgba(255,252,240,0.95)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#27425c';
  ctx.fillText(texte, largeur / 2, 48);
  ctx.shadowBlur = 0;
  ctx.fillText(texte, largeur / 2, 48);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, ratio: largeur / 96 };
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
    // taille d'écran ~constante, estompage quand on est très près ou
    // quand l'étiquette passe derrière le globe
    const d = camera.position.length();
    const h = THREE.MathUtils.clamp((d - 1) * 0.018, 0.004, 0.05);
    for (const { sprite, ratio, important } of sprites) {
      const hh = h * (important ? 1 : 0.78);
      sprite.scale.set(hh * ratio, hh, 1);
      const devant = sprite.position.dot(camera.position) > 0.9;
      sprite.material.opacity = devant
        ? THREE.MathUtils.clamp((d - 1.12) / 0.25, 0, 0.92) : 0;
    }
  }

  return { groupe, anime };
}
