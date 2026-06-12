// La plongée (étape 3 du plan) : clic sur un mouillage → la caméra descend
// vers l'ancre, et le carnet de bord de l'escale glisse à l'écran — les
// vrais articles du blog et leurs photos, qui émergent en cascade.

import * as THREE from 'three';
import { latLonVers3D } from './geo.js';

const DISTANCE_PLONGEE = 1.026;  // ≈ 165 km : la vue aérienne HD emplit l'écran
const DISTANCE_ORBITE = 3.0;
const DUREE_VOL_S = 2.6;

const formatLong = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

const lisse = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function creerPlongee({ camera, controls, timeline, regleSuivi,
  mouillagesParCle, scene, vuesAeriennes, relief }) {
  const panneau = document.getElementById('plongee');
  const titre = document.getElementById('plongee-nom');
  const sousTitre = document.getElementById('plongee-dates');
  const flux = document.getElementById('plongee-flux');
  const boutonRemonter = document.getElementById('remonter');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('img');
  const lightboxLegende = lightbox.querySelector('figcaption');

  let vol = null; // { t, depart:{dir,dist}, arrivee:{dir,dist}, alOuverture }
  let ouverte = false;

  // — vue aérienne haute définition du mouillage (préchargée au build : on
  // connaît d'avance tous les endroits cliquables — idée de Sidney) —
  const chargeurTexture = new THREE.TextureLoader();
  let patchAerien = null;
  let opaciteCible = 0;

  function montreVueAerienne(escale) {
    const vue = vuesAeriennes[`${escale.nom}|${escale.date_arrivee}`];
    if (!vue) return;
    cacheVueAerienne();
    const texture = chargeurTexture.load(`./${vue.fichier}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const geo = new THREE.SphereGeometry(
      1, 64, 64,
      THREE.MathUtils.degToRad(vue.lonMin + 180),
      THREE.MathUtils.degToRad(vue.lonMax - vue.lonMin),
      THREE.MathUtils.degToRad(90 - vue.latMax),
      THREE.MathUtils.degToRad(vue.latMax - vue.latMin));
    relief.drape(geo, 0.0012); // l'image épouse le terrain sculpté
    // bord en fondu : la vue HD se dissout dans le globe, pas de carré dur
    const materiau = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        carte: { value: texture },
        opacite: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D carte;
        uniform float opacite;
        varying vec2 vUv;
        void main() {
          vec2 bord = smoothstep(0.0, 0.12, vUv) * smoothstep(1.0, 0.88, vUv);
          vec3 tex = texture2D(carte, vUv).rgb;
          // l'océan profond de l'imagerie satellite est presque noir :
          // on le fond dans le bleu du monde carnet, les terres, lagons
          // et récifs gardent leur vraie image (éclaircie pour l'ambiance)
          float clarte = max(max(tex.r, tex.g), tex.b);
          float terre = smoothstep(0.06, 0.22, clarte);
          vec3 bleuCarnet = vec3(0.46, 0.69, 0.86);
          vec3 image = pow(tex, vec3(0.88)) * 1.18;
          vec3 couleur = mix(bleuCarnet, image, terre);
          gl_FragColor = vec4(couleur, opacite * bord.x * bord.y);
        }`,
    });
    patchAerien = new THREE.Mesh(geo, materiau);
    patchAerien.renderOrder = 1;
    scene.add(patchAerien);
    opaciteCible = 1;
  }

  function cacheVueAerienne() {
    if (!patchAerien) return;
    const ancien = patchAerien;
    patchAerien = null;
    opaciteCible = 0;
    // petit fondu de sortie autonome puis nettoyage
    const fondu = () => {
      ancien.material.uniforms.opacite.value -= 0.06;
      if (ancien.material.uniforms.opacite.value <= 0) {
        scene.remove(ancien);
        ancien.geometry.dispose();
        ancien.material.uniforms.carte.value.dispose();
        ancien.material.dispose();
      } else {
        requestAnimationFrame(fondu);
      }
    };
    fondu();
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
    if (patchAerien) {
      const u = patchAerien.material.uniforms.opacite;
      if (u.value < opaciteCible) u.value = Math.min(opaciteCible, u.value + dt * 0.9);
    }
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
    const credit = vuesAeriennes[`${escale.nom}|${escale.date_arrivee}`]
      ? ' · vue aérienne © Esri, Maxar' : '';
    sousTitre.textContent =
      `${d2 ? `du ${d1} au ${d2}` : d1} · ${escale.log_nm.toLocaleString('fr-FR')} milles au log${credit}`;

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
        img.addEventListener('click', () => {
          lightboxImg.src = img.src;
          lightboxLegende.textContent = im.legende;
          lightbox.hidden = false;
        });
        fig.append(img);
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
    panneau.hidden = true;
    const complet = mouillagesParCle.get(`${escale.nom}|${escale.date_arrivee}`) ?? escale;
    timeline.vaA(new Date(escale.date_arrivee + 'T12:00:00Z').getTime(), true);
    controls.minDistance = 1.014;
    montreVueAerienne(complet);
    lanceVol(latLonVers3D(complet.lat, complet.lon, 1), DISTANCE_PLONGEE, () => {
      rempli(complet);
      panneau.hidden = false;
      document.body.classList.add('plongee-ouverte');
      flux.scrollTop = 0;
      ouverte = true;
    });
  }

  function remonte() {
    if (vol) return;
    panneau.hidden = true;
    document.body.classList.remove('plongee-ouverte');
    ouverte = false;
    cacheVueAerienne();
    lanceVol(camera.position.clone().normalize(), DISTANCE_ORBITE, () => {
      controls.minDistance = 1.25;
      regleSuivi(true); // on reprend la route en suivant le bateau
    });
  }

  boutonRemonter.addEventListener('click', remonte);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lightbox.hidden) lightbox.hidden = true;
    else if (ouverte) remonte();
  });
  lightbox.addEventListener('click', () => { lightbox.hidden = true; });

  return {
    vers,
    remonte,
    metAJour,
    get enVol() { return vol !== null; },
    get ouverte() { return ouverte; },
  };
}
