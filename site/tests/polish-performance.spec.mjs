import { expect, test } from '@playwright/test';

test('référence candidate de fluidité pendant la Traversée', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const debutNavigation = Date.now();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('pret')
    && window.__sillage?.renderer && window.__sillage?.timeline);
  const pretMs = Date.now() - debutNavigation;

  await page.evaluate(() => {
    window.__sillage.sauteIntro();
    document.getElementById('lecture').click();
  });

  const mesures = await page.evaluate(async () => {
    const mesureRaf = nombre => new Promise(resolve => {
      const deltas = [];
      let precedent = performance.now();
      const image = (maintenant) => {
        deltas.push(maintenant - precedent);
        precedent = maintenant;
        if (deltas.length >= nombre + 1) resolve(deltas.slice(1));
        else requestAnimationFrame(image);
      };
      requestAnimationFrame(image);
    });
    const resume = deltas => {
      const triees = [...deltas].sort((a, b) => a - b);
      const percentile = p => triees[Math.min(triees.length - 1,
        Math.floor((triees.length - 1) * p))];
      return {
        echantillons: deltas.length,
        medianeMs: percentile(0.5),
        p95Ms: percentile(0.95),
        maximumMs: Math.max(...deltas),
        plusDe33ms: deltas.filter(delta => delta > 33.34).length,
        plusDe50ms: deltas.filter(delta => delta > 50).length,
      };
    };
    const series = [];
    const tousDeltas = [];
    for (let passage = 0; passage < 5; passage++) {
      const deltas = await mesureRaf(30);
      tousDeltas.push(...deltas);
      series.push({ passage: passage + 1, ...resume(deltas) });
    }
    const ressources = performance.getEntriesByType('resource');
    const memoire = performance.memory;
    const gl = window.__sillage.renderer.getContext();
    const infoGpu = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererGpu = infoGpu
      ? gl.getParameter(infoGpu.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendorGpu = infoGpu
      ? gl.getParameter(infoGpu.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    return {
      environnement: {
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemoryGb: navigator.deviceMemory ?? null,
        mouvementReduit: matchMedia('(prefers-reduced-motion: reduce)').matches,
        gpu: {
          vendor: vendorGpu,
          renderer: rendererGpu,
          logiciel: /swiftshader|software/i.test(`${vendorGpu} ${rendererGpu}`),
        },
      },
      scenario: {
        nom: 'traversee-desktop-1366',
        lecture: window.__sillage.timeline.enLecture,
        mode: document.body.dataset.mode,
      },
      limitation: 'Référence candidate sur le moteur et le GPU déclarés ci-dessus; aucune comparaison inter-machine.',
      frames: { ...resume(tousDeltas), series },
      rendu: { ...window.__sillage.renderer.info.render },
      memoire: memoire ? {
        utilisee: memoire.usedJSHeapSize,
        totale: memoire.totalJSHeapSize,
        limite: memoire.jsHeapSizeLimit,
      } : null,
      ressources: {
        nombre: ressources.length,
        transfertOctets: ressources.reduce((somme, r) => somme + (r.transferSize || 0), 0),
        decodeOctets: ressources.reduce((somme, r) => somme + (r.decodedBodySize || 0), 0),
      },
    };
  });

  const reference = { pretMs, ...mesures };
  await testInfo.attach('performance-reference-candidate.json', {
    body: Buffer.from(JSON.stringify(reference, null, 2)),
    contentType: 'application/json',
  });

  // This establishes a candidate reference only. Absolute budgets remain
  // human-owned until the same runner/hardware reference is ratified.
  expect(mesures.frames.echantillons).toBe(150);
  expect(mesures.frames.series).toHaveLength(5);
  expect(mesures.rendu.calls).toBeGreaterThan(0);
  expect(mesures.ressources.nombre).toBeGreaterThan(0);
});
