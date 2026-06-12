// Les nuages cotonneux du mode Carnet : des grappes de sphères fusionnées,
// blanches et mates, qui flottent autour du globe et dérivent lentement.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const NOMBRE = 22;

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
      color: 0xffffff, gradientMap, transparent: true,
    });
    const mesh = new THREE.Mesh(geometrieNuage(alea), matiere);
    const dir = new THREE.Vector3(
      alea() * 2 - 1,
      (alea() * 2 - 1) * 0.7,
      alea() * 2 - 1,
    ).normalize();
    const rayon = 1.5 + alea() * 1.3;
    mesh.position.copy(dir.multiplyScalar(rayon));
    mesh.scale.setScalar(0.085 + alea() * 0.075);
    mesh.lookAt(0, 0, 0); // les grappes s'allongent face au globe
    nuages.push({ mesh, phase: alea() * Math.PI * 2, base: mesh.position.y });
    groupe.add(mesh);
  }

  const posMonde = new THREE.Vector3();
  function anime(dt, temps, camera) {
    groupe.rotation.y += dt * 0.006;
    for (const n of nuages) {
      n.mesh.position.y = n.base + Math.sin(temps * 0.25 + n.phase) * 0.02;
      if (camera) {
        // un nuage qui frôle la caméra s'efface au lieu de boucher la vue
        n.mesh.getWorldPosition(posMonde);
        const d = posMonde.distanceTo(camera.position);
        n.mesh.material.opacity = THREE.MathUtils.clamp((d - 0.3) / 0.45, 0, 1);
      }
    }
  }

  return { groupe, anime };
}
