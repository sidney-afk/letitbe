// Le vrai ciel (fonctionnalité 3 du plan) : les 9 096 étoiles du Yale
// Bright Star Catalog, placées en coordonnées équatoriales réelles, teintées
// par leur température de couleur, dimensionnées par leur magnitude.
// L'orientation suit le temps sidéral fourni par sun.js.

import * as THREE from 'three';
import { latLonVers3D } from './geo.js';

const RAYON_CIEL = 60;

// corps noir → RGB (ajustement classique de Tanner Helland, simplifié)
function couleurKelvin(k, cible) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  cible.setRGB(
    THREE.MathUtils.clamp(r / 255, 0, 1),
    THREE.MathUtils.clamp(g / 255, 0, 1),
    THREE.MathUtils.clamp(b / 255, 0, 1),
  );
  return cible;
}

export async function creerEtoiles() {
  const catalogue = await fetch('./data/etoiles.json').then(r => r.json());

  const n = catalogue.length;
  const positions = new Float32Array(n * 3);
  const tailles = new Float32Array(n);
  const teintes = new Float32Array(n * 3);
  const couleur = new THREE.Color();

  catalogue.forEach(([ra, dec, mag, kelvin], i) => {
    // RA placée comme une longitude « à temps sidéral nul » : le groupe
    // entier tourne ensuite de -GMST autour de l'axe des pôles
    const p = latLonVers3D(dec, ra, RAYON_CIEL);
    positions.set([p.x, p.y, p.z], i * 3);
    tailles[i] = Math.max(0.32, (6.9 - mag) * 0.34);
    couleurKelvin(kelvin, couleur);
    // les étoiles faibles tirent vers le gris
    const v = THREE.MathUtils.clamp(1.1 - mag * 0.11, 0.25, 1);
    teintes.set([couleur.r * v, couleur.g * v, couleur.b * v], i * 3);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('taille', new THREE.BufferAttribute(tailles, 1));
  geo.setAttribute('teinte', new THREE.BufferAttribute(teintes, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      attribute float taille;
      attribute vec3 teinte;
      varying vec3 vTeinte;
      void main() {
        vTeinte = teinte;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = taille * (150.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vTeinte;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(vTeinte, a);
      }`,
  });

  const points = new THREE.Points(geo, mat);

  return {
    points,
    oriente(gmstDeg) {
      points.rotation.y = -gmstDeg * Math.PI / 180;
    },
  };
}
