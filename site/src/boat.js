// Let It Be : une maquette 3D stable du vrai catamaran.
//
// La figurine est volontairement un peu plus grande que l'échelle du globe,
// mais elle reste une vraie miniature : sa taille ne dépend jamais de la
// caméra et son modèle ne se tourne jamais vers elle. Seul le conteneur suit
// la route, posé sur la tangente de l'océan.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RAYON } from './geo.js';

// Bahia 46 : 14,05 m × 7,38 m. Les proportions locales ci-dessous gardent
// ce rapport de largeur/longueur (≈ 0,53) pour que les deux coques se lisent
// aussi depuis le dessus.
const LONGUEUR_MODELE = 1.48;
const LARGEUR_MODELE = 0.80;
// Une taille monde fixe, volontairement assez généreuse pour que la coque
// reste lisible sur le globe complet d'un téléphone. Elle ne varie jamais
// avec la caméra.
// Smaller than the earlier figurine, but still deliberate at globe distance.
const ECHELLE_MODELE = 0.120;
// L'asset GLB importé est volontairement deux fois plus petit que la
// miniature procédurale de secours. Le facteur local laisse le root de route
// intact : son ancrage, son cap et la pose sur l'eau restent donc identiques.
const FACTEUR_ECHELLE_ASSET = 0.5;
const ECHELLE_ASSET = ECHELLE_MODELE * FACTEUR_ECHELLE_ASSET;
// La garde est mesurée depuis le point le plus bas de la vraie géométrie
// (contour compris), pas depuis l'origine du modèle. Cela conserve les deux
// coques posées sur l'océan si la silhouette évolue.
const GARDE_EAU = 0.00007;

// Le sillage accompagne le bateau sans jamais passer à travers lui.
const ECUME_N = 36;
const ECUME_FENETRE_MS = 7 * 86400e3;
const ECUME_DECALAGE_MS = 18 * 3600e3;

function creerEcume() {
  const positions = new Float32Array(ECUME_N * 3);
  const ages = new Float32Array(ECUME_N);
  for (let i = 0; i < ECUME_N; i++) ages[i] = (i + 1) / (ECUME_N + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('age', new THREE.BufferAttribute(ages, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      taille: { value: 8 * Math.min(devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */`
      uniform float taille;
      attribute float age;
      varying float vAge;
      void main() {
        vAge = age;
        gl_PointSize = taille * (1.0 - age * 0.62);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vAge;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.21, d) * (1.0 - vAge) * 0.70;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0, 1.0, 0.99), a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = 3;
  points.frustumCulled = false;
  return points;
}

function matierePeinte(couleur, {
  roughness = 0.72,
  metalness = 0,
} = {}) {
  // Les photos de Let It Be ont du volume, pas des aplats de pictogramme.
  // Ces matériaux restent mats et illustrés, mais la lumière du globe révèle
  // les ponts, vitrages et coques au lieu de tout écraser vu du dessus.
  return new THREE.MeshStandardMaterial({
    color: couleur,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
}

// Contour d'encre discret : il aide la maquette à se détacher du bleu sans
// transformer les deux coques en gros autocollants noirs.
const matEncre = new THREE.MeshBasicMaterial({ color: 0x5a4b3c, side: THREE.BackSide });
function avecContour(mesh, epaisseur = 0.008) {
  const geo = mesh.geometry.clone();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) + nor.getX(i) * epaisseur,
      pos.getY(i) + nor.getY(i) * epaisseur,
      pos.getZ(i) + nor.getZ(i) * epaisseur);
  }
  const contour = new THREE.Mesh(geo, matEncre);
  contour.position.copy(mesh.position);
  contour.rotation.copy(mesh.rotation);
  contour.scale.copy(mesh.scale);
  return contour;
}

function ajoute(modele, geometry, material, position, {
  scale,
  rotation,
  contour = 0.008,
  nom,
} = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.copy(position);
  if (scale) mesh.scale.copy(scale);
  if (rotation) mesh.rotation.copy(rotation);
  if (nom) mesh.name = nom;
  modele.add(mesh);
  let silhouette = null;
  if (contour > 0) {
    silhouette = avecContour(mesh, contour);
    if (nom) silhouette.name = `${nom}-silhouette`;
    modele.add(silhouette);
  }
  return { mesh, silhouette };
}

function tigeEntre(modele, a, b, rayon, materiau, contour = 0.003) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const longueur = direction.length();
  const tige = new THREE.Mesh(
    new THREE.CylinderGeometry(rayon, rayon, longueur, 6), materiau);
  tige.position.copy(a).add(b).multiplyScalar(0.5);
  tige.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  modele.add(tige);
  if (contour > 0) modele.add(avecContour(tige, contour));
}

function pointBasLocal(meshes) {
  const point = new THREE.Vector3();
  let bas = Infinity;
  for (const mesh of meshes) {
    if (!mesh) continue;
    mesh.updateMatrix();
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrix);
      bas = Math.min(bas, point.y);
    }
  }
  return bas;
}

// Coque Bahia simplifiée : une étrave effilée et légèrement relevée, un
// maître-bau long, puis un tableau arrière court. C'est une vraie forme de
// bateau plutôt que deux capsules identiques, tout en gardant les flotteurs
// séparés et lisibles dans la vue du globe.
function creerCoqueBahia() {
  const stations = [
    { z: 0.640, largeur: 0.050, bas: 0.066, chine: 0.112, epaule: 0.164, pont: 0.185 },
    { z: 0.500, largeur: 0.084, bas: 0.028, chine: 0.076, epaule: 0.145, pont: 0.175 },
    { z: 0.260, largeur: 0.108, bas: -0.003, chine: 0.054, epaule: 0.135, pont: 0.170 },
    { z: -0.200, largeur: 0.118, bas: -0.003, chine: 0.050, epaule: 0.132, pont: 0.167 },
    { z: -0.520, largeur: 0.112, bas: 0.010, chine: 0.055, epaule: 0.128, pont: 0.162 },
    { z: -0.690, largeur: 0.090, bas: 0.028, chine: 0.070, epaule: 0.118, pont: 0.152 },
  ];
  const positions = [];
  const indices = [];
  const COTES = 8;
  const ajouteAnneau = ({ z, largeur, bas, chine, epaule, pont }) => {
    const index = positions.length / 3;
    // Fond peu profond, bouchain marqué, épaule souple, petit plat de pont.
    positions.push(
      -largeur * 0.55, bas, z,
      largeur * 0.55, bas, z,
      largeur * 0.98, chine, z,
      largeur * 0.90, epaule, z,
      largeur * 0.68, pont, z,
      -largeur * 0.68, pont, z,
      -largeur * 0.90, epaule, z,
      -largeur * 0.98, chine, z,
    );
    return index;
  };
  const anneaux = stations.map(ajouteAnneau);
  const pointe = positions.length / 3;
  positions.push(0, 0.210, 0.765);
  const tableau = positions.length / 3;
  // Même plan Z que le dernier anneau : le tableau est une vraie face plate,
  // jamais un second nez arrondi.
  positions.push(0, 0.088, -0.700);

  for (let face = 0; face < COTES; face++) {
    const suivant = (face + 1) % COTES;
    indices.push(pointe, anneaux[0] + suivant, anneaux[0] + face);
  }
  for (let s = 0; s < anneaux.length - 1; s++) {
    for (let face = 0; face < COTES; face++) {
      const suivant = (face + 1) % COTES;
      const ici = anneaux[s];
      const apres = anneaux[s + 1];
      indices.push(ici + face, apres + face, apres + suivant);
      indices.push(ici + face, apres + suivant, ici + suivant);
    }
  }
  const dernier = anneaux.at(-1);
  for (let face = 0; face < COTES; face++) {
    const suivant = (face + 1) % COTES;
    indices.push(tableau, dernier + face, dernier + suivant);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function creerPontCentral() {
  // Nacelle basse : elle joint les coques derrière le trampoline, mais garde
  // une vraie lame d'eau visible entre les flotteurs.
  const sommets = [
    -0.205, 0.182, 0.220, 0.205, 0.182, 0.220,
    0.255, 0.185, -0.385, -0.255, 0.185, -0.385,
    -0.220, 0.250, 0.180, 0.220, 0.250, 0.180,
    0.275, 0.255, -0.350, -0.275, 0.255, -0.350,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
    4, 5, 6, 4, 6, 7,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function creerTrampolineAvant() {
  // La toile avant est une petite surface chaude et ajourée, pas une dalle
  // cyan. Elle rattache visuellement les deux étraves au vrai pont central.
  const sommets = [
    -0.205, 0.188, 0.210,
    0.205, 0.188, 0.210,
    0.130, 0.188, 0.600,
    -0.130, 0.188, 0.600,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function creerSalonBalaye() {
  // Rouf bas et étiré : façade inclinée, sommet discret et arrière arrondi.
  const sommets = [
    -0.270, 0.252, 0.220, 0.270, 0.252, 0.220,
    0.278, 0.252, -0.305, -0.278, 0.252, -0.305,
    -0.215, 0.365, 0.105, 0.215, 0.365, 0.105,
    0.230, 0.385, -0.235, -0.230, 0.385, -0.235,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
    4, 5, 6, 4, 6, 7,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function creerBaieAvant(xBasGauche, xBasDroite, xHautGauche, xHautDroite) {
  const sommets = [
    xBasGauche, 0.282, 0.226,
    xBasDroite, 0.282, 0.226,
    xHautDroite, 0.350, 0.112,
    xHautGauche, 0.350, 0.112,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function creerBaieLaterale(cote) {
  const xBas = cote * 0.281;
  const xHaut = cote * 0.233;
  const sommets = [
    xBas, 0.284, -0.215,
    xBas, 0.284, 0.145,
    xHaut, 0.356, 0.074,
    xHaut, 0.372, -0.155,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function ajouteLiseretCoque(modele, cote, materiau, {
  exterieur = 0.400,
  hauteur = 0.137,
  rayon = 0.006,
} = {}) {
  const x = cote * exterieur;
  const courbe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x * 0.90, hauteur - 0.010, 0.60),
    new THREE.Vector3(x, hauteur, 0.28),
    new THREE.Vector3(x, hauteur, -0.30),
    new THREE.Vector3(x * 0.94, hauteur - 0.010, -0.62),
  ]);
  const liseret = new THREE.Mesh(
    new THREE.TubeGeometry(courbe, 18, rayon, 5, false), materiau);
  modele.add(liseret);
}

function ajoutePortLateral(modele, cote, z, y, vitre) {
  const x = cote * 0.405;
  ajoute(modele, new RoundedBoxGeometry(0.010, 0.030, 0.070, 3, 0.004), vitre,
    new THREE.Vector3(x, y, z), { contour: 0, nom: 'hublot-lateral' });
}

// The production boat uses a small surface builder rather than stacking
// capsules and boxes. The result is still intentionally lightweight, but its
// bridge, glasshouse, cockpit and hull trim read as one designed vessel.
class SurfaceBuilder {
  constructor() {
    this.positions = [];
    this.indices = [];
    this.groups = [];
  }

  quad(a, b, c, d, material = 0) {
    const start = this.positions.length / 3;
    for (const point of [a, b, c, d]) this.positions.push(point.x, point.y, point.z);
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    this.groups.push({ start: this.indices.length - 6, count: 6, material });
  }

  triangle(a, b, c, material = 0) {
    const start = this.positions.length / 3;
    for (const point of [a, b, c]) this.positions.push(point.x, point.y, point.z);
    this.indices.push(start, start + 1, start + 2);
    this.groups.push({ start: this.indices.length - 3, count: 3, material });
  }

  finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setIndex(this.indices);
    for (const group of this.groups) geometry.addGroup(group.start, group.count, group.material);
    geometry.computeVertexNormals();
    return geometry;
  }
}

const point = (x, y, z) => new THREE.Vector3(x, y, z);

function addTaperedVolume(builder, bottomFront, bottomRear, topFront, topRear, material) {
  const [frontLeft, frontRight] = bottomFront;
  const [rearRight, rearLeft] = bottomRear;
  const [topFrontLeft, topFrontRight] = topFront;
  const [topRearRight, topRearLeft] = topRear;
  builder.quad(frontLeft, rearLeft, rearRight, frontRight, material);
  builder.quad(frontLeft, frontRight, topFrontRight, topFrontLeft, material);
  builder.quad(frontRight, rearRight, topRearRight, topFrontRight, material);
  builder.quad(rearRight, rearLeft, topRearLeft, topRearRight, material);
  builder.quad(rearLeft, frontLeft, topFrontLeft, topRearLeft, material);
  builder.quad(topFrontLeft, topFrontRight, topRearRight, topRearLeft, material);
}

function addSalonLoft(builder, material) {
  // Five low, rounded greenhouse sections. This makes the cabin a swept
  // saloon with a crown, rather than a rectangular house on the deck.
  const stations = [
    { z: 0.205, half: 0.235, base: 0.252, side: 0.292, shoulder: 0.342, roof: 0.380 },
    { z: 0.090, half: 0.264, base: 0.252, side: 0.300, shoulder: 0.360, roof: 0.408 },
    { z: -0.105, half: 0.278, base: 0.252, side: 0.302, shoulder: 0.368, roof: 0.425 },
    { z: -0.255, half: 0.258, base: 0.252, side: 0.298, shoulder: 0.352, roof: 0.402 },
    { z: -0.320, half: 0.226, base: 0.252, side: 0.286, shoulder: 0.330, roof: 0.372 },
  ];
  const rings = stations.map(({ z, half, base, side, shoulder, roof }) => [
    point(-half * 0.88, base, z),
    point(half * 0.88, base, z),
    point(half, side, z),
    point(half * 0.82, shoulder, z),
    point(half * 0.42, roof, z),
    point(-half * 0.42, roof, z),
    point(-half * 0.82, shoulder, z),
    point(-half, side, z),
  ]);
  for (let station = 0; station < rings.length - 1; station++) {
    for (let edge = 0; edge < 8; edge++) {
      const next = (edge + 1) % 8;
      builder.quad(rings[station][edge], rings[station + 1][edge],
        rings[station + 1][next], rings[station][next], material);
    }
  }
  for (let edge = 1; edge < 7; edge++) {
    builder.triangle(rings[0][0], rings[0][edge], rings[0][edge + 1], material);
    builder.triangle(rings.at(-1)[0], rings.at(-1)[edge + 1], rings.at(-1)[edge], material);
  }
}

function addHullRibbon(builder, side, y, halfHeight, material) {
  const path = [
    point(side * 0.335, y - 0.010, 0.580),
    point(side * 0.392, y, 0.280),
    point(side * 0.402, y, -0.240),
    point(side * 0.385, y - 0.008, -0.610),
  ];
  for (let segment = 0; segment < path.length - 1; segment++) {
    const a = path[segment];
    const b = path[segment + 1];
    builder.quad(
      point(a.x, a.y - halfHeight, a.z), point(b.x, b.y - halfHeight, b.z),
      point(b.x, b.y + halfHeight, b.z), point(a.x, a.y + halfHeight, a.z), material);
  }
}

function creerSuperstructureBahia() {
  // Material indices are supplied by creerBateau: ivory, glass, cockpit,
  // red canvas, mast metal, net, and the navy waterline.
  const IVOIRE = 0;
  const VITRE = 1;
  const COCKPIT = 2;
  const ROUGE = 3;
  const FILET = 5;
  const LIGNE_EAU = 6;
  const builder = new SurfaceBuilder();

  // A broad low nacelle begins behind the trampoline. It intentionally leaves
  // the front opening between the two bows visible.
  addTaperedVolume(builder,
    [point(-0.205, 0.178, 0.220), point(0.205, 0.178, 0.220)],
    [point(0.270, 0.182, -0.490), point(-0.270, 0.182, -0.490)],
    [point(-0.222, 0.252, 0.170), point(0.222, 0.252, 0.170)],
    [point(0.278, 0.257, -0.455), point(-0.278, 0.257, -0.455)], IVOIRE);

  // Warm, transparent forward trampoline. It is a net, never an opaque wing.
  builder.quad(point(-0.200, 0.186, 0.205), point(0.200, 0.186, 0.205),
    point(0.125, 0.188, 0.625), point(-0.125, 0.188, 0.625), FILET);

  addSalonLoft(builder, IVOIRE);

  // One large wraparound glazing belt makes the cabin immediately legible at
  // map scale. The small offsets prevent depth fighting with the white shell.
  builder.quad(point(-0.212, 0.278, 0.212), point(0.212, 0.278, 0.212),
    point(0.172, 0.352, 0.105), point(-0.172, 0.352, 0.105), VITRE);
  for (const side of [-1, 1]) {
    const offset = side * 0.004;
    builder.quad(
      point(side * 0.269 + offset, 0.282, 0.145),
      point(side * 0.282 + offset, 0.282, -0.228),
      point(side * 0.218 + offset, 0.360, -0.238),
      point(side * 0.206 + offset, 0.358, 0.070), VITRE);
  }

  // Recessed cockpit and a small, gently arched canvas bimini at the stern.
  builder.quad(point(-0.205, 0.260, -0.295), point(0.205, 0.260, -0.295),
    point(0.225, 0.260, -0.570), point(-0.225, 0.260, -0.570), COCKPIT);
  const bimini = {
    frontLeft: point(-0.165, 0.414, -0.305), frontRight: point(0.165, 0.414, -0.305),
    rearRight: point(0.220, 0.416, -0.555), rearLeft: point(-0.220, 0.416, -0.555),
    frontCenter: point(0, 0.438, -0.305), rearCenter: point(0, 0.440, -0.555),
  };
  builder.quad(bimini.frontLeft, bimini.frontCenter, bimini.rearCenter, bimini.rearLeft, ROUGE);
  builder.quad(bimini.frontCenter, bimini.frontRight, bimini.rearRight, bimini.rearCenter, ROUGE);

  // Paint, not tubes: the signature red and navy stripes hug the outer hull
  // surfaces all the way from the raised bow to the short transom.
  for (const side of [-1, 1]) {
    addHullRibbon(builder, side, 0.135, 0.0065, ROUGE);
    addHullRibbon(builder, side, 0.068, 0.0035, LIGNE_EAU);
    const x = side * 0.405;
    for (const z of [0.035, -0.275]) {
      builder.quad(point(x, 0.094, z - 0.026), point(x, 0.094, z + 0.026),
        point(x, 0.122, z + 0.026), point(x, 0.122, z - 0.026), VITRE);
    }
  }
  return builder.finish();
}

function creerBateauProcedural() {
  const modele = new THREE.Group();
  modele.name = 'let-it-be-catamaran';
  modele.scale.setScalar(ECHELLE_MODELE);

  const blanc = matierePeinte(0xf4f0e7, { roughness: 0.50 });
  const blancCoque = matierePeinte(0xf6f0e5, { roughness: 0.46 });
  // Les longs panneaux du gelcoat restent lisses dans le sens de la coque,
  // mais leurs bouchains doivent être lisibles : pas de tube ovale brillant.
  const creme = matierePeinte(0xfff8ea, { roughness: 0.62 });
  const rouge = matierePeinte(0xb83e33, { roughness: 0.68 });
  const gris = matierePeinte(0x7e8a88, { roughness: 0.36, metalness: 0.42 });
  const vitre = matierePeinte(0x244e5b, { roughness: 0.18, metalness: 0.20 });
  const cockpit = matierePeinte(0x385b61, { roughness: 0.42, metalness: 0.08 });
  const ligneEau = matierePeinte(0x2c414a, { roughness: 0.64 });
  const filet = new THREE.MeshStandardMaterial({
    color: 0xd8ccbc,
    roughness: 0.88,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // — Les deux flotteurs —
  // Leur silhouette basse est mesurée après création : le conteneur peut donc
  // être posé à une hauteur fixe au-dessus de l'océan, sans varier avec le zoom.
  const geoCoque = creerCoqueBahia();
  const flotteurs = [];
  for (const cote of [-1, 1]) {
    const coque = ajoute(modele, geoCoque, blancCoque,
      new THREE.Vector3(cote * 0.285, 0, 0), {
      contour: 0,
      nom: cote < 0 ? 'coque-babord' : 'coque-tribord',
    });
    flotteurs.push(coque.mesh);
  }
  const coqueBasLocale = pointBasLocal(flotteurs);
  const rayonAncrage = RAYON + GARDE_EAU - coqueBasLocale * ECHELLE_MODELE;

  // — Pont ouvert et salon —
  // Deux traverses portent le salon tout en laissant le vrai vide de
  // trampoline ouvert entre les étraves. À cette échelle, un faux quadrillage
  // lisait comme une aile : l'espace entre les coques est plus honnête.
  ajoute(modele, creerSuperstructureBahia(),
    [creme, vitre, cockpit, rouge, gris, filet, ligneEau], null,
    { contour: 0, nom: 'superstructure-bahia' });
  // Baie panoramique continue : c'est la ligne sombre qui fait lire le rouf
  // comme un catamaran de croisière plutôt qu'une petite cabine posée dessus.

  // — Cockpit et bimini rouge, courts et bas comme sur les photos —
  for (const cote of [-1, 1]) {
    tigeEntre(modele,
      new THREE.Vector3(cote * 0.205, 0.270, -0.515),
      new THREE.Vector3(cote * 0.212, 0.414, -0.525), 0.0038, gris, 0);
    tigeEntre(modele,
      new THREE.Vector3(cote * 0.188, 0.270, -0.325),
      new THREE.Vector3(cote * 0.158, 0.414, -0.325), 0.0038, gris, 0);
  }

  // — Gréement calme au mouillage —
  // Un mât fin suffit. La voile roulée, le fanion, la bôme rouge et les
  // haubans diagonaux formaient une silhouette de drone au gros plan.
  ajoute(modele, new THREE.CylinderGeometry(0.014, 0.018, 1.12, 8), gris,
    new THREE.Vector3(0, 0.830, -0.020), { contour: 0, nom: 'mat' });
  // Grand-voile rangée : un court rouleau crème sur une bôme rouge. Cette
  // ligne directionnelle reste lisible de loin sans fabriquer un avion.
  ajoute(modele, new THREE.CylinderGeometry(0.015, 0.015, 0.670, 8), creme,
    new THREE.Vector3(0, 0.438, -0.305), {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0), contour: 0, nom: 'voile-furlee',
    });
  ajoute(modele, new THREE.CylinderGeometry(0.019, 0.019, 0.410, 8), rouge,
    new THREE.Vector3(0, 0.438, -0.405), {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0), contour: 0, nom: 'bome-rouge',
    });
  ajoute(modele, new THREE.SphereGeometry(0.016, 8, 6), rouge,
    new THREE.Vector3(0, 1.410, -0.020), { contour: 0, nom: 'pommeau-mat' });

  const conteneur = new THREE.Group();
  conteneur.name = 'let-it-be-route-root';
  conteneur.add(modele);
  const ecume = creerEcume();

  const haut = new THREE.Vector3();
  const avant = new THREE.Vector3();
  const droite = new THREE.Vector3();
  const matrice = new THREE.Matrix4();
  // Le cap exact de la route, et celui que la maquette montre. Ils ne
  // diffèrent que pendant la lecture animée, le temps d'un virage.
  const quaternionRoute = new THREE.Quaternion();
  const capAffiche = new THREE.Vector3(0, 0, 1);
  const hautAffiche = new THREE.Vector3(0, 1, 0);
  const droiteAffichee = new THREE.Vector3();
  let capInitialise = false;
  const perle = new THREE.Vector3();
  const travers = new THREE.Vector3();
  const hautEcume = new THREE.Vector3();
  const tribordRapporte = new THREE.Vector3();
  const capRapporte = new THREE.Vector3();
  const hautRapporte = new THREE.Vector3();
  function capDeRoute(voyage, t, position) {
    haut.copy(position).normalize();
    avant.copy(voyage.tangent(t, rayonAncrage));
  }

  function metAJourEcume(voyage, t) {
    const positions = ecume.geometry.attributes.position;
    travers.crossVectors(haut, avant).normalize();
    for (let i = 0; i < ECUME_N; i++) {
      const age = (i + 1) / (ECUME_N + 2);
      perle.copy(voyage.position(
        t - ECUME_DECALAGE_MS - age * ECUME_FENETRE_MS,
        RAYON * 1.0007));
      hautEcume.copy(perle).normalize();
      const bord = (i % 2) * 2 - 1;
      perle.addScaledVector(travers,
        bord * (0.0015 + age * 0.010) * (1 + 0.18 * Math.sin(i * 12.9898)));
      perle.addScaledVector(hautEcume, 0.0008);
      positions.setXYZ(i, perle.x, perle.y, perle.z);
    }
    positions.needsUpdate = true;
  }

  function positionne(voyage, t) {
    const position = voyage.position(t, rayonAncrage);
    conteneur.position.copy(position);
    capDeRoute(voyage, t, position);

    // Base orthonormée droite : x = haut × avant, y = haut, z = avant.
    // L'ancienne base utilisait avant × haut et créait une réflexion, donc un
    // quaternion déformant. Ici la maquette garde exactement sa géométrie.
    droite.crossVectors(haut, avant).normalize();
    matrice.makeBasis(droite, haut, avant);
    quaternionRoute.setFromRotationMatrix(matrice);
    conteneur.quaternion.copy(quaternionRoute);
    hautAffiche.copy(haut);
    if (!capInitialise) {
      capAffiche.copy(avant);
      capInitialise = true;
    }

    metAJourEcume(voyage, t);
  }

  // Tourne `cap` vers `cible` autour de `axe`, d'une fraction de l'écart et
  // jamais plus vite que `maxi` radians : un demi-tour reste un virage lisible.
  function tourneVers(cap, cible, axe, fraction, maxi) {
    cap.addScaledVector(axe, -cap.dot(axe));
    if (cap.lengthSq() < 1e-10) cap.copy(cible);
    cap.normalize();
    const sinus = droiteAffichee.crossVectors(cap, cible).dot(axe);
    const angle = Math.atan2(sinus, THREE.MathUtils.clamp(cap.dot(cible), -1, 1));
    const pas = THREE.MathUtils.clamp(angle * fraction, -maxi, maxi);
    cap.applyAxisAngle(axe, pas).normalize();
  }

  function anime(temps = 0, _camera = null, {
    dt = 0,
    houle = 0,
    lissageCap = 0,
  } = {}) {
    // Jamais d'échelle caméra ni de rotation vers la caméra : la route reste
    // l'unique source d'orientation. Deux exceptions, réservées à la lecture
    // animée (« Larguer les amarres ») et absentes en mouvement réduit :
    // - le cap montré rejoint celui de la route en un virage, au lieu de
    //   pivoter d'un coup aux escales ;
    // - une houle très lente (moins de deux degrés) fait vivre la coque.
    // Hors lecture, la maquette reprend exactement le cap de route, sans
    // aucune rotation locale.
    if (lissageCap > 0 && dt > 0) {
      tourneVers(capAffiche, avant, hautAffiche,
        1 - Math.exp(-dt / lissageCap), dt * THREE.MathUtils.degToRad(100));
      droiteAffichee.crossVectors(hautAffiche, capAffiche).normalize();
      matrice.makeBasis(droiteAffichee, hautAffiche, capAffiche);
      conteneur.quaternion.setFromRotationMatrix(matrice);
    } else {
      capAffiche.copy(avant);
      conteneur.quaternion.copy(quaternionRoute);
    }
    const amplitude = THREE.MathUtils.clamp(houle, 0, 1);
    if (amplitude > 0) {
      // tangage et roulis déterministes, sur deux périodes sans multiple
      // commun : un mouvement de mer, jamais une oscillation mécanique.
      const tangage = THREE.MathUtils.degToRad(0.9)
        * (Math.sin(temps * 1.13) * 0.75 + Math.sin(temps * 0.47 + 1.7) * 0.25);
      const roulis = THREE.MathUtils.degToRad(1.4)
        * (Math.sin(temps * 0.83 + 0.6) * 0.7 + Math.sin(temps * 0.31 + 2.2) * 0.3);
      modele.rotation.set(tangage * amplitude, 0, roulis * amplitude);
    } else if (modele.rotation.x || modele.rotation.z) {
      modele.rotation.set(0, 0, 0);
    }
  }

  function regleVisibilite(affiche) {
    const visible = Boolean(affiche);
    // Le sillage est une scène séparée du modèle : les deux doivent toujours
    // disparaître et revenir ensemble pendant la plongée d'une escale.
    conteneur.visible = visible;
    ecume.visible = visible;
  }

  function etat() {
    tribordRapporte.set(1, 0, 0).applyQuaternion(conteneur.quaternion).normalize();
    capRapporte.set(0, 0, 1).applyQuaternion(conteneur.quaternion).normalize();
    hautRapporte.set(0, 1, 0).applyQuaternion(conteneur.quaternion).normalize();
    return {
      echelle: ECHELLE_MODELE,
      longueur: LONGUEUR_MODELE * ECHELLE_MODELE,
      largeur: LARGEUR_MODELE * ECHELLE_MODELE,
      surfaceEau: rayonAncrage / RAYON,
      ecartSurface: conteneur.position.length() - RAYON,
      coqueBasLocale,
      coqueBasMonde: conteneur.position.length() + coqueBasLocale * ECHELLE_MODELE,
      quaternionNorme: conteneur.quaternion.length(),
      tribord: { x: tribordRapporte.x, y: tribordRapporte.y, z: tribordRapporte.z },
      cap: { x: capRapporte.x, y: capRapporte.y, z: capRapporte.z },
      verticale: { x: hautRapporte.x, y: hautRapporte.y, z: hautRapporte.z },
      rotationLocale: { x: modele.rotation.x, y: modele.rotation.y, z: modele.rotation.z },
      visible: conteneur.visible,
      ecumeVisible: ecume.visible,
    };
  }

  return {
    conteneur, ecume, positionne, anime, regleVisibilite, etat,
    // le cap que montre la maquette (monde), pour la caméra de poursuite
    capAffiche: () => capAffiche,
  };
}

// Un contour d'encre à épaisseur constante à l'écran (coque inversée,
// extrudée dans l'espace de projection) : la maquette garde une silhouette
// nette, dans l'esprit cel-shading du Carnet, au lieu d'une tache blanche
// sur la mer claire. Il ne change ni sa forme ni sa pose.
const resolutionContour = { value: new THREE.Vector2(1, 1) };
function regleResolutionContour() {
  resolutionContour.value.set(Math.max(1, innerWidth), Math.max(1, innerHeight));
}
if (typeof addEventListener === 'function') {
  regleResolutionContour();
  addEventListener('resize', regleResolutionContour);
}
function matiereContourEcran(couleur = 0x4a3b2c, epaisseurPx = 1.6) {
  // Drawn before the boat (renderOrder) without writing depth: the opaque
  // model then covers the inside of this enlarged silhouette, so only its
  // outer rim of ink remains — no stray lines from the model's open panels.
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      couleur: { value: new THREE.Color(couleur) },
      epaisseur: { value: epaisseurPx },
      resolution: resolutionContour,
    },
    vertexShader: /* glsl */`
      uniform float epaisseur;
      uniform vec2 resolution;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 normaleVue = normalize(normalMatrix * normal);
        vec2 sens = normaleVue.xy;
        float l = length(sens);
        sens = l > 1e-4 ? sens / l : vec2(0.0);
        clip.xy += sens * epaisseur * 2.0 / resolution * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 couleur;
      void main() { gl_FragColor = vec4(couleur, 1.0); }`,
  });
}

// Une ombre douce sur l'eau sous la maquette : la figurine se pose sur la
// carte au lieu de flotter dessus.
function creerOmbreBateau(longueur, largeur, hauteurLocale) {
  const toile = document.createElement('canvas');
  toile.width = toile.height = 64;
  const ctx = toile.getContext('2d');
  const degrade = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  degrade.addColorStop(0, 'rgba(18, 52, 78, 0.42)');
  degrade.addColorStop(0.55, 'rgba(18, 52, 78, 0.22)');
  degrade.addColorStop(1, 'rgba(18, 52, 78, 0)');
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(toile);
  const ombre = new THREE.Mesh(
    new THREE.PlaneGeometry(largeur * 1.7, longueur * 1.3),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  ombre.name = 'ombre-let-it-be';
  ombre.rotation.x = -Math.PI / 2; // dans le plan de la mer (y = verticale)
  ombre.position.y = hauteurLocale;
  ombre.renderOrder = 2;
  return ombre;
}

// — La voilure de Let It Be —
// Sur la photo sous voile : une grande-voile blanche, haute et lattée, et un
// génois blanc qui recouvre un peu le mât. La maquette importée les montre
// ferlés (étui sur la bôme, génois enroulé sur l'étai) ; ces deux voiles
// hissées s'appuient exactement sur son gréement, mesuré dans le repère du
// modèle (x tribord, y haut, z étrave, unités de la maquette) :
// - mât : pied (z 0,058 ; y 0,14), tête (z 0,013 ; y 0,94) ;
// - bôme : de l'arrière du mât jusqu'à z -0,28, à y ≈ 0,19 ;
// - étai : du davier (z 0,307 ; y 0,073) vers le haut du mât.
// Les voiles sont bordées sous le vent, à bâbord (x négatif), avec un creux
// et un vrillage modestes : un bateau qui avance, pas une figurine.
const MAT_PIED = { y: 0.14, z: 0.058 };
const MAT_TETE = { y: 0.94, z: 0.013 };
const zMat = y => THREE.MathUtils.lerp(MAT_PIED.z, MAT_TETE.z,
  (y - MAT_PIED.y) / (MAT_TETE.y - MAT_PIED.y));
const zEtai = y => 0.307 - (y - 0.073) * 0.343;
const SOUS_LE_VENT = -1; // bâbord

function lisseSegment(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Toile procédurale : blanc cassé, lattes (grand-voile) ou coutures (génois)
// très discrètes, bordure de chute un peu plus dense. Une petite texture
// mipmappée : les lignes s'effacent d'elles-mêmes vues de loin.
function texturerVoile(lignes, { chute = true } = {}) {
  const toile = document.createElement('canvas');
  toile.width = 64;
  toile.height = 256;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(0, 0, 64, 256);
  // Un peu de modelé peint : l'ombre douce du creux derrière le guindant et
  // une bordure à peine plus chaude, pour que la toile ait du volume même
  // sous la lumière plate du carnet.
  const creux = ctx.createLinearGradient(0, 0, 64, 0);
  creux.addColorStop(0, 'rgba(206, 196, 178, 0.05)');
  creux.addColorStop(0.16, 'rgba(206, 196, 178, 0.42)');
  creux.addColorStop(0.42, 'rgba(206, 196, 178, 0.10)');
  creux.addColorStop(1, 'rgba(206, 196, 178, 0)');
  ctx.fillStyle = creux;
  ctx.fillRect(0, 0, 64, 256);
  const bordure = ctx.createLinearGradient(0, 256, 0, 200);
  bordure.addColorStop(0, 'rgba(200, 188, 166, 0.45)');
  bordure.addColorStop(1, 'rgba(200, 188, 166, 0)');
  ctx.fillStyle = bordure;
  ctx.fillRect(0, 200, 64, 56);
  if (chute) {
    const bord = ctx.createLinearGradient(52, 0, 64, 0);
    bord.addColorStop(0, 'rgba(214, 205, 188, 0)');
    bord.addColorStop(1, 'rgba(214, 205, 188, 0.75)');
    ctx.fillStyle = bord;
    ctx.fillRect(52, 0, 12, 256);
  }
  for (const { v, epaisseur = 2, couleur = 'rgba(176, 166, 148, 0.85)' } of lignes) {
    const y = (1 - v) * 256;
    ctx.fillStyle = couleur;
    ctx.fillRect(1, y - epaisseur / 2, 63, epaisseur);
  }
  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Une voile = une grille (u le long de la corde, guindant → chute ; v du
// pied à la tête). `section(v)` donne le point d'amure (guindant), le point
// de chute, le creux et le vrillage de cette hauteur.
function surfaceVoile(section, { colonnes = 10, rangees = 16 } = {}) {
  const positions = [];
  const contours = [];
  const uvs = [];
  const indices = [];
  const centre = new THREE.Vector3();
  const points = [];
  for (let j = 0; j <= rangees; j++) {
    const v = j / rangees;
    const { guindant, chute, creux, vrillage, creuxMax = 0.38 } = section(v);
    const corde = new THREE.Vector3().subVectors(chute, guindant);
    const longueur = corde.length();
    const sensCorde = corde.clone().normalize();
    // normale sous le vent, perpendiculaire à la corde dans le plan horizontal
    const sousLeVent = new THREE.Vector3(SOUS_LE_VENT, 0, 0);
    sousLeVent.addScaledVector(sensCorde, -sousLeVent.dot(sensCorde)).normalize();
    // vrillage : la section s'ouvre sous le vent en montant
    const cos = Math.cos(vrillage);
    const sin = Math.sin(vrillage);
    const cordeVrillee = sensCorde.clone().multiplyScalar(cos)
      .addScaledVector(sousLeVent, sin).multiplyScalar(longueur);
    const normaleVrillee = sousLeVent.clone().multiplyScalar(cos)
      .addScaledVector(sensCorde, -sin);
    for (let i = 0; i <= colonnes; i++) {
      const u = i / colonnes;
      // profil à creux maximal vers l'avant, comme une vraie voile
      const k = u < creuxMax
        ? Math.sin((u / creuxMax) * Math.PI / 2)
        : Math.cos(((u - creuxMax) / (1 - creuxMax)) * Math.PI / 2);
      const p = guindant.clone().addScaledVector(cordeVrillee, u)
        .addScaledVector(normaleVrillee, creux * longueur * k);
      points.push(p);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      centre.add(p);
    }
  }
  centre.divideScalar(points.length);
  // Contour d'encre : chaque sommet s'écarte du centre de la voile, dans
  // son plan. Le shader de contour élargit ainsi la silhouette à l'écran.
  for (const p of points) {
    const dehors = p.clone().sub(centre).normalize();
    contours.push(dehors.x, dehors.y, dehors.z);
  }
  const largeur = colonnes + 1;
  for (let j = 0; j < rangees; j++) {
    for (let i = 0; i < colonnes; i++) {
      const a = j * largeur + i;
      indices.push(a, a + 1, a + largeur, a + 1, a + largeur + 1, a + largeur);
    }
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometrie.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometrie.setIndex(indices);
  geometrie.computeVertexNormals();
  const silhouette = new THREE.BufferGeometry();
  silhouette.setAttribute('position', geometrie.getAttribute('position'));
  silhouette.setAttribute('normal', new THREE.Float32BufferAttribute(contours, 3));
  silhouette.setIndex(indices);
  return { geometrie, silhouette };
}

function sectionGrandVoile(v) {
  // Guindant le long de l'arrière du mât, du dessus de l'étui de bôme à la
  // tête ; chute tendue par les lattes (rond de chute), petite têtière.
  const yPied = 0.196;
  const yTete = 0.915;
  const y = THREE.MathUtils.lerp(yPied, yTete, v);
  const guindant = new THREE.Vector3(0, y, zMat(y) - 0.016);
  const pointeEcoute = new THREE.Vector3(0, 0.190, -0.272);
  const tetiere = new THREE.Vector3(0, yTete, zMat(yTete) - 0.016 - 0.032);
  const chute = pointeEcoute.clone().lerp(tetiere, v);
  chute.z -= 0.030 * Math.sin(Math.PI * Math.min(1, v * 1.05)) * (1 - 0.2 * v);
  return {
    guindant,
    chute,
    // la bordure suit la bôme : pas de creux tout en bas
    creux: 0.10 * lisseSegment(0, 0.22, v) * (1 - 0.3 * v),
    vrillage: THREE.MathUtils.degToRad(11) * Math.pow(v, 1.3),
    creuxMax: 0.42,
  };
}

function sectionGenois(v) {
  // Guindant sur l'étai (avec un léger creux d'étai), point d'écoute bordé
  // sous le vent près du rouf, en recouvrement léger du mât, comme sur la
  // photo. La tête s'arrête un peu sous le capelage.
  const amure = new THREE.Vector3(0, 0.082, zEtai(0.082));
  const tete = new THREE.Vector3(0, 0.845, zEtai(0.845));
  const guindant = amure.clone().lerp(tete, v);
  guindant.x += SOUS_LE_VENT * 0.006 * Math.sin(Math.PI * v);
  const ecoute = new THREE.Vector3(SOUS_LE_VENT * 0.078, 0.176, -0.052);
  const chute = ecoute.clone().lerp(tete, v);
  // chute légèrement creuse : un génois n'a pas de lattes
  const versAvant = new THREE.Vector3().subVectors(guindant, chute);
  chute.addScaledVector(versAvant, 0.04 * Math.sin(Math.PI * v));
  return {
    guindant,
    chute,
    creux: 0.125 * lisseSegment(0, 0.12, v) * (1 - 0.25 * v),
    vrillage: THREE.MathUtils.degToRad(9) * v,
    creuxMax: 0.36,
  };
}

function creerVoilure() {
  const voilure = new THREE.Group();
  voilure.name = 'voilure-let-it-be';
  const textureGV = texturerVoile([1, 2, 3, 4, 5, 6].map(k => ({ v: k / 7 })));
  const textureGenois = texturerVoile([
    { v: 0.36, epaisseur: 1.5, couleur: 'rgba(190, 181, 164, 0.7)' },
    { v: 0.70, epaisseur: 1.5, couleur: 'rgba(190, 181, 164, 0.55)' },
  ]);
  const materiaux = [];
  const ajouteVoile = (nom, section, texture) => {
    const { geometrie, silhouette } = surfaceVoile(section);
    const matiere = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.16,
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    materiaux.push(matiere);
    const voile = new THREE.Mesh(geometrie, matiere);
    voile.name = nom;
    voile.renderOrder = 2;
    const contour = new THREE.Mesh(silhouette, matiereContourEcran(0x4a3b2c, 1.4));
    contour.name = `${nom}-contour`;
    contour.userData.contour = true;
    contour.renderOrder = 1;
    voilure.add(contour, voile);
  };
  ajouteVoile('grand-voile', sectionGrandVoile, textureGV);
  ajouteVoile('genois', sectionGenois, textureGenois);
  return {
    voilure,
    regleMode(mode) {
      // le carnet est déjà très clair ; la nuit du globe réaliste l'est moins
      for (const matiere of materiaux) matiere.emissiveIntensity = mode === 'carnet' ? 0.08 : 0.2;
    },
  };
}

// Voiles hissées, la maquette importée ne peut plus montrer son génois
// enroulé sur l'étai ni sa balancine tendue (détendue en navigation) : ces
// deux traits rouges barraient les voiles. Leurs triangles sont retirés, et
// l'étui de bôme prend le bleu marine de la photo sous voile. Rien d'autre ne
// change : ni la coque, ni le mât, ni l'échelle.
function distanceAuSegment(p, a, b, tMin, tMax) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz)
    / (abx * abx + aby * aby + abz * abz);
  if (t < tMin || t > tMax) return Infinity;
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t);
}
const ETAI_BAS = new THREE.Vector3(0, 0.073, 0.307);
const ETAI_HAUT = new THREE.Vector3(0, 0.910, 0.020);
const BALANCINE_HAUT = new THREE.Vector3(0, 0.935, 0.012);
const BALANCINE_BAS = new THREE.Vector3(0, 0.198, -0.283);
const dansGenoisRoule = p => p.y > 0.115 && p.y < 0.765
  && distanceAuSegment(p, ETAI_BAS, ETAI_HAUT, 0, 1) < 0.017;
const dansBalancine = p => distanceAuSegment(p, BALANCINE_HAUT, BALANCINE_BAS, 0.06, 0.955) < 0.016;
const dansEtuiDeBome = p => p.y > 0.153 && p.y < 0.222
  && p.z > -0.300 && p.z < 0.066 && Math.abs(p.x) < 0.034;

function ajusteGreementHisse(modele) {
  modele.updateWorldMatrix(true, true);
  const inverse = modele.matrixWorld.clone().invert();
  const relatif = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const etui = new THREE.MeshStandardMaterial({ color: 0x23304a, roughness: 0.82 });
  let retires = 0;
  let marine = 0;
  modele.traverse(mesh => {
    const index = mesh.isMesh && !mesh.userData.contour && !Array.isArray(mesh.material)
      ? mesh.geometry.index : null;
    if (!index) return;
    relatif.multiplyMatrices(inverse, mesh.matrixWorld);
    const positions = mesh.geometry.getAttribute('position');
    const local = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(relatif);
      local[i * 3] = point.x;
      local[i * 3 + 1] = point.y;
      local[i * 3 + 2] = point.z;
    }
    const sommet = (i, cible) => cible.set(local[i * 3], local[i * 3 + 1], local[i * 3 + 2]);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const tous = (test) => test(a) && test(b) && test(c);
    const gardes = [];
    const etuis = [];
    for (let k = 0; k < index.count; k += 3) {
      const i0 = index.getX(k), i1 = index.getX(k + 1), i2 = index.getX(k + 2);
      sommet(i0, a); sommet(i1, b); sommet(i2, c);
      if (tous(dansGenoisRoule) || tous(dansBalancine)) {
        retires++;
        continue;
      }
      (tous(dansEtuiDeBome) ? etuis : gardes).push(i0, i1, i2);
    }
    if (!retires && !etuis.length) return;
    marine += etuis.length / 3;
    const tableau = positions.count > 65535 ? Uint32Array : Uint16Array;
    mesh.geometry.setIndex(new THREE.BufferAttribute(tableau.from([...gardes, ...etuis]), 1));
    mesh.geometry.clearGroups();
    mesh.geometry.addGroup(0, gardes.length, 0);
    if (etuis.length) {
      mesh.geometry.addGroup(gardes.length, etuis.length, 1);
      mesh.material = [mesh.material, etui];
    }
  });
  return { retires, marine };
}

// The supplied GLB is a coherent, textured catamaran rather than a collection
// of placeholder primitives. Keep it inside the calibrated route root above:
// only that root changes heading, never the asset itself or its scale.
const LONGUEUR_ASSET = 1.29886359;
const LARGEUR_ASSET = 0.63347614;
const DECALAGE_EAU_ASSET = 0.002;

function pointBasRelatif(racine) {
  racine.updateWorldMatrix(true, true);
  const inverseRacine = racine.matrixWorld.clone().invert();
  const relatif = new THREE.Matrix4();
  const point = new THREE.Vector3();
  let bas = Infinity;
  racine.traverse(enfant => {
    const positions = enfant.isMesh && enfant.geometry?.getAttribute('position');
    if (!positions) return;
    enfant.updateWorldMatrix(true, false);
    relatif.multiplyMatrices(inverseRacine, enfant.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(relatif);
      bas = Math.min(bas, point.y);
    }
  });
  return bas;
}

async function chargeMaquetteCatamaran() {
  const url = `${import.meta.env.BASE_URL}models/let-it-be-catamaran.glb`;
  // The asset ships meshopt-compressed with WebP textures (1.3 MB instead of
  // 9.6 MB): same geometry and look, a fraction of the first-load weight.
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const maquette = gltf.scene;
  maquette.name = 'let-it-be-catamaran-asset';
  // Le modèle importé, et lui seul, passe exactement à la moitié de sa taille
  // précédente. Les mesures de coque plus bas incluent déjà cette échelle.
  maquette.scale.setScalar(FACTEUR_ECHELLE_ASSET);
  const materiauxEclaires = new Set();

  // Recentre l'empreinte horizontale et pose le minimum mesurÃ© juste sous
  // l'axe local. Le calcul de l'ancrage du conteneur conserve alors les deux
  // coques exactement sur l'ocÃ©an sans dÃ©pendre de la camÃ©ra.
  const boite = new THREE.Box3().setFromObject(maquette);
  const centre = boite.getCenter(new THREE.Vector3());
  maquette.position.x -= centre.x;
  maquette.position.z -= centre.z;
  maquette.position.y -= boite.min.y + DECALAGE_EAU_ASSET;

  const contours = [];
  maquette.traverse(enfant => {
    if (!enfant.isMesh || enfant.userData.contour) return;
    contours.push(enfant);
  });
  for (const mesh of contours) {
    const contour = new THREE.Mesh(mesh.geometry, matiereContourEcran());
    contour.userData.contour = true;
    contour.name = `${mesh.name || 'coque'}-contour`;
    contour.position.copy(mesh.position);
    contour.quaternion.copy(mesh.quaternion);
    contour.scale.copy(mesh.scale);
    contour.renderOrder = 1; // after the globe, before the boat itself
    mesh.renderOrder = 2;
    mesh.parent.add(contour);
  }

  maquette.traverse(enfant => {
    if (!enfant.isMesh || enfant.userData.contour) return;
    enfant.castShadow = false;
    enfant.receiveShadow = false;
    enfant.frustumCulled = true;
    const materiaux = Array.isArray(enfant.material) ? enfant.material : [enfant.material];
    for (const materiau of materiaux) {
      if (!materiau?.isMeshStandardMaterial) continue;
      // The source was authored for an HDR-lit viewer. A small emissive copy
      // of its own albedo keeps the textured hull, glazing and red canvas
      // legible on the globe's shaded side without changing its palette.
      if (materiau.map) {
        materiau.emissiveMap = materiau.map;
        materiau.emissive.set(0xffffff);
        materiau.needsUpdate = true;
        materiauxEclaires.add(materiau);
      }
    }
  });
  return {
    maquette,
    regleMode(mode) {
      // Leave enough shade for the hull's modeled volume to read; the local
      // key lights provide the highlight, while this only protects texture
      // detail on the far side.
      const intensite = mode === 'carnet' ? 0.035 : 0.072;
      for (const materiau of materiauxEclaires) materiau.emissiveIntensity = intensite;
    },
  };
}

export async function creerBateau() {
  // The route and wake choreography has already been proven across the whole
  // itinerary. Reuse that stable root and replace only its visual child.
  const bateau = creerBateauProcedural();
  try {
    const { maquette, regleMode } = await chargeMaquetteCatamaran();
    const modele = bateau.conteneur.getObjectByName('let-it-be-catamaran');
    modele.clear();
    modele.add(maquette);

    // This compact rig travels with the vessel, not the camera. It gives the
    // imported PBR model a readable bow, saloon and rig while its short range
    // keeps the globe, sky and clouds on their existing lighting.
    const lumierePrincipale = new THREE.PointLight(0xffecd1, 3.1, 0.68, 2);
    lumierePrincipale.position.set(-0.16, 0.28, 0.18);
    const lumiereContour = new THREE.PointLight(0xc9e9ff, 0.72, 0.46, 2);
    lumiereContour.position.set(0.15, 0.14, -0.17);
    bateau.conteneur.add(lumierePrincipale, lumiereContour);

    const coqueBasLocale = pointBasRelatif(modele);
    const rayonAncrage = RAYON + GARDE_EAU - coqueBasLocale * ECHELLE_MODELE;
    // Les voiles hissées, posées sur le gréement de la maquette (après la
    // mesure des coques : elles ne changent rien à la ligne de flottaison).
    const greement = ajusteGreementHisse(modele);
    const voilure = creerVoilure();
    modele.add(voilure.voilure);
    // just under the hulls, on the water
    bateau.conteneur.add(creerOmbreBateau(
      LONGUEUR_ASSET * ECHELLE_ASSET, LARGEUR_ASSET * ECHELLE_ASSET,
      coqueBasLocale * ECHELLE_MODELE - GARDE_EAU * 0.5));
    const positionneProcedural = bateau.positionne;
    const etatProcedural = bateau.etat;

    bateau.positionne = (voyage, t) => {
      positionneProcedural(voyage, t);
      // The heading quaternion remains the same tangent basis; only the exact
      // radial waterline differs now that the asset's real hulls are measured.
      bateau.conteneur.position.copy(voyage.position(t, rayonAncrage));
    };
    bateau.etat = () => ({
      ...etatProcedural(),
      echelle: ECHELLE_ASSET,
      facteurEchelleAsset: FACTEUR_ECHELLE_ASSET,
      longueur: LONGUEUR_ASSET * ECHELLE_ASSET,
      largeur: LARGEUR_ASSET * ECHELLE_ASSET,
      surfaceEau: rayonAncrage / RAYON,
      ecartSurface: bateau.conteneur.position.length() - RAYON,
      coqueBasLocale,
      coqueBasMonde: bateau.conteneur.position.length()
        + coqueBasLocale * ECHELLE_MODELE,
      maquette: 'gltf',
      greement,
    });
    bateau.regleMode = mode => {
      regleMode(mode);
      voilure.regleMode(mode);
      lumierePrincipale.intensity = mode === 'carnet' ? 3.1 : 2.35;
      lumiereContour.intensity = mode === 'carnet' ? 0.72 : 0.55;
    };
    return bateau;
  } catch (erreur) {
    // Do not strand the itinerary on a transient asset fetch failure. The
    // replacement stays local and retriable; the original stable miniature is
    // a temporary visual fallback, never a second moving boat.
    console.warn('Maquette du catamaran indisponible; miniature de secours utilisÃ©e.', erreur);
    return bateau;
  }
}
