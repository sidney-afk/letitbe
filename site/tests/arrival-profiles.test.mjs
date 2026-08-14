import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const litJson = chemin => JSON.parse(readFileSync(
  fileURLToPath(new URL(chemin, import.meta.url)),
  'utf8',
));

const route = litJson('../../data/route.json');
const vuesAeriennes = litJson('../../data/vues_aeriennes.json');

test('every selectable anchorage has a valid arrival profile and local source', () => {
  const escales = route.filter(escale => escale.type !== 'traversee');
  assert.equal(escales.length, 127, 'the selectable route catalogue changed; review its arrivals');

  const sansProfil = escales.filter(escale => !vuesAeriennes[
    `${escale.nom}|${escale.date_arrivee}`
  ]);
  assert.deepEqual(sansProfil, [], 'every selectable anchorage needs an arrival profile');

  for (const [cle, vue] of Object.entries(vuesAeriennes)) {
    assert.equal(typeof vue.fichier, 'string', `${cle} needs an image file`);
    assert.ok(vue.fichier.startsWith('media/'), `${cle} must resolve below public media`);
    assert.ok(existsSync(fileURLToPath(new URL(`../public/${vue.fichier}`, import.meta.url))),
      `${cle} references a missing public image: ${vue.fichier}`);
    for (const champ of ['lonMin', 'lonMax', 'latMin', 'latMax']) {
      assert.ok(Number.isFinite(vue[champ]), `${cle} needs a finite ${champ}`);
    }
    assert.ok(vue.lonMax > vue.lonMin, `${cle} needs increasing longitude bounds`);
    assert.ok(vue.latMax > vue.latMin, `${cle} needs increasing latitude bounds`);
    if (!vue.detailPlongee) continue;
    assert.ok(Number.isFinite(vue.detailDistance), `${cle} needs its reviewed distance`);
    assert.ok(Number.isFinite(vue.detailFov), `${cle} needs its reviewed field of view`);
  }
});
