// La Terre miniature : en mode Carnet, une figurine peinte à la main —
// relief sculpté en vraie géométrie (montagnes en volume), cel shading aux
// ombres bleutées, océan laiteux qui scintille doucement. En mode réaliste,
// jour/nuit Blue Marble + lumières nocturnes et halo atmosphérique.

import * as THREE from 'three';
import { RAYON } from './geo.js';

const texLoader = new THREE.TextureLoader();

function charge(url, espace = THREE.SRGBColorSpace) {
  const t = texLoader.load(url);
  t.colorSpace = espace;
  // Les cartes équirectangulaires rejoignent leurs bords gauche/droit sur le
  // méridien 180°. Sans répétition horizontale, les deux colonnes de la
  // géométrie UV lisent chacune un bord « clampé » différent et dessinent une
  // couture verticale dans le Pacifique.
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ressoude les normales le long du méridien de la couture UV (les sommets
// y sont dupliqués : sans cela, un trait d'ombre coupe le Pacifique)
function soudeCouture(geo, segL, segH) {
  const n = geo.attributes.normal;
  const colonnes = segL + 1;
  const v = new THREE.Vector3();
  for (let rang = 0; rang <= segH; rang++) {
    const a = rang * colonnes;
    const b = a + segL;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b))
      .normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}

export function creerGlobe(relief) {
  const groupe = new THREE.Group();

  const jour = charge('./textures/earth_day_5400.jpg');
  const nuit = charge('./textures/earth_night_3600.jpg');
  const spec = charge('./textures/earth_specular_2048.jpg', THREE.NoColorSpace);
  const normales = charge('./textures/earth_normal_2048.jpg', THREE.NoColorSpace);
  const nuages = charge('./textures/clouds_2048.jpg', THREE.NoColorSpace);

  const carnet = charge('./textures/earth_carnet.jpg');

  const uniforms = {
    carteJour: { value: jour },
    carteNuit: { value: nuit },
    carteSpec: { value: spec },
    carteNormales: { value: normales },
    dirSoleil: { value: new THREE.Vector3(1, 0, 0) },
    meteoLumiere: { value: 1 },  // grisaille du jour (météo vécue)
  };
  const meteoNuages = { value: 1 };
  const cibleMeteo = { nuages: 1, lumiere: 1 };

  // matériau « peint à la main » du mode Carnet : demi-Lambert en bandes
  // douces (pas de face nocturne), ombres bleutées plutôt que noires,
  // liseré de lumière crème. Le relief est dans la géométrie : les bandes
  // de lumière sculptent les chaînes de montagnes.
  const matiereCarnet = new THREE.ShaderMaterial({
    uniforms: {
      carteCarnet: { value: carnet },
      carteSpec: uniforms.carteSpec,
      dirSoleil: uniforms.dirSoleil,
      meteoLumiere: uniforms.meteoLumiere,
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormaleM;
      varying vec3 vPosM;
      void main() {
        vUv = uv;
        vNormaleM = normalize(mat3(modelMatrix) * normal);
        vec4 pm = modelMatrix * vec4(position, 1.0);
        vPosM = pm.xyz;
        gl_Position = projectionMatrix * viewMatrix * pm;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D carteCarnet;
      uniform sampler2D carteSpec;
      uniform vec3 dirSoleil;
      uniform float meteoLumiere;
      varying vec2 vUv;
      varying vec3 vNormaleM;
      varying vec3 vPosM;
      void main() {
        vec3 n = normalize(vNormaleM);
        // Le lavis du JPG Carnet n'est pas périodique : ses deux bords du
        // Pacifique n'ont pas exactement la même teinte. La sphère joint ces
        // UV à ±180° : on fond seulement leurs couleurs de bord dans une très
        // petite bande océanique, sans refléter la géographie voisine.
        const float LARGEUR_COUTURE = 0.010;
        const float EPSILON_COUTURE = 0.0005;
        float uLocal = clamp(vUv.x, EPSILON_COUTURE, 1.0 - EPSILON_COUTURE);
        vec2 uvLocal = vec2(uLocal, vUv.y);
        float merLocal = texture2D(carteSpec, uvLocal).r;
        float merBordGauche = texture2D(carteSpec,
          vec2(EPSILON_COUTURE, vUv.y)).r;
        float merBordDroit = texture2D(carteSpec,
          vec2(1.0 - EPSILON_COUTURE, vUv.y)).r;
        float oceanLocal = smoothstep(0.35, 0.70, merLocal);
        float oceanBords = min(smoothstep(0.35, 0.70, merBordGauche),
                               smoothstep(0.35, 0.70, merBordDroit));
        float proximiteCouture = 1.0 - smoothstep(0.0, LARGEUR_COUTURE,
                                                   min(vUv.x, 1.0 - vUv.x));
        // On ne mélange que si le pixel local et les deux bords sont océans :
        // les terres et les côtes du Pacifique restent nettes et uniques.
        float fonduCouture = proximiteCouture * min(oceanLocal, oceanBords);
        vec3 couleurBord = mix(
          texture2D(carteCarnet, vec2(EPSILON_COUTURE, vUv.y)).rgb,
          texture2D(carteCarnet, vec2(1.0 - EPSILON_COUTURE, vUv.y)).rgb,
          0.5);
        vec3 tex = mix(texture2D(carteCarnet, uvLocal).rgb, couleurBord,
                       fonduCouture);
        // La carte spéculaire est blanche au large et noire sur les terres.
        // Son masque reste local pour qu'aucun détail géographique ne soit
        // importé depuis l'autre bord de la carte.
        float mer = merLocal;
        float ocean = smoothstep(0.35, 0.70, mer);

        float ndl = dot(n, dirSoleil) * 0.5 + 0.5; // demi-Lambert : pas de nuit
        // Une seule rampe de soleil, continue autour de la sphère. Les anciens
        // paliers de cel shading dessinaient une bande verticale visible dans
        // le Pacifique lorsque le soleil changeait de longitude.
        float lumiereDouce = smoothstep(0.0, 1.0, ndl);
        float eclairageTerre = mix(0.82, 1.10, lumiereDouce);
        vec3 terre = tex * eclairageTerre * 1.32 * vec3(1.0, 0.98, 0.94);
        // Les reliefs gardent une ombre fraîche, suivant la même transition
        // continue que le soleil pour rester sculptés sans paliers visibles.
        terre *= mix(vec3(0.87, 0.92, 1.07), vec3(1.0), lumiereDouce);

        // L'océan du Carnet est une encre stable : ses lagons, lavis et
        // vaguelettes viennent déjà de la texture. Ne pas les moduler par le
        // soleil supprime toute bande longitudinale, même à grande échelle.
        vec3 eau = tex * 1.38 * vec3(1.0, 0.985, 0.97);
        vec3 couleur = mix(terre, eau, ocean);

        vec3 versCam = normalize(cameraPosition - vPosM);

        // liseré de lumière crème sur le bord
        float bord = pow(1.0 - max(dot(n, versCam), 0.0), 2.4);
        couleur += vec3(1.0, 0.96, 0.86) * bord * 0.28;

        couleur *= mix(1.0, meteoLumiere, 0.6); // la grisaille, en douceur
        gl_FragColor = vec4(couleur, 1.0);
      }`,
  });

  const matierePhoto = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vNormaleM;
        varying vec3 vPosM;
        void main() {
          vUv = uv;
          vNormaleM = normalize(mat3(modelMatrix) * normal);
          vec4 pm = modelMatrix * vec4(position, 1.0);
          vPosM = pm.xyz;
          gl_Position = projectionMatrix * viewMatrix * pm;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D carteJour;
        uniform sampler2D carteNuit;
        uniform sampler2D carteSpec;
        uniform sampler2D carteNormales;
        uniform vec3 dirSoleil;
        uniform float meteoLumiere;
        varying vec2 vUv;
        varying vec3 vNormaleM;
        varying vec3 vPosM;

        void main() {
          vec3 n = normalize(vNormaleM);
          // micro-relief discret issu de la carte de normales
          vec3 dn = texture2D(carteNormales, vUv).rgb * 2.0 - 1.0;
          n = normalize(n + 0.35 * (dn.x * vec3(0.0, 1.0, 0.0) + dn.y * cross(n, vec3(0.0, 1.0, 0.0))));

          float cosSoleil = dot(n, dirSoleil);
          float jourMix = smoothstep(-0.12, 0.18, cosSoleil);

          vec3 cJour = texture2D(carteJour, vUv).rgb;
          float eclairage = (0.18 + 1.05 * max(cosSoleil, 0.0)) * meteoLumiere;
          cJour *= eclairage;

          // reflet du soleil sur l'océan
          float ocean = texture2D(carteSpec, vUv).r;
          vec3 versCam = normalize(cameraPosition - vPosM);
          vec3 refl = reflect(-dirSoleil, n);
          float glint = pow(max(dot(refl, versCam), 0.0), 56.0) * ocean;
          cJour += vec3(1.0, 0.92, 0.78) * glint * 0.5 * smoothstep(0.0, 0.25, cosSoleil);

          // villes la nuit, ambrées
          vec3 lumieres = texture2D(carteNuit, vUv).rgb;
          vec3 cNuit = pow(lumieres, vec3(1.35)) * vec3(1.0, 0.82, 0.55) * 1.6
                     + cJour * 0.06;

          vec3 couleur = mix(cNuit, cJour, jourMix);

          // teinte atmosphérique sur le limbe
          float fresnel = pow(1.0 - max(dot(n, versCam), 0.0), 2.6);
          vec3 teinteAtmo = mix(vec3(0.9, 0.45, 0.25), vec3(0.35, 0.6, 1.0),
                                smoothstep(-0.25, 0.45, cosSoleil));
          couleur += teinteAtmo * fresnel * (0.18 + 0.45 * jourMix);

          gl_FragColor = vec4(couleur, 1.0);
        }`,
  });

  // — la sculpture : une sphère dense déplacée par la carte d'élévation —
  const SEG_L = 512, SEG_H = 256;
  const geoTerre = new THREE.SphereGeometry(RAYON, SEG_L, SEG_H);
  relief.drape(geoTerre, 0);
  soudeCouture(geoTerre, SEG_L, SEG_H);
  const terre = new THREE.Mesh(geoTerre, matierePhoto);
  groupe.add(terre);

  // au-dessus des plus hauts sommets, pour le mode réaliste
  const meshNuages = new THREE.Mesh(
    new THREE.SphereGeometry(RAYON * 1.03, 96, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        carteNuages: { value: nuages },
        dirSoleil: uniforms.dirSoleil,
        meteoNuages,
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vNormaleM;
        void main() {
          vUv = uv;
          vNormaleM = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D carteNuages;
        uniform vec3 dirSoleil;
        uniform float meteoNuages;
        varying vec2 vUv;
        varying vec3 vNormaleM;
        void main() {
          float d = texture2D(carteNuages, vUv).r * meteoNuages;
          float alpha = smoothstep(0.08, 0.85, d) * 0.85;
          float cosSoleil = dot(normalize(vNormaleM), dirSoleil);
          float eclat = 0.08 + 0.97 * max(cosSoleil, 0.0);
          gl_FragColor = vec4(vec3(eclat), alpha * smoothstep(-0.25, 0.05, cosSoleil + 0.18));
        }`,
    }),
  );
  groupe.add(meshNuages);

  // halo atmosphérique vu de l'extérieur
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(RAYON * 1.06, 96, 48),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { dirSoleil: uniforms.dirSoleil },
      vertexShader: /* glsl */`
        varying vec3 vNormaleM;
        varying vec3 vPosM;
        void main() {
          vNormaleM = normalize(mat3(modelMatrix) * normal);
          vec4 pm = modelMatrix * vec4(position, 1.0);
          vPosM = pm.xyz;
          gl_Position = projectionMatrix * viewMatrix * pm;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 dirSoleil;
        varying vec3 vNormaleM;
        varying vec3 vPosM;
        void main() {
          vec3 n = normalize(vNormaleM);
          vec3 versCam = normalize(cameraPosition - vPosM);
          float bord = pow(1.0 - abs(dot(n, versCam)), 3.2);
          float cote = smoothstep(-0.45, 0.35, dot(n, dirSoleil));
          vec3 bleu = vec3(0.3, 0.55, 1.0);
          gl_FragColor = vec4(bleu, bord * (0.06 + 0.55 * cote));
        }`,
    }),
  );
  groupe.add(halo);

  return {
    groupe,
    metAJourSoleil(dir) { uniforms.dirSoleil.value.copy(dir); },
    regleMode(mode) {
      const carnetActif = mode === 'carnet';
      terre.material = carnetActif ? matiereCarnet : matierePhoto;
      meshNuages.visible = !carnetActif; // le Carnet a ses nuages cotonneux
      halo.visible = !carnetActif;
    },
    regleMeteo({ nuages, lumiere }) {
      cibleMeteo.nuages = nuages;
      cibleMeteo.lumiere = lumiere;
    },
    anime(dt) {
      meshNuages.rotation.y += dt * 0.0035;
      const k = Math.min(1, dt * 1.2); // la météo change en douceur
      meteoNuages.value += (cibleMeteo.nuages - meteoNuages.value) * k;
      uniforms.meteoLumiere.value += (cibleMeteo.lumiere - uniforms.meteoLumiere.value) * k;
    },
  };
}
