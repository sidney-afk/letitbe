# Le Sillage polish QA playbook

Read [POLISH_CONTRACT.md](./POLISH_CONTRACT.md) before using this playbook. The contract defines the product; this document defines the repeatable audit, compare, and release-recommendation loop.

## Roles

- **Implementer:** diagnoses a bounded issue, makes the smallest root-cause change in the authorized scope, and produces evidence.
- **Independent reviewer:** reviews the rendered result without being primed to defend the implementation. This may be a separate person or a separate model/context that receives the contract, state manifest, and captures but not the implementer’s argument first.
- **Human owner:** decides intent, approves exceptions, promotes baselines, and separately authorizes any publication.

The implementer cannot act as the sole visual reviewer. No automated role can promote the evidence it generated.

## Evidence model

Every run gets an immutable run ID, for example `2026-08-09T184500Z-a1b2c3d`. Store disposable run output outside source control unless the owner requests a checked-in artifact.

Recommended run shape:

```text
artifacts/polish/<run-id>/
  manifest.json
  before/
  after/
  diffs/
  contact-sheets/
  audits/
  review.md
```

The manifest should record:

- exact commit and whether the worktree was already dirty;
- production build command and result;
- browser name/version, OS/runner, GPU or software renderer, DPR, locale, timezone, color scheme, motion preference, and viewport;
- data revision, route date/progress, camera target/distance, render mode, panel state, and interaction action;
- readiness signal and capture timestamp;
- console, network, geometry, label-collision, accessibility, and performance summaries;
- hashes of before/after images and any approved reference used for comparison.

Never identify a screenshot only as `final.png`. Use `<state>__<viewport>__<mode>__<phase>.png`, for example `label-americas__D1440__carnet__before.png`.

## 1. Preflight

1. Classify the request as audit-only, proposed change, implementation, or release review. Audit-only work does not edit product code.
2. Record the exact branch, commit, and pre-existing changes. Never absorb another person’s dirty files into the polish batch.
3. Read the contract and the relevant product code. For visual intent, also consult `PLAN.md`; for capture behavior, inspect `site/capture.mjs` rather than assuming its flags.
4. Define the issue as observable behavior: state, viewport, surface, evidence, user impact, and pass condition.
5. Select the smallest affected rows from the release matrix, then add adjacent states that share the same layout or scene logic.
6. Confirm that baseline-update and deployment actions are absent from the plan.
7. Build and serve the production output locally. Do not evaluate polish only in a hot-reloading development state.

## 2. Deterministic capture

`site/capture.mjs` is the existing seed harness. It already knows useful actions such as `play`, `recit`, `photo`, `zoom=…`, `regarde=lat,lon`, `date=…`, `mi-parcours`, `plonge=…`, and `defile=…`. Extend or wrap that harness when necessary; do not maintain an unrelated second vocabulary for the same product states.

A release-grade capture must:

- use a pinned Chromium version and a declared renderer;
- set viewport, DPR, locale, timezone, color scheme, reduced-motion preference, and network conditions explicitly;
- wait for fonts, route/story data, required images, and a product-specific ready signal rather than relying only on a sleep;
- set date/progress, camera orientation/distance, mode, and panel state explicitly;
- pause or seed nondeterministic cloud, particle, weather, and animation state for still comparison while retaining separate motion checks;
- collect page errors, console errors, failed requests, and browser crashes as failures;
- capture the full viewport without resizing it to fit broken content.

Use the same environment and state manifest for before and after. If either side differs, the comparison is invalid and must be recaptured.

### Canonical state catalogue

The exact coordinates and dates live in the capture manifest, not in filenames. Keep these stable once the owner ratifies them.

| State ID | Purpose | Existing harness starting point |
| --- | --- | --- |
| `load-ready` | loading transition and first usable frame | default load |
| `carnet-start` | default composition and journey start | fixed start date/progress |
| `carnet-mid` | typical ocean/route composition | `mi-parcours` |
| `label-americas` | dense-label and edge stress | `regarde=lat,lon` plus a fixed near zoom |
| `photo-mid` | mode parity | `photo mi-parcours` |
| `timeline-start` | left endpoint and start metadata | fixed start date/progress |
| `timeline-mid` | range, weather, place, and boat synchronization | `mi-parcours` |
| `timeline-end` | right endpoint and arrival metadata | fixed end date/progress |
| `playback` | camera follow, route, foam, photos, and controls in motion | `play` with a fixed elapsed point |
| `story-first` | story entry, focus, and layout | `recit` |
| `story-dense` | longest supported chapter and scroll behavior | explicit chapter selection |
| `dive-top` | anchorage transition and first panel frame | `plonge=Fakarava` or ratified anchor |
| `dive-scrolled` | long text/gallery and nested scroll | `plonge=… defile=…` |
| `lightbox` | image fit, close path, caption, and focus | explicit thumbnail activation |
| `reduced-motion` | complete static-equivalent journey | browser preference plus matching state |
| `fallback` | useful no-WebGL/low-capability result | explicit capability simulation |

Before declaring the matrix automated, add explicit harness support for any catalogue state that cannot currently be reached deterministically. A manual click sequence is acceptable as temporary evidence only when it is written into the manifest.

## 3. Hard audit

Run the contract’s hard gates before asking for aesthetic review. A known hard failure makes visual approval provisional.

### DOM geometry probe

For each visible persistent control, title, panel, dialog, and intended scroll container, record its bounding rectangle and computed overflow. Fail when:

- a required rectangle crosses the usable viewport or its designated container by more than 1 CSS pixel;
- the page itself scrolls in either direction;
- a fixed surface intersects another fixed surface;
- text is clipped by height/width without an explicitly approved truncation rule;
- a target is smaller than 44 × 44 CSS pixels; or
- an invisible element intercepts pointer input or remains in the focus order.

### WebGL label probe

The place names in `site/src/etiquettes.js` are Three.js sprites backed by canvas textures. They will not appear in DOM accessibility or overflow queries. The harness therefore needs a read-only debug result for each rendered label:

```text
id, priority, visible, opacity,
screenRect { x, y, width, height },
anchorScreenPoint { x, y },
depth, occlusionReason
```

Apply the safe-area, reserved-UI, and overlap thresholds in the contract to these rectangles. Save the collision list in the run artifacts. The debug result must describe production rendering; it must not change culling or layout only during tests.

Record the deterministic priority order used in that state. A test-only order that differs from production is invalid evidence.

### Interaction and accessibility probe

- Exercise every affected control with pointer/touch and keyboard input.
- Check focus order, visible focus, state announcements, dialog containment/return, Escape behavior, range keys, and reduced motion.
- Run an automated accessibility scan after each major state transition, not only on initial load.
- Treat zero critical/serious automated findings as the floor. Canvas meaning, reading order, focus behavior, contrast over moving imagery, and understandable French names still require human review.

### Reliability and asset probe

Fail on an uncaught page error, unhandled rejection, required asset failure, unexpected 4xx/5xx, broken image, empty required data, impossible route/date state, or fallback timeout. Capture console warnings for review even when they are not release-blocking.

### Performance probe

Measure ready time, playback frame-time distribution, long tasks, transfer sizes, and peak memory on the same pinned environment. Use at least five runs and compare medians. Keep real-GPU and software-rendered CI references separate. Until the owner ratifies absolute budgets, enforce the contract’s no-unexplained-regression rule.

## 4. Visual audit

Build contact sheets that put the same state and viewport side by side: reference or before, candidate, and diff/overlay. Also include one matrix sheet per viewport so cross-state inconsistency is visible.

Review in this order:

1. **Comprehension:** Can a new visitor identify the voyage, current place/date, route, and next meaningful action?
2. **Hierarchy:** Are globe, route, boat, story, and timeline prioritized over ornament and chrome?
3. **Composition:** Are safe areas, density, balance, cropping, and panel relationships intentional?
4. **Legibility:** Are type, labels, icons, contrast, and focus readable over the actual scene?
5. **Style fidelity:** Does the result retain the painted carnet, maritime paper, and restrained tactile character?
6. **State continuity:** Does switching mode, zoom, time, panel, and viewport feel like one product?
7. **Motion:** Does movement preserve orientation and settle cleanly? Does reduced motion remain complete?
8. **Content integrity:** Are real words and media treated with dignity rather than cut, invented, or hidden?

Record each finding as:

```text
ID and severity:
State and viewport:
Surface:
Evidence:
Observed behavior:
User impact:
Pass condition:
Objective or judgment-based:
Confidence:
Status and owner:
```

The independent reviewer receives the contract, manifest, and evidence first. The implementer’s explanation follows after the reviewer records an initial read, reducing confirmation bias.

## 5. Repair and compare loop

1. Group findings by root cause, not by screenshot.
2. Choose one bounded batch and state the files/surfaces it may change.
3. Capture the exact before states if they do not already exist.
4. Make the smallest coherent change. Do not add a new design system for a local defect.
5. Run focused hard checks while iterating.
6. Recapture the identical state manifest.
7. Compare before/after at the same viewport, renderer, date, camera, zoom, mode, and animation point.
8. Ask the independent reviewer to find regressions and remaining issues.
9. Run every blocking matrix cell and all gates after focused checks pass.
10. Produce a release recommendation with unresolved findings and confidence; stop before publication.

An iteration is rejected if it fixes the named screenshot by changing the camera, content, viewport, timing, tested state, or evidence threshold instead of fixing the product.

## 6. Baseline protocol

Authoritative baselines are human-owned records of intended appearance, not output generated by the latest code.

Automation may prepare candidates under a new run ID. It must never:

- invoke `--update-snapshots` or an equivalent update mode;
- overwrite or copy candidate images into the authoritative baseline location;
- accept received output automatically;
- increase diff thresholds, crop comparisons, add masks, or disable states to obtain a pass;
- rewrite performance references after a regression; or
- combine baseline promotion with the implementation under review.

When intent genuinely changes, the human owner performs a separate baseline-promotion action after reviewing the exact old/new images, manifests, contract impact, and implementation diff. Record who approved it and why. If no owner-approved baseline exists, label the evidence **before/after candidate comparison**, not “visual regression passed.”

## 7. Release-recommendation workflow

A complete review packet contains:

- exact commit/worktree state and scoped changed files;
- production build and focused/full test results;
- state manifest and blocking matrix coverage;
- console/network/geometry/label/accessibility/performance summaries;
- before/after/diff contact sheets;
- independent-review findings with P0–P3 status;
- any exception with owner, reason, scope, and expiry;
- a clear `GO`, `NO-GO`, or `INCONCLUSIVE` recommendation.

`GO` requires zero P0/P1, all applicable hard gates passing, every P2 accepted or resolved, and valid same-state visual evidence. `INCONCLUSIVE` is the honest result when capture, rendering, or baseline provenance cannot be trusted.

The automation ends here. It does not push, merge, tag, edit the Pages workflow/settings, or deploy. Publication is a new, explicit, human-authorized task with its own pre-deploy and post-deploy verification.

## Exceptions

An exception must name the gate, affected states/viewports, user impact, evidence, owner, reason, and expiry or removal condition. P0 failures, blank/fallback failures, unreachable primary controls, materially false journey data, and broken exit paths cannot be waived as polish debt.

## Suggested implementation order

This playbook is intentionally usable before every tool is installed. Build the automation in this order:

1. Expand the existing capture harness to the viewport/state manifest and collect console/network failures.
2. Add DOM geometry and Three.js screen-space label probes.
3. Add browser interaction tests and state-by-state accessibility scans.
4. Add deterministic screenshot candidates, diffs, and contact sheets without an update mode available to the automation.
5. Add pinned cross-browser smoke checks and a separately calibrated performance reference.
6. Consider hosted visual review or optional critique vocabularies only after the local evidence model is trustworthy.

Impeccable or external hooks are not part of these steps and must not be installed during ordinary polish work.
