// La plongée (étape 3 du plan) : clic sur un mouillage → la caméra descend
// vers l'ancre, et le carnet de bord de l'escale glisse à l'écran — les
// vrais articles du blog et leurs photos, qui émergent en cascade.

import * as THREE from 'three';
import { latLonVers3D } from './geo.js';

// A distance of 1.014 put the camera only a few millimetres above the
// miniature. That magnified both the base map and a one-degree aerial tile
// until their pixels became the subject of the view. This is still an island
// close-up, but leaves enough breathing room for the place to read as part of
// the globe rather than as a stretched map tile.
const DISTANCE_PLONGEE = 1.25;
const DISTANCE_ORBITE = 3.0;
const DUREE_VOL_S = 2.6;

const formatLong = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

const lisse = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function creerPlongee({ camera, controls, timeline, regleSuivi,
  regleVisibiliteBateau = () => {}, regleVisibiliteRoute = () => {},
  mouillagesParCle, scene, relief }) {
  const panneau = document.getElementById('plongee');
  const titre = document.getElementById('plongee-nom');
  const sousTitre = document.getElementById('plongee-dates');
  const flux = document.getElementById('plongee-flux');
  const boutonRemonter = document.getElementById('remonter');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('img');
  const lightboxLegende = lightbox.querySelector('figcaption');
  const boutonFermerLightbox = document.getElementById('lightbox-fermer');

  let vol = null; // { t, depart:{dir,dist}, arrivee:{dir,dist}, alOuverture }
  let ouverte = false;
  let focusAvantPlongee = null;
  let focusAvantLightbox = null;

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

    // The selected place stays in the Carnet language: a soft lagoon glow,
    // a precise gold ring, and no pasted satellite rectangle.
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.016, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { couleur: { value: new THREE.Color(0x8ce7ee) } },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 couleur;
          varying vec2 vUv;
          void main() {
            float r = length((vUv - 0.5) * 2.0);
            float brume = 1.0 - smoothstep(0.12, 1.0, r);
            float liseret = smoothstep(0.60, 0.74, r)
              * (1.0 - smoothstep(0.82, 0.96, r));
            gl_FragColor = vec4(couleur, brume * 0.14 + liseret * 0.20);
          }`,
      }));
    halo.renderOrder = 4;

    const anneau = new THREE.Mesh(new THREE.RingGeometry(0.0064, 0.0076, 48),
      new THREE.MeshBasicMaterial({
        color: 0xd4a142, transparent: true, opacity: 0.94,
        depthWrite: false, side: THREE.DoubleSide,
      }));
    anneau.renderOrder = 5;

    const coeur = new THREE.Mesh(new THREE.CircleGeometry(0.00215, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfff4cf, transparent: true, opacity: 0.96,
        depthWrite: false, side: THREE.DoubleSide,
      }));
    coeur.renderOrder = 6;

    repere.add(halo, anneau, coeur);
    scene.add(repere);
    repereEscale = repere;
  }

  function lanceVol(versDir, versDist, alArrivee) {
    vol = {
      t: 0,
      departDir: camera.position.clone().normalize(),
      departDist: camera.position.length(),
      arriveeDir: versDir.clone().normalize(),
      arriveeDist: versDist,
      alArrivee,
    };
    controls.enabled = false;
  }

  function metAJour(dt) {
    if (!vol) return;
    vol.t = Math.min(1, vol.t + dt / DUREE_VOL_S);
    const f = lisse(vol.t);
    const dir = vol.departDir.clone().lerp(vol.arriveeDir, f).normalize();
    const dist = THREE.MathUtils.lerp(vol.departDist, vol.arriveeDist, f);
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);
    if (vol.t >= 1) {
      const fin = vol.alArrivee;
      vol = null;
      controls.enabled = true;
      fin?.();
    }
  }

  function rempli(escale) {
    titre.textContent = escale.nom;
    const d1 = formatLong.format(new Date(escale.date_arrivee + 'T12:00:00Z'));
    const d2 = escale.date_depart && escale.date_depart !== escale.date_arrivee
      ? formatLong.format(new Date(escale.date_depart + 'T12:00:00Z')) : null;
    sousTitre.textContent =
      `${d2 ? `du ${d1} au ${d2}` : d1} · ${escale.log_nm.toLocaleString('fr-FR')} milles au log`;

    flux.replaceChildren();
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

  function vers(escale) {
    // La maquette et son sillage ne font pas partie de la vue rapprochée de
    // l'escale : on les cache avant même le premier frame du vol pour éviter
    // qu'ils deviennent gigantesques au-dessus de l'île.
    regleVisibiliteBateau(false);
    // The itinerary is useful on the overview, but it is visual noise when a
    // visitor has deliberately entered one place. Hide it before the flight
    // begins so no bright line cuts across the selected island.
    regleVisibiliteRoute(false);
    focusAvantPlongee = document.activeElement;
    panneau.hidden = true;
    const complet = mouillagesParCle.get(`${escale.nom}|${escale.date_arrivee}`) ?? escale;
    timeline.vaA(new Date(escale.date_arrivee + 'T12:00:00Z').getTime(), true);
    controls.minDistance = DISTANCE_PLONGEE - 0.003;
    montreRepereEscale(complet);
    lanceVol(latLonVers3D(complet.lat, complet.lon, 1), DISTANCE_PLONGEE, () => {
      rempli(complet);
      panneau.hidden = false;
      document.body.classList.add('plongee-ouverte');
      flux.scrollTop = 0;
      ouverte = true;
      boutonRemonter.focus({ preventScroll: true });
    });
  }

  function remonte() {
    if (vol) return;
    fermeLightbox();
    panneau.hidden = true;
    document.body.classList.remove('plongee-ouverte');
    ouverte = false;
    cacheRepereEscale();
    lanceVol(camera.position.clone().normalize(), DISTANCE_ORBITE, () => {
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
    });
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
    if (ouverte && e.key === 'Escape') {
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
  };
}
