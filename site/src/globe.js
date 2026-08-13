// La Terre miniature : en mode Carnet, une figurine peinte à la main —
// relief sculpté en vraie géométrie (montagnes en volume), cel shading aux
// ombres bleutées, océan laiteux qui scintille doucement. En mode réaliste,
// jour/nuit Blue Marble + lumières nocturnes et halo atmosphérique.

import * as THREE from 'three';
import { RAYON } from './geo.js';

const texLoader = new THREE.TextureLoader();

function textureNeutre() {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function mercatorY(latitude) {
  const lat = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(latitude, -85, 85));
  return (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2;
}

function borneDetail(vue) {
  if (!vue || !Number.isFinite(vue.lonMin) || !Number.isFinite(vue.lonMax)
    || !Number.isFinite(vue.latMin) || !Number.isFinite(vue.latMax)) return null;
  let etendueLon = vue.lonMax - vue.lonMin;
  if (etendueLon <= 0) etendueLon += 360;
  const centreLon = vue.lonMin + etendueLon / 2;
  const hautMercator = mercatorY(vue.latMax);
  const basMercator = mercatorY(vue.latMin);
  return {
    centreU: THREE.MathUtils.euclideanModulo((centreLon + 180) / 360, 1),
    etendueU: etendueLon / 360,
    centreMercator: (hautMercator + basMercator) / 2,
    etendueMercator: Math.abs(basMercator - hautMercator),
  };
}

// Le détail local est échantillonné dans le matériau du globe, pas dessiné
// comme une seconde carte au-dessus de lui. Cela conserve l'ancrage 3D et
// supprime les bords de tuile, même pendant une rotation.
const GLSL_DETAIL_ILE = /* glsl */`
  uniform sampler2D carteDetail;
  uniform float detailActif;
  uniform float detailOpacite;
  uniform float detailCentreU;
  uniform float detailEtendueU;
  uniform float detailCentreMercator;
  uniform float detailEtendueMercator;

  float mercatorDetail(float latitude) {
    return (1.0 - log(tan(0.78539816339 + latitude * 0.5)) / 3.14159265359) * 0.5;
  }

  float deltaCyclique(float valeur) {
    return valeur - floor(valeur + 0.5);
  }

  vec3 melangeDetailIle(vec3 fond, vec2 uv) {
    if (detailActif < 0.5 || detailOpacite <= 0.001) return fond;

    // The local photograph and the base globe use the same sphere UVs.  Read
    // latitude from that interpolated UV, not from a world-position varying:
    // near a selected island the latter spans a large, low-poly globe face and
    // turns a continuous aerial image into visibly faceted/rectangular bands.
    // Three's SphereGeometry has v=1 at the north pole and v=0 at the south.
    float latitude = (uv.y - 0.5) * 3.14159265359;
    float u = deltaCyclique(uv.x - detailCentreU) / max(detailEtendueU, 0.00001) + 0.5;
    float v = (mercatorDetail(latitude) - detailCentreMercator)
      / max(detailEtendueMercator, 0.00001) + 0.5;
    vec2 detailUV = vec2(u, v);

    // La zone centrale est entièrement détaillée ; le raccord se fait loin de
    // la caméra dans une large marge. Il ne peut donc pas lire comme un carré.
    float bordU = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.94, 1.0, u));
    float bordV = smoothstep(0.0, 0.06, v) * (1.0 - smoothstep(0.94, 1.0, v));
    float raccord = bordU * bordV * detailOpacite;
    if (raccord <= 0.001) return fond;

    vec3 brut = texture2D(carteDetail, clamp(detailUV, 0.0, 1.0)).rgb;
    // Some old source mosaics contain literal black no-data columns. They do
    // not describe dark water: their RGB energy is zero. Fade those pixels
    // back to the globe instead of allowing a hard, square black tile to
    // become visible. A genuinely dark blue sea retains a blue channel and
    // therefore remains valid local imagery.
    float energie = max(max(brut.r, brut.g), brut.b);
    float bleuissement = max(0.0, brut.b - max(brut.r, brut.g));
    float noirSansDonnee = 1.0 - smoothstep(0.010, 0.050, energie);
    float eauFoncee = smoothstep(0.008, 0.035, bleuissement);
    float validite = 1.0 - noirSansDonnee * (1.0 - eauFoncee);
    // The asset is a fixed reflectance rendering produced from Sentinel's
    // raw red/green/blue bands. Preserve its real reef, shoreline, and water
    // colours rather than applying an illustrated-map recolour in the shader.
    return mix(fond, brut, raccord * validite);
  }
`;

function attendImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image locale indisponible : ${url}`));
    image.src = url;
  });
}

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
    // Une seule texture locale est injectée dans le matériau du globe à la
    // fois. Ainsi, une escale détaillée reste collée à la sphère au lieu de
    // devenir un second carré posé au-dessus de la carte.
    carteDetail: { value: textureNeutre() },
    detailActif: { value: 0 },
    detailOpacite: { value: 0 },
    detailCentreU: { value: 0.5 },
    detailEtendueU: { value: 1 },
    detailCentreMercator: { value: 0.5 },
    detailEtendueMercator: { value: 1 },
    dirSoleil: { value: new THREE.Vector3(1, 0, 0) },
    meteoLumiere: { value: 1 },  // grisaille du jour (météo vécue)
  };
  const textureDetailNeutre = uniforms.carteDetail.value;
  let textureDetail = null;
  let demandeDetail = 0;
  let cibleDetail = 0;
  let fichierDetail = null;
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
      carteDetail: uniforms.carteDetail,
      detailActif: uniforms.detailActif,
      detailOpacite: uniforms.detailOpacite,
      detailCentreU: uniforms.detailCentreU,
      detailEtendueU: uniforms.detailEtendueU,
      detailCentreMercator: uniforms.detailCentreMercator,
      detailEtendueMercator: uniforms.detailEtendueMercator,
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
      ${GLSL_DETAIL_ILE}
      void main() {
        vec3 n = normalize(vNormaleM);
        // Le lavis du JPG Carnet n'est pas périodique : ses deux bords du
        // Pacifique n'ont pas exactement la même teinte. La sphère joint ces
        // UV à ±180° : on fond seulement leurs couleurs de bord dans une très
        // petite bande océanique, sans refléter la géographie voisine. Cette
        // largeur est inférieure à 0,0028 U : Makogai (179° E) reste donc
        // entièrement dans sa propre imagerie, hors du raccord de dateline.
        const float LARGEUR_COUTURE = 0.0015;
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
        couleur = melangeDetailIle(couleur, vUv);

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
        ${GLSL_DETAIL_ILE}

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
          couleur = melangeDetailIle(couleur, vUv);

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

  function appliqueBorneDetail(borne) {
    if (!borne) return false;
    uniforms.detailCentreU.value = borne.centreU;
    uniforms.detailEtendueU.value = borne.etendueU;
    uniforms.detailCentreMercator.value = borne.centreMercator;
    uniforms.detailEtendueMercator.value = borne.etendueMercator;
    return true;
  }

  function libereTextureDetail() {
    if (!textureDetail) return;
    textureDetail.dispose();
    textureDetail = null;
    uniforms.carteDetail.value = textureDetailNeutre;
    fichierDetail = null;
  }

  // L'imagerie locale est volontairement chargée dans le shader de la Terre :
  // ni géométrie rapportée ni vignette n'ont alors de bord, de profondeur ou
  // de projection différente de la carte principale.
  async function montreDetail(vue) {
    // The caller supplies only reviewed, geographically bounded imagery. The
    // base manifest intentionally remains independent from that quality gate:
    // a file existing on disk is not evidence that it can survive a close-up.
    const borne = borneDetail(vue);
    if (!borne || !vue?.fichier) {
      cacheDetail();
      return false;
    }
    const demande = ++demandeDetail;
    cibleDetail = 0;
    try {
      const image = await attendImage(`./${vue.fichier}`);
      if (demande !== demandeDetail) return false;
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      // The aerial mosaics are assembled north-to-south (Web-Mercator image
      // coordinates). Unlike the equirectangular globe JPGs, they must keep
      // their top row at v=0 for the Mercator lookup above.
      texture.flipY = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      // Do not remap the previous texture while this image is decoding. The
      // bounds and texture become visible as one atomic detail state.
      appliqueBorneDetail(borne);
      libereTextureDetail();
      textureDetail = texture;
      uniforms.carteDetail.value = texture;
      uniforms.detailActif.value = 1;
      cibleDetail = 1;
      fichierDetail = vue.fichier;
      return true;
    } catch {
      if (demande === demandeDetail) {
        uniforms.detailActif.value = 0;
        cibleDetail = 0;
        fichierDetail = null;
      }
      return false;
    }
  }

  function cacheDetail() {
    demandeDetail += 1;
    cibleDetail = 0;
  }

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
    montreDetail,
    cacheDetail,
    etatDetail() {
      return {
        actif: Boolean(uniforms.detailActif.value),
        opacite: uniforms.detailOpacite.value,
        fichier: fichierDetail,
      };
    },
    anime(dt) {
      meshNuages.rotation.y += dt * 0.0035;
      const k = Math.min(1, dt * 1.2); // la météo change en douceur
      meteoNuages.value += (cibleMeteo.nuages - meteoNuages.value) * k;
      uniforms.meteoLumiere.value += (cibleMeteo.lumiere - uniforms.meteoLumiere.value) * k;
      const kDetail = Math.min(1, dt * 4.5);
      uniforms.detailOpacite.value += (cibleDetail - uniforms.detailOpacite.value) * kDetail;
      if (!cibleDetail && uniforms.detailOpacite.value < 0.002) {
        uniforms.detailOpacite.value = 0;
        uniforms.detailActif.value = 0;
        libereTextureDetail();
      }
    },
  };
}
