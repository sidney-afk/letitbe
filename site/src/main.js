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
import { creerPlongee, blocEvoque, boutonPartage } from './plongee.js';
import { suisLeCarnet, lisLien, slugEscale } from './lien.js';
import { creerRecit, CHAPITRES } from './recit.js';
import { creerTraversee } from './traversee.js';
import {
  chargeRoadtrip, creerTraceRoadtrip, infobulleLieu, sectionRoadtrip, CLE_ESCALE_ROADTRIP,
} from './roadtrip.js';
import { creerOcean } from './ocean.js';
import { creerMeteo } from './meteo.js';
import { creerCiel } from './ciel.js';
import { creerNuagesCotonneux } from './nuages.js';
import { creerEtiquettes } from './etiquettes.js';
import { creerOrnements } from './ornements.js';
import { construireVoyage, latLonVers3D } from './geo.js';
import { soleilEtCiel } from './sun.js';
import { chargeRelief, reliefPlat } from './relief.js';
import { creerChargement } from './chargement.js';
import { activeAPropos } from './apropos.js';
import { creerSommaire } from './sommaire.js';

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
  // The painted world of the globe, flattened over the half of the planet
  // the voyage crossed (same bounds as pipeline/carte_fallback.py).
  const CARTE = { lonOuest: 140, largeurLon: 170, latNord: 65, latSud: -50, l: 1600, h: 1083 };
  const projette = (lat, lon) => {
    const lonEst = lon < 0 ? lon + 360 : lon;
    return {
      x: (lonEst - CARTE.lonOuest) / CARTE.largeurLon * CARTE.l,
      y: (CARTE.latNord - lat) / (CARTE.latNord - CARTE.latSud) * CARTE.h,
    };
  };
  if (trace && routeData.length) {
    const ns = 'http://www.w3.org/2000/svg';
    trace.setAttribute('viewBox', `0 0 ${CARTE.l} ${CARTE.h}`);
    const fond = document.createElementNS(ns, 'image');
    fond.setAttribute('href', './textures/carte_pacifique.jpg');
    fond.setAttribute('width', String(CARTE.l));
    fond.setAttribute('height', String(CARTE.h));
    fond.setAttribute('preserveAspectRatio', 'none');
    trace.append(fond);
    const points = routeData
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon))
      .map(point => projette(point.lat, point.lon))
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`);
    const ligne = document.createElementNS(ns, 'polyline');
    ligne.setAttribute('points', points.join(' '));
    ligne.setAttribute('class', 'fallback-route-ligne');
    trace.append(ligne);
    for (const escale of escales) {
      const { x, y } = projette(escale.lat, escale.lon);
      const point = document.createElementNS(ns, 'circle');
      point.setAttribute('cx', x.toFixed(1));
      point.setAttribute('cy', y.toFixed(1));
      point.setAttribute('r', '4');
      point.setAttribute('class', 'fallback-escale-point');
      trace.append(point);
    }
  }

  const options = document.createDocumentFragment();
  const items = document.createDocumentFragment();
  if (navigation && liste) liste.before(navigation);
  const formatDateFallback = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  // Each stop opens its journal in place: the blog posts in their order,
  // with their photographs (the same archive as the 3D journal).
  let carnetsFallback = null;
  const chargeCarnetsFallback = () => {
    carnetsFallback ??= fetch('./data/mouillages.json')
      .then(r => (r.ok ? r.json() : []))
      .then(liste => new Map(liste.map(m => [`${m.nom}|${m.date_arrivee}`, m])))
      .catch(() => new Map());
    return carnetsFallback;
  };
  const remplitCarnetFallback = async (escale, conteneur) => {
    const carnets = await chargeCarnetsFallback();
    const cle = `${escale.nom}|${escale.date_arrivee}`;
    const complet = carnets.get(cle);
    const articles = complet?.articles ?? [];
    const route = cle === CLE_ESCALE_ROADTRIP ? await chargeRoadtrip() : [];
    const billetsRoute = new Set(route.map(e => e.article_id).filter(Boolean));
    conteneur.replaceChildren();
    if (!articles.length) {
      const vide = document.createElement('p');
      vide.textContent = 'Aucun billet du blog n’a été écrit depuis ce mouillage.';
      conteneur.append(vide);
      const evoque = complet?.evoque ?? [];
      if (evoque.length) {
        vide.textContent += ` Il est évoqué dans ${evoque.length > 1 ? 'des billets voisins' : 'un billet voisin'}\u00a0:`;
        conteneur.append(blocEvoque(evoque, {
          surBillet: v => ouvreBilletFallback(v.escale, v.escale_arrivee, v.id),
        }));
      }
      return;
    }
    for (const article of articles) {
      if (billetsRoute.has(article.id) && !conteneur.querySelector('.roadtrip')) {
        conteneur.append(sectionRoadtrip(route, {
          surBillet: id => conteneur.querySelector(`#fallback-billet-${id}`)
            ?.scrollIntoView({ block: 'start', behavior: mouvementReduit ? 'auto' : 'smooth' }),
        }));
      }
      const date = document.createElement('p');
      date.className = 'article-date';
      date.id = `fallback-billet-${article.id}`;
      const jour = document.createElement('span');
      jour.textContent = formatDateFallback.format(new Date(`${article.date}T12:00:00Z`));
      date.append(jour, boutonPartage(escale, article));
      const titre = document.createElement('h4');
      titre.textContent = article.titre || '';
      conteneur.append(date, titre);
      const images = article.images ?? [];
      for (const bloc of article.blocs ?? []) {
        if (typeof bloc === 'string') {
          const p = document.createElement('p');
          p.className = 'article-texte';
          p.textContent = bloc;
          conteneur.append(p);
        } else if (images[bloc]) {
          const figure = document.createElement('figure');
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.src = `./media/${images[bloc].src.replace(/\.[a-z]+$/i, '.webp')}`;
          if (images[bloc].l && images[bloc].h) {
            img.width = images[bloc].l;
            img.height = images[bloc].h;
          }
          img.alt = images[bloc].legende || article.titre || '';
          img.addEventListener('error', () => figure.remove());
          figure.append(img);
          if (images[bloc].legende) {
            const legende = document.createElement('figcaption');
            legende.textContent = images[bloc].legende;
            figure.append(legende);
          }
          conteneur.append(figure);
        }
      }
    }
  };
  // from a quoted mention to the post itself, in another stop's journal
  const ouvreBilletFallback = async (nom, arrivee, id) => {
    const index = escales.findIndex(e => e.nom === nom && e.date_arrivee === arrivee);
    const details = document.querySelector(`#fallback-escale-${index} details`);
    if (!details) return;
    const carnet = details.querySelector('.fallback-carnet');
    if (!carnet.dataset.rempli) {
      carnet.dataset.rempli = '1';
      carnet.remplissage = remplitCarnetFallback(escales[index], carnet);
    }
    details.open = true;
    await carnet.remplissage;
    const billet = document.getElementById(`fallback-billet-${id}`);
    billet?.scrollIntoView({ block: 'start', behavior: mouvementReduit ? 'auto' : 'smooth' });
  };
  escales.forEach((escale, index) => {
    const date = formatDateFallback.format(new Date(`${escale.date_arrivee}T12:00:00Z`));
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${escale.nom} — ${date}`;
    options.append(option);
    const item = document.createElement('li');
    item.id = `fallback-escale-${index}`;
    item.tabIndex = -1;
    const details = document.createElement('details');
    const resume = document.createElement('summary');
    const nom = document.createElement('strong');
    nom.textContent = escale.nom;
    const temps = document.createElement('time');
    temps.dateTime = escale.date_arrivee;
    temps.textContent = date;
    resume.append(nom, temps);
    const carnet = document.createElement('div');
    carnet.className = 'fallback-carnet';
    carnet.textContent = 'Le carnet s’ouvre…';
    details.append(resume, carnet);
    details.addEventListener('toggle', () => {
      if (details.open && !carnet.dataset.rempli) {
        carnet.dataset.rempli = '1';
        carnet.remplissage = remplitCarnetFallback(escale, carnet);
      }
      // the address names the stop being read, to send it to someone
      const ancre = `#${slugEscale(escale)}`;
      if (details.open) history.replaceState(null, '', ancre);
      else if (location.hash.startsWith(ancre)) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    });
    item.append(details);
    items.append(item);
  });
  select?.replaceChildren(options);
  liste?.replaceChildren(items);
  // a shared link: that stop's journal, open, at that post
  const lien = lisLien(escales);
  if (lien) {
    const index = escales.indexOf(lien.escale);
    const item = document.getElementById(`fallback-escale-${index}`);
    if (lien.billet) {
      void ouvreBilletFallback(lien.escale.nom, lien.escale.date_arrivee, lien.billet);
    } else if (item) {
      item.querySelector('details').open = true;
      item.scrollIntoView({ block: 'start' });
    }
  }
  if (ouvrir && select) {
    ouvrir.textContent = 'Ouvrir le carnet';
    ouvrir.addEventListener('click', () => {
      const item = document.getElementById(`fallback-escale-${select.value}`);
      const details = item?.querySelector('details');
      if (details) details.open = true;
      item?.scrollIntoView({ block: 'start', behavior: mouvementReduit ? 'auto' : 'smooth' });
      item?.querySelector('summary')?.focus({ preventScroll: true });
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

activeAPropos();

// relief, étoiles, données du voyage, carte peinte, bateau
const chargement = creerChargement(5);
let renderer = null;
if (webglDisponible()) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (erreur) {
    // A driver can advertise WebGL and still refuse a context: that visitor
    // gets the map fallback, never a blank page.
    console.warn('WebGL refusé ; carte de secours.', erreur);
    renderer = null;
  }
}
if (!renderer) {
  await activeFallback2D();
  chargement.termine();
} else {
try {
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

// Everything that does not depend on the relief starts downloading now, in
// parallel, instead of one file after another.
const etoilesPromesse = chargement.suivre(creerEtoiles());
const bateauPromesse = chargement.suivre(creerBateau());
const donneesPromesse = chargement.suivre(chargeDonneesVoyage());
// The journals (every blog post, 1.3 MB) are not needed to show the globe:
// they download right after it appears (see below), and a stop's journal
// waits for them if a visitor is quicker than the network.
let lanceCarnets;
const carnetsPromesse = new Promise((resolve, reject) => {
  lanceCarnets = () => fetchJson('./data/mouillages.json').then(resolve, reject);
});

// le relief sculpté nourrit le globe, la route, les étiquettes, la plongée
const relief = await chargement.suivre(chargeRelief('./textures/earth_elev_2048.jpg')
  .catch(() => reliefPlat()));

// Phones and small GPUs paint the 4096 px globe (a quarter of the memory).
const carnetLeger = Math.min(screen.width, screen.height) < 700
  || renderer.capabilities.maxTextureSize < 8192
  || (navigator.deviceMemory !== undefined && navigator.deviceMemory < 4);
const globe = creerGlobe(relief, { carnetLeger });
scene.add(globe.groupe);
const globePret = chargement.suivre(globe.pret);

const etoiles = await etoilesPromesse;
scene.add(etoiles.points);

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
  roadtrip?.regleMode(mode);
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
  modeBouton.querySelector('.bouton-court').textContent = carnetActif ? 'Réaliste' : 'Carnet';
  const actionMode = carnetActif ? 'Passer au mode réaliste' : 'Passer au mode carnet';
  modeBouton.setAttribute('aria-label', actionMode);
  modeBouton.title = actionMode;
}
// The realistic textures load on demand: hovering or focusing the button
// starts them early, and the first switch waits for them (with a visible
// busy state) rather than showing a black globe.
const prechargeRealiste = () => { globe.prepareRealiste().catch(() => {}); };
modeBouton.addEventListener('pointerenter', prechargeRealiste, { once: true });
modeBouton.addEventListener('focus', prechargeRealiste, { once: true });
let modeEnAttente = false;
modeBouton.addEventListener('click', async () => {
  if (modeEnAttente) return;
  if (mode === 'carnet') {
    modeEnAttente = true;
    modeBouton.setAttribute('aria-busy', 'true');
    try {
      await globe.prepareRealiste();
    } catch (erreur) {
      console.warn('Mode réaliste indisponible pour le moment.', erreur);
      return;
    } finally {
      modeEnAttente = false;
      modeBouton.removeAttribute('aria-busy');
    }
  }
  fonduMode(() => regleMode(mode === 'carnet' ? 'photo' : 'carnet'));
});

// The painted globe and the photographic one dissolve into each other, like
// one map laid over the other, instead of jumping (plan, feature 1). The
// last frame is copied (scaled down: a dissolve hides the detail) onto a
// veil above the scene and below every control, which then fades away.
function fonduMode(change) {
  if (mouvementReduit) {
    change();
    return;
  }
  const source = renderer.domElement;
  const voile = document.createElement('canvas');
  voile.className = 'fondu-mode';
  voile.setAttribute('aria-hidden', 'true');
  const echelle = Math.min(1, 1280 / Math.max(1, source.width));
  voile.width = Math.max(1, Math.round(source.width * echelle));
  voile.height = Math.max(1, Math.round(source.height * echelle));
  try {
    renderer.render(scene, camera); // the drawing buffer is valid right after a render
    voile.getContext('2d').drawImage(source, 0, 0, voile.width, voile.height);
  } catch {
    change();
    return;
  }
  canvas.after(voile);
  change();
  const retire = () => voile.remove();
  voile.addEventListener('transitionend', retire, { once: true });
  setTimeout(retire, 1600);
  requestAnimationFrame(() => requestAnimationFrame(() => voile.classList.add('dissous')));
}

function estCatalogueObjet(valeur) {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
}

async function fetchJson(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} : ${url}`);
  return reponse.json();
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

function chargeDonneesVoyage() {
  return Promise.all([
  fetchJson('./data/route.json'),
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
}
const [routeData, vuesAeriennesBase, vuesAeriennesGenerees, herosEscalesBruts, meteo] = await donneesPromesse;
const vuesAeriennes = fusionneVuesAeriennes(vuesAeriennesBase, vuesAeriennesGenerees);
const herosEscales = selectionneHerosEscales(herosEscalesBruts);
const voyage = construireVoyage(routeData);
const mouillagesParCle = new Map();
const carnetsPrets = carnetsPromesse.then((mouillagesData) => {
  for (const m of mouillagesData) mouillagesParCle.set(`${m.nom}|${m.date_arrivee}`, m);
}).catch((erreur) => {
  console.warn('Carnets de bord indisponibles pour le moment.', erreur);
});

const route = creerRoute(voyage, routeData, relief);
scene.add(route.groupe);

// The autumn-2013 camper-van trip through the western parks, drawn once the
// journals are in (it happened during the San Francisco stop).
let roadtrip = null;
const roadtripPromesse = carnetsPromesse.then(() => chargeRoadtrip(), () => []);
roadtripPromesse.then((etapes) => {
  if (!etapes.length) return;
  roadtrip = creerTraceRoadtrip(etapes, relief);
  roadtrip.regleMode(mode);
  scene.add(roadtrip.groupe);
});

const bateau = await bateauPromesse;
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
  camera, controls, timeline, regleSuivi, mouillagesParCle, carnetsPrets, scene,
  roadtrip: roadtripPromesse,
  voisines: (escale) => {
    const i = route.escales.findIndex(e => e.nom === escale.nom
      && e.date_arrivee === escale.date_arrivee);
    return i < 0 ? {} : { precedente: route.escales[i - 1], suivante: route.escales[i + 1] };
  },
  escaleParCle: (nom, arrivee) => route.escales.find(e => e.nom === nom && e.date_arrivee === arrivee),
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
// When the replayed crossing reaches San Diego, the voyage ends on its
// epilogue ("La terre ferme") instead of simply stopping.
timeline.surFinDuVoyage(() => {
  if (!recit.actif && !plongee.ouverte && !plongee.enVol) recit.entre({ aide: false });
});
creerTraversee({ timeline, voyage, mouillagesParCle });

// The whole logbook as a table of contents: chapters, stops, post titles.
// Opening a journal from elsewhere than the globe: the table of contents, a
// shared link, the browser's Forward button.
function ouvreCarnet(escale, billet) {
  // chosen from the welcome card (or a link): the card steps aside
  if (document.body.classList.contains('accueil-ouvert')) {
    chargement.ferme();
    intro = 1;
  }
  if (recit.actif) recit.sort();
  const menu = document.getElementById('navigation-escales');
  if (menu?.open) {
    menu.open = false;
    menu.querySelector('summary')?.focus({ preventScroll: true });
  }
  void plongee.vers(escale, billet ? { billet } : {});
}

creerSommaire({
  escales: route.escales.filter(e => e.date_arrivee),
  mouillagesParCle,
  carnetsPrets,
  chapitres: CHAPITRES,
  ouvre: ouvreCarnet,
});
// the address follows the open journal; Back closes it (lien.js)
const lienCarnet = suisLeCarnet({ plongee, escales: route.escales, ouvre: ouvreCarnet });

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
    // The menu has done its job: fold it away so it does not linger over the
    // globe after the journal closes. Focus moves to its summary first, so the
    // dive returns the keyboard there rather than to a hidden button.
    const menu = document.getElementById('navigation-escales');
    if (menu?.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus({ preventScroll: true });
    }
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
let roadtripSurvole = null;
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

// A fingertip is far less precise than a mouse: on touch, a tap that misses
// the small ring still opens the nearest visible stop within finger reach.
const RAYON_DOIGT_PX = 30;
const pointEscale = new THREE.Vector3();
const versCamera = new THREE.Vector3();
function escaleProche(x, y, rayonPx) {
  versCamera.copy(camera.position).normalize();
  let meilleure = null;
  let meilleureDistance = rayonPx;
  route.escales.forEach((escale, i) => {
    if (!route.estVisible(i) || !escale.date_arrivee) return;
    pointEscale.copy(latLonVers3D(escale.lat, escale.lon, 1));
    if (pointEscale.dot(versCamera) < 0.25) return; // behind or on the limb
    pointEscale.project(camera);
    const px = (pointEscale.x * 0.5 + 0.5) * innerWidth;
    const py = (-pointEscale.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(px - x, py - y);
    if (d < meilleureDistance) {
      meilleureDistance = d;
      meilleure = escale;
    }
  });
  return meilleure;
}
let dernierTypePointeur = 'mouse';

canvas.addEventListener('pointerdown', (e) => {
  dernierTypePointeur = e.pointerType || 'mouse';
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
  roadtripSurvole = null;
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
  // a tap has no hover before it: the click's own position is the truth
  positionPointeur = { x: e.clientX, y: e.clientY };
  chercheSurvol(); // le survol throttlé peut être périmé au moment du clic
  const touche = dernierTypePointeur === 'touch' || dernierTypePointeur === 'pen';
  const libre = route.groupe.visible && !plongee.ouverte && !plongee.enVol && !plongee.enChargement;
  const visee = escaleSurvolee?.date_arrivee ? escaleSurvolee
    : (touche && libre ? escaleProche(e.clientX, e.clientY, RAYON_DOIGT_PX) : null);
  const surRoadtrip = !visee && libre && (roadtripSurvole
    ?? (touche ? roadtripSous(e.clientX, e.clientY, RAYON_DOIGT_PX, 14) : null));
  if (visee) {
    if (recit.actif) recit.sort(); // on quitte le récit pour plonger
    void plongee.vers(visee);
  } else if (surRoadtrip) {
    // the trip lives in the San Francisco journal: open it at that post
    const sf = route.escales.find(x => `${x.nom}|${x.date_arrivee}` === CLE_ESCALE_ROADTRIP);
    if (sf) {
      if (recit.actif) recit.sort();
      void plongee.vers(sf, { billet: surRoadtrip.billet });
    }
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
    roadtripSurvole = null;
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
  roadtripSurvole = escaleSurvolee ? null : roadtripSous(positionPointeur.x, positionPointeur.y, 10, 6);
  roadtrip?.regleSurvol(roadtripSurvole?.index ?? -1);
  if (escaleSurvolee) {
    const e = escaleSurvolee;
    const dates = e.date_depart && e.date_depart !== e.date_arrivee
      ? `${formatCourt.format(new Date(e.date_arrivee))} → ${formatCourt.format(new Date(e.date_depart))}`
      : formatCourt.format(new Date(e.date_arrivee));
    remplitInfobulle(e.nom, `${dates} · ${e.log_nm.toLocaleString('fr-FR')} milles au log`);
  } else if (roadtripSurvole) {
    remplitInfobulle(roadtripSurvole.nom, roadtripSurvole.detail, true);
  } else {
    infobulle.hidden = true;
    canvas.style.cursor = '';
  }
}

function remplitInfobulle(nom, detail, surRoute = false) {
  infobulle.classList.toggle('infobulle-route', surRoute);
  const dates = document.createElement('span');
  dates.className = 'dates';
  dates.textContent = detail;
  infobulle.replaceChildren(nom, dates);
  infobulle.hidden = false;
  positionneInfobulle(positionPointeur.x, positionPointeur.y);
  canvas.style.cursor = 'pointer';
}

// Under the pointer on the camper-van trail: one of its places (when close
// enough to show them) or the dotted line itself, which leads to the map.
function roadtripSous(x, y, rayonPoint, rayonTrace) {
  if (!roadtrip?.groupe.visible) return null;
  const lieu = roadtrip.lieuProche(x, y, rayonPoint);
  if (lieu) {
    return { ...infobulleLieu(lieu), index: lieu.index, billet: lieu.etapes[0].article_id };
  }
  if (roadtrip.surTrace(x, y, rayonTrace)) {
    return {
      nom: 'En camping-car',
      detail: `sept. – oct. 2013 · ${roadtrip.total.toLocaleString('fr-FR')} miles dans les parcs de l’Ouest`,
      index: -1,
      billet: 'roadtrip',
    };
  }
  return null;
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
  get roadtrip() { return roadtrip; },
  sauteIntro() {
    chargement.ferme();
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
      roadtrip: roadtrip?.etat() ?? null,
      nuages: coton.etat(),
      rendu: { ...renderer.info.render },
    };
  },
};

const horloge = new THREE.Clock();
let decalageVue = 0;
let accumulateurSurvol = 0;
let lectureAvant = false;

// The painted globe must be on screen before the curtain lifts.
await globePret;
document.body.classList.add('pret'); // l'interface peut entrer en scène
lanceCarnets();

renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();

  timeline.metAJour(dt * 1000);
  plongee.metAJour(dt);
  lienCarnet.metAJour();
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
  roadtrip?.oriente(camera, {
    visible: route.groupe.visible && !plongee.ouverte && !plongee.enVol && !plongee.enChargement,
    anneaux: route.etat().marqueurs?.filter(m => m.visible) ?? [],
    etiquettes: etiquettes.etat().etiquettes
      .filter(e => e.affichee && e.rectangle).map(e => e.rectangle),
  });

  accumulateurSurvol += dt;
  if (accumulateurSurvol > 0.08 && !plongee.enVol) { // raycast décimé
    accumulateurSurvol = 0;
    chercheSurvol();
  }

  // Story mode on an upright phone: the card sits low, so the view shifts
  // up and the boat (always at the centre of the camera) shows above it.
  const portraitCompact = innerWidth < 700 && innerHeight > innerWidth;
  const cibleDecalage = recit.actif && portraitCompact && !plongee.ouverte ? 0.22 : 0;
  decalageVue += (cibleDecalage - decalageVue) * Math.min(1, dt * 3);
  if (Math.abs(decalageVue) > 1e-3) {
    camera.setViewOffset(innerWidth, innerHeight, 0, decalageVue * innerHeight,
      innerWidth, innerHeight);
  } else if (camera.view?.enabled) {
    decalageVue = 0;
    camera.clearViewOffset();
  }

  controls.update();
  renderer.render(scene, camera);
});

// La page de garde : un premier visiteur sait tout de suite quoi faire.
// « Larguer les amarres » rejoue le voyage ; « Explorer la carte » laisse
// le globe libre.
chargement.accueil().then((choix) => {
  if (choix !== 'traversee') return;
  intro = 1;
  const accueil = distanceAccueilPourViewport();
  if (camera.position.length() > accueil + 0.5) camera.position.setLength(accueil);
  if (!timeline.enLecture) document.getElementById('lecture').click();
});
// a shared link to a stop or a post: straight to that journal
lienCarnet.ouvreLienInitial();
} catch (erreur) {
  chargement.echec(erreur);
}
}
