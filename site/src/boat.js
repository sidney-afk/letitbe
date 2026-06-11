// Let It Be en miniature : catamaran toon inspiré des photos du vrai bateau
// (Fountaine-Pajot blanc à liserés rouges, grand-voile à corne, bimini).
// Échelle volontairement très exagérée — Sidney préfère le voir de loin.
// Pas de gîte : c'est un cata.

import * as THREE from 'three';
import { RAYON } from './geo.js';

function matiereToon(couleur) {
  const degrade = new Uint8Array([155, 208, 255]);
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
  const creme = matiereToon(0xfff9ec);
  const gris = matiereToon(0x9aa2ab);
  const vitre = matiereToon(0x35506b);

  // — coques dodues (axe Z = avant, étrave vers +Z) —
  const geoCoque = new THREE.CapsuleGeometry(0.105, 0.62, 6, 14);
  geoCoque.rotateX(Math.PI / 2);
  for (const cote of [-1, 1]) {
    const coque = new THREE.Mesh(geoCoque, blanc);
    coque.position.set(cote * 0.28, 0.05, 0);
    coque.scale.y = 0.8;
    bateau.add(coque);

    // double liseré rouge du vrai Let It Be
    for (const [h, ep] of [[0.105, 0.022], [0.065, 0.012]]) {
      const liseret = new THREE.Mesh(
        new THREE.CapsuleGeometry(ep, 0.66, 4, 10), rouge);
      liseret.rotation.x = Math.PI / 2;
      liseret.position.set(cote * 0.355, h, 0.01);
      liseret.scale.set(1, 1, 0.5);
      bateau.add(liseret);
    }
  }

  // — nacelle pleine largeur et rouf vitré —
  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.55), blanc);
  nacelle.position.set(0, 0.14, -0.02);
  bateau.add(nacelle);
  const rouf = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), blanc);
  rouf.position.set(0, 0.17, 0.03);
  rouf.scale.set(1.25, 0.6, 1.05);
  bateau.add(rouf);
  const baie = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 12), vitre);
  baie.position.set(0, 0.175, 0.045);
  baie.scale.set(1.18, 0.5, 0.98);
  bateau.add(baie);
  // bimini à l'arrière
  const bimini = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.22), creme);
  bimini.position.set(0, 0.34, -0.28);
  bateau.add(bimini);

  // — gréement —
  const mat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.024, 1.18, 8), gris);
  mat.position.set(0, 0.78, 0.06);
  bateau.add(mat);
  const bome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), gris);
  bome.rotation.x = Math.PI / 2;
  bome.position.set(0, 0.3, -0.26);
  bateau.add(bome);

  // — grand-voile à corne (comme sur les photos), bombée par le vent —
  const grandVoile = new THREE.Mesh(voileBombee([
    new THREE.Vector3(0, 0.32, -0.56),  // point d'écoute
    new THREE.Vector3(0, 0.32, 0.04),   // amure au mât
    new THREE.Vector3(0, 1.36, 0.07),   // tête
    new THREE.Vector3(0, 1.22, -0.26),  // la corne
  ], 0.085), creme);
  bateau.add(grandVoile);
  // liseré rouge sur la chute, clin d'œil aux lignes du bateau
  const chute = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 1.08, 6), rouge);
  chute.position.set(0, 0.78, -0.42);
  chute.rotation.x = 0.28;
  bateau.add(chute);

  // — génois sur l'étrave —
  const genois = new THREE.Mesh(voileBombee([
    new THREE.Vector3(0, 0.16, 0.7),
    new THREE.Vector3(0, 1.3, 0.08),
    new THREE.Vector3(0, 0.16, 0.1),
  ], -0.07), creme);
  bateau.add(genois);

  // — la clef de sol du tatoo, stylisée en spirale rouge sur la coque —
  const clef = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.011, 6, 16, Math.PI * 1.6), rouge);
  clef.position.set(0.385, 0.06, 0.22);
  clef.rotation.y = Math.PI / 2;
  bateau.add(clef);

  // — fanion rouge en tête de mât —
  const fanion = new THREE.Mesh(voileBombee([
    new THREE.Vector3(0, 1.42, 0.07),
    new THREE.Vector3(0, 1.33, 0.07),
    new THREE.Vector3(0, 1.375, -0.12),
  ], 0.02), rouge);
  bateau.add(fanion);

  bateau.scale.setScalar(0.03);

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

  const camLocale = new THREE.Vector3();
  function anime(temps, camera) {
    // léger tangage de catamaran — pas de gîte, Éric y tient
    bateau.rotation.x = Math.sin(temps * 1.7) * 0.025;
    bateau.rotation.z = Math.sin(temps * 1.1 + 1) * 0.012;

    const d = camera.position.length();
    // une vraie miniature : énorme, toujours lisible au-dessus du globe
    const s = THREE.MathUtils.clamp((d - 1) * 0.075, 0.002, 0.3);
    bateau.scale.setScalar(s);

    // de loin, la figurine pivote pour se montrer de profil (silhouette
    // de voilier, pas un point vu du ciel) ; de près elle reprend son cap
    camLocale.copy(camera.position);
    conteneur.worldToLocal(camLocale);
    let beta = Math.atan2(camLocale.x, camLocale.z) - Math.PI / 2;
    while (beta > Math.PI / 2) beta -= Math.PI;
    while (beta < -Math.PI / 2) beta += Math.PI;
    const profil = THREE.MathUtils.smoothstep(d, 1.7, 2.7);
    bateau.rotation.y = beta * profil;
  }

  return { conteneur, positionne, anime };
}

// voile bombée : triangle ou quadrilatère dont le centre est gonflé
// vers tribord (effet « vent dans la toile »)
function voileBombee(coins, bombement) {
  const centre = coins.reduce((a, p) => a.add(p), new THREE.Vector3())
    .multiplyScalar(1 / coins.length)
    .add(new THREE.Vector3(bombement, 0, 0));
  const sommets = [];
  for (let i = 0; i < coins.length; i++) {
    sommets.push(coins[i], coins[(i + 1) % coins.length], centre);
  }
  const geo = new THREE.BufferGeometry();
  geo.setFromPoints(sommets);
  geo.computeVertexNormals();
  return geo;
}
