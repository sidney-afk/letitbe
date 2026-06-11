// La Terre : jour/nuit ERA-photoréaliste (Blue Marble + lumières nocturnes),
// reflet du soleil sur l'océan, nuages dérivants, halo atmosphérique.

import * as THREE from 'three';
import { RAYON } from './geo.js';

const texLoader = new THREE.TextureLoader();

function charge(url, espace = THREE.SRGBColorSpace) {
  const t = texLoader.load(url);
  t.colorSpace = espace;
  t.anisotropy = 8;
  return t;
}

export function creerGlobe() {
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
  // liseré de lumière crème — l'esprit cel shading de la référence.
  const matiereCarnet = new THREE.ShaderMaterial({
    uniforms: {
      carteCarnet: { value: carnet },
      carteNormales: { value: normales },
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
      uniform sampler2D carteNormales;
      uniform vec3 dirSoleil;
      uniform float meteoLumiere;
      varying vec2 vUv;
      varying vec3 vNormaleM;
      varying vec3 vPosM;
      void main() {
        vec3 n = normalize(vNormaleM);
        vec3 tex = texture2D(carteCarnet, vUv).rgb;
        // relief « sculpté » façon diorama : la carte de normales accentuée
        // (elle est plate sur l'océan, le relief n'apparaît que sur terre)
        vec3 dn = texture2D(carteNormales, vUv).rgb * 2.0 - 1.0;
        n = normalize(n + 0.6 * (dn.x * vec3(0.0, 1.0, 0.0)
                                 + dn.y * cross(n, vec3(0.0, 1.0, 0.0))));

        float ndl = dot(n, dirSoleil) * 0.5 + 0.5; // demi-Lambert : pas de nuit
        // trois bandes d'éclairage aux transitions douces, base claire
        float bandes = 0.74
          + 0.13 * smoothstep(0.30, 0.40, ndl)
          + 0.21 * smoothstep(0.55, 0.68, ndl);
        vec3 couleur = tex * bandes * 1.32 * vec3(1.0, 0.98, 0.94);
        // l'ombre est fraîche et bleutée, jamais sombre
        couleur = mix(couleur * vec3(0.85, 0.91, 1.08), couleur,
                      smoothstep(0.18, 0.52, ndl));

        // liseré de lumière crème sur le bord
        vec3 versCam = normalize(cameraPosition - vPosM);
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

  const terre = new THREE.Mesh(
    new THREE.SphereGeometry(RAYON, 128, 64), matierePhoto);
  groupe.add(terre);

  const meshNuages = new THREE.Mesh(
    new THREE.SphereGeometry(RAYON * 1.0045, 96, 48),
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
    new THREE.SphereGeometry(RAYON * 1.045, 96, 48),
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
