import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const scenarios = [
  {
    name: 'desktop-1366-carnet-pacifique',
    viewport: { width: 1366, height: 768 },
    date: '2013-09-10',
    camera: { lat: 12, lon: -145, distance: 3.4 },
  },
  {
    name: 'desktop-1920-realiste-nouvelle-zelande',
    viewport: { width: 1920, height: 1080 },
    date: '2011-01-15',
    camera: { lat: -28, lon: 174, distance: 3.4 },
    mode: 'photo',
  },
  {
    name: 'tablette-recit-polynesie',
    viewport: { width: 768, height: 1024 },
    date: '2010-05-21',
    camera: { lat: -14, lon: -149, distance: 3.15 },
    recit: true,
  },
  {
    name: 'portrait-360-carnet-auto',
    viewport: { width: 360, height: 800 },
    date: '2009-05-27',
  },
  {
    name: 'landscape-844-carnet-auto',
    viewport: { width: 844, height: 390 },
    date: '2009-05-27',
  },
  {
    name: 'portrait-390-zoom-proche-stress',
    viewport: { width: 390, height: 844 },
    date: '2010-05-21',
    camera: { lat: -15, lon: -149, distance: 2.1 },
  },
  {
    name: 'portrait-390-fallback-2d',
    viewport: { width: 390, height: 844 },
    fallback: true,
  },
  {
    name: 'desktop-plongee-nuku-hiva',
    viewport: { width: 1366, height: 768 },
    date: '2010-03-24',
    camera: { lat: -9, lon: -140, distance: 3.4 },
    plongee: 'Marquises - Nuku Hiva',
  },
];

function collectRuntimeSignals(page) {
  const signals = {
    console: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };

  page.on('console', message => {
    signals.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });
  page.on('pageerror', error => {
    signals.pageErrors.push({ message: error.message, stack: error.stack ?? '' });
  });
  page.on('requestfailed', request => {
    signals.requestFailures.push({
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText ?? 'échec sans détail',
    });
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      signals.httpErrors.push({ status: response.status(), url: response.url() });
    }
  });

  return signals;
}

async function setRepresentativeState(page, scenario) {
  await page.setViewportSize(scenario.viewport);
  await page.goto(scenario.fallback ? '/?force-fallback=1' : '/', {
    waitUntil: 'domcontentloaded',
  });
  if (scenario.fallback) {
    await page.waitForFunction(() => document.body.classList.contains('fallback-actif')
      && window.__sillage?.fallback === true);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(resolve));
    });
    return;
  }
  await page.waitForFunction(() => document.body.classList.contains('pret')
    && window.__sillage?.camera
    && window.__sillage?.timeline);

  await page.evaluate(() => {
    window.__sillage.sauteIntro();
    const suivre = document.getElementById('suivre');
    if (suivre?.getAttribute('aria-pressed') === 'true') suivre.click();
  });
  await page.waitForFunction(() => ['titre', 'boutons-haut', 'timeline'].every(id => {
    const element = document.getElementById(id);
    return element && Number(getComputedStyle(element).opacity) > 0.98;
  }));

  await page.evaluate(({ date, camera }) => {
    const api = window.__sillage;
    api.timeline.vaA(new Date(`${date}T12:00:00Z`).getTime(), true);
    if (camera) {
      const phi = (90 - camera.lat) * Math.PI / 180;
      const theta = (camera.lon + 180) * Math.PI / 180;
      api.camera.position.set(
        -camera.distance * Math.sin(phi) * Math.cos(theta),
        camera.distance * Math.cos(phi),
        camera.distance * Math.sin(phi) * Math.sin(theta),
      );
      api.camera.lookAt(0, 0, 0);
      api.controls.target.set(0, 0, 0);
      api.controls.update();
    }
  }, scenario);

  if (scenario.mode === 'photo') {
    await page.locator('#mode-bouton').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'photo');
  }

  if (scenario.recit) {
    await page.locator('#recit-bouton').click();
    await expect(page.locator('body')).toHaveClass(/recit-actif/);
    await expect(page.locator('#recit-carte')).toHaveClass(/visible/);
  }

  if (scenario.plongee) {
    await page.evaluate(async (nom) => {
      const { plongee, route } = window.__sillage;
      const escale = route.escales.find(item => item.nom === nom);
      if (!escale) throw new Error(`Escale QA introuvable : ${nom}`);
      await plongee.vers(escale);
      // Advance the exposed flight controller directly. Waiting on wall-clock
      // animation makes headless WebGL throttling change the measured state.
      plongee.metAJour(10);
    }, scenario.plongee);
    await page.waitForFunction(() => window.__sillage.plongee.ouverte
      && !window.__sillage.plongee.enVol);
    await expect(page.locator('#plongee')).toBeVisible();
    // The panel starts its CSS entrance only after the camera flight completes.
    // Measure the settled layout, not an intentional 550 ms transition frame.
    await page.waitForTimeout(700);
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(
      () => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(350);
}

async function measureComposition(page) {
  return page.evaluate(() => {
    const selectors = [
      '#scene',
      '#titre',
      '#boutons-haut',
      '#timeline',
      '#timeline-corps',
      '#timeline-libelle',
      '#recit-carte',
      '#recit-indicateur',
      '#recit-aide',
      '#navigation-escales',
      '#plongee',
      '#plongee-entete',
      '#infobulle',
      '#lightbox',
      '#fallback-2d',
      '#fallback-carte',
      '#fallback-trace',
      '#fallback-liste',
    ];
    const tolerance = 1;
    const viewport = { width: innerWidth, height: innerHeight };

    const visibleRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element || element.hidden) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden'
        || Number(style.opacity) <= 0.01 || rect.width <= 0 || rect.height <= 0) return null;
      return {
        selector,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    const elements = selectors.map(visibleRect).filter(Boolean);
    const containmentViolations = elements.filter(rect => rect.left < -tolerance
      || rect.top < -tolerance
      || rect.right > viewport.width + tolerance
      || rect.bottom > viewport.height + tolerance);

    const structuralSelectors = new Set([
      '#titre', '#boutons-haut', '#timeline', '#recit-carte',
      '#navigation-escales', '#plongee', '#fallback-carte', '#fallback-liste',
    ]);
    const structural = elements.filter(rect => structuralSelectors.has(rect.selector));
    const structuralOverlaps = [];
    for (let i = 0; i < structural.length; i++) {
      for (let j = i + 1; j < structural.length; j++) {
        const a = structural[i];
        const b = structural[j];
        const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (width > tolerance && height > tolerance) {
          structuralOverlaps.push({
            selectors: [a.selector, b.selector],
            width,
            height,
            area: width * height,
          });
        }
      }
    }

    const textClippingCandidates = [...document.querySelectorAll(
      'h1, h2, h3, p, span, button, figcaption')]
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const clipsWidth = style.overflowX !== 'visible'
          && element.scrollWidth > element.clientWidth + tolerance;
        const clipsHeight = style.overflowY !== 'visible'
          && element.scrollHeight > element.clientHeight + tolerance;
        return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden'
          && !element.closest('.sr-only')
          && Number(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0
          && (clipsWidth || clipsHeight);
      })
      .map(element => ({
        selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
        text: element.textContent?.trim().slice(0, 120) ?? '',
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        overflow: getComputedStyle(element).overflow,
      }));

    const undersizedTargets = [...document.querySelectorAll(
      'button, summary, select, input[type="range"], [role="button"]')]
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0
          && (rect.width < 44 - tolerance || rect.height < 44 - tolerance);
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
          width: rect.width,
          height: rect.height,
        };
      });

    const resources = performance.getEntriesByType('resource');
    return {
      viewport,
      devicePixelRatio,
      url: location.href,
      bodyMode: document.body.dataset.mode ?? null,
      bodyClasses: [...document.body.classList],
      scene: window.__sillage?.etatComposition?.() ?? null,
      elements,
      containmentViolations,
      structuralOverlaps,
      textClippingCandidates,
      undersizedTargets,
      documentOverflow: {
        horizontal: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
          - viewport.width,
        vertical: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
          - viewport.height,
      },
      resources: {
        count: resources.length,
        transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        decodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
      },
    };
  });
}

function evaluateSceneContract(measurements) {
  const state = measurements.scene;
  if (state?.fallback) {
    return {
      skipped: 'fallback-2d-sans-etiquettes-webgl',
      missingInstrumentation: [],
      labelContainmentViolations: [],
      labelIntersections: [],
      labelZoneIntersections: [],
      labelMarkerIntersections: [],
      labelBoatIntersections: [],
      currentLabelContradictions: [],
    };
  }
  if (!state?.etiquettes?.etiquettes || !state?.etiquettes?.zonesInterface) {
    return {
      missingInstrumentation: ['window.__sillage.etatComposition().etiquettes'],
      labelContainmentViolations: [],
      labelIntersections: [],
      labelZoneIntersections: [],
      labelMarkerIntersections: [],
      labelBoatIntersections: [],
      currentLabelContradictions: [],
    };
  }

  const { largeur, hauteur } = state.viewport;
  const compact = largeur < 700 || hauteur < 520;
  const safeMargin = compact ? 12 : 20;
  const labelGap = compact ? 8 : 12;
  const labels = measurements.bodyMode === 'photo'
    ? []
    : state.etiquettes.etiquettes.filter(label => label.affichee);
  const zones = state.etiquettes.zonesInterface;
  const intersects = (a, b, margin = 0) => a.gauche < b.droite + margin
    && a.droite > b.gauche - margin
    && a.haut < b.bas + margin
    && a.bas > b.haut - margin;

  const labelContainmentViolations = labels
    .filter(label => !label.rectangle
      || label.rectangle.gauche < safeMargin
      || label.rectangle.droite > largeur - safeMargin
      || label.rectangle.haut < safeMargin
      || label.rectangle.bas > hauteur - safeMargin)
    .map(label => ({ nom: label.nom, rectangle: label.rectangle }));

  const labelIntersections = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (intersects(labels[i].rectangle, labels[j].rectangle, labelGap)) {
        labelIntersections.push({ labels: [labels[i].nom, labels[j].nom] });
      }
    }
  }

  const labelZoneIntersections = [];
  for (const label of labels) {
    for (const zone of zones) {
      // UI rectangles already include the production 10/14 px safe margin.
      if (intersects(label.rectangle, zone)) {
        labelZoneIntersections.push({ label: label.nom, zone: zone.nom });
      }
    }
  }

  const markerPadding = compact ? 5 : 7;
  const labelMarkerIntersections = [];
  const visibleMarkers = state.route?.marqueurs?.filter(marker => marker.visible) ?? [];
  for (const label of labels) {
    for (const marker of visibleMarkers) {
      if (marker.x >= label.rectangle.gauche - markerPadding
        && marker.x <= label.rectangle.droite + markerPadding
        && marker.y >= label.rectangle.haut - markerPadding
        && marker.y <= label.rectangle.bas + markerPadding) {
        labelMarkerIntersections.push({ label: label.nom, marker: marker.nom });
      }
    }
  }

  const currentLabels = state.etiquettes.etiquettes
    .filter(label => label.positionCourante);
  const currentLabelContradictions = [];
  if (currentLabels.length !== 1) {
    currentLabelContradictions.push({
      type: 'nombre-de-positions-courantes',
      labels: currentLabels.map(label => label.nom),
    });
  }

  const rectangleBateau = state.bateau?.rectangle;
  const labelBoatIntersections = rectangleBateau
    ? labels.filter(label => intersects(label.rectangle, rectangleBateau, compact ? 3 : 5))
      .map(label => ({ label: label.nom, bateau: rectangleBateau }))
    : [];
  for (const label of currentLabels) {
    if (!label.affichee && ['collision', 'limite-de-densite'].includes(label.occlusionReason)) {
      currentLabelContradictions.push({
        type: 'position-courante-evincee',
        label: label.nom,
        raison: label.occlusionReason,
      });
    }
  }

  return {
    missingInstrumentation: [],
    policy: {
      compact,
      labelViewportMarginPx: safeMargin,
      labelGapPx: labelGap,
      uiZoneMarginPx: compact ? 10 : 14,
    },
    displayedLabels: labels.map(label => label.nom),
    labelContainmentViolations,
    labelIntersections,
    labelZoneIntersections,
    labelMarkerIntersections,
    labelBoatIntersections,
    currentLabelContradictions,
  };
}

async function scanAccessibility(page) {
  const results = await new AxeBuilder({ page }).analyze();
  return {
    limitation: 'axe-core mesure le DOM et les contrôles, pas le contenu visuel du canvas WebGL.',
    ...results,
  };
}

for (const scenario of scenarios) {
  test(`${scenario.name} reste mesurable et contenu dans le viewport`, async ({ page }, testInfo) => {
    const signals = collectRuntimeSignals(page);
    await setRepresentativeState(page, scenario);

    const measurements = await measureComposition(page);
    measurements.sceneContract = evaluateSceneContract(measurements);
    const accessibility = await scanAccessibility(page);
    const accessibilityViolations = accessibility.violations
      .map(violation => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map(node => node.target),
      }));
    const screenshot = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      scale: 'css',
    });

    // Report-only artifacts: these deliberately use attachments, never snapshot
    // assertions, so the current visual defects cannot become approved goldens.
    await testInfo.attach(`${scenario.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });
    await testInfo.attach(`${scenario.name}-measurements.json`, {
      body: Buffer.from(JSON.stringify(measurements, null, 2)),
      contentType: 'application/json',
    });
    await testInfo.attach(`${scenario.name}-runtime-signals.json`, {
      body: Buffer.from(JSON.stringify(signals, null, 2)),
      contentType: 'application/json',
    });
    await testInfo.attach(`${scenario.name}-axe.json`, {
      body: Buffer.from(JSON.stringify(accessibility, null, 2)),
      contentType: 'application/json',
    });

    expect(measurements.containmentViolations, 'éléments visibles hors viewport').toEqual([]);
    expect(measurements.documentOverflow.horizontal, 'débordement horizontal du document')
      .toBeLessThanOrEqual(1);
    expect(measurements.documentOverflow.vertical, 'débordement vertical du document')
      .toBeLessThanOrEqual(1);
    expect(measurements.structuralOverlaps, 'surfaces persistantes qui se chevauchent')
      .toEqual([]);
    expect(measurements.textClippingCandidates, 'texte visible rogné ou ellipsé')
      .toEqual([]);
    expect(measurements.undersizedTargets, 'cibles interactives inférieures à 44 px')
      .toEqual([]);
    expect(signals.pageErrors, 'exceptions JavaScript non gérées').toEqual([]);
    expect(signals.requestFailures, 'requêtes réseau échouées').toEqual([]);
    expect(signals.httpErrors, 'réponses HTTP en erreur').toEqual([]);
    expect(signals.console.filter(entry => entry.type === 'error'), 'console.error').toEqual([]);
    expect(measurements.sceneContract.missingInstrumentation,
      'instrumentation de composition indisponible').toEqual([]);
    expect(measurements.sceneContract.labelContainmentViolations,
      'étiquettes affichées hors marges sûres').toEqual([]);
    expect(measurements.sceneContract.labelIntersections,
      'étiquettes affichées qui se chevauchent').toEqual([]);
    expect(measurements.sceneContract.labelZoneIntersections,
      'étiquettes affichées dans une zone UI réservée').toEqual([]);
    expect(measurements.sceneContract.labelMarkerIntersections,
      'marqueurs d\'escale qui traversent une étiquette').toEqual([]);
    expect(measurements.sceneContract.labelBoatIntersections,
      'bateau qui traverse une étiquette').toEqual([]);
    expect(measurements.sceneContract.currentLabelContradictions,
      'étiquette de position courante contradictoire ou évincée').toEqual([]);
    expect(accessibilityViolations,
      'violations axe-core (le canvas WebGL reste complété par les sondes de scène)')
      .toEqual([]);

    if (scenario.fallback) {
      await expect(page.locator('#fallback-2d')).toBeVisible();
      expect(await page.locator('#fallback-trace .fallback-route-ligne').count(),
        'tracé de route 2D').toBeGreaterThan(0);
      expect(await page.locator('#fallback-liste li').count(),
        'escales lisibles dans le fallback').toBeGreaterThan(0);
      expect(await page.locator('#escales-select option').count(),
        'navigation des escales dans le fallback').toBeGreaterThan(1);
      expect(measurements.scene?.escales ?? 0, 'escales exposées par etatComposition')
        .toBeGreaterThan(0);
    }
  });
}
