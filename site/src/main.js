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
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const VITESSE_ROTATION_CARTE = 0.55;
// À quelques mètres du sol, un même angle couvre une grande partie de l'île.
// Cette réduction s'applique uniquement une fois le carnet d'escale ouvert;
// le globe général garde donc exactement sa réponse habituelle.
const FACTEUR_ROTATION_PLONGEE = 0.20;

function webglDisponible() {
  if (new URLSearchParams(location.search).has('force-fallback')) return false;
  try {
    const test = document.createElement('canvas');
    return Boolean(test.getContext('webgl2') || test.getContext('webgl'));
  } catch {
    return false;
  }
}

async function activeFallback2D() {
  const fallback = document.getElementById('fallback-2d');
  const trace = document.getElementById('fallback-trace');
  const liste = document.getElementById('fallback-liste');
  const navigation = document.getElementById('navigation-escales');
  const select = document.getElementById('escales-select');
  const ouvrir = document.getElementById('escales-ouvrir');
  document.body.classList.add('fallback-actif', 'pret');
  if (fallback) fallback.hidden = false;

  let routeData = [];
  try {
    const reponse = await fetch('./data/route.json');
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    routeData = await reponse.json();
  } catch {
    fallback?.classList.add('fallback-donnees-indisponibles');
  }

  const escales = routeData.filter(e => e.type !== 'traversee' && e.date_arrivee);
  if (trace && routeData.length) {
    trace.setAttribute('viewBox', '0 0 1000 500');
    const segments = [];
    let segment = [];
    let dernierX = null;
    for (const point of routeData) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const x = (point.lon + 180) / 360 * 1000;
      const y = (90 - point.lat) / 180 * 500;
      if (dernierX !== null && Math.abs(x - dernierX) > 450) {
        if (segment.length > 1) segments.push(segment);
        segment = [];
      }
      segment.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      dernierX = x;
    }
    if (segment.length > 1) segments.push(segment);
    for (const points of segments) {
      const ligne = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      ligne.setAttribute('points', points.join(' '));
      ligne.setAttribute('class', 'fallback-route-ligne');
      trace.append(ligne);
    }
  }

  const options = document.createDocumentFragment();
  const items = document.createDocumentFragment();
  if (navigation && liste) liste.before(navigation);
  const formatDateFallback = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  escales.forEach((escale, index) => {
    const date = formatDateFallback.format(new Date(`${escale.date_arrivee}T12:00:00Z`));
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${escale.nom} — ${date}`;
    options.append(option);
    const item = document.createElement('li');
    item.id = `fallback-escale-${index}`;
    item.tabIndex = -1;
    const nom = document.createElement('strong');
    nom.textContent = escale.nom;
    const temps = document.createElement('time');
    temps.dateTime = escale.date_arrivee;
    temps.textContent = date;
    item.append(nom, temps);
    items.append(item);
  });
  select?.replaceChildren(options);
  liste?.replaceChildren(items);
  if (ouvrir && select) {
    ouvrir.textContent = 'Afficher sur le carnet';
    ouvrir.addEventListener('click', () => {
      const item = document.getElementById(`fallback-escale-${select.value}`);
      item?.scrollIntoView({ block: 'center', behavior: mouvementReduit ? 'auto' : 'smooth' });
      item?.focus({ preventScroll: true });
    });
  }

  window.__sillage = {
    fallback: true,
    route: { escales },
    etatComposition() {
      return {
        fallback: true,
        viewport: { largeur: innerWidth, hauteur: innerHeight, dpr: devicePixelRatio },
        escales: escales.length,
      };
    },
  };
}

if (!webglDisponible()) {
  await activeFallback2D();
} else {
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
function ratioPixelsCible() {
  const compact = innerWidth < 700 || innerHeight < 520;
  return Math.min(devicePixelRatio, compact ? 1.5 : 2);
}
renderer.setPixelRatio(ratioPixelsCible());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
// Le globe conserve une distance minimale lisible pour le catamaran fixe.
// La plongée abaisse temporairement cette limite pour son propre plan rapproché.
controls.minDistance = 2.1;
controls.maxDistance = 12;
controls.rotateSpeed = VITESSE_ROTATION_CARTE;
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
  bateau?.regleMode?.(mode);
  modeBouton.querySelector('span').textContent =
    carnetActif ? 'Mode réaliste' : 'Mode carnet';
  const actionMode = carnetActif ? 'Passer au mode réaliste' : 'Passer au mode carnet';
  modeBouton.setAttribute('aria-label', actionMode);
  modeBouton.title = actionMode;
}
modeBouton.addEventListener('click', () => {
  regleMode(mode === 'carnet' ? 'photo' : 'carnet');
});

function estCatalogueObjet(valeur) {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
}

async function chargeJsonOptionnel(url) {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return {};
    const donnees = await reponse.json();
    return estCatalogueObjet(donnees) ? donnees : {};
  } catch {
    return {};
  }
}

function estVueDetailApprouvee(vue) {
  return estCatalogueObjet(vue)
    && vue.approved === true
    && vue.previewOnly !== true
    && vue.detailPlongee === true
    && typeof vue.fichier === 'string'
    && vue.fichier.trim().length > 0
    && Number.isFinite(vue.lonMin)
    && Number.isFinite(vue.lonMax)
    && Number.isFinite(vue.latMin)
    && Number.isFinite(vue.latMax);
}

function fusionneVuesAeriennes(base, generated) {
  const resultat = Object.create(null);
  for (const [cle, vue] of Object.entries(base)) resultat[cle] = vue;

  for (const [cle, vue] of Object.entries(generated)) {
    // The hand-reviewed detailed source always wins.  The generated catalogue
    // may only replace an old overview tile after a human has approved it.
    if (base[cle]?.detailPlongee === true || !estVueDetailApprouvee(vue)) continue;
    resultat[cle] = vue;
  }
  return resultat;
}

function estHeroEscaleCurate(hero) {
  // This layer is deliberately separate from aerial imagery: a journal photo
  // is shown only after someone has picked it for this exact stop and supplied
  // its own archive description.  There is no automatic article-photo choice.
  return estCatalogueObjet(hero)
    && hero.curated === true
    && typeof hero.fichier === 'string'
    && /^media\/[A-Za-z0-9_./-]+\.webp$/i.test(hero.fichier)
    && typeof hero.alt === 'string'
    && hero.alt.trim().length > 0
    && typeof hero.legende === 'string'
    && hero.legende.trim().length > 0;
}

function selectionneHerosEscales(catalogue) {
  return Object.fromEntries(Object.entries(catalogue)
    .filter(([, hero]) => estHeroEscaleCurate(hero)));
}

const [routeData, mouillagesData, vuesAeriennesBase, vuesAeriennesGenerees, herosEscalesBruts, meteo] = await Promise.all([
  fetch('./data/route.json').then(r => r.json()),
  fetch('./data/mouillages.json').then(r => r.json()),
  // The close-up imagery is optional: a missing manifest must leave the
  // journal's clean selected-place fallback intact rather than block launch.
  chargeJsonOptionnel('./data/vues_aeriennes.json'),
  // Pipeline output is deliberately inert until a person marks each source as
  // approved.  This keeps a quality-gated candidate from becoming live just
  // because it was successfully generated.
  chargeJsonOptionnel('./data/vues_aeriennes_sentinel.generated.json'),
  // A small explicitly-curated layer of real voyage photographs can enrich a
  // calm atlas arrival.  It is never treated as a surface map or inferred
  // from the article list at runtime.
  chargeJsonOptionnel('./data/heros_escales.json'),
  creerMeteo(),
]);
const vuesAeriennes = fusionneVuesAeriennes(vuesAeriennesBase, vuesAeriennesGenerees);
const herosEscales = selectionneHerosEscales(herosEscalesBruts);
const voyage = construireVoyage(routeData);
const mouillagesParCle = new Map(
  mouillagesData.map(m => [`${m.nom}|${m.date_arrivee}`, m]));

const route = creerRoute(voyage, routeData, relief);
scene.add(route.groupe);

const bateau = await creerBateau();
scene.add(bateau.conteneur, bateau.ecume);

const timeline = creerTimeline(voyage);

// Frame the globe inside the space left by the title, controls and timeline.
// A portrait phone therefore sees a composed miniature rather than a desktop
// camera cropped to a narrow strip.
function distanceAccueilPourViewport() {
  const largeur = Math.max(320, innerWidth);
  const hauteur = Math.max(320, innerHeight);
  const compact = largeur < 700 || hauteur < 520;
  const paysageCompact = hauteur < 520 && largeur > hauteur;
  const reserveHaut = paysageCompact ? 48 : compact ? 72 : 92;
  const reserveBas = paysageCompact ? 78 : compact ? 116 : 126;
  const largeurUtile = Math.max(220, largeur - (compact ? 28 : 56));
  const hauteurUtile = Math.max(180, hauteur - reserveHaut - reserveBas);
  const demiVertical = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const angleVertical = Math.atan(Math.tan(demiVertical) * hauteurUtile / hauteur);
  const angleHorizontal = Math.atan(Math.tan(demiVertical) * largeurUtile / hauteur);
  const angleLimitant = Math.max(THREE.MathUtils.degToRad(7.5),
    Math.min(angleVertical, angleHorizontal) * 0.94);
  return THREE.MathUtils.clamp(1.08 / Math.sin(angleLimitant), 3.55, 8.25);
}

function distanceTraverseePourViewport() {
  const compact = innerWidth < 700 || innerHeight < 520;
  return Math.max(2.5, distanceAccueilPourViewport() * (compact ? 0.74 : 0.62));
}

// caméra de départ : loin au large, l'intro glisse vers la Martinique
let derniereDistanceAccueil = distanceAccueilPourViewport();
camera.position.copy(voyage.position(voyage.debut)).normalize()
  .multiplyScalar(mouvementReduit
    ? distanceAccueilPourViewport()
    : Math.max(8.5, distanceAccueilPourViewport() + 2.2));
camera.lookAt(0, 0, 0);
let intro = mouvementReduit ? 1 : 0; // 0 → 1 : l'approche du début

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
  const action = actif ? 'Arrêter de suivre le bateau' : 'Suivre le bateau';
  boutonSuivre.setAttribute('aria-label', action);
  boutonSuivre.title = action;
}
boutonSuivre.addEventListener('click', () => regleSuivi(!suivre));
regleSuivi(true);
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
  relief, regleVisibiliteBateau: bateau.regleVisibilite,
  regleVisibiliteRoute: affiche => {
    route.groupe.visible = Boolean(affiche);
    if (affiche) return;
    // Do not rely on the next render loop alone: an island image must never
    // get one frame of stale route rings while its detail texture arrives.
    route.orientePerles(camera, 0, []);
  },
  vuesAeriennes,
  herosEscales,
  regleDetailIle: vue => globe.montreDetail(vue),
  cacheDetailIle: () => globe.cacheDetail(),
});
const recit = creerRecit({ timeline, regleSuivi, voyage });
creerTraversee({ timeline, voyage, mouillagesParCle });

// The canvas is not the only way into the voyage: this native navigator gives
// keyboard and assistive-technology users direct access to every anchorage.
const selectEscales = document.getElementById('escales-select');
const boutonOuvrirEscale = document.getElementById('escales-ouvrir');
if (selectEscales && boutonOuvrirEscale) {
  const fragment = document.createDocumentFragment();
  route.escales.forEach((escale, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    const annee = escale.date_arrivee ? new Date(`${escale.date_arrivee}T12:00:00Z`).getUTCFullYear() : '';
    option.textContent = `${escale.nom}${annee ? ` — ${annee}` : ''}`;
    fragment.append(option);
  });
  selectEscales.replaceChildren(fragment);
  boutonOuvrirEscale.addEventListener('click', () => {
    const escale = route.escales[Number(selectEscales.value)];
    if (!escale?.date_arrivee) return;
    if (recit.actif) recit.sort();
    void plongee.vers(escale);
  });
}

const ocean = creerOcean();
const sonBouton = document.getElementById('son-bouton');
sonBouton.addEventListener('click', () => {
  const actif = ocean.bascule();
  sonBouton.classList.toggle('actif', actif);
  sonBouton.setAttribute('aria-pressed', String(actif));
  sonBouton.setAttribute('aria-label', actif ? 'Couper l’ambiance sonore' : 'Activer l’ambiance sonore');
});

// — infobulle des mouillages —
const infobulle = document.getElementById('infobulle');
const raycaster = new THREE.Raycaster();
const pointeur = new THREE.Vector2(-2, -2);
let escaleSurvolee = null;
let positionPointeur = { x: 0, y: 0 };
let debutGeste = null;
let clicDeplace = false;

function positionneInfobulle(x, y) {
  const marge = 10;
  const rect = infobulle.getBoundingClientRect();
  let gauche = x + 14;
  let haut = y + 10;
  if (gauche + rect.width > innerWidth - marge) gauche = x - rect.width - 14;
  if (haut + rect.height > innerHeight - marge) haut = y - rect.height - 10;
  infobulle.style.left = `${Math.max(marge, gauche)}px`;
  infobulle.style.top = `${Math.max(marge, haut)}px`;
}

canvas.addEventListener('pointerdown', (e) => {
  debutGeste = { id: e.pointerId, x: e.clientX, y: e.clientY };
  clicDeplace = false;
});

canvas.addEventListener('pointermove', (e) => {
  pointeur.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  positionPointeur = { x: e.clientX, y: e.clientY };
  if (debutGeste?.id === e.pointerId
    && Math.hypot(e.clientX - debutGeste.x, e.clientY - debutGeste.y) > 7) {
    clicDeplace = true;
  }
  if (!infobulle.hidden) positionneInfobulle(e.clientX, e.clientY);
});

canvas.addEventListener('pointercancel', () => { debutGeste = null; });
canvas.addEventListener('pointerleave', () => {
  debutGeste = null;
  pointeur.set(-2, -2);
  escaleSurvolee = null;
  route.regleSurvol(-1);
  infobulle.hidden = true;
  canvas.style.cursor = '';
});

canvas.addEventListener('click', (e) => {
  debutGeste = null;
  if (clicDeplace) {
    clicDeplace = false;
    return;
  }
  pointeur.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  chercheSurvol(); // le survol throttlé peut être périmé au moment du clic
  if (escaleSurvolee?.date_arrivee) {
    if (recit.actif) recit.sort(); // on quitte le récit pour plonger
    void plongee.vers(escaleSurvolee);
  } else if (plongee.ouverte || plongee.enVol || plongee.enChargement) {
    plongee.remonte(); // cliquer ailleurs referme le carnet
  }
});

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
function chercheSurvol() {
  // Route targets are intentionally absent while a place is loading, flying
  // in, or open. Raycasting the hidden instanced mesh could otherwise revive
  // an old tooltip/click target during the async image transition.
  if (!route.groupe.visible || plongee.enVol || plongee.ouverte || plongee.enChargement) {
    escaleSurvolee = null;
    route.regleSurvol(-1);
    infobulle.hidden = true;
    canvas.style.cursor = '';
    return;
  }
  raycaster.setFromCamera(pointeur, camera);
  const hits = raycaster.intersectObject(route.cibles);
  const hit = hits.find(h => h.instanceId !== undefined && route.estVisible(h.instanceId));
  escaleSurvolee = hit ? route.escales[hit.instanceId] : null;
  route.regleSurvol(hit ? hit.instanceId : -1);
  if (escaleSurvolee) {
    const e = escaleSurvolee;
    const dates = e.date_depart && e.date_depart !== e.date_arrivee
      ? `${formatCourt.format(new Date(e.date_arrivee))} → ${formatCourt.format(new Date(e.date_depart))}`
      : formatCourt.format(new Date(e.date_arrivee));
    infobulle.innerHTML = `${e.nom}<span class="dates">${dates} · ${e.log_nm} nm au log</span>`;
    infobulle.hidden = false;
    positionneInfobulle(positionPointeur.x, positionPointeur.y);
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
  if (plongee.enVol || plongee.enChargement) return;
  intro = 1;
  const d = camera.position.length()
    * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0013));
  camera.position.setLength(
    THREE.MathUtils.clamp(d, controls.minDistance, controls.maxDistance));
}, { passive: true });

// — boucle de rendu —
function redimensionne() {
  const w = innerWidth, h = innerHeight;
  const distanceAvant = camera.position.length();
  renderer.setPixelRatio(ratioPixelsCible());
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  route.surResize(w, h);
  const nouvelAccueil = distanceAccueilPourViewport();
  if (intro >= 1 && !timeline.enLecture && !plongee.enVol && !plongee.ouverte && !plongee.enChargement
    && Math.abs(distanceAvant - derniereDistanceAccueil) < 0.65) {
    camera.position.setLength(nouvelAccueil);
  }
  derniereDistanceAccueil = nouvelAccueil;
}
addEventListener('resize', redimensionne);
redimensionne();

const boiteBateau = new THREE.Box3();
const coinBateau = new THREE.Vector3();
function rectangleEcranBateau() {
  bateau.conteneur.updateWorldMatrix(true, true);
  boiteBateau.setFromObject(bateau.conteneur, true);
  let gauche = Infinity, droite = -Infinity, haut = Infinity, bas = -Infinity;
  for (const x of [boiteBateau.min.x, boiteBateau.max.x]) {
    for (const y of [boiteBateau.min.y, boiteBateau.max.y]) {
      for (const z of [boiteBateau.min.z, boiteBateau.max.z]) {
        coinBateau.set(x, y, z).project(camera);
        const px = (coinBateau.x * 0.5 + 0.5) * innerWidth;
        const py = (-coinBateau.y * 0.5 + 0.5) * innerHeight;
        gauche = Math.min(gauche, px);
        droite = Math.max(droite, px);
        haut = Math.min(haut, py);
        bas = Math.max(bas, py);
      }
    }
  }
  return Object.fromEntries(Object.entries({ gauche, droite, haut, bas })
    .map(([cle, valeur]) => [cle, Number(valeur.toFixed(1))]));
}

// poignée de débogage (capture.mjs, console)
window.__sillage = {
  camera, controls, timeline, voyage, bateau, plongee, route, recit, etoiles, globe,
  etiquettes, coton, renderer,
  sauteIntro() {
    intro = 1;
    const accueil = distanceAccueilPourViewport();
    if (camera.position.length() > accueil + 0.5) camera.position.setLength(accueil);
  },
  etatComposition() {
    return {
      viewport: { largeur: innerWidth, hauteur: innerHeight, dpr: devicePixelRatio },
      camera: { distance: camera.position.length(), accueil: distanceAccueilPourViewport() },
      chronologie: {
        instant: timeline.t,
        libelle: voyage.segmentA(timeline.t).libelle,
      },
      bateau: { rectangle: rectangleEcranBateau(), ...bateau.etat() },
      etiquettes: etiquettes.etat(),
      route: route.etat(),
      nuages: coton.etat(),
      rendu: { ...renderer.info.render },
    };
  },
};

const horloge = new THREE.Clock();
let accumulateurSurvol = 0;
let lectureAvant = false;

document.body.classList.add('pret'); // l'interface peut entrer en scène

renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();

  timeline.metAJour(dt * 1000);
  plongee.metAJour(dt);
  if (suivre && !suiviEnPause && !plongee.enVol && !plongee.enChargement) {
    suitLeBateau(Math.min(1, dt * 3.5));
  }
  if (timeline.enLecture && !lectureAvant) regleSuivi(true); // la Traversée embarque
  lectureAvant = timeline.enLecture;
  document.body.classList.toggle('lecture', timeline.enLecture);
  ocean.metAJour(dt, timeline.enLecture);

  // l'intro : on arrive du large, en douceur, jusqu'à la Martinique
  if (intro < 1 && !plongee.enVol && !timeline.enLecture) {
    intro = Math.min(1, intro + dt / 3.2);
    const f = 1 - Math.pow(1 - intro, 3);
    const accueil = distanceAccueilPourViewport();
    camera.position.setLength(THREE.MathUtils.lerp(Math.max(8.5, accueil + 2.2), accueil, f));
  }

  // la rotation s'adoucit quand on est près du sol (sinon chaque
  // mouvement de souris est démesuré en zoom fort)
  const distance = camera.position.length();
  const vitesseProche = VITESSE_ROTATION_CARTE
    * THREE.MathUtils.clamp((distance - 1) / 2.4, 0.05, 1);
  // À la plongée, l'inertie reste la même mais chaque glissement fait environ
  // 80 % moins tourner le globe. Le retour à la carte rétablit aussitôt la
  // vitesse calculée ci-dessus, pendant que les contrôles sont encore bloqués
  // par le vol de remontée.
  controls.rotateSpeed = vitesseProche
    * (plongee.ouverte ? FACTEUR_ROTATION_PLONGEE : 1);
  controls.zoomSpeed = THREE.MathUtils.clamp((distance - 1) / 1.6, 0.25, 1);

  if (!plongee.enVol && !plongee.ouverte && intro >= 1) {
    const compact = innerWidth < 700 || innerHeight < 520;
    const minimumRecit = distanceAccueilPourViewport() * (compact ? 0.72 : 0.58);
    const cible = recit.actif ? Math.max(recit.distanceCamera, minimumRecit)
      : timeline.enLecture ? distanceTraverseePourViewport() : null;
    if (cible !== null) {
      camera.position.setLength(
        THREE.MathUtils.lerp(distance, cible, Math.min(1, dt * 2)));
    }
  }

  globe.anime(dt);
  coton.anime(dt, mouvementReduit ? 0 : horloge.elapsedTime, camera, !mouvementReduit);
  bateau.anime(mouvementReduit ? 0 : horloge.elapsedTime, camera);
  etiquettes.anime(camera, bateau.conteneur.position,
    voyage.segmentA(timeline.t).libelle, rectangleEcranBateau(), dt);
  route.orientePerles(camera, mouvementReduit ? 0 : horloge.elapsedTime,
    etiquettes.etat().etiquettes);

  accumulateurSurvol += dt;
  if (accumulateurSurvol > 0.08 && !plongee.enVol) { // raycast décimé
    accumulateurSurvol = 0;
    chercheSurvol();
  }

  controls.update();
  renderer.render(scene, camera);
});
}
