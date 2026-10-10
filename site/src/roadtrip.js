// Le roadtrip de l'automne 2013. Pendant que Let It Be attendait dans sa
// marina de San Francisco, la famille est partie cinq semaines en camping-car
// dans les parcs de l'Ouest ; chaque billet de la route porte le compteur en
// tête (« M2275 - Natural Bridges »). Sur le globe : un pointillé d'encre sur
// la terre ferme, distinct du sillage doré de la mer. Dans le carnet de San
// Francisco : une petite carte et la liste des billets de la route.
//
// Le tracé relie les étapes et les lieux que les billets nomment
// (data/roadtrip.json, pipeline/extract_roadtrip.py) ; les routes exactes
// n'ont pas été notées, la carte le dit.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { RAYON, slerpSurface, latLonVers3D } from './geo.js';

// l'escale pendant laquelle le camping-car a roulé
export const CLE_ESCALE_ROADTRIP = 'San Francisco|2013-09-10';

const ALTITUDE = RAYON * 1.0026;
const PAS_RAD = THREE.MathUtils.degToRad(0.2);
const NS = 'http://www.w3.org/2000/svg';

let chargement = null;
export function chargeRoadtrip() {
  chargement ??= fetch('./data/roadtrip.json')
    .then(r => (r.ok ? r.json() : []))
    .then(etapes => (Array.isArray(etapes) ? etapes : []))
    .catch(() => []);
  return chargement;
}

// Le chemin dessiné : chaque étape, précédée des lieux traversés que son
// billet cite (Davis, Salt Lake City, Sedona…).
function chemin(etapes) {
  const points = [];
  for (const e of etapes) {
    for (const v of e.via ?? []) points.push(v);
    points.push(e);
  }
  return points;
}

// « M2275 - Natural Bridges » → « Natural Bridges » : le titre du billet,
// sans le compteur qui est affiché à part.
export function titreBillet(etape) {
  return (etape.titre ?? '').replace(/^M\d+\s*-\s*/, '').trim();
}

const formatJour = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});
const formatJourCourt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const miles = n => `${n.toLocaleString('fr-FR')} miles`;

// Les étapes datées (la première, le départ de San Francisco, n'a ni date
// ni billet), regroupées par lieu : Yellowstone a quatre billets.
function lieux(etapes) {
  const parCle = new Map();
  for (const e of etapes) {
    if (!e.article_id) continue;
    const cle = `${e.lat.toFixed(2)}|${e.lon.toFixed(2)}`;
    if (!parCle.has(cle)) parCle.set(cle, { lat: e.lat, lon: e.lon, lieu: e.lieu, etapes: [] });
    parCle.get(cle).etapes.push(e);
  }
  return [...parCle.values()];
}

export function infobulleLieu(lieu) {
  const [premiere] = lieu.etapes;
  const derniere = lieu.etapes[lieu.etapes.length - 1];
  const dates = premiere === derniere
    ? formatJourCourt.format(new Date(`${premiere.date}T12:00:00Z`))
    : `${formatJour.format(new Date(`${premiere.date}T12:00:00Z`))} → ${
      formatJourCourt.format(new Date(`${derniere.date}T12:00:00Z`))}`;
  return { nom: lieu.lieu, detail: `${dates} · en camping-car, ${miles(premiere.miles)}` };
}

/* ------------------------------------------------------------------ */
/* Sur le globe                                                        */
/* ------------------------------------------------------------------ */

export function creerTraceRoadtrip(etapes, relief) {
  const groupe = new THREE.Group();
  groupe.name = 'roadtrip';

  const points = chemin(etapes);
  const sommets = [];
  const reperes = []; // les points nommés, pour viser le tracé
  for (let i = 0; i < points.length; i++) {
    const a = latLonVers3D(points[i].lat, points[i].lon, 1);
    reperes.push(a.clone().multiplyScalar(Math.max(ALTITUDE, relief.altitude(a, 0.0045))));
    if (i === points.length - 1) break;
    const b = latLonVers3D(points[i + 1].lat, points[i + 1].lon, 1);
    const n = Math.max(1, Math.ceil(a.angleTo(b) / PAS_RAD));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const p = slerpSurface(a, b, k / n, 1);
      p.multiplyScalar(Math.max(ALTITUDE, relief.altitude(p, 0.0045)));
      sommets.push(p.x, p.y, p.z);
    }
  }
  // a pale ribbon under a dark dashed line: legible over the ochre desert
  // as over the green forests, and clearly not the golden sea route
  const geometrie = new LineGeometry();
  geometrie.setPositions(sommets);
  const matHaloTrace = new LineMaterial({
    color: 0xfff3dc,
    linewidth: 4,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const haloTrace = new Line2(geometrie, matHaloTrace);
  haloTrace.name = 'roadtrip-halo';
  haloTrace.renderOrder = 1.9;
  groupe.add(haloTrace);
  const matTrace = new LineMaterial({
    color: 0x5c2410,
    linewidth: 2,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    dashed: true,
    dashSize: 0.01,
    gapSize: 0.007,
  });
  const trace = new Line2(geometrie, matTrace);
  trace.computeLineDistances();
  trace.name = 'roadtrip-trace';
  trace.renderOrder = 2;
  groupe.add(trace);

  // un point d'encre cerclé de crème par lieu, seulement quand on est assez
  // près pour qu'ils ne se marchent pas dessus
  const places = lieux(etapes);
  const positions = places.map(l => {
    const p = latLonVers3D(l.lat, l.lon, 1);
    return p.multiplyScalar(Math.max(ALTITUDE, relief.altitude(p, 0.0045)) + 0.0004);
  });
  const matPoint = new THREE.MeshBasicMaterial({ color: 0x5c2410, depthWrite: false, transparent: true });
  const matHalo = new THREE.MeshBasicMaterial({ color: 0xfff6e2, depthWrite: false, transparent: true });
  const disques = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18), matPoint, places.length);
  const halos = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18), matHalo, places.length);
  disques.renderOrder = 2.7;
  halos.renderOrder = 2.6;
  disques.frustumCulled = false;
  halos.frustumCulled = false;
  groupe.add(halos, disques);

  const centre = new THREE.Vector3();
  reperes.forEach(p => centre.add(p));
  centre.divideScalar(reperes.length);

  const affiches = new Array(places.length).fill(null); // {x, y} à l'écran
  let reperesEcran = [];
  let indexSurvol = -1;
  const projete = new THREE.Vector3();
  const dansCamera = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const versCamera = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const echelle = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const vide = new THREE.Matrix4().makeScale(0, 0, 0);

  function ecran(p, camera) {
    projete.copy(p).project(camera);
    return {
      x: (projete.x * 0.5 + 0.5) * innerWidth,
      y: (-projete.y * 0.5 + 0.5) * innerHeight,
      dedans: projete.z > -1 && projete.z < 1,
    };
  }

  function oriente(camera, { visible, anneaux = [], etiquettes = [] }) {
    groupe.visible = Boolean(visible);
    if (!visible) {
      affiches.fill(null);
      reperesEcran = [];
      return;
    }
    const compact = innerWidth < 700 || innerHeight < 520;
    const ratio = Math.min(devicePixelRatio, compact ? 1.5 : 2);
    const d = camera.position.length();
    const seuilHorizon = Math.min(0.9, 1.03 / Math.max(d, 1.05) + 0.02);
    direction.copy(camera.position).normalize();

    // des tirets de taille constante à l'écran, quel que soit le zoom
    dansCamera.copy(centre).applyMatrix4(camera.matrixWorldInverse);
    const unitesParPixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      * Math.max(0.04, -dansCamera.z) / Math.max(1, innerHeight);
    matTrace.dashSize = unitesParPixel * (compact ? 6 : 7);
    matTrace.gapSize = unitesParPixel * (compact ? 4 : 4.5);
    matTrace.linewidth = (compact ? 1.7 : 2) * ratio;
    matHaloTrace.linewidth = (compact ? 3.6 : 4.2) * ratio;

    reperesEcran = reperes
      .filter(p => p.clone().normalize().dot(direction) > seuilHorizon)
      .map(p => ecran(p, camera))
      .filter(p => p.dedans);

    // assez près pour distinguer les étapes ? (l'Ouest fait plus de 150 px)
    let etendue = 0;
    for (const a of reperesEcran) {
      for (const b of reperesEcran) etendue = Math.max(etendue, Math.hypot(a.x - b.x, a.y - b.y));
    }
    const pointsVisibles = etendue > (compact ? 130 : 160);
    const espacement = compact ? 14 : 12;
    const tailleBase = compact ? 3.4 : 3.8;
    const montres = [];
    positions.forEach((p, i) => {
      let affiche = false;
      let x = 0;
      let y = 0;
      if (pointsVisibles && p.clone().normalize().dot(direction) > seuilHorizon) {
        ({ x, y } = ecran(p, camera));
        const dansChamp = x > 8 && x < innerWidth - 8 && y > 8 && y < innerHeight - 8;
        const libre = !montres.some(c => Math.hypot(c.x - x, c.y - y) < espacement)
          && !anneaux.some(c => Math.hypot(c.x - x, c.y - y) < 16)
          && !etiquettes.some(r => x > r.gauche - 6 && x < r.droite + 6
            && y > r.haut - 6 && y < r.bas + 6);
        affiche = dansChamp && libre;
      }
      affiches[i] = affiche ? { x, y } : null;
      if (!affiche) {
        disques.setMatrixAt(i, vide);
        halos.setMatrixAt(i, vide);
        return;
      }
      montres.push({ x, y });
      dansCamera.copy(p).applyMatrix4(camera.matrixWorldInverse);
      const upp = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
        * Math.max(0.04, -dansCamera.z) / Math.max(1, innerHeight);
      const taille = upp * tailleBase * (i === indexSurvol ? 1.4 : 1);
      versCamera.copy(camera.position).sub(p).normalize();
      q.setFromUnitVectors(Z, versCamera);
      echelle.setScalar(taille);
      m.compose(p, q, echelle);
      disques.setMatrixAt(i, m);
      echelle.setScalar(taille * 1.75);
      m.compose(p, q, echelle);
      halos.setMatrixAt(i, m);
    });
    disques.instanceMatrix.needsUpdate = true;
    halos.instanceMatrix.needsUpdate = true;
  }

  // le lieu sous le pointeur (seulement parmi les points affichés)
  function lieuProche(x, y, rayonPx) {
    let meilleur = -1;
    let distance = rayonPx;
    affiches.forEach((a, i) => {
      if (!a) return;
      const dd = Math.hypot(a.x - x, a.y - y);
      if (dd < distance) {
        distance = dd;
        meilleur = i;
      }
    });
    return meilleur >= 0 ? { index: meilleur, ...places[meilleur] } : null;
  }

  // le pointeur est-il sur le pointillé ? (vue d'ensemble, points cachés)
  function surTrace(x, y, rayonPx) {
    for (let i = 0; i < reperesEcran.length - 1; i++) {
      const a = reperesEcran[i];
      const b = reperesEcran[i + 1];
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = l2 ? THREE.MathUtils.clamp(((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / l2, 0, 1) : 0;
      if (Math.hypot(a.x + t * (b.x - a.x) - x, a.y + t * (b.y - a.y) - y) < rayonPx) return true;
    }
    return false;
  }

  function regleMode(mode) {
    const carnet = mode === 'carnet';
    matTrace.color.set(carnet ? 0x5c2410 : 0xf3dfb4);
    matHaloTrace.color.set(carnet ? 0xfff3dc : 0x1a120a);
    matPoint.color.set(carnet ? 0x5c2410 : 0xf3dfb4);
    matHalo.color.set(carnet ? 0xfff6e2 : 0x2a1c10);
  }

  return {
    groupe,
    total: etapes[etapes.length - 1].miles,
    oriente,
    lieuProche,
    surTrace,
    regleMode,
    regleSurvol(i) { indexSurvol = i; },
    etat() {
      return {
        visible: groupe.visible,
        points: affiches.filter(Boolean).length,
        lieux: places.length,
        marqueurs: places.map((l, i) => ({
          nom: l.lieu,
          billet: l.etapes[0].article_id,
          ...(affiches[i] ? { x: Math.round(affiches[i].x), y: Math.round(affiches[i].y) } : {}),
        })),
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dans le carnet de San Francisco                                     */
/* ------------------------------------------------------------------ */

// Mêmes bornes que pipeline/carte_roadtrip.py (textures/carte_ouest.jpg).
const CARTE = { lonOuest: -124.6, lonEst: -106.6, latNord: 46.4, latSud: 33.6, l: 760, h: 706 };
const versCarte = (lat, lon) => [
  (lon - CARTE.lonOuest) / (CARTE.lonEst - CARTE.lonOuest) * CARTE.l,
  (CARTE.latNord - lat) / (CARTE.latNord - CARTE.latSud) * CARTE.h,
];

// Les grands noms seulement, placés à la main pour ne pas se chevaucher ;
// les autres étapes restent des points (leur nom s'affiche au survol).
const NOMS_CARTE = {
  'San Francisco': [0, 36, 'middle'],
  Yellowstone: [18, 6, 'start'],
  Canyonlands: [16, 2, 'start'],
  'Monument Valley': [0, 33, 'middle'],
  'Grand Canyon': [0, 32, 'middle'],
  'Bryce Canyon': [-12, -14, 'end'],
  Zion: [-14, 8, 'end'],
  'Las Vegas': [0, 32, 'middle'],
  'Death Valley': [-14, 8, 'end'],
  Yosemite: [0, -18, 'middle'],
};

function el(nom, attributs = {}, parent = null) {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attributs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
}

export function sectionRoadtrip(etapes, { surBillet }) {
  const billets = etapes.filter(e => e.article_id);
  const derniere = billets[billets.length - 1];
  const section = document.createElement('section');
  section.className = 'roadtrip';
  section.id = 'roadtrip';
  section.setAttribute('aria-labelledby', 'roadtrip-titre');

  const h = document.createElement('h3');
  h.id = 'roadtrip-titre';
  h.className = 'roadtrip-titre';
  h.textContent = 'En camping-car dans les parcs de l’Ouest';
  section.append(h);

  const chapeau = document.createElement('p');
  chapeau.className = 'roadtrip-chapeau';
  chapeau.textContent = 'Pendant que Let It Be attendait, «\u00a0bien sage dans la marina\u00a0», '
    + 'la famille est partie cinq semaines en camping-car. Chaque billet de la route porte '
    + `le compteur en tête (M983 : 983 miles depuis le départ). Au retour : ${miles(derniere.miles)}.`;
  section.append(chapeau);

  const figure = document.createElement('figure');
  figure.className = 'roadtrip-carte';
  const cadre = document.createElement('div');
  cadre.className = 'roadtrip-cadre';
  const img = document.createElement('img');
  img.src = './textures/carte_ouest.jpg';
  img.alt = '';
  img.width = CARTE.l;
  img.height = CARTE.h;
  img.decoding = 'async';
  cadre.append(img);

  const svg = el('svg', {
    viewBox: `0 0 ${CARTE.l} ${CARTE.h}`,
    role: 'img',
    'aria-label': `Carte du trajet en camping-car : de San Francisco à Yellowstone, puis les parcs de l’Utah et de l’Arizona, Las Vegas, la Vallée de la Mort et le Yosemite, avant le retour à San Francisco.`,
  });
  const trace = chemin(etapes).map(p => versCarte(p.lat, p.lon).map(v => v.toFixed(1)).join(',')).join(' ');
  el('polyline', { points: trace, class: 'roadtrip-halo' }, svg);
  el('polyline', { points: trace, class: 'roadtrip-ligne' }, svg);

  const nomsPoses = new Set();
  for (const lieu of lieux(etapes)) {
    const [x, y] = versCarte(lieu.lat, lieu.lon);
    const premiere = lieu.etapes[0];
    const g = el('g', { class: 'roadtrip-point', 'data-article': premiere.article_id }, svg);
    const info = infobulleLieu(lieu);
    el('title', {}, g).textContent = `${info.nom} · ${info.detail}`;
    el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 18, class: 'roadtrip-cible' }, g);
    el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6.5 }, g);
    g.addEventListener('click', () => surBillet(premiere.article_id));
    const pose = NOMS_CARTE[lieu.lieu];
    if (pose && !nomsPoses.has(lieu.lieu)) {
      nomsPoses.add(lieu.lieu);
      const t = el('text', {
        x: (x + pose[0]).toFixed(1), y: (y + pose[1]).toFixed(1),
        'text-anchor': pose[2], class: 'roadtrip-nom',
      }, svg);
      t.textContent = lieu.lieu;
    }
  }
  // le départ et le retour : la marina, marquée d'une ancre
  const [xd, yd] = versCarte(etapes[0].lat, etapes[0].lon);
  el('circle', { cx: xd.toFixed(1), cy: yd.toFixed(1), r: 10, class: 'roadtrip-depart' }, svg);
  cadre.append(svg);
  figure.append(cadre);

  const legende = document.createElement('figcaption');
  legende.textContent = 'Le trait relie les étapes et les lieux nommés dans les billets ; '
    + 'les routes exactes n’ont pas été notées. Touchez un point pour lire son billet.';
  figure.append(legende);
  section.append(figure);

  const liste = document.createElement('details');
  liste.className = 'roadtrip-liste';
  const resume = document.createElement('summary');
  resume.textContent = `Les ${billets.length} billets de la route`;
  liste.append(resume);
  const ol = document.createElement('ol');
  for (const e of billets) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const compteur = document.createElement('span');
    compteur.className = 'roadtrip-compteur';
    compteur.textContent = `M${e.miles}`;
    const titre = document.createElement('span');
    titre.className = 'roadtrip-billet';
    titre.textContent = titreBillet(e);
    const quand = document.createElement('span');
    quand.className = 'roadtrip-quand';
    quand.textContent = `${e.lieu} · ${formatJour.format(new Date(`${e.date}T12:00:00Z`))}`;
    b.append(compteur, titre, quand);
    b.addEventListener('click', () => surBillet(e.article_id));
    li.append(b);
    ol.append(li);
  }
  liste.append(ol);
  section.append(liste);
  return section;
}

// Annonce en tête du carnet de San Francisco : le roadtrip est plus bas.
export function annonceRoadtrip(etapes, { surClic }) {
  const derniere = etapes[etapes.length - 1];
  const p = document.createElement('p');
  p.className = 'roadtrip-annonce';
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = '<span class="roadtrip-annonce-titre"></span><span class="roadtrip-annonce-detail"></span>';
  b.querySelector('.roadtrip-annonce-titre').textContent = 'Pendant l’escale : le roadtrip des parcs';
  b.querySelector('.roadtrip-annonce-detail').textContent =
    `cinq semaines en camping-car, ${miles(derniere.miles)} · la carte et les billets ↓`;
  b.addEventListener('click', surClic);
  p.append(b);
  return p;
}
