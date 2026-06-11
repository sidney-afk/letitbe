// Géométrie du globe : conversions lat/lon ↔ Vector3 et route paramétrée
// par le temps. Le repère suit la convention des textures équirectangulaires
// plaquées sur THREE.SphereGeometry.

import * as THREE from 'three';

export const RAYON = 1;

export function latLonVers3D(lat, lon, rayon = RAYON) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -rayon * Math.sin(phi) * Math.cos(theta),
    rayon * Math.cos(phi),
    rayon * Math.sin(phi) * Math.sin(theta),
  );
}

// Interpolation en orthodromie (slerp sur la sphère unité).
export function slerpSurface(a, b, t, rayon = RAYON) {
  const va = a.clone().normalize();
  const vb = b.clone().normalize();
  const omega = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1));
  if (omega < 1e-6) return va.multiplyScalar(rayon);
  const so = Math.sin(omega);
  return va.multiplyScalar(Math.sin((1 - t) * omega) / so)
    .add(vb.multiplyScalar(Math.sin(t * omega) / so))
    .multiplyScalar(rayon);
}

const JOUR_MS = 86400e3;

/**
 * Construit la chronologie du voyage à partir de data/route.json :
 * une suite de segments { t0, t1, p0, p1, libelle, enMer } continue
 * du départ à l'arrivée. Reprend les règles du pipeline :
 *  - une ligne « traversee » couvre le temps de mer vers son point ;
 *  - un trou avant une traversée ou > 30 j = bateau immobile ;
 *  - un trou court = navigation vers l'escale suivante.
 */
export function construireVoyage(route) {
  const seg = [];
  const pts = route.map(e => latLonVers3D(e.lat, e.lon));
  const date = s => new Date(s + 'T12:00:00Z').getTime();

  for (let i = 0; i < route.length; i++) {
    const e = route[i];
    if (!e.date_arrivee) continue;
    const arr = date(e.date_arrivee);
    const dep = e.date_depart ? date(e.date_depart) : arr;

    if (e.type === 'traversee' && i > 0 && dep - arr > JOUR_MS) {
      seg.push({
        t0: arr, t1: dep, p0: pts[i - 1], p1: pts[i],
        libelle: `En mer — ${e.nom}`, enMer: true, escale: e,
      });
    } else if (dep >= arr) {
      seg.push({
        t0: arr, t1: Math.max(dep, arr + 1), p0: pts[i], p1: pts[i],
        libelle: e.nom, enMer: false, escale: e,
      });
    }

    const n = route[i + 1];
    if (!n || !n.date_arrivee) continue;
    const narr = date(n.date_arrivee);
    if (narr - dep <= JOUR_MS) continue;
    if (n.type === 'traversee' || narr - dep > 30 * JOUR_MS) {
      seg.push({
        t0: dep, t1: narr, p0: pts[i], p1: pts[i],
        libelle: e.nom, enMer: false, escale: e,
      });
    } else {
      seg.push({
        t0: dep, t1: narr, p0: pts[i], p1: pts[i + 1],
        libelle: `En mer — ${e.nom} → ${n.nom}`, enMer: true, escale: n,
      });
    }
  }

  seg.sort((a, b) => a.t0 - b.t0);
  const debut = seg[0].t0;
  const fin = seg[seg.length - 1].t1;

  function segmentA(t) {
    let lo = 0, hi = seg.length - 1;
    while (lo < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (seg[mi].t0 <= t) lo = mi; else hi = mi - 1;
    }
    return seg[lo];
  }

  function position(t, rayon = RAYON) {
    t = THREE.MathUtils.clamp(t, debut, fin);
    const s = segmentA(t);
    const f = s.t1 > s.t0 ? THREE.MathUtils.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1) : 0;
    return slerpSurface(s.p0, s.p1, f, rayon);
  }

  return { segments: seg, debut, fin, position, segmentA };
}
