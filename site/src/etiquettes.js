// Place names on the illustrated globe.  Labels remain part of the Three.js
// scene, but their layout is decided in screen space so they cannot pile up,
// disappear under the globe edge, or trespass into the interface.

import * as THREE from 'three';
import { latLonVers3D } from './geo.js';

const LIEUX = [
  ['Martinique', 14.6, -61.0, 1],
  ['Los Roques', 11.95, -66.67, 0],
  ['Aruba', 12.5, -70.04, 0],
  ['San Blas', 9.55, -78.95, 0],
  ['Panamá', 8.9, -79.6, 1],
  ['Galápagos', -0.75, -90.31, 1],
  ['Gambier', -23.12, -134.97, 1],
  ['Marquises', -9.5, -139.5, 1],
  ['Tuamotu', -15.9, -146.2, 1],
  ['Tahiti', -17.53, -149.57, 1],
  ['Bora Bora', -16.5, -151.74, 0],
  ['Îles Cook', -20.0, -159.78, 0],
  ['Niue', -19.05, -169.92, 0],
  ['Tonga', -18.65, -173.98, 0],
  ['Fidji', -17.8, 178.0, 1],
  ['Nouvelle-Zélande', -38.5, 175.5, 1],
  ['Hawaï', 20.6, -156.5, 1],
  ['Colombie-Britannique', 52.5, -127.5, 1],
  ['San Francisco', 37.81, -122.44, 1],
  ['San Diego', 32.72, -117.23, 1],
  ['Costa Rica', 10.5, -84.8, 0],
];

const SELECTEURS_ZONES = [
  '[data-scene-safe-zone]',
  '#titre',
  '#boutons-haut',
  '#timeline',
  '#recit-carte',
  '#plongee',
  '#lightbox',
].join(',');

function spriteTexte(texte, important) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const police = `italic 600 ${important ? 150 : 122}px Iowan Old Style, Palatino, Georgia, serif`;
  ctx.font = police;
  const largeur = Math.ceil(ctx.measureText(texte).width) + 110;
  c.width = largeur;
  c.height = 220;
  ctx.font = police;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,250,234,0.98)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#5b3d1e';
  for (let i = 0; i < 3; i++) ctx.fillText(texte, largeur / 2, 112);
  ctx.shadowBlur = 0;
  ctx.fillText(texte, largeur / 2, 112);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, ratio: largeur / 220 };
}

function chevauche(a, b, marge = 0) {
  return a.gauche < b.droite + marge
    && a.droite > b.gauche - marge
    && a.haut < b.bas + marge
    && a.bas > b.haut - marge;
}

function cleLieu(texte = '') {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function rectangleDom(element, marge) {
  if (element.hidden) return null;
  const style = getComputedStyle(element);
  const permanent = ['titre', 'boutons-haut', 'timeline', 'navigation-escales']
    .includes(element.id);
  if (style.display === 'none' || style.visibility === 'hidden'
    || (!permanent && Number(style.opacity) < 0.05)) return null;
  const r = element.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return {
    gauche: r.left - marge,
    droite: r.right + marge,
    haut: r.top - marge,
    bas: r.bottom + marge,
    type: 'interface',
    nom: element.id || element.getAttribute('aria-label') || element.tagName,
  };
}

export function creerEtiquettes(relief) {
  const groupe = new THREE.Group();
  const sprites = [];
  const projete = new THREE.Vector3();
  const dansCamera = new THREE.Vector3();
  const directionCamera = new THREE.Vector3();
  let zonesInterface = [];
  let prochaineLectureZones = 0;
  let dernierEtat = [];

  for (const [nom, lat, lon, important] of LIEUX) {
    const { texture, ratio } = spriteTexte(nom, important);
    const materiau = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      // Back-facing labels are rejected in code. Disabling depth testing keeps
      // the remaining billboard from being cut in half by the curved horizon.
      depthTest: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(materiau);
    const ancrage = latLonVers3D(lat, lon, 1);
    sprite.position.copy(ancrage).multiplyScalar(
      Math.max(1.025, relief.altitude(ancrage, 0.018)));
    sprite.renderOrder = 10;
    sprites.push({
      nom,
      cle: cleLieu(nom),
      sprite,
      ratio,
      important: Boolean(important),
      cible: 0,
      rectangle: null,
      ancrageEcran: null,
      profondeur: null,
      priorite: important ? 1 : 0,
      raison: 'initialisation',
    });
    groupe.add(sprite);
  }

  function litZonesInterface(largeur, hauteur) {
    const maintenant = performance.now();
    if (maintenant < prochaineLectureZones) return zonesInterface;
    prochaineLectureZones = maintenant + 240;
    const marge = largeur < 700 ? 10 : 14;
    const elements = [...new Set(document.querySelectorAll(SELECTEURS_ZONES))];
    zonesInterface = elements
      .map(element => rectangleDom(element, marge))
      .filter(Boolean)
      .map(r => ({
        ...r,
        gauche: Math.max(0, r.gauche),
        droite: Math.min(largeur, r.droite),
        haut: Math.max(0, r.haut),
        bas: Math.min(hauteur, r.bas),
      }));
    return zonesInterface;
  }

  function anime(camera, pointActif = null, libelleActif = '', zoneBateau = null,
    dt = 1 / 60) {
    const largeur = Math.max(1, innerWidth);
    const hauteur = Math.max(1, innerHeight);
    const compact = largeur < 700 || hauteur < 520;
    const recitActif = document.body.classList.contains('recit-actif');
    const d = camera.position.length();
    const zones = [...litZonesInterface(largeur, hauteur)];
    if (zoneBateau) {
      const margeBateau = compact ? 5 : 7;
      zones.push({
        gauche: zoneBateau.gauche - margeBateau,
        droite: zoneBateau.droite + margeBateau,
        haut: zoneBateau.haut - margeBateau,
        bas: zoneBateau.bas + margeBateau,
        type: 'scene',
        nom: 'bateau',
      });
    }
    const margeBord = compact ? 12 : 20;
    const margeEntre = compact ? 8 : 12;
    const maximum = recitActif ? (compact ? 2 : 3)
      : compact ? (largeur < hauteur ? 4 : 5)
        : largeur < 1100 ? 7 : d < 1.85 ? 6 : 10;
    const autoriseSecondaires = !recitActif && !compact && d > 2.15;
    directionCamera.copy(camera.position).normalize();

    // A single label owns the current position. Textual chronology wins; on
    // at-sea segments, the geographically nearest mentioned endpoint wins.
    // This prevents two nearby ports (for example San Francisco/San Diego)
    // from both claiming to be the current stop.
    const cleActive = cleLieu(libelleActif);
    const exact = sprites.find(entree => entree.cle === cleActive);
    const mentionnees = cleActive
      ? sprites.filter(entree => cleActive.includes(entree.cle)) : [];
    const lesPlusProches = mentionnees.length ? mentionnees : sprites;
    const proche = pointActif ? lesPlusProches.reduce((meilleur, entree) => {
      const angle = entree.sprite.position.angleTo(pointActif);
      return !meilleur || angle < meilleur.angle ? { entree, angle } : meilleur;
    }, null) : null;
    const entreeActive = exact ?? (proche?.angle < THREE.MathUtils.degToRad(12)
      ? proche.entree : null);

    const candidats = [];
    for (const entree of sprites) {
      const { sprite, ratio, important } = entree;
      const positionCourante = entree === entreeActive;
      const mentionnee = cleActive ? cleActive.includes(entree.cle) : false;
      const priorite = positionCourante ? 3 : mentionnee ? 2 : important ? 1 : 0;
      const normale = sprite.position.clone().normalize();
      const frontal = normale.dot(directionCamera);
      const seuilHorizon = Math.min(0.9, 1.035 / Math.max(d, 1.05) + 0.045);
      projete.copy(sprite.position).project(camera);
      dansCamera.copy(sprite.position).applyMatrix4(camera.matrixWorldInverse);
      const profondeur = Math.max(0.04, -dansCamera.z);
      const tresLoin = d > 5;
      const basePx = compact
        ? (important ? (tresLoin ? 30 : 37) : (tresLoin ? 22 : 27))
        : (important ? 48 : 34);
      const rapprochement = THREE.MathUtils.clamp((2.3 - d) / 1.0, 0, 1);
      const hauteurPx = basePx * (1 - rapprochement * 0.12) * (recitActif ? 0.84 : 1);
      // The current label sits above the boat, not through its sail. Other
      // labels only need enough room for their anchorage ring.
      const espaceAncrage = positionCourante ? 48
        : compact ? 12 : 14;
      const unitesParPixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
        * profondeur / hauteur;
      const h = hauteurPx * unitesParPixel;
      const x = (projete.x * 0.5 + 0.5) * largeur;
      const y = (-projete.y * 0.5 + 0.5) * hauteur;
      const centreX = positionCourante
        ? x > largeur * 0.58 ? (compact ? 0.7 : 0.78)
          : x < largeur * 0.42 ? (compact ? 0.3 : 0.22) : 0.5
        : 0.5;
      sprite.center.set(centreX, -espaceAncrage / hauteurPx);
      sprite.scale.set(h * ratio, h, 1);

      const largeurPx = hauteurPx * ratio;
      const rect = {
        gauche: x - largeurPx * centreX,
        droite: x + largeurPx * (1 - centreX),
        haut: y - espaceAncrage - hauteurPx,
        bas: y - espaceAncrage,
        type: 'etiquette',
        nom: entree.nom,
      };
      entree.rectangle = rect;
      entree.ancrageEcran = { x, y };
      entree.profondeur = profondeur;
      entree.priorite = priorite;
      const dansChamp = projete.z > -1 && projete.z < 1
        && rect.gauche >= margeBord && rect.droite <= largeur - margeBord
        && rect.haut >= margeBord && rect.bas <= hauteur - margeBord;
      const interfaceLibre = !zones.some(zone => chevauche(rect, zone));
      const eligible = frontal > seuilHorizon && dansChamp && interfaceLibre
        && (priorite > 0 || autoriseSecondaires);
      entree.raison = frontal <= seuilHorizon ? 'derriere-ou-limbe'
        : !dansChamp ? 'hors-zone-sure'
          : !interfaceLibre ? 'interface-reservee'
            : priorite === 0 && !autoriseSecondaires ? 'densite-compacte'
              : 'candidat';
      if (eligible) {
        const centralite = Math.hypot(projete.x, projete.y);
        candidats.push({ entree, rect, centralite, priorite, positionCourante });
      }
    }

    candidats.sort((a, b) => b.priorite - a.priorite
      || a.centralite - b.centralite
      || a.entree.nom.localeCompare(b.entree.nom, 'fr'));

    const retenus = [];
    for (const candidat of candidats) {
      if (retenus.length >= maximum) break;
      if (retenus.some(r => chevauche(candidat.rect, r.rect, margeEntre))) continue;
      retenus.push(candidat);
      candidat.entree.raison = null;
    }
    const nomsRetenus = new Set(retenus.map(r => r.entree.nom));

    for (const entree of sprites) {
      entree.cible = nomsRetenus.has(entree.nom)
        ? (recitActif ? 0.72
          : entree.priorite >= 2 ? 0.94 : entree.important ? 0.86 : 0.74) : 0;
      if (entree.raison === 'candidat') entree.raison = retenus.length >= maximum
        ? 'limite-de-densite' : 'collision';
      const vitesse = entree.cible > entree.sprite.material.opacity ? 12 : 24;
      const transition = 1 - Math.exp(-Math.min(dt, 0.25) * vitesse);
      entree.sprite.material.opacity += (entree.cible - entree.sprite.material.opacity) * transition;
      entree.sprite.visible = entree.sprite.material.opacity > 0.012 || entree.cible > 0;
    }

    dernierEtat = sprites.map(entree => ({
      nom: entree.nom,
      prioritaire: entree.important,
      priorite: entree.priorite,
      positionCourante: entree === entreeActive,
      affichee: entree.cible > 0,
      opacite: Number(entree.sprite.material.opacity.toFixed(3)),
      rectangle: entree.rectangle && Object.fromEntries(
        ['gauche', 'droite', 'haut', 'bas'].map(cle => [cle, Number(entree.rectangle[cle].toFixed(1))])),
      screenRect: entree.rectangle && {
        x: Number(entree.rectangle.gauche.toFixed(1)),
        y: Number(entree.rectangle.haut.toFixed(1)),
        width: Number((entree.rectangle.droite - entree.rectangle.gauche).toFixed(1)),
        height: Number((entree.rectangle.bas - entree.rectangle.haut).toFixed(1)),
      },
      anchorScreenPoint: entree.ancrageEcran && {
        x: Number(entree.ancrageEcran.x.toFixed(1)),
        y: Number(entree.ancrageEcran.y.toFixed(1)),
      },
      depth: entree.profondeur && Number(entree.profondeur.toFixed(4)),
      occlusionReason: entree.raison,
    }));
  }

  return {
    groupe,
    anime,
    etat() {
      return { etiquettes: dernierEtat, zonesInterface };
    },
  };
}
