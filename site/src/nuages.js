// Les nuages cotonneux du mode Carnet : des grappes de sphères fusionnées,
// blanches et mates, qui flottent autour du globe et dérivent lentement.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const NOMBRE = 16;

function geometrieNuage(alea) {
  const boules = [];
  const n = 6 + Math.floor(alea() * 4);
  for (let i = 0; i < n; i++) {
    const r = 0.38 + alea() * 0.42;
    const g = new THREE.SphereGeometry(r, 9, 7);
    g.translate(
      (alea() - 0.5) * 2.4,
      (alea() - 0.5) * 0.55,
      (alea() - 0.5) * 1.1,
    );
    boules.push(g);
  }
  const geo = mergeGeometries(boules);
  // la base s'aplatit : après le lookAt vers le globe, le +Z local est
  // le dessous du nuage — on le rabote, façon nuage peint à la main
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z > 0.15) pos.setZ(i, 0.15 + (z - 0.15) * 0.22);
  }
  geo.computeVertexNormals();
  return geo;
}

export function creerNuagesCotonneux() {
  let graine = 7;
  const alea = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };

  const groupe = new THREE.Group();
  groupe.visible = false;

  const degrade = new Uint8Array([170, 215, 255]);
  const gradientMap = new THREE.DataTexture(degrade, 3, 1, THREE.RedFormat);
  gradientMap.needsUpdate = true;

  const nuages = [];
  for (let i = 0; i < NOMBRE; i++) {
    // matériau par nuage : chacun s'estompe quand la caméra s'approche
    const matiere = new THREE.MeshToonMaterial({
      color: 0xffffff, gradientMap, transparent: true, depthWrite: false, opacity: 0.62,
    });
    const mesh = new THREE.Mesh(geometrieNuage(alea), matiere);
    const dir = new THREE.Vector3(
      alea() * 2 - 1,
      (alea() * 2 - 1) * 0.7,
      alea() * 2 - 1,
    ).normalize();
    const rayon = 1.75 + alea() * 1.15;
    mesh.position.copy(dir.multiplyScalar(rayon));
    mesh.scale.setScalar(0.055 + alea() * 0.055);
    mesh.lookAt(0, 0, 0); // les grappes s'allongent face au globe
    nuages.push({
      mesh,
      phase: alea() * Math.PI * 2,
      base: mesh.position.y,
      opacite: 0.5 + alea() * 0.16,
    });
    groupe.add(mesh);
  }

  const posMonde = new THREE.Vector3();
  const projete = new THREE.Vector3();
  let dernierEtat = [];
  function anime(dt, temps, camera, mouvement = true) {
    if (mouvement) groupe.rotation.y += dt * 0.006;
    const compact = innerWidth < 700 || innerHeight < 520;
    dernierEtat = [];
    for (let i = 0; i < nuages.length; i++) {
      const n = nuages[i];
      n.mesh.position.y = n.base
        + (mouvement ? Math.sin(temps * 0.25 + n.phase) * 0.02 : 0);
      n.mesh.visible = !compact || i % 2 === 0;
      if (camera) {
        n.mesh.getWorldPosition(posMonde);
        const d = posMonde.distanceTo(camera.position);
        projete.copy(posMonde).project(camera);
        const centralite = Math.hypot(projete.x, projete.y);
        const devantGlobe = posMonde.dot(camera.position) > 0
          && d < camera.position.length();
        const proximite = THREE.MathUtils.clamp((d - 0.42) / 0.75, 0, 1);
        const degagementCentre = devantGlobe
          ? THREE.MathUtils.clamp((centralite - 0.12) / 0.9, 0.16, 1)
          : 1;
        const cible = n.opacite * proximite * degagementCentre * (compact ? 0.72 : 1);
        n.mesh.material.opacity += (cible - n.mesh.material.opacity) * Math.min(1, dt * 4);
      }
      dernierEtat.push({
        index: i,
        visible: n.mesh.visible,
        opacite: Number(n.mesh.material.opacity.toFixed(3)),
      });
    }
  }

  return {
    groupe,
    anime,
    etat() { return dernierEtat; },
  };
}
