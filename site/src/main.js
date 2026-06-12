// Le Sillage — point d'entrée : la Terre miniature, la route des cinq ans,
// le bateau et sa traîne d'écume, la timeline. Tout le reste (plongée,
// récit, traversée, météo) s'y branche.

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
import { creerOrnements } from './ornements.js';
import { construireVoyage } from './geo.js';
import { soleilEtCiel } from './sun.js';
import { chargeRelief, reliefPlat } from './relief.js';

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

// le relief sculpté nourrit le globe, la route, les étiquettes, la plongée
const relief = await chargeRelief('./textures/earth_elev_2048.jpg')
  .catch(() => reliefPlat());

const etoiles = await creerEtoiles();
scene.add(etoiles.points);

const globe = creerGlobe(relief);
scene.add(globe.groupe);

const ciel = creerCiel();
scene.add(ciel.mesh);
const coton = creerNuagesCotonneux();
scene.add(coton.groupe);
const etiquettes = creerEtiquettes(relief);
scene.add(etiquettes.groupe);
const ornements = creerOrnements();
scene.add(ornements.groupe);

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
  ornements.groupe.visible = carnetActif;
  etoiles.points.visible = !carnetActif;
  hemisphere.color.set(carnetActif ? 0xdfeeff : 0xcfe5ff);
  hemisphere.groundColor.set(carnetActif ? 0xf2e4c8 : 0x202428);
  hemisphere.intensity = carnetActif ? 1.6 : 1.1;
  soleilLampe.intensity = carnetActif ? 1.6 : 2.2;
  soleilLampe.color.set(carnetActif ? 0xfff0c8 : 0xfff3df);
  modeBouton.querySelector('span').textContent =
    carnetActif ? 'Mode réaliste' : 'Mode carnet';
}
modeBouton.addEventListener('click', () => {
  regleMode(mode === 'carnet' ? 'photo' : 'carnet');
});

const [routeData, mouillagesData, vuesAeriennes, meteo] = await Promise.all([
  fetch('./data/route.json').then(r => r.json()),
  fetch('./data/mouillages.json').then(r => r.json()),
  fetch('./data/vues_aeriennes.json').then(r => r.json()),
  creerMeteo(),
]);
const voyage = construireVoyage(routeData);
const mouillagesParCle = new Map(
  mouillagesData.map(m => [`${m.nom}|${m.date_arrivee}`, m]));

const route = creerRoute(voyage, routeData, relief);
scene.add(route.groupe);

const bateau = creerBateau();
scene.add(bateau.conteneur, bateau.ecume);

const timeline = creerTimeline(voyage);

// caméra de départ : loin au large, l'intro glisse vers la Martinique
const DISTANCE_ACCUEIL = 3.4;
camera.position.copy(voyage.position(voyage.debut)).normalize()
  .multiplyScalar(7.5);
camera.lookAt(0, 0, 0);
let intro = 0; // 0 → 1 : l'approche du début

// — suivi du bateau : « collant » —
// Le bouton ⌖ est la seule vraie bascule. Faire tourner le globe à la main
// ne fait que suspendre le suivi ; toucher la timeline le réengage.
const boutonSuivre = document.getElementById('suivre');
let suivre = true;
let suiviEnPause = false;
function regleSuivi(actif) {
  suivre = actif;
  suiviEnPause = false;
  boutonSuivre.setAttribute('aria-pressed', String(actif));
}
boutonSuivre.addEventListener('click', () => regleSuivi(!suivre));
controls.addEventListener('start', () => { suiviEnPause = true; intro = 1; });

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
timeline.surChangement(() => { suiviEnPause = false; }); // la timeline réengage le suivi
regleMode('carnet');
applique(timeline.t);

const plongee = creerPlongee({
  camera, controls, timeline, regleSuivi, mouillagesParCle, scene,
  vuesAeriennes, relief,
});
const recit = creerRecit({ timeline, regleSuivi, voyage });
creerTraversee({ timeline, voyage, mouillagesParCle });

const ocean = creerOcean();
const sonBouton = document.getElementById('son-bouton');
sonBouton.addEventListener('click', () => {
  const actif = ocean.bascule();
  sonBouton.classList.toggle('actif', actif);
  sonBouton.setAttribute('aria-pressed', String(actif));
});

// — préchargement des vues aériennes HD (l'idée de Sidney : tous les
// endroits cliquables sont connus d'avance) : un fil discret en tâche de
// fond, et la vue survolée passe en tête de file —
const aPrecharger = Object.values(vuesAeriennes).map(v => `./${v.fichier}`);
const dejaChargees = new Set();
function prechargeVue(url) {
  if (!url || dejaChargees.has(url)) return;
  dejaChargees.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}
let filPrechargement = 0;
function prechargeAuRepos(delai) {
  setTimeout(() => {
    while (filPrechargement < aPrecharger.length
      && dejaChargees.has(aPrecharger[filPrechargement])) filPrechargement++;
    if (filPrechargement >= aPrecharger.length) return;
    prechargeVue(aPrecharger[filPrechargement++]);
    prechargeAuRepos(420); // ~un fichier toutes les 0,4 s : invisible
  }, delai);
}
prechargeAuRepos(6000); // on laisse d'abord la scène se charger

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
  route.regleSurvol(hit ? hit.instanceId : -1);
  if (escaleSurvolee) {
    const e = escaleSurvolee;
    // la vue aérienne de ce mouillage d'abord : le clic sera instantané
    const vue = vuesAeriennes[`${e.nom}|${e.date_arrivee}`];
    if (vue) prechargeVue(`./${vue.fichier}`);
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

// — la molette zoome PARTOUT (demande de Sidney) : même au-dessus de la
// timeline ou du titre ; seuls les panneaux qui défilent gardent leur molette
addEventListener('wheel', (e) => {
  if (e.target === canvas) return; // OrbitControls s'en occupe déjà
  if (e.target.closest?.('#plongee, #recit-carte, #lightbox')) return;
  if (plongee.enVol) return;
  intro = 1;
  const d = camera.position.length()
    * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0013));
  camera.position.setLength(
    THREE.MathUtils.clamp(d, controls.minDistance, controls.maxDistance));
}, { passive: true });

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
window.__sillage = {
  camera, controls, timeline, voyage, bateau, plongee, route, recit, etoiles,
  sauteIntro() { intro = 1; },
};

const horloge = new THREE.Clock();
let accumulateurSurvol = 0;
let lectureAvant = false;
const DISTANCE_TRAVERSEE = 2.5;

document.body.classList.add('pret'); // l'interface peut entrer en scène

renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();

  timeline.metAJour(dt * 1000);
  plongee.metAJour(dt);
  if (suivre && !suiviEnPause && !plongee.enVol) suitLeBateau(Math.min(1, dt * 3.5));
  if (timeline.enLecture && !lectureAvant) regleSuivi(true); // la Traversée embarque
  lectureAvant = timeline.enLecture;
  document.body.classList.toggle('lecture', timeline.enLecture);
  ocean.metAJour(dt, timeline.enLecture);

  // l'intro : on arrive du large, en douceur, jusqu'à la Martinique
  if (intro < 1 && !plongee.enVol && !timeline.enLecture) {
    intro = Math.min(1, intro + dt / 3.2);
    const f = 1 - Math.pow(1 - intro, 3);
    camera.position.setLength(THREE.MathUtils.lerp(7.5, DISTANCE_ACCUEIL, f));
  }

  // la rotation s'adoucit quand on est près du sol (sinon chaque
  // mouvement de souris est démesuré en zoom fort)
  const distance = camera.position.length();
  controls.rotateSpeed = 0.55 * THREE.MathUtils.clamp((distance - 1) / 2.4, 0.05, 1);
  controls.zoomSpeed = THREE.MathUtils.clamp((distance - 1) / 1.6, 0.25, 1);

  if (!plongee.enVol && !plongee.ouverte && intro >= 1) {
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
  route.orientePerles(camera, horloge.elapsedTime);
  bateau.anime(horloge.elapsedTime, camera);

  accumulateurSurvol += dt;
  if (accumulateurSurvol > 0.08 && !plongee.enVol) { // raycast décimé
    accumulateurSurvol = 0;
    chercheSurvol();
  }

  controls.update();
  renderer.render(scene, camera);
});
