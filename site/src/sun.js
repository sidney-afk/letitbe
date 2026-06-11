// Direction du soleil pour la date du voyage.
//
// La déclinaison saisonnière est réelle (la Croix du Sud attendra la version
// astronomique complète) ; la longitude subsolaire est ancrée près du bateau
// pour qu'un défilement de plusieurs jours par seconde ne fasse pas
// stroboscoper le terminateur : le bateau vit en fin de matinée permanente,
// le relief du terminateur reste visible sur le limbe.

import { latLonVers3D } from './geo.js';

export function directionSoleil(t, lonBateau) {
  const d = new Date(t);
  const debutAnnee = Date.UTC(d.getUTCFullYear(), 0, 1);
  const jourAnnee = (t - debutAnnee) / 86400e3;
  const declinaison = -23.44 * Math.cos(2 * Math.PI * (jourAnnee + 10) / 365.25);
  const lonSubsolaire = lonBateau + 35; // fin de matinée à bord
  return latLonVers3D(declinaison, lonSubsolaire, 1).normalize();
}
