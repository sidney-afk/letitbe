// Le sillage : la route des cinq ans tracée sur le globe, avec sa portion
// déjà parcourue qui s'illumine au fil de la timeline, et les mouillages.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { RAYON, slerpSurface, latLonVers3D } from './geo.js';

const ALTITUDE = RAYON * 1.0022;
const PAS_RAD = THREE.MathUtils.degToRad(0.35); // ≈ 39 km entre deux points

/**
 * Échantillonne la chronologie en une polyline horodatée : chaque point
 * porte son instant, ce qui permet de « couper » la ligne à la date courante
 * d'un simple instanceCount.
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

export function creerRoute(voyage, routeData) {
  const groupe = new THREE.Group();
  const { points, temps } = echantillonne(voyage);
  const positions = [];
  for (const p of points) positions.push(p.x, p.y, p.z);

  const resolution = new THREE.Vector2(innerWidth, innerHeight);

  const geoComplete = new LineGeometry();
  geoComplete.setPositions(positions);
  const ligneComplete = new Line2(geoComplete, new LineMaterial({
    color: 0x6a86a0,
    linewidth: 2.2,
    transparent: true,
    opacity: 0.5,
    resolution,
  }));
  ligneComplete.computeLineDistances();
  groupe.add(ligneComplete);

  const geoSillage = new LineGeometry();
  geoSillage.setPositions(positions);
  const ligneSillage = new Line2(geoSillage, new LineMaterial({
    color: 0xeec97e,
    linewidth: 4.2,
    transparent: true,
    opacity: 0.95,
    resolution,
  }));
  ligneSillage.computeLineDistances();
  groupe.add(ligneSillage);

  // mouillages : épingles or et crème, taille d'écran ~constante, avec une
  // cible de clic invisible bien plus généreuse que le dessin
  const escales = routeData.filter(e => e.type !== 'traversee' && e.date_arrivee);
  const matAnneau = new THREE.MeshBasicMaterial({ color: 0xc8922e });
  const matCoeur = new THREE.MeshBasicMaterial({ color: 0xfffbef });
  const matCible = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false,
  });
  const anneaux = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1, 0.22, 8, 28), matAnneau, escales.length);
  const coeurs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.62, 12, 10), matCoeur, escales.length);
  const cibles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(3.2, 8, 6), matCible, escales.length);
  const positionsPerles = escales.map(e => latLonVers3D(e.lat, e.lon, ALTITUDE));
  groupe.add(anneaux, coeurs, cibles);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const versCamera = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  function orientePerles(camera) {
    // ~9 px à l'écran quelle que soit la distance, anneaux face caméra
    const d = camera.position.length();
    const s = THREE.MathUtils.clamp((d - 1) * 0.0035, 0.0006, 0.009);
    echelle.setScalar(s);
    positionsPerles.forEach((p, i) => {
      versCamera.copy(camera.position).sub(p).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), versCamera);
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
    // nombre de segments instanciés dont le départ est déjà passé
    let lo = 0, hi = temps.length - 1;
    while (lo < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (temps[mi] <= t) lo = mi; else hi = mi - 1;
    }
    geoSillage.instanceCount = Math.max(0, lo);
  }

  function surResize(w, h) {
    resolution.set(w, h);
  }

  function regleMode(mode) {
    if (mode === 'carnet') {
      ligneSillage.material.color.set(0xf2a035); // or chaud sur océan vif
      ligneComplete.material.color.set(0xffffff);
      ligneComplete.material.opacity = 0.55;
      matAnneau.color.set(0xc8922e);
    } else {
      ligneSillage.material.color.set(0xeec97e);
      ligneComplete.material.color.set(0x8fa9c0);
      ligneComplete.material.opacity = 0.5;
      matAnneau.color.set(0xeec97e);
    }
  }

  return {
    groupe, metAJourTemps, surResize, regleMode, orientePerles,
    cibles, escales,
  };
}
