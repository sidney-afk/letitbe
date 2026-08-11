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

  function indiceSegment(t) {
    let lo = 0, hi = seg.length - 1;
    while (lo < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (seg[mi].t0 <= t) lo = mi; else hi = mi - 1;
    }
    return lo;
  }

  function segmentA(t) {
    return seg[indiceSegment(t)];
  }

  function position(t, rayon = RAYON) {
    t = THREE.MathUtils.clamp(t, debut, fin);
    const s = segmentA(t);
    const f = s.t1 > s.t0 ? THREE.MathUtils.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1) : 0;
    return slerpSurface(s.p0, s.p1, f, rayon);
  }

  // Cap stable et déterministe pour le bateau. Aux mouillages, où p0 = p1,
  // on prend le prochain tronçon qui bouge (ou le dernier connu à l'arrivée)
  // plutôt que de dépendre du sens de lecture précédent de la timeline.
  function tangent(t, rayon = RAYON) {
    t = THREE.MathUtils.clamp(t, debut, fin);
    const index = indiceSegment(t);
    const normal = position(t, rayon).normalize();
    const direction = new THREE.Vector3();

    function capDuSegment(i) {
      if (i < 0 || i >= seg.length) return false;
      direction.copy(seg[i].p1).sub(seg[i].p0);
      direction.addScaledVector(normal, -direction.dot(normal));
      return direction.lengthSq() > 1e-12;
    }

    if (!capDuSegment(index)) {
      for (let i = index + 1; i < seg.length; i++) {
        if (capDuSegment(i)) break;
      }
    }
    if (direction.lengthSq() <= 1e-12) {
      for (let i = index - 1; i >= 0; i--) {
        if (capDuSegment(i)) break;
      }
    }
    if (direction.lengthSq() <= 1e-12) {
      // Route dégénérée : choisit l'axe monde le moins aligné avec la
      // normale. Sa projection reste donc strictement tangente, y compris
      // aux points exacts ±X du globe.
      const ax = Math.abs(normal.x);
      const ay = Math.abs(normal.y);
      const az = Math.abs(normal.z);
      if (ax <= ay && ax <= az) direction.set(1, 0, 0);
      else if (ay <= az) direction.set(0, 1, 0);
      else direction.set(0, 0, 1);
      direction.addScaledVector(normal, -direction.dot(normal));
    }
    return direction.normalize();
  }

  return { segments: seg, debut, fin, position, tangent, segmentA };
}
