// Les ornements de la carte au trésor : une rose des vents à l'encre sépia
// posée sur le Pacifique Sud, un serpent de mer dans l'Atlantique — les
// marges dessinées des vieilles cartes marines. Mode Carnet uniquement.

import * as THREE from 'three';

const RAYON_DECAL = 1.0008; // juste au-dessus de l'eau, sous la route

function patch(texture, latMin, latMax, lonMin, lonMax) {
  const geo = new THREE.SphereGeometry(
    RAYON_DECAL, 48, 48,
    THREE.MathUtils.degToRad(lonMin + 180),
    THREE.MathUtils.degToRad(lonMax - lonMin),
    THREE.MathUtils.degToRad(90 - latMax),
    THREE.MathUtils.degToRad(latMax - latMin));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false,
  }));
  mesh.renderOrder = 1;
  return mesh;
}

function textureCanvas(taille, dessine) {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  dessine(c.getContext('2d'), taille);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const ENCRE = 'rgba(91, 74, 47, 0.62)';
const OR_PALE = 'rgba(193, 145, 60, 0.55)';

function dessineRose(ctx, T) {
  const cx = T / 2, cy = T / 2;
  ctx.translate(cx, cy);

  // cercles gradués
  ctx.strokeStyle = ENCRE;
  ctx.lineWidth = T * 0.006;
  ctx.beginPath();
  ctx.arc(0, 0, T * 0.30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = T * 0.003;
  ctx.beginPath();
  ctx.arc(0, 0, T * 0.27, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 32; i++) { // graduations fines
    const a = (i / 32) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * T * 0.27, Math.sin(a) * T * 0.27);
    ctx.lineTo(Math.cos(a) * T * 0.30, Math.sin(a) * T * 0.30);
    ctx.stroke();
  }

  // la pointe classique : losange mi-ombre mi-lumière
  const pointe = (angle, longueur, largeur) => {
    ctx.save();
    ctx.rotate(angle);
    for (const cote of [-1, 1]) {
      ctx.fillStyle = cote === 1 ? ENCRE : OR_PALE;
      ctx.beginPath();
      ctx.moveTo(0, -longueur);
      ctx.lineTo(cote * largeur, 0);
      ctx.lineTo(0, longueur * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) {
    pointe(i * Math.PI / 2 + Math.PI / 4, T * 0.24, T * 0.035); // intercardinales
  }
  for (let i = 0; i < 4; i++) {
    pointe(i * Math.PI / 2, T * 0.40, T * 0.05); // cardinales
  }
  ctx.fillStyle = ENCRE;
  ctx.beginPath();
  ctx.arc(0, 0, T * 0.022, 0, Math.PI * 2);
  ctx.fill();

  // N E S O à la plume
  ctx.fillStyle = ENCRE;
  ctx.font = `italic ${T * 0.085}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -T * 0.45);
  ctx.fillText('E', T * 0.45, 0);
  ctx.fillText('S', 0, T * 0.455);
  ctx.fillText('O', -T * 0.45, 0);
}

function dessineSerpent(ctx, T) {
  ctx.strokeStyle = ENCRE;
  ctx.fillStyle = ENCRE;
  ctx.lineCap = 'round';

  const y = T * 0.42;
  // trois bosses pleines, en croissants effilés
  const bosse = (x, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);           // dos rond
    ctx.quadraticCurveTo(x + r * 0.55, y - r * 0.42, x - r, y); // ventre creusé
    ctx.closePath();
    ctx.fill();
  };
  bosse(T * 0.36, T * 0.085);
  bosse(T * 0.55, T * 0.105);
  bosse(T * 0.74, T * 0.07);

  // le cou et la tête, dressés, avec une petite langue
  ctx.lineWidth = T * 0.032;
  ctx.beginPath();
  ctx.moveTo(T * 0.24, y);
  ctx.quadraticCurveTo(T * 0.17, y - T * 0.10, T * 0.185, y - T * 0.16);
  ctx.stroke();
  ctx.beginPath(); // crâne
  ctx.ellipse(T * 0.19, y - T * 0.175, T * 0.035, T * 0.024, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = T * 0.008;
  ctx.beginPath(); // langue fourchue
  ctx.moveTo(T * 0.165, y - T * 0.19);
  ctx.lineTo(T * 0.135, y - T * 0.21);
  ctx.stroke();
  // l'œil, en réserve claire
  ctx.fillStyle = 'rgba(248, 240, 222, 0.85)';
  ctx.beginPath();
  ctx.arc(T * 0.196, y - T * 0.18, T * 0.007, 0, Math.PI * 2);
  ctx.fill();

  // la queue qui sort de l'eau
  ctx.fillStyle = ENCRE;
  ctx.beginPath();
  ctx.moveTo(T * 0.84, y);
  ctx.quadraticCurveTo(T * 0.90, y - T * 0.07, T * 0.885, y - T * 0.115);
  ctx.quadraticCurveTo(T * 0.905, y - T * 0.06, T * 0.875, y);
  ctx.closePath();
  ctx.fill();

  // la légende des vieilles cartes
  ctx.font = `italic ${T * 0.055}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(91, 74, 47, 0.55)';
  ctx.fillText('Ici veillent les dragons', T * 0.52, y + T * 0.13);
}

export function creerOrnements() {
  const groupe = new THREE.Group();
  groupe.visible = false;

  // Pacifique Sud, au large de la route du retour — un coin d'océan vide
  const rose = patch(textureCanvas(1024, dessineRose), -50, -32, -125, -107);
  // Atlantique Nord, visible dès le départ de la Martinique
  const serpent = patch(textureCanvas(1024, dessineSerpent), 21, 35, -52, -38);
  groupe.add(rose, serpent);

  return { groupe };
}
