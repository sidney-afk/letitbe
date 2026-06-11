// Ciel étoilé d'ambiance (le ciel astronomiquement exact viendra plus tard).

import * as THREE from 'three';

export function creerEtoiles(nombre = 7000) {
  const positions = new Float32Array(nombre * 3);
  const tailles = new Float32Array(nombre);
  const teintes = new Float32Array(nombre * 3);
  const couleur = new THREE.Color();

  for (let i = 0; i < nombre; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(60);
    positions.set([v.x, v.y, v.z], i * 3);
    const m = Math.random();
    tailles[i] = m < 0.92 ? 0.6 + Math.random() * 0.9 : 1.6 + Math.random() * 1.8;
    // du bleuté au doré, comme un vrai champ d'étoiles
    couleur.setHSL(Math.random() < 0.5 ? 0.62 : 0.12,
      Math.random() * 0.45, 0.75 + Math.random() * 0.25);
    teintes.set([couleur.r, couleur.g, couleur.b], i * 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('taille', new THREE.BufferAttribute(tailles, 1));
  geo.setAttribute('teinte', new THREE.BufferAttribute(teintes, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      attribute float taille;
      attribute vec3 teinte;
      varying vec3 vTeinte;
      void main() {
        vTeinte = teinte;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = taille * (140.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vTeinte;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.12, d);
        gl_FragColor = vec4(vTeinte, a);
      }`,
  });

  return new THREE.Points(geo, mat);
}
