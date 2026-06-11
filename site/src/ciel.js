// Le ciel du mode Carnet : un dôme bleu clair dégradé, jamais l'espace
// noir, avec un soleil chaleureux et son halo.

import * as THREE from 'three';

export function creerCiel() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        dirSoleil: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 dirSoleil;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 zenith = vec3(0.39, 0.69, 0.94);
          vec3 horizon = vec3(0.76, 0.89, 0.98);
          vec3 ciel = mix(horizon, zenith, smoothstep(-0.3, 0.55, d.y));
          float versSoleil = max(dot(d, dirSoleil), 0.0);
          ciel += vec3(1.0, 0.92, 0.72) * pow(versSoleil, 14.0) * 0.30; // halo
          ciel += vec3(1.0, 0.98, 0.90) * pow(versSoleil, 260.0) * 1.4; // disque
          gl_FragColor = vec4(ciel, 1.0);
        }`,
    }),
  );
  mesh.visible = false;
  return {
    mesh,
    metAJourSoleil(dir) { mesh.material.uniforms.dirSoleil.value.copy(dir); },
  };
}
