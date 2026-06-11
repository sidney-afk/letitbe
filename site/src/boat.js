// Let It Be en miniature : catamaran procédural (deux coques blanches à
// liseré rouge, trampoline, grand-voile et génois crème). Fidèle dans
// l'esprit — le modèle détaillé d'après les photos viendra plus tard.
// Échelle volontairement exagérée pour rester visible à l'échelle du globe.

import * as THREE from 'three';
import { RAYON } from './geo.js';

const ECHELLE = 0.016;

export function creerBateau() {
  const bateau = new THREE.Group();

  const blanc = new THREE.MeshLambertMaterial({
    color: 0xf4f1ea, emissive: 0x4a4640,
  });
  const rouge = new THREE.MeshLambertMaterial({
    color: 0xb43227, emissive: 0x351008,
  });
  const creme = new THREE.MeshLambertMaterial({
    color: 0xfdf6e3, emissive: 0x55503f, side: THREE.DoubleSide,
  });
  const gris = new THREE.MeshLambertMaterial({ color: 0x8a8f96, emissive: 0x2a2c2f });

  // coques (axe Z = avant)
  const geoCoque = new THREE.CapsuleGeometry(0.085, 0.62, 4, 10);
  geoCoque.rotateX(Math.PI / 2);
  for (const cote of [-1, 1]) {
    const coque = new THREE.Mesh(geoCoque, blanc);
    coque.position.set(cote * 0.26, 0.04, 0);
    coque.scale.y = 0.72;
    bateau.add(coque);

    const liseret = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.035, 0.66), rouge);
    liseret.position.set(cote * 0.345, 0.075, 0);
    bateau.add(liseret);
  }

  // nacelle / trampoline
  const pont = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.5), blanc);
  pont.position.set(0, 0.12, -0.02);
  bateau.add(pont);
  const rouf = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.3), blanc);
  rouf.position.set(0, 0.19, -0.05);
  bateau.add(rouf);

  // gréement
  const mat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.018, 1.05, 6), gris);
  mat.position.set(0, 0.65, 0.02);
  bateau.add(mat);

  const grandVoile = new THREE.Mesh(triangle(
    new THREE.Vector3(0, 0.14, 0.0),
    new THREE.Vector3(0, 1.16, 0.02),
    new THREE.Vector3(0, 0.16, -0.55),
  ), creme);
  grandVoile.position.x = -0.012;
  bateau.add(grandVoile);

  const genois = new THREE.Mesh(triangle(
    new THREE.Vector3(0, 0.12, 0.62),
    new THREE.Vector3(0, 1.08, 0.04),
    new THREE.Vector3(0, 0.12, 0.05),
  ), creme);
  genois.position.x = 0.012;
  bateau.add(genois);

  bateau.scale.setScalar(ECHELLE);

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
    const s = THREE.MathUtils.clamp((distanceCamera - 1) * 0.011, 0.0015, 0.045);
    bateau.scale.setScalar(s);
  }

  return { conteneur, positionne, anime };
}

function triangle(a, b, c) {
  const geo = new THREE.BufferGeometry();
  geo.setFromPoints([a, b, c]);
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}
