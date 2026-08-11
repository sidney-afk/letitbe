import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { latLonVers3D } from '../src/geo.js';
import { creerRoute } from '../src/route.js';

function installeDOMMinimal() {
  globalThis.devicePixelRatio = 1;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  globalThis.document = {
    body: { classList: { contains: () => false } },
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        beginPath() {},
        moveTo() {},
        quadraticCurveTo() {},
        stroke() {},
        lineCap: 'round',
        lineWidth: 1,
        strokeStyle: '#000',
        globalAlpha: 1,
      }),
    }),
  };
}

function cameraFaceAu(point, distance = 2.6) {
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10);
  camera.position.copy(point).normalize().multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

test('la route est un seul itinéraire continu, quel que soit le temps', () => {
  installeDOMMinimal();
  const voyage = {
    segments: [
      { p0: latLonVers3D(0, 0), p1: latLonVers3D(0, 20), t0: 0, t1: 100 },
      { p0: latLonVers3D(0, 20), p1: latLonVers3D(0, 40), t0: 100, t1: 200 },
    ],
  };
  const routeData = [
    { nom: 'Départ', lat: 0, lon: 0, date_arrivee: '2000-01-01' },
    { nom: 'Arrivée', lat: 0, lon: 40, date_arrivee: '2000-02-01' },
  ];
  const relief = { altitude: () => 1.04 };
  const route = creerRoute(voyage, routeData, relief);
  const itineraire = route.groupe.getObjectByName('route-itineraire');

  assert.ok(itineraire.isLine2);
  assert.ok(itineraire.material.isLineMaterial);
  assert.equal(route.groupe.children.some(objet => objet.isPoints), false);
  assert.equal(route.groupe.children.filter(objet => objet.isLine2).length, 1);
  assert.equal(route.groupe.getObjectByName('route-a-venir'), undefined);

  const segments = itineraire.geometry.getAttribute('instanceStart').count;
  route.metAJourTemps(-1);
  assert.equal(itineraire.geometry.instanceCount, segments);

  route.metAJourTemps(100);
  assert.equal(itineraire.geometry.instanceCount, segments);

  route.metAJourTemps(200);
  assert.equal(itineraire.geometry.instanceCount, segments);
});

test('le X final est ancré au relief et disparaît avant son horizon', () => {
  installeDOMMinimal();
  const voyage = {
    segments: [{ p0: latLonVers3D(0, 0), p1: latLonVers3D(0, 20), t0: 0, t1: 100 }],
  };
  const routeData = [
    { nom: 'Départ', lat: 0, lon: 0, date_arrivee: '2000-01-01' },
    { nom: 'Arrivée', lat: 0, lon: 20, date_arrivee: '2000-02-01' },
  ];
  const route = creerRoute(voyage, routeData, { altitude: () => 1.04 });
  const croix = route.groupe.getObjectByName('route-destination-marker');

  assert.ok(croix.isMesh);
  assert.ok(croix.material.isMeshBasicMaterial);
  assert.ok(croix.userData.surfaceDirection.angleTo(croix.position) < 1e-8);
  assert.ok(croix.userData.surfaceDirection.angleTo(
    new THREE.Vector3(0, 0, 1).applyQuaternion(croix.quaternion)) < 1e-8);
  assert.ok(croix.userData.surfaceRadius > 1.04);
  assert.ok(Math.abs(croix.position.length() - croix.userData.surfaceRadius) < 1e-10);

  const cameraDevant = cameraFaceAu(croix.position);
  route.orientePerles(cameraDevant);
  assert.equal(croix.visible, true);
  assert.ok(croix.scale.x > 0);

  const cameraDerriere = cameraFaceAu(croix.position, -2.6);
  route.orientePerles(cameraDerriere);
  assert.equal(croix.visible, false);
});
