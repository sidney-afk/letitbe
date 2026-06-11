// Let It Be en miniature mignonne : catamaran toon (deux coques blanches
// dodues à liseré rouge, trampoline, voiles crème bien rondes, fanion rouge),
// dans l'esprit cartoon du mode Carnet. Pas de gîte — c'est un cata.
// Échelle volontairement exagérée pour rester visible à l'échelle du globe.

import * as THREE from 'three';
import { RAYON } from './geo.js';

function matiereToon(couleur) {
  const degrade = new Uint8Array([150, 205, 255]);
  const gradientMap = new THREE.DataTexture(degrade, 3, 1, THREE.RedFormat);
  gradientMap.needsUpdate = true;
  return new THREE.MeshToonMaterial({
    color: couleur,
    gradientMap,
    side: THREE.DoubleSide,
  });
}

export function creerBateau() {
  const bateau = new THREE.Group();

  const blanc = matiereToon(0xffffff);
  const rouge = matiereToon(0xd64533);
  const creme = matiereToon(0xfff8e8);
  const bois = matiereToon(0xc89a62);

  // coques dodues (axe Z = avant)
  const geoCoque = new THREE.CapsuleGeometry(0.105, 0.56, 6, 12);
  geoCoque.rotateX(Math.PI / 2);
  for (const cote of [-1, 1]) {
    const coque = new THREE.Mesh(geoCoque, blanc);
    coque.position.set(cote * 0.27, 0.05, 0);
    coque.scale.y = 0.78;
    bateau.add(coque);

    const liseret = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.6, 4, 8), rouge);
    liseret.geometry = liseret.geometry.clone();
    liseret.rotation.x = Math.PI / 2;
    liseret.position.set(cote * 0.355, 0.09, 0);
    liseret.scale.set(1, 1, 0.6);
    bateau.add(liseret);
  }

  // nacelle ronde et rouf joufflu
  const pont = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.5), blanc);
  pont.position.set(0, 0.13, -0.02);
  bateau.add(pont);
  const rouf = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 14, 10), blanc);
  rouf.position.set(0, 0.16, -0.06);
  rouf.scale.set(1.05, 0.62, 0.95);
  bateau.add(rouf);

  // gréement
  const mat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.02, 1.05, 8), bois);
  mat.position.set(0, 0.65, 0.02);
  bateau.add(mat);

  // voiles : des triangles légèrement bombés (vertex du milieu poussé)
  const grandVoile = new THREE.Mesh(voileBombee(
    new THREE.Vector3(0, 0.16, 0.0),
    new THREE.Vector3(0, 1.14, 0.02),
    new THREE.Vector3(0, 0.18, -0.56),
    0.07,
  ), creme);
  bateau.add(grandVoile);

  const genois = new THREE.Mesh(voileBombee(
    new THREE.Vector3(0, 0.14, 0.62),
    new THREE.Vector3(0, 1.06, 0.04),
    new THREE.Vector3(0, 0.14, 0.06),
    -0.06,
  ), creme);
  bateau.add(genois);

  // le fanion rouge en tête de mât
  const fanion = new THREE.Mesh(voileBombee(
    new THREE.Vector3(0, 1.17, 0.02),
    new THREE.Vector3(0, 1.10, 0.02),
    new THREE.Vector3(0, 1.135, -0.16),
    0.02,
  ), rouge);
  bateau.add(fanion);

  bateau.scale.setScalar(0.016);

  const conteneur = new THREE.Group();
  conteneur.add(bateau);

  const haut = new THREE.Vector3();
  const avant = new THREE.Vector3();
  const matrice = new THREE.Matrix4();
  let capPrecedent = new THREE.Vector3(1, 0, 0);

  function positionne(voyage, t) {
    const p = voyage.position(t, RAYON * 1.0025);
    conteneur.position.copy(p);

    haut.copy(p).normalize();
    const apres = voyage.position(t + 36e5, RAYON * 1.0025);
    avant.copy(apres).sub(p);
    avant.addScaledVector(haut, -avant.dot(haut)); // projeté tangent
    if (avant.lengthSq() < 1e-12) {
      avant.copy(capPrecedent);
      avant.addScaledVector(haut, -avant.dot(haut));
    }
    if (avant.lengthSq() < 1e-12) avant.set(1, 0, 0);
    avant.normalize();
    capPrecedent.copy(avant);

    const droite = new THREE.Vector3().crossVectors(avant, haut).normalize();
    matrice.makeBasis(droite, haut, avant);
    conteneur.quaternion.setFromRotationMatrix(matrice);
  }

  function anime(temps, distanceCamera = 3) {
    // léger tangage de catamaran — pas de gîte, Éric y tient
    bateau.rotation.x = Math.sin(temps * 1.7) * 0.025;
    bateau.rotation.z = Math.sin(temps * 1.1 + 1) * 0.012;
    // taille à peu près constante à l'écran, pour rester lisible de loin
    const s = THREE.MathUtils.clamp((distanceCamera - 1) * 0.0135, 0.003, 0.05);
    bateau.scale.setScalar(s);
  }

  return { conteneur, positionne, anime };
}

// triangle de voile dont le centre est gonflé vers tribord (effet « vent »)
function voileBombee(a, b, c, bombement) {
  const centre = a.clone().add(b).add(c).multiplyScalar(1 / 3)
    .add(new THREE.Vector3(bombement, 0, 0));
  const geo = new THREE.BufferGeometry();
  geo.setFromPoints([a, b, centre, b, c, centre, c, a, centre]);
  geo.computeVertexNormals();
  return geo;
}
