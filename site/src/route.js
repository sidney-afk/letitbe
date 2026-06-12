// Le sillage façon carte au trésor : un chemin de gros ronds d'or cerclés
// d'encre — vécu en or, à venir en crème —, des mouillages marqués de
// bagues d'or qui respirent, et un X rouge sang à l'arrivée : le trésor.
// Les proportions sont volontairement fausses : c'est le trajet qui compte.
// Le chemin est drapé sur le relief : il escalade les côtes montagneuses.

import * as THREE from 'three';
import { RAYON, slerpSurface, latLonVers3D } from './geo.js';

const ALTITUDE = RAYON * 1.0022;
const PAS_RAD = THREE.MathUtils.degToRad(0.52); // un rond tous les ~58 km

/**
 * Échantillonne la chronologie en un chapelet de points réguliers et
 * horodatés : la coupe au temps courant est un simple drawRange.
 */
function echantillonne(voyage, relief) {
  const points = [];
  const temps = [];
  for (const s of voyage.segments) {
    const omega = s.p0.angleTo(s.p1);
    const n = Math.max(1, Math.ceil(omega / PAS_RAD));
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const p = slerpSurface(s.p0, s.p1, f, 1);
      p.multiplyScalar(Math.max(ALTITUDE, relief.altitude(p, 0.0035)));
      const dernier = points[points.length - 1];
      if (dernier && dernier.distanceToSquared(p) < 1e-10) {
        temps[temps.length - 1] = s.t0 + f * (s.t1 - s.t0);
        continue;
      }
      points.push(p);
      temps.push(s.t0 + f * (s.t1 - s.t0));
    }
  }
  return { points, temps };
}

function materiauPointilles(couleur, bordure, taillePx, opacite) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      couleur: { value: new THREE.Color(couleur) },
      bordure: { value: new THREE.Color(bordure) },
      taille: { value: taillePx * Math.min(devicePixelRatio, 2) },
      opacite: { value: opacite },
    },
    vertexShader: /* glsl */`
      uniform float taille;
      void main() {
        gl_PointSize = taille;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 couleur;
      uniform vec3 bordure;
      uniform float opacite;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.42, d); // rond doux, bord fondu
        if (a < 0.01) discard;
        // cœur plein, fin cerne à peine plus sombre : tamponné, jamais noir
        // (les ronds se chevauchent de loin : un cerne foncé ferait corde)
        vec3 c = mix(bordure, couleur, smoothstep(0.44, 0.34, d));
        gl_FragColor = vec4(c, a * opacite);
      }`,
  });
}

// le X du trésor, tracé à la main (deux croisillons irréguliers)
function textureX() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a3252b';
  ctx.lineWidth = 30;
  const trait = (x0, y0, x1, y1, devie) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + devie, (y0 + y1) / 2 - devie, x1, y1);
    ctx.stroke();
  };
  trait(58, 64, 198, 196, 9);
  trait(196, 58, 60, 198, -7);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 12;
  trait(62, 70, 194, 192, 12);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function creerRoute(voyage, routeData, relief) {
  const groupe = new THREE.Group();
  const { points, temps } = echantillonne(voyage, relief);
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));
  const geoPoints = new THREE.BufferGeometry();
  geoPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const matSillage = materiauPointilles(0xf2a035, 0xcf831f, 14, 0.96);
  const matFutur = materiauPointilles(0xfdf8ec, 0xd9c08e, 8, 0.72);

  const sillage = new THREE.Points(geoPoints, matSillage);
  const futur = new THREE.Points(geoPoints.clone(), matFutur);
  sillage.renderOrder = 2;
  futur.renderOrder = 1;
  groupe.add(sillage, futur);

  // mouillages : bagues d'or à cœur crème, imposantes (carte au trésor),
  // avec une cible de clic invisible encore plus large
  const escales = routeData.filter(e => e.type !== 'traversee' && e.date_arrivee);
  const matAnneau = new THREE.MeshBasicMaterial({ color: 0xc8922e });
  const matCoeur = new THREE.MeshBasicMaterial({ color: 0xfffbef });
  const matCible = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false,
  });
  const anneaux = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1, 0.27, 8, 28), matAnneau, escales.length);
  const coeurs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.56, 12, 10), matCoeur, escales.length);
  const cibles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.6, 8, 6), matCible, escales.length);
  anneaux.renderOrder = 3;
  coeurs.renderOrder = 3;
  const positionsPerles = escales.map(e => {
    const p = latLonVers3D(e.lat, e.lon, 1);
    return p.multiplyScalar(Math.max(ALTITUDE, relief.altitude(p, 0.0035)));
  });
  groupe.add(anneaux, coeurs, cibles);

  // — X marque l'endroit : la fin du voyage, là où dort le trésor —
  // un poil au large du dernier mouillage, pour que la figurine amarrée
  // ne le recouvre pas
  const arrivee = routeData[routeData.length - 1];
  const croix = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textureX(),
    transparent: true,
    depthWrite: false,
  }));
  croix.position.copy(
    latLonVers3D(arrivee.lat - 3.4, arrivee.lon - 4.6, RAYON * 1.004));
  croix.renderOrder = 3;
  groupe.add(croix);

  let indexSurvol = -1;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const versCamera = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  function orientePerles(camera, tempsS = 0) {
    // ~24 px à l'écran quelle que soit la distance, anneaux face caméra,
    // une respiration lente : la carte est vivante
    const d = camera.position.length();
    const s = THREE.MathUtils.clamp((d - 1) * 0.0085, 0.0005, 0.022);
    positionsPerles.forEach((p, i) => {
      const vie = 1 + 0.06 * Math.sin(tempsS * 1.8 + i * 1.7);
      const survole = i === indexSurvol ? 1.35 : 1;
      echelle.setScalar(s * vie * survole);
      versCamera.copy(camera.position).sub(p).normalize();
      q.setFromUnitVectors(Z, versCamera);
      m.compose(p, q, echelle);
      anneaux.setMatrixAt(i, m);
      coeurs.setMatrixAt(i, m);
      cibles.setMatrixAt(i, m);
    });
    anneaux.instanceMatrix.needsUpdate = true;
    coeurs.instanceMatrix.needsUpdate = true;
    cibles.instanceMatrix.needsUpdate = true;
    const sx = THREE.MathUtils.clamp((d - 1) * 0.030, 0.002, 0.075);
    croix.scale.setScalar(sx);
  }

  function metAJourTemps(t) {
    let lo = 0, hi = temps.length - 1;
    while (lo < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (temps[mi] <= t) lo = mi; else hi = mi - 1;
    }
    sillage.geometry.setDrawRange(0, Math.max(1, lo + 1));
    futur.geometry.setDrawRange(lo + 1, temps.length - lo - 1);
  }

  function surResize() { /* tailles en pixels : rien à faire */ }

  function regleMode(mode) {
    if (mode === 'carnet') {
      matSillage.uniforms.couleur.value.set(0xf2a035);
      matSillage.uniforms.bordure.value.set(0xcf831f);
      matFutur.uniforms.couleur.value.set(0xfdf8ec);
      matAnneau.color.set(0xc8922e);
      croix.material.opacity = 1;
    } else {
      matSillage.uniforms.couleur.value.set(0xeec97e);
      matSillage.uniforms.bordure.value.set(0x6b5524);
      matFutur.uniforms.couleur.value.set(0x9fb7cc);
      matAnneau.color.set(0xeec97e);
      croix.material.opacity = 0.85;
    }
  }

  return {
    groupe, metAJourTemps, surResize, regleMode, orientePerles,
    cibles, escales,
    regleSurvol(i) { indexSurvol = i; },
  };
}
