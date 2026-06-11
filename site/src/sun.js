// Position du soleil et orientation du ciel pour la date du voyage.
//
// La position écliptique du soleil est réelle (formules basse précision,
// largement suffisantes à l'échelle du globe). La longitude subsolaire est
// ancrée près du bateau pour qu'un défilement de plusieurs jours par seconde
// ne fasse pas stroboscoper le terminateur : le bateau vit en fin de matinée
// permanente. Le temps sidéral qui en découle oriente le catalogue
// d'étoiles : à heure locale fixée, le ciel glisse d'un degré par jour —
// et la Croix du Sud est au bon endroit pour la date.

import { latLonVers3D } from './geo.js';

const RAD = Math.PI / 180;

export function soleilEtCiel(t, lonBateau) {
  // jours depuis J2000
  const n = (t - Date.UTC(2000, 0, 1, 12)) / 86400e3;
  const L = (280.460 + 0.9856474 * n) % 360;          // longitude moyenne
  const g = (357.528 + 0.9856003 * n) * RAD;          // anomalie moyenne
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const epsilon = 23.439 * RAD;

  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  const lonSubsolaire = lonBateau + 35; // fin de matinée à bord
  const gmstDeg = alpha / RAD - lonSubsolaire;

  return {
    dirSoleil: latLonVers3D(delta / RAD, lonSubsolaire, 1).normalize(),
    gmstDeg,
  };
}
