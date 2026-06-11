// Le sillage façon carte au trésor : un chemin de gros pointillés ronds —
// or pour ce qui est vécu, crème pour ce qui attend — et des mouillages
// marqués de bagues d'or bien visibles. Les proportions sont volontairement
// fausses : c'est le trajet qui compte, pas la géographie.

import * as THREE from 'three';
import { RAYON, slerpSurface, latLonVers3D } from './geo.js';

const ALTITUDE = RAYON * 1.0022;
const PAS_RAD = THREE.MathUtils.degToRad(0.22); // un rond tous les ~24 km

/**
 * Échantillonne la chronologie en un chapelet de points réguliers et
 * horodatés : la coupe au temps courant est un simple drawRange.
 */
function echantillonne(voyage) {
  const points = [];
  const temps = [];
  for (const s of voyage.segments) {
    const omega = s.p0.angleTo(s.p1);
    const n = Math.max(1, Math.ceil(omega / PAS_RAD));
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const p = slerpSurface(s.p0, s.p1, f, ALTITUDE);
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

function materiauPointilles(couleur, taillePx, opacite) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      couleur: { value: new THREE.Color(couleur) },
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
      uniform float opacite;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.32, d); // rond doux, bord fondu
        if (a < 0.01) discard;
        gl_FragColor = vec4(couleur, a * opacite);
      }`,
  });
}

export function creerRoute(voyage, routeData) {
  const groupe = new THREE.Group();
  const { points, temps } = echantillonne(voyage);
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));
  const geoPoints = new THREE.BufferGeometry();
  geoPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const matSillage = materiauPointilles(0xf2a035, 9, 0.95);
  const matFutur = materiauPointilles(0xfdf8ec, 5.5, 0.65);

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
    new THREE.TorusGeometry(1, 0.26, 8, 28), matAnneau, escales.length);
  const coeurs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.58, 12, 10), matCoeur, escales.length);
  const cibles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.6, 8, 6), matCible, escales.length);
  anneaux.renderOrder = 3;
  coeurs.renderOrder = 3;
  const positionsPerles = escales.map(e => latLonVers3D(e.lat, e.lon, ALTITUDE));
  groupe.add(anneaux, coeurs, cibles);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const versCamera = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  function orientePerles(camera) {
    // ~16 px à l'écran quelle que soit la distance, anneaux face caméra
    const d = camera.position.length();
    const s = THREE.MathUtils.clamp((d - 1) * 0.0062, 0.0004, 0.016);
    echelle.setScalar(s);
    positionsPerles.forEach((p, i) => {
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
      matFutur.uniforms.couleur.value.set(0xfdf8ec);
      matAnneau.color.set(0xc8922e);
    } else {
      matSillage.uniforms.couleur.value.set(0xeec97e);
      matFutur.uniforms.couleur.value.set(0x9fb7cc);
      matAnneau.color.set(0xeec97e);
    }
  }

  return {
    groupe, metAJourTemps, surResize, regleMode, orientePerles,
    cibles, escales,
  };
}
