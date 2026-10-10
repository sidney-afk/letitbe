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

  // L'horloge de la Traversée : la lecture n'avance pas au rythme du
  // calendrier brut, sinon les 17 mois d'hivernage à Whangarei occupent un
  // quart des trois minutes. Chaque jour de mer garde son poids ; une escale
  // pèse au plus quelques jours, un mouillage d'une nuit un peu plus d'un.
  // Le curseur, lui, reste linéaire dans le temps.
  const POIDS_ESCALE_MIN = 1.5;
  const POIDS_ESCALE_MAX = 7;
  const tranches = seg.map((s, i) => {
    const t0 = s.t0;
    const t1 = i + 1 < seg.length ? Math.max(t0, seg[i + 1].t0) : fin;
    const jours = (t1 - t0) / JOUR_MS;
    // (very long stays, like the NZ wintering, earn a few more seconds)
    const poids = s.enMer
      ? Math.max(0.5, jours)
      : jours <= POIDS_ESCALE_MAX
        ? Math.max(POIDS_ESCALE_MIN, jours)
        : POIDS_ESCALE_MAX + Math.min(POIDS_ESCALE_MAX, (jours - POIDS_ESCALE_MAX) / 30);
    return { t0, t1, poids };
  });
  let cumul = 0;
  for (const tr of tranches) {
    tr.w0 = cumul;
    cumul += tr.poids;
  }
  const poidsTotal = cumul;

  function versPoids(t) {
    t = THREE.MathUtils.clamp(t, debut, fin);
    const tr = tranches[indiceSegment(t)];
    const f = tr.t1 > tr.t0 ? THREE.MathUtils.clamp((t - tr.t0) / (tr.t1 - tr.t0), 0, 1) : 1;
    return tr.w0 + f * tr.poids;
  }

  function depuisPoids(w) {
    w = THREE.MathUtils.clamp(w, 0, poidsTotal);
    let lo = 0, hi = tranches.length - 1;
    while (lo < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (tranches[mi].w0 <= w) lo = mi; else hi = mi - 1;
    }
    const tr = tranches[lo];
    const f = tr.poids > 0 ? THREE.MathUtils.clamp((w - tr.w0) / tr.poids, 0, 1) : 1;
    return tr.t0 + f * (tr.t1 - tr.t0);
  }

  return {
    segments: seg, debut, fin, position, tangent, segmentA,
    lecture: { versPoids, depuisPoids, total: poidsTotal },
  };
}
