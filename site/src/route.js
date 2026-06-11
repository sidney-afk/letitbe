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
    linewidth: 1.4,
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
    linewidth: 2.6,
    transparent: true,
    opacity: 0.95,
    resolution,
  }));
  ligneSillage.computeLineDistances();
  groupe.add(ligneSillage);

  // mouillages : petites perles dorées, cliquables
  const escales = routeData.filter(e => e.type !== 'traversee' && e.date_arrivee);
  const geoPerle = new THREE.SphereGeometry(0.0035, 10, 8);
  const matPerle = new THREE.MeshBasicMaterial({
    color: 0xffd896,
    transparent: true,
    opacity: 0.85,
  });
  const perles = new THREE.InstancedMesh(geoPerle, matPerle, escales.length);
  const m = new THREE.Matrix4();
  escales.forEach((e, i) => {
    m.setPosition(latLonVers3D(e.lat, e.lon, ALTITUDE));
    perles.setMatrixAt(i, m);
  });
  perles.instanceMatrix.needsUpdate = true;
  groupe.add(perles);

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

  return { groupe, metAJourTemps, surResize, perles, escales };
}
