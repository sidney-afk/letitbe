// Le Sillage — point d'entrée : la Terre, la route des cinq ans, le bateau,
// la timeline. (Étape 2 du plan : globe + route + scrubber + bateau.)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { creerGlobe } from './globe.js';
import { creerRoute } from './route.js';
import { creerBateau } from './boat.js';
import { creerEtoiles } from './stars.js';
import { creerTimeline } from './timeline.js';
import { creerPlongee } from './plongee.js';
import { creerRecit } from './recit.js';
import { creerTraversee } from './traversee.js';
import { creerOcean } from './ocean.js';
import { creerMeteo } from './meteo.js';
import { creerCiel } from './ciel.js';
import { creerNuagesCotonneux } from './nuages.js';
import { creerEtiquettes } from './etiquettes.js';
import { construireVoyage } from './geo.js';
import { soleilEtCiel } from './sun.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.25;
controls.maxDistance = 12;
controls.rotateSpeed = 0.55;
controls.enablePan = false;

// lumières pour les matériaux du bateau et des nuages (la Terre a ses shaders)
const hemisphere = new THREE.HemisphereLight(0xcfe5ff, 0x202428, 1.1);
scene.add(hemisphere);
const soleilLampe = new THREE.DirectionalLight(0xfff3df, 2.2);
scene.add(soleilLampe);

const etoiles = await creerEtoiles();
scene.add(etoiles.points);

const globe = creerGlobe();
scene.add(globe.groupe);

const ciel = creerCiel();
scene.add(ciel.mesh);
const coton = creerNuagesCotonneux();
scene.add(coton.groupe);
const etiquettes = creerEtiquettes();
scene.add(etiquettes.groupe);

// — Réaliste ⟷ Carnet (l'esthétique de Sidney est le mode par défaut) —
const modeBouton = document.getElementById('mode-bouton');
let mode = 'carnet';
function regleMode(nouveau) {
  mode = nouveau;
  const carnetActif = mode === 'carnet';
  document.body.dataset.mode = mode;
  globe.regleMode(mode);
  route.regleMode(mode);
  ciel.mesh.visible = carnetActif;
  coton.groupe.visible = carnetActif;
  etiquettes.groupe.visible = carnetActif;
  etoiles.points.visible = !carnetActif;
  hemisphere.color.set(carnetActif ? 0xdfeeff : 0xcfe5ff);
  hemisphere.groundColor.set(carnetActif ? 0xf2e4c8 : 0x202428);
  hemisphere.intensity = carnetActif ? 1.6 : 1.1;
  soleilLampe.intensity = carnetActif ? 1.6 : 2.2;
  soleilLampe.color.set(carnetActif ? 0xfff0c8 : 0xfff3df);
  modeBouton.textContent = carnetActif ? '🌍 Mode réaliste' : '🖍 Mode carnet';
}
modeBouton.addEventListener('click', () => {
  regleMode(mode === 'carnet' ? 'photo' : 'carnet');
});

const [routeData, mouillagesData, meteo] = await Promise.all([
  fetch('./data/route.json').then(r => r.json()),
  fetch('./data/mouillages.json').then(r => r.json()),
  creerMeteo(),
]);
const voyage = construireVoyage(routeData);
const mouillagesParCle = new Map(
  mouillagesData.map(m => [`${m.nom}|${m.date_arrivee}`, m]));

const route = creerRoute(voyage, routeData);
scene.add(route.groupe);

const bateau = creerBateau();
scene.add(bateau.conteneur);

const timeline = creerTimeline(voyage);

// caméra de départ : au-dessus de la Martinique
camera.position.copy(voyage.position(voyage.debut)).normalize().multiplyScalar(3.4);
camera.lookAt(0, 0, 0);

// — suivi du bateau —
const boutonSuivre = document.getElementById('suivre');
let suivre = true;
function regleSuivi(actif) {
  suivre = actif;
  boutonSuivre.setAttribute('aria-pressed', String(actif));
}
boutonSuivre.addEventListener('click', () => regleSuivi(!suivre));
controls.addEventListener('start', () => regleSuivi(false));

function suitLeBateau(force = 1) {
  const distance = camera.position.length();
  const direction = camera.position.clone().normalize();
  const cible = bateau.conteneur.position.clone().normalize();
  direction.lerp(cible, force).normalize();
  camera.position.copy(direction.multiplyScalar(distance));
}

function applique(t) {
  bateau.positionne(voyage, t);
  route.metAJourTemps(t);
  const lon = THREE.MathUtils.radToDeg(
    Math.atan2(bateau.conteneur.position.z, -bateau.conteneur.position.x)) - 180;
  const { dirSoleil, gmstDeg } = soleilEtCiel(t, lon);
  globe.metAJourSoleil(dirSoleil);
  ciel.metAJourSoleil(dirSoleil);
  soleilLampe.position.copy(dirSoleil).multiplyScalar(10);
  etoiles.oriente(gmstDeg);
  globe.regleMeteo(meteo.applique(t));
}
timeline.surChangement(applique);
regleMode('carnet');
applique(timeline.t);

const plongee = creerPlongee({ camera, controls, timeline, regleSuivi, mouillagesParCle });
const recit = creerRecit({ timeline, regleSuivi, voyage });
creerTraversee({ timeline, voyage, mouillagesParCle });

const ocean = creerOcean();
const sonBouton = document.getElementById('son-bouton');
sonBouton.addEventListener('click', () => {
  const actif = ocean.bascule();
  sonBouton.textContent = actif ? '🔊' : '🔇';
  sonBouton.setAttribute('aria-pressed', String(actif));
});

// — infobulle des mouillages —
const infobulle = document.getElementById('infobulle');
const raycaster = new THREE.Raycaster();
const pointeur = new THREE.Vector2(-2, -2);
let escaleSurvolee = null;

canvas.addEventListener('pointermove', (e) => {
  pointeur.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  infobulle.style.left = `${e.clientX + 14}px`;
  infobulle.style.top = `${e.clientY + 10}px`;
});

canvas.addEventListener('click', (e) => {
  pointeur.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  chercheSurvol(); // le survol throttlé peut être périmé au moment du clic
  if (escaleSurvolee?.date_arrivee) {
    if (recit.actif) recit.sort(); // on quitte le récit pour plonger
    plongee.vers(escaleSurvolee);
  } else if (plongee.ouverte) {
    plongee.remonte(); // cliquer ailleurs referme le carnet
  }
});

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
function chercheSurvol() {
  raycaster.setFromCamera(pointeur, camera);
  const hits = raycaster.intersectObject(route.cibles);
  const hit = hits.find(h => h.instanceId !== undefined);
  escaleSurvolee = hit ? route.escales[hit.instanceId] : null;
  if (escaleSurvolee) {
    const e = escaleSurvolee;
    const dates = e.date_depart && e.date_depart !== e.date_arrivee
      ? `${formatCourt.format(new Date(e.date_arrivee))} → ${formatCourt.format(new Date(e.date_depart))}`
      : formatCourt.format(new Date(e.date_arrivee));
    infobulle.innerHTML = `${e.nom}<span class="dates">${dates} · ${e.log_nm} nm au log</span>`;
    infobulle.hidden = false;
    canvas.style.cursor = 'pointer';
  } else {
    infobulle.hidden = true;
    canvas.style.cursor = '';
  }
}

// — boucle de rendu —
function redimensionne() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  route.surResize(w, h);
}
addEventListener('resize', redimensionne);
redimensionne();

// poignée de débogage (capture.mjs, console)
window.__sillage = { camera, controls, timeline, voyage, bateau, plongee, route, recit, etoiles };

const horloge = new THREE.Clock();
let accumulateurSurvol = 0;
let lectureAvant = false;
const DISTANCE_TRAVERSEE = 2.5;

renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();

  timeline.metAJour(dt * 1000);
  plongee.metAJour(dt);
  if (suivre && !plongee.enVol) suitLeBateau(Math.min(1, dt * 3.5));
  if (timeline.enLecture && !lectureAvant) regleSuivi(true); // la Traversée embarque
  lectureAvant = timeline.enLecture;
  ocean.metAJour(dt, timeline.enLecture);

  // la rotation s'adoucit quand on est près du sol (sinon chaque
  // mouvement de souris est démesuré en zoom fort)
  const distance = camera.position.length();
  controls.rotateSpeed = 0.55 * THREE.MathUtils.clamp((distance - 1) / 2.4, 0.05, 1);
  controls.zoomSpeed = THREE.MathUtils.clamp((distance - 1) / 1.6, 0.25, 1);

  if (!plongee.enVol && !plongee.ouverte) {
    const cible = recit.actif ? recit.distanceCamera
      : timeline.enLecture ? DISTANCE_TRAVERSEE : null;
    if (cible !== null) {
      camera.position.setLength(
        THREE.MathUtils.lerp(distance, cible, Math.min(1, dt * 2)));
    }
  }

  globe.anime(dt);
  coton.anime(dt, horloge.elapsedTime, camera);
  etiquettes.anime(camera);
  route.orientePerles(camera);
  bateau.anime(horloge.elapsedTime, camera.position.length());

  accumulateurSurvol += dt;
  if (accumulateurSurvol > 0.08 && !plongee.enVol) { // raycast décimé
    accumulateurSurvol = 0;
    chercheSurvol();
  }

  controls.update();
  renderer.render(scene, camera);
});
