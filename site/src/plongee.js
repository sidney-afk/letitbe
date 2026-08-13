// La plongée (étape 3 du plan) : clic sur un mouillage → la caméra descend
// vers l'ancre, et le carnet de bord de l'escale glisse à l'écran — les
// vrais articles du blog et leurs photos, qui émergent en cascade.

import * as THREE from 'three';
import { latLonVers3D } from './geo.js';

// A stop without an explicitly reviewed close-up is an arrival in the atlas,
// not a pretend satellite fly-over. Keep enough of the painted globe in view
// that coastlines stay graceful instead of exposing the base map's pixels.
const DISTANCE_PLONGEE = 1.90;
// A source marked `detailPlongee` has passed the separate imagery gate and
// earns this tighter, cinematic crop. Existing archive tiles that have not
// passed that gate retain the calm illustrated selected-place fallback below.
const DISTANCE_PLONGEE_DETAIL = 1.02;
const FOV_PLONGEE_DETAIL = 5;
const DISTANCE_ORBITE = 3.0;
const DUREE_VOL_S = 2.6;

const formatLong = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

const lisse = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function creerPlongee({ camera, controls, timeline, regleSuivi,
  regleVisibiliteBateau = () => {}, regleVisibiliteRoute = () => {},
  regleDetailIle = () => false, cacheDetailIle = () => {}, vuesAeriennes = {},
  herosEscales = {}, mouillagesParCle, scene, relief }) {
  const panneau = document.getElementById('plongee');
  const titre = document.getElementById('plongee-nom');
  const sousTitre = document.getElementById('plongee-dates');
  const flux = document.getElementById('plongee-flux');
  const boutonRemonter = document.getElementById('remonter');
  const legendeScene = document.getElementById('plongee-scene-caption');
  const legendeSceneMobile = document.getElementById('plongee-scene-caption-mobile');
  const legendeSceneA11y = document.getElementById('plongee-scene-caption-a11y');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('img');
  const lightboxLegende = lightbox.querySelector('figcaption');
  const boutonFermerLightbox = document.getElementById('lightbox-fermer');

  let vol = null; // { t, depart:{dir,dist}, arrivee:{dir,dist}, alOuverture }
  let ouverte = false;
  let focusAvantPlongee = null;
  let focusAvantLightbox = null;
  let focaleAvantPlongee = camera.fov;
  // Loading a local image is asynchronous. A later selection (or a return to
  // the map) must win over an older request so a delayed image can never
  // start the wrong flight.
  let demandePlongee = 0;
  let chargement = false;

  const elementsFocusables = conteneur => [...conteneur.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), '
    + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && getComputedStyle(element).display !== 'none');

  function gardeFocus(e, conteneur) {
    if (e.key !== 'Tab') return;
    const elements = elementsFocusables(conteneur);
    if (!elements.length) return;
    const premier = elements[0];
    const dernier = elements[elements.length - 1];
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
    }
  }

  function ouvreLightbox(src, legende, declencheur) {
    focusAvantLightbox = declencheur ?? document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = legende || 'Photographie du carnet de bord';
    lightboxLegende.textContent = legende || '';
    lightbox.hidden = false;
    requestAnimationFrame(() => boutonFermerLightbox?.focus({ preventScroll: true }));
  }

  function fermeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightboxImg.removeAttribute('src');
    const cible = focusAvantLightbox;
    focusAvantLightbox = null;
    if (cible?.isConnected) requestAnimationFrame(() => cible.focus({ preventScroll: true }));
  }

  let repereEscale = null;

  function cacheRepereEscale() {
    if (!repereEscale) return;
    scene.remove(repereEscale);
    repereEscale.traverse(element => {
      element.geometry?.dispose();
      const materiaux = Array.isArray(element.material) ? element.material : [element.material];
      materiaux.filter(Boolean).forEach(materiau => materiau.dispose());
    });
    repereEscale = null;
  }

  function montreRepereEscale(escale) {
    cacheRepereEscale();
    const direction = latLonVers3D(escale.lat, escale.lon, 1);
    const repere = new THREE.Group();
    repere.position.copy(direction).multiplyScalar(relief.altitude(direction, 0.006));
    repere.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    // A reviewed detail can stand on its own. The illustrated atlas needs a
    // modest, surface-bound wayfinder instead: a gold mast and red pennant,
    // deliberately unlike a loading bullseye or a satellite target.
    const matOr = new THREE.MeshBasicMaterial({
      color: 0xc89032, transparent: true, opacity: 0.98,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const matRouge = new THREE.MeshBasicMaterial({
      color: 0xbb4733, transparent: true, opacity: 0.98,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const matIvoire = new THREE.MeshBasicMaterial({
      color: 0xfff3cf, transparent: true, opacity: 0.96,
      depthWrite: false, side: THREE.DoubleSide,
    });

    const amarre = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 20), matIvoire);
    amarre.position.set(-0.0037, -0.0036, 0.0008);
    amarre.renderOrder = 4;

    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.00055, 0.00055, 0.014, 8), matOr);
    // The group has its local Z aligned with the globe normal, so turn the
    // cylinder from its default Y axis into a truly upright little mast.
    mat.rotation.x = Math.PI / 2;
    mat.position.z = 0.007;
    mat.renderOrder = 5;

    const formePavillon = new THREE.Shape();
    formePavillon.moveTo(0, 0.0132);
    formePavillon.lineTo(0.0102, 0.0095);
    formePavillon.lineTo(0, 0.0058);
    formePavillon.closePath();
    const pavillon = new THREE.Mesh(new THREE.ShapeGeometry(formePavillon), matRouge);
    pavillon.position.z = 0.0009;
    pavillon.renderOrder = 6;

    repere.add(amarre, mat, pavillon);
    repere.userData.type = 'pavillon';
    scene.add(repere);
    repereEscale = repere;
  }

  function cacheLegendeScene() {
    for (const legende of [legendeScene, legendeSceneMobile]) {
      if (!legende) continue;
      legende.hidden = true;
      legende.textContent = '';
    }
    if (legendeSceneA11y) legendeSceneA11y.textContent = '';
    document.body.classList.remove('plongee-escale-illustree');
  }

  function montreLegendeScene(escale) {
    const date = formatLong.format(new Date(`${escale.date_arrivee}T12:00:00Z`));
    const texte = `À l’ancre · ${escale.nom} · ${date}`;
    for (const legende of [legendeScene, legendeSceneMobile]) {
      if (!legende) continue;
      legende.textContent = texte;
      legende.hidden = false;
    }
    if (legendeSceneA11y) legendeSceneA11y.textContent = texte;
    document.body.classList.add('plongee-escale-illustree');
  }

  function lanceVol(versDir, versDist, alArrivee, versFov = camera.fov) {
    vol = {
      t: 0,
      departDir: camera.position.clone().normalize(),
      departDist: camera.position.length(),
      departFov: camera.fov,
      arriveeDir: versDir.clone().normalize(),
      arriveeDist: versDist,
      arriveeFov: versFov,
      alArrivee,
    };
    controls.enabled = false;
  }

  function profilDetail(vue) {
    // Per-view framing lets a reviewed source keep a narrow reef or a broad
    // island in the safe portion of its own imagery. This helper is called
    // only after the source has passed the detail gate.
    const distance = Number.isFinite(vue?.detailDistance)
      && vue.detailDistance > 1.001 && vue.detailDistance < DISTANCE_ORBITE
      ? vue.detailDistance : DISTANCE_PLONGEE_DETAIL;
    const fov = Number.isFinite(vue?.detailFov)
      && vue.detailFov >= 3 && vue.detailFov <= 55
      ? vue.detailFov : FOV_PLONGEE_DETAIL;
    return { distance, fov };
  }

  function metAJour(dt) {
    if (!vol) return;
    vol.t = Math.min(1, vol.t + dt / DUREE_VOL_S);
    const f = lisse(vol.t);
    const dir = vol.departDir.clone().lerp(vol.arriveeDir, f).normalize();
    const dist = THREE.MathUtils.lerp(vol.departDist, vol.arriveeDist, f);
    camera.position.copy(dir.multiplyScalar(dist));
    camera.fov = THREE.MathUtils.lerp(vol.departFov, vol.arriveeFov, f);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    if (vol.t >= 1) {
      const fin = vol.alArrivee;
      vol = null;
      controls.enabled = true;
      fin?.();
    }
  }

  function ajouteHeroCarnet(hero) {
    if (!hero) return;
    const figure = document.createElement('figure');
    figure.className = 'plongee-hero-carnet';

    const etiquette = document.createElement('p');
    etiquette.className = 'plongee-hero-carnet-etiquette';
    etiquette.textContent = 'Photographie du carnet';
    figure.append(etiquette);

    const ouvrirImage = document.createElement('button');
    ouvrirImage.type = 'button';
    ouvrirImage.className = 'photo-ouvrir';
    ouvrirImage.setAttribute('aria-label', `Agrandir la photographie du carnet : ${hero.legende}`);

    const img = document.createElement('img');
    img.loading = 'eager';
    img.src = `./${hero.fichier}`;
    img.alt = hero.alt;
    img.addEventListener('error', () => figure.remove());
    ouvrirImage.addEventListener('click', () => ouvreLightbox(img.src, hero.legende, ouvrirImage));
    ouvrirImage.append(img);
    figure.append(ouvrirImage);

    const cap = document.createElement('figcaption');
    cap.textContent = hero.date ? `${hero.legende} · ${hero.date}` : hero.legende;
    figure.append(cap);
    flux.append(figure);
  }

  function rempli(escale, heroCarnet = null) {
    titre.textContent = escale.nom;
    const d1 = formatLong.format(new Date(escale.date_arrivee + 'T12:00:00Z'));
    const d2 = escale.date_depart && escale.date_depart !== escale.date_arrivee
      ? formatLong.format(new Date(escale.date_depart + 'T12:00:00Z')) : null;
    sousTitre.textContent =
      `${d2 ? `du ${d1} au ${d2}` : d1} · ${escale.log_nm.toLocaleString('fr-FR')} milles au log`;

    flux.replaceChildren();
    // A curated journal photograph makes the two deliberately selected atlas
    // arrivals tangible, while remaining visibly distinct from map imagery.
    // It is passed only for the calm fallback state, never for a reviewed
    // aerial detail such as Makogai.
    ajouteHeroCarnet(heroCarnet);
    const articles = escale.articles ?? [];
    if (!articles.length) {
      const p = document.createElement('p');
      p.className = 'plongee-vide';
      p.textContent = 'Le blog est resté silencieux dans ce mouillage — l’équipage devait être à l’eau.';
      flux.append(p);
      return;
    }
    let rang = 0;
    for (const a of articles) {
      const art = document.createElement('article');
      art.style.setProperty('--rang', rang++);

      const date = document.createElement('p');
      date.className = 'article-date';
      date.textContent = (a.en_mer ? '✉ écrit en mer · ' : '')
        + formatLong.format(new Date(a.date + 'T12:00:00Z'));
      art.append(date);

      if (a.titre) {
        const h = document.createElement('h3');
        h.textContent = a.titre;
        art.append(h);
      }

      const texte = document.createElement('p');
      texte.className = 'article-texte';
      texte.textContent = a.texte ?? a.extrait;
      art.append(texte);

      for (const im of a.images) {
        const fig = document.createElement('figure');
        fig.style.setProperty('--rang', rang++);
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = `./media/${im.src.replace(/\.[a-z]+$/i, '.webp')}`;
        img.alt = im.legende || a.titre;
        img.addEventListener('error', () => fig.remove());
        const ouvrirImage = document.createElement('button');
        ouvrirImage.type = 'button';
        ouvrirImage.className = 'photo-ouvrir';
        ouvrirImage.setAttribute('aria-label', `Agrandir la photo${im.legende ? ` : ${im.legende}` : ''}`);
        ouvrirImage.addEventListener('click', () => ouvreLightbox(img.src, im.legende, ouvrirImage));
        ouvrirImage.append(img);
        fig.append(ouvrirImage);
        if (im.legende) {
          const cap = document.createElement('figcaption');
          cap.textContent = im.legende;
          fig.append(cap);
        }
        art.append(fig);
      }
      flux.append(art);
    }
  }

  async function vers(escale) {
    const demande = ++demandePlongee;
    chargement = true;
    // La maquette et son sillage ne font pas partie de la vue rapprochée de
    // l'escale : on les cache avant même le premier frame du vol pour éviter
    // qu'ils deviennent gigantesques au-dessus de l'île.
    regleVisibiliteBateau(false);
    // The itinerary is useful on the overview, but it is visual noise when a
    // visitor has deliberately entered one place. Hide it before the flight
    // begins so no bright line cuts across the selected island.
    regleVisibiliteRoute(false);
    // Release any earlier close-up before choosing this anchorage. The globe
    // owns at most one local image and it always remains a real surface map.
    cacheDetailIle();
    cacheRepereEscale();
    cacheLegendeScene();
    focusAvantPlongee = document.activeElement;
    focaleAvantPlongee = camera.fov;
    panneau.hidden = true;
    const complet = mouillagesParCle.get(`${escale.nom}|${escale.date_arrivee}`) ?? escale;
    const vue = vuesAeriennes[`${complet.nom}|${complet.date_arrivee}`];
    // The clean selected-place state is reserved for a source that has passed
    // the per-location imagery gate. A merely existing legacy file must not
    // turn a visit into a blurry satellite rectangle; it keeps the illustrated
    // globe and the truthful selected-place marker until a reviewed detail is
    // generated for that stop.
    const detailDisponible = Boolean(vue?.detailPlongee && await regleDetailIle(vue));
    if (demande !== demandePlongee) return;
    chargement = false;
    const directionDetail = detailDisponible && Number.isFinite(vue?.focusLat)
      && Number.isFinite(vue?.focusLon)
      ? latLonVers3D(vue.focusLat, vue.focusLon, 1) : null;
    const profil = detailDisponible ? profilDetail(vue) : null;
    const distanceCible = profil?.distance ?? DISTANCE_PLONGEE;
    const focaleCible = profil?.fov ?? focaleAvantPlongee;
    timeline.vaA(new Date(escale.date_arrivee + 'T12:00:00Z').getTime(), true);
    controls.minDistance = distanceCible - 0.003;
    // The real island image is its own focal point. Keep a small pennant only
    // for escales without a reliable local source, where it remains useful
    // rather than covering the shoreline with a target-like circle.
    if (detailDisponible) cacheRepereEscale();
    else montreRepereEscale(complet);
    lanceVol(directionDetail ?? latLonVers3D(complet.lat, complet.lon, 1), distanceCible, () => {
      if (demande !== demandePlongee) return;
      const heroCarnet = detailDisponible
        ? null : herosEscales[`${complet.nom}|${complet.date_arrivee}`];
      rempli(complet, heroCarnet);
      panneau.hidden = false;
      if (!detailDisponible) montreLegendeScene(complet);
      document.body.classList.add('plongee-ouverte');
      flux.scrollTop = 0;
      ouverte = true;
      boutonRemonter.focus({ preventScroll: true });
    }, focaleCible);
  }

  function remonte() {
    const demande = ++demandePlongee;
    chargement = false;
    // A return requested during the inbound flight replaces that flight. This
    // keeps a stale arrival from opening the journal after the visitor has
    // already changed their mind.
    vol = null;
    controls.enabled = true;
    fermeLightbox();
    panneau.hidden = true;
    document.body.classList.remove('plongee-ouverte');
    ouverte = false;
    cacheLegendeScene();
    cacheRepereEscale();
    cacheDetailIle();
    lanceVol(camera.position.clone().normalize(), DISTANCE_ORBITE, () => {
      if (demande !== demandePlongee) return;
      controls.minDistance = 2.1;
      regleSuivi(true); // on reprend la route en suivant le bateau
      // Le retour est terminé : la maquette et son sillage reprennent
      // ensemble leur place sur la carte générale.
      regleVisibiliteBateau(true);
      regleVisibiliteRoute(true);
      const cible = focusAvantPlongee?.isConnected && focusAvantPlongee !== document.body
        ? focusAvantPlongee : document.querySelector('#navigation-escales summary, #recit-bouton');
      focusAvantPlongee = null;
      cible?.focus({ preventScroll: true });
    }, focaleAvantPlongee);
  }

  boutonRemonter.addEventListener('click', remonte);
  addEventListener('keydown', (e) => {
    if (!lightbox.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        fermeLightbox();
      } else gardeFocus(e, lightbox);
      return;
    }
    if ((ouverte || chargement || vol) && e.key === 'Escape') {
      e.preventDefault();
      remonte();
    } else if (ouverte) gardeFocus(e, panneau);
  });
  boutonFermerLightbox?.addEventListener('click', fermeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) fermeLightbox();
  });

  return {
    vers,
    remonte,
    metAJour,
    get enVol() { return vol !== null; },
    get ouverte() { return ouverte; },
    get enChargement() { return chargement; },
    get repereVisible() { return repereEscale !== null; },
    get repereType() { return repereEscale?.userData.type ?? null; },
  };
}
