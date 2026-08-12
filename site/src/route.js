// Le sillage façon carte au trésor : un trait d'or continu qui relie les
// escales, des mouillages marqués de bagues d'or qui respirent, et un X rouge
// sang à l'arrivée : le trésor.
// Les proportions sont volontairement fausses : c'est le trajet qui compte.
// Le chemin est drapé sur le relief : il escalade les côtes montagneuses.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { RAYON, slerpSurface, latLonVers3D } from './geo.js';

const ALTITUDE = RAYON * 1.0022;
const PAS_RAD = THREE.MathUtils.degToRad(0.52); // un point de contrôle tous les ~58 km
const GARDE_CROIX = RAYON * 0.009;
const GARDE_CHEVRON = RAYON * 0.007;
const PAS_CHEVRON_RAD = THREE.MathUtils.degToRad(26);
const DECALAGE_CHEVRON_RAD = THREE.MathUtils.degToRad(13);

/**
 * Échantillonne l'itinéraire en points réguliers. La date reste associée aux
 * escales et au bateau, tandis que le trait montre un seul voyage lisible.
 */
function echantillonne(voyage, relief) {
  const points = [];
  for (const s of voyage.segments) {
    const omega = s.p0.angleTo(s.p1);
    const n = Math.max(1, Math.ceil(omega / PAS_RAD));
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const p = slerpSurface(s.p0, s.p1, f, 1);
      p.multiplyScalar(Math.max(ALTITUDE, relief.altitude(p, 0.0035)));
      const dernier = points[points.length - 1];
      if (dernier && dernier.distanceToSquared(p) < 1e-10) {
        continue;
      }
      points.push(p);
    }
  }
  return { points };
}

function materiauLigne(couleur, epaisseurPx, opacite) {
  return new LineMaterial({
    color: couleur,
    linewidth: epaisseurPx * Math.min(devicePixelRatio, 2),
    transparent: true,
    opacity: opacite,
    depthWrite: false,
  });
}

function creeLigne(positions, materiau) {
  const geometrie = new LineGeometry();
  geometrie.setPositions(positions);
  const ligne = new Line2(geometrie, materiau);
  ligne.computeLineDistances();
  return ligne;
}

function geometrieChevron() {
  // Un V plein très fin, plus proche d'un repère de carte que d'une flèche UI.
  // L'axe +Y est le sens de progression et +Z regarde vers l'extérieur du globe.
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.56, 0, // pointe extérieure
    -0.58, -0.52, 0,
    -0.38, -0.62, 0,
    0, 0.05, 0, // pointe intérieure
    0.38, -0.62, 0,
    0.58, -0.52, 0,
  ], 3));
  // Deux rubans, gauche et droit : ni disque ni triangle massif.
  geometrie.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  geometrie.computeVertexNormals();
  return geometrie;
}

function echantillonneChevrons(points) {
  const chevrons = [];
  let parcouru = 0;
  let prochain = DECALAGE_CHEVRON_RAD;
  for (let i = 0; i < points.length - 1; i++) {
    const depart = points[i];
    const arrivee = points[i + 1];
    const angle = depart.angleTo(arrivee);
    if (angle < 1e-6) continue;
    const finSegment = parcouru + angle;
    while (prochain < finSegment) {
      const f = (prochain - parcouru) / angle;
      const normale = slerpSurface(depart, arrivee, f, 1);
      const rayon = THREE.MathUtils.lerp(depart.length(), arrivee.length(), f) + GARDE_CHEVRON;
      const tangente = arrivee.clone().sub(depart).projectOnPlane(normale);
      if (tangente.lengthSq() > 1e-10) {
        chevrons.push({
          position: normale.clone().multiplyScalar(rayon),
          normale,
          tangente: tangente.normalize(),
        });
      }
      prochain += PAS_CHEVRON_RAD;
    }
    parcouru = finSegment;
  }
  return chevrons;
}

// le X du trésor, tracé à la main (deux croisillons irréguliers)
function textureX() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a3252b';
  ctx.lineWidth = 30;
  const trait = (x0, y0, x1, y1, devie) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + devie, (y0 + y1) / 2 - devie, x1, y1);
    ctx.stroke();
  };
  trait(58, 64, 198, 196, 9);
  trait(196, 58, 60, 198, -7);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 12;
  trait(62, 70, 194, 192, 12);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function creerRoute(voyage, routeData, relief) {
  const groupe = new THREE.Group();
  const { points } = echantillonne(voyage, relief);
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => positions.set([p.x, p.y, p.z], i * 3));

  // Une seule trajectoire, épaisse et continue : aucune réplique pâle ne
  // vient concurrencer la lecture de la route quand le globe tourne.
  const matItineraire = materiauLigne(0xf2a035, 2.35, 0.9);
  const itineraire = creeLigne(positions, matItineraire);
  itineraire.name = 'route-itineraire';
  itineraire.renderOrder = 2;
  groupe.add(itineraire);

  // Quelques chevrons seulement suffisent à révéler le sens du voyage. Ils
  // sont des instances tangentiellement posées sur la même route, jamais une
  // deuxième ligne ni une chaîne d'ornements.
  const directions = echantillonneChevrons(points);
  const matChevrons = new THREE.MeshBasicMaterial({
    color: 0xaf6815,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const chevrons = new THREE.InstancedMesh(
    geometrieChevron(), matChevrons, Math.max(1, directions.length));
  chevrons.name = 'route-direction-cues';
  chevrons.renderOrder = 2.5;
  chevrons.frustumCulled = false;
  chevrons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chevrons.userData.total = directions.length;
  chevrons.userData.ancres = directions.map(({ position }) => position.clone());
  chevrons.userData.tangentes = directions.map(({ tangente }) => tangente.clone());
  chevrons.userData.normales = directions.map(({ normale }) => normale.clone());
  const matriceVide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < chevrons.count; i++) chevrons.setMatrixAt(i, matriceVide);
  chevrons.instanceMatrix.needsUpdate = true;
  groupe.add(chevrons);

  // mouillages : bagues d'or à cœur crème, imposantes (carte au trésor),
  // avec une cible de clic invisible encore plus large
  const escales = routeData.filter(e => e.type !== 'traversee' && e.date_arrivee);
  const matAnneau = new THREE.MeshBasicMaterial({ color: 0xc8922e });
  const matCoeur = new THREE.MeshBasicMaterial({ color: 0xfffbef });
  const matCible = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false,
  });
  const anneaux = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1, 0.27, 8, 28), matAnneau, escales.length);
  const coeurs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.56, 12, 10), matCoeur, escales.length);
  const cibles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.6, 8, 6), matCible, escales.length);
  anneaux.renderOrder = 3;
  coeurs.renderOrder = 3;
  const positionsPerles = escales.map(e => {
    const p = latLonVers3D(e.lat, e.lon, 1);
    return p.multiplyScalar(Math.max(ALTITUDE, relief.altitude(p, 0.0035)));
  });
  groupe.add(anneaux, coeurs, cibles);

  // — X marque l'endroit : la fin du voyage, là où dort le trésor —
  // un poil au large du dernier mouillage, pour que la figurine amarrée
  // ne le recouvre pas
  const arrivee = routeData[routeData.length - 1];
  const croix = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: textureX(),
    transparent: true,
    depthWrite: false,
  }));
  const directionCroix = latLonVers3D(arrivee.lat - 3.4, arrivee.lon - 4.6, 1);
  const rayonCroix = Math.max(ALTITUDE, relief.altitude(directionCroix, 0.0035)) + GARDE_CROIX;
  croix.position.copy(directionCroix).multiplyScalar(rayonCroix);
  croix.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), directionCroix);
  croix.name = 'route-destination-marker';
  croix.userData.surfaceRadius = rayonCroix;
  croix.userData.surfaceDirection = directionCroix.clone();
  croix.renderOrder = 3;
  groupe.add(croix);

  let indexSurvol = -1;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const matriceChevron = new THREE.Matrix4();
  const quaternionChevron = new THREE.Quaternion();
  const versCamera = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const echelleChevron = new THREE.Vector3();
  const axeChevron = new THREE.Vector3();
  const projete = new THREE.Vector3();
  const dansCamera = new THREE.Vector3();
  const directionCamera = new THREE.Vector3();
  const normale = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const marqueursAffiches = new Uint8Array(escales.length);
  let dernierEtat = {
    marqueursVisibles: 0,
    marqueursTotal: escales.length,
    chevronsVisibles: 0,
    chevronsTotal: directions.length,
    pasRoute: 1,
  };
  function orientePerles(camera, tempsS = 0, etiquettes = []) {
    const d = camera.position.length();
    const largeur = Math.max(1, innerWidth);
    const hauteur = Math.max(1, innerHeight);
    const compact = largeur < 700 || hauteur < 520;
    const recitActif = document.body.classList.contains('recit-actif');
    const plongeeActive = document.body.classList.contains('plongee-ouverte');
    const zonesEtiquettes = etiquettes
      .filter(etiquette => etiquette.affichee && etiquette.rectangle)
      .map(etiquette => etiquette.rectangle);
    const ratioPixels = Math.min(devicePixelRatio, compact ? 1.5 : 2);
    const epaisseurRoute = (compact ? 1.85 : 2.35) * ratioPixels * (recitActif ? 0.78 : 1);
    matItineraire.linewidth = epaisseurRoute;
    matItineraire.opacity = (compact ? 0.78 : 0.9) * (recitActif ? 0.58 : 1);
    matChevrons.opacity = (compact ? 0.76 : 0.88) * (recitActif ? 0.58 : 1);

    // Entering a place hides the itinerary group immediately. Keep it fully
    // invisible during every following animation frame as well: stale
    // instanced-mesh matrices must never flash as gold rings over aerial
    // shoreline imagery.
    if (plongeeActive || !groupe.visible) {
      anneaux.visible = false;
      coeurs.visible = false;
      cibles.visible = false;
      chevrons.visible = false;
      croix.visible = false;
      dernierEtat = {
        marqueursVisibles: 0,
        marqueursTotal: escales.length,
        chevronsVisibles: 0,
        chevronsTotal: directions.length,
        pasRoute: 1,
        tailleRoutePx: Number((epaisseurRoute / ratioPixels).toFixed(1)),
        marqueurs: [],
      };
      return;
    }
    itineraire.visible = true;
    anneaux.visible = true;
    coeurs.visible = true;
    cibles.visible = true;
    chevrons.visible = true;

    directionCamera.copy(camera.position).normalize();
    const centres = [];
    const marqueurs = [];
    const espacement = d < 2 ? 15 : compact ? 25 : 28;
    let visibles = 0;
    positionsPerles.forEach((p, i) => {
      projete.copy(p).project(camera);
      dansCamera.copy(p).applyMatrix4(camera.matrixWorldInverse);
      const profondeur = Math.max(0.04, -dansCamera.z);
      const frontal = normale.copy(p).normalize().dot(directionCamera);
      const seuilHorizon = Math.min(0.9, 1.025 / Math.max(d, 1.05) + 0.02);
      const x = (projete.x * 0.5 + 0.5) * largeur;
      const y = (-projete.y * 0.5 + 0.5) * hauteur;
      const dansChamp = projete.z > -1 && projete.z < 1
        && x > 8 && x < largeur - 8 && y > 8 && y < hauteur - 8;
      const groupeExistant = centres.some(c => Math.hypot(c.x - x, c.y - y) < espacement);
      // Keep a little more room than the QA probe so sub-pixel projection
      // rounding cannot leave a ring touching the last row of label pixels.
      const margeEtiquette = compact ? 7 : 9;
      const sousEtiquette = zonesEtiquettes.some(rectangle =>
        x >= rectangle.gauche - margeEtiquette
        && x <= rectangle.droite + margeEtiquette
        && y >= rectangle.haut - margeEtiquette
        && y <= rectangle.bas + margeEtiquette);
      const affiche = frontal > seuilHorizon && dansChamp
        && !groupeExistant && !sousEtiquette;
      marqueursAffiches[i] = affiche ? 1 : 0;
      if (affiche) {
        centres.push({ x, y });
        visibles++;
      }
      marqueurs.push({
        index: i,
        nom: escales[i].nom,
        date: escales[i].date_arrivee,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        visible: affiche,
      });

      const vie = 1 + 0.06 * Math.sin(tempsS * 1.8 + i * 1.7);
      const survole = i === indexSurvol ? 1.35 : 1;
      const unitesParPixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
        * profondeur / hauteur;
      const taillePx = (compact ? 11 : 14) * (recitActif ? 0.78 : 1);
      const s = affiche ? unitesParPixel * taillePx / 2.55 * vie * survole : 0;
      echelle.setScalar(s);
      versCamera.copy(camera.position).sub(p).normalize();
      q.setFromUnitVectors(Z, versCamera);
      m.compose(p, q, echelle);
      anneaux.setMatrixAt(i, m);
      coeurs.setMatrixAt(i, m);
      echelle.multiplyScalar(affiche ? 1.2 : 0);
      m.compose(p, q, echelle);
      cibles.setMatrixAt(i, m);
    });
    anneaux.instanceMatrix.needsUpdate = true;
    coeurs.instanceMatrix.needsUpdate = true;
    cibles.instanceMatrix.needsUpdate = true;

    // Les chevrons suivent la tangente de l'itinéraire, gardent un gabarit
    // écran constant, évitent les anneaux/étiquettes et se retirent avant le
    // limbe. Leur petit nombre donne le sens de marche sans refaire un motif.
    const centresChevrons = [];
    const tailleChevronPx = (compact ? 7.5 : 9.5) * (recitActif ? 0.78 : 1);
    const maximumChevrons = recitActif ? (compact ? 2 : 3) : compact ? 3 : 5;
    let chevronsVisibles = 0;
    directions.forEach((chevron, i) => {
      projete.copy(chevron.position).project(camera);
      dansCamera.copy(chevron.position).applyMatrix4(camera.matrixWorldInverse);
      const profondeurChevron = Math.max(0.04, -dansCamera.z);
      const unitesParPixelChevron = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
        * profondeurChevron / hauteur;
      const echelleChevronCourante = unitesParPixelChevron * tailleChevronPx;
      const x = (projete.x * 0.5 + 0.5) * largeur;
      const y = (-projete.y * 0.5 + 0.5) * hauteur;
      const rayonChevron = chevron.position.length();
      const frontalChevron = chevron.normale.dot(directionCamera);
      const seuilHorizonChevron = Math.min(0.92,
        (rayonChevron + GARDE_CHEVRON) / Math.max(d, rayonChevron + 0.001) + 0.032);
      const margeHorizonChevron = Math.asin(Math.min(0.12,
        echelleChevronCourante * 0.82 / rayonChevron));
      const margeEcranChevron = tailleChevronPx * 0.75;
      const dansChampChevron = projete.z > -1 && projete.z < 1
        && x > margeEcranChevron && x < largeur - margeEcranChevron
        && y > margeEcranChevron && y < hauteur - margeEcranChevron;
      const presDunAnneau = centres.some(centre => Math.hypot(centre.x - x, centre.y - y)
        < (compact ? 18 : 22));
      const sousEtiquetteChevron = zonesEtiquettes.some(rectangle =>
        x >= rectangle.gauche - margeEcranChevron
        && x <= rectangle.droite + margeEcranChevron
        && y >= rectangle.haut - margeEcranChevron
        && y <= rectangle.bas + margeEcranChevron);
      const tropProche = centresChevrons.some(centre => Math.hypot(centre.x - x, centre.y - y)
        < (compact ? 28 : 36));
      const afficheChevron = chevronsVisibles < maximumChevrons
        && frontalChevron > seuilHorizonChevron + margeHorizonChevron
        && dansChampChevron && !presDunAnneau && !sousEtiquetteChevron && !tropProche;
      if (afficheChevron) {
        centresChevrons.push({ x, y });
        chevronsVisibles++;
      }
      axeChevron.crossVectors(chevron.tangente, chevron.normale).normalize();
      matriceChevron.makeBasis(axeChevron, chevron.tangente, chevron.normale);
      quaternionChevron.setFromRotationMatrix(matriceChevron);
      echelleChevron.setScalar(afficheChevron ? echelleChevronCourante : 0);
      matriceChevron.compose(chevron.position, quaternionChevron, echelleChevron);
      chevrons.setMatrixAt(i, matriceChevron);
    });
    for (let i = directions.length; i < chevrons.count; i++) chevrons.setMatrixAt(i, matriceVide);
    chevrons.instanceMatrix.needsUpdate = true;
    chevrons.userData.visibles = chevronsVisibles;

    // Le X est une petite décalcomanie tangentielle posée au-dessus du relief,
    // puis disparaît un peu avant la silhouette du globe. Il reste donc bien
    // ancré en 3D sans être découpé par l'horizon.
    dansCamera.copy(croix.position).applyMatrix4(camera.matrixWorldInverse);
    const profondeurCroix = Math.max(0.04, -dansCamera.z);
    const tailleCroixPx = (compact ? 21 : 25) * (recitActif ? 0.8 : 1);
    const unitesParPixelCroix = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      * profondeurCroix / hauteur;
    const echelleCroix = unitesParPixelCroix * tailleCroixPx;
    croix.scale.setScalar(echelleCroix);
    normale.copy(croix.position).normalize();
    const frontalCroix = normale.dot(directionCamera);
    // Le seuil tient compte du rayon réel de ce point du relief, pas du
    // rayon abstrait de la sphère : une côte haute ne peut donc pas couper
    // le marqueur un peu avant son horizon.
    const seuilHorizonCroix = Math.min(0.96,
      (rayonCroix + GARDE_CROIX) / Math.max(d, rayonCroix + 0.001) + 0.028);
    const margeHorizonCroix = Math.asin(Math.min(0.14, echelleCroix * 0.72 / rayonCroix));
    projete.copy(croix.position).project(camera);
    const xCroix = (projete.x * 0.5 + 0.5) * largeur;
    const yCroix = (-projete.y * 0.5 + 0.5) * hauteur;
    const margeEcranCroix = tailleCroixPx * 0.7;
    const croixDansChamp = projete.z > -1 && projete.z < 1
      && xCroix > margeEcranCroix && xCroix < largeur - margeEcranCroix
      && yCroix > margeEcranCroix && yCroix < hauteur - margeEcranCroix;
    croix.visible = frontalCroix > seuilHorizonCroix + margeHorizonCroix && croixDansChamp;
    dernierEtat = {
      marqueursVisibles: visibles,
      marqueursTotal: escales.length,
      chevronsVisibles,
      chevronsTotal: directions.length,
      pasRoute: 1,
      tailleRoutePx: Number((epaisseurRoute / ratioPixels).toFixed(1)),
      marqueurs,
    };
  }

  function metAJourTemps() { /* le trait complet reste le repère temporel stable */ }

  function surResize() { /* tailles en pixels : rien à faire */ }

  function regleMode(mode) {
    if (mode === 'carnet') {
      matItineraire.color.set(0xf2a035);
      matChevrons.color.set(0xaf6815);
      matAnneau.color.set(0xc8922e);
      croix.material.opacity = 1;
    } else {
      matItineraire.color.set(0xeec97e);
      matChevrons.color.set(0xb78945);
      matAnneau.color.set(0xeec97e);
      croix.material.opacity = 0.85;
    }
  }

  return {
    groupe, metAJourTemps, surResize, regleMode, orientePerles,
    cibles, escales,
    regleSurvol(i) { indexSurvol = i; },
    estVisible(i) { return marqueursAffiches[i] === 1; },
    etat() { return { ...dernierEtat }; },
  };
}
