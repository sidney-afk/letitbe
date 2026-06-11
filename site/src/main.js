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
import { construireVoyage } from './geo.js';
import { directionSoleil } from './sun.js';

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

// lumières pour les matériaux Lambert du bateau (la Terre a son shader)
scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x202428, 1.1));
const soleilLampe = new THREE.DirectionalLight(0xfff3df, 2.2);
scene.add(soleilLampe);

scene.add(creerEtoiles());

const globe = creerGlobe();
scene.add(globe.groupe);

const [routeData, mouillagesData] = await Promise.all([
  fetch('./data/route.json').then(r => r.json()),
  fetch('./data/mouillages.json').then(r => r.json()),
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
  const soleil = directionSoleil(t, lon);
  globe.metAJourSoleil(soleil);
  soleilLampe.position.copy(soleil).multiplyScalar(10);
}
timeline.surChangement(applique);
applique(timeline.t);

const plongee = creerPlongee({ camera, controls, timeline, regleSuivi, mouillagesParCle });
const recit = creerRecit({ timeline, regleSuivi, routeData, controls });

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

canvas.addEventListener('click', () => {
  if (!escaleSurvolee?.date_arrivee) return;
  if (recit.actif) recit.sort(); // on quitte le récit pour plonger
  plongee.vers(escaleSurvolee);
});

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
function chercheSurvol() {
  raycaster.setFromCamera(pointeur, camera);
  const hits = raycaster.intersectObject(route.perles);
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
window.__sillage = { camera, controls, timeline, voyage, bateau, plongee, route, recit };

const horloge = new THREE.Clock();
let accumulateurSurvol = 0;

renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();

  timeline.metAJour(dt * 1000);
  plongee.metAJour(dt);
  recit.metAJour(dt);
  if (suivre && !plongee.enVol && !plongee.ouverte) suitLeBateau(Math.min(1, dt * 3.5));
  if (recit.actif && !plongee.enVol) {
    const d = camera.position.length();
    camera.position.setLength(THREE.MathUtils.lerp(d, recit.distanceCamera, Math.min(1, dt * 2)));
  }

  globe.anime(dt);
  bateau.anime(horloge.elapsedTime, camera.position.length());

  accumulateurSurvol += dt;
  if (accumulateurSurvol > 0.08 && !plongee.enVol) { // raycast décimé
    accumulateurSurvol = 0;
    chercheSurvol();
  }

  controls.update();
  renderer.render(scene, camera);
});
