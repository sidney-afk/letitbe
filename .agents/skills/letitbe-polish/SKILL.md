---
name: letitbe-polish
description: Audit, plan, implement, and verify visual or interaction polish for the Let It Be / Le Sillage Three.js experience. Use for screenshot review, responsive clipping, WebGL label collisions, visual hierarchy, interaction quality, accessibility, before-and-after comparison, or release-quality polish evidence in this repository.
---

# Let It Be polish

Use the repository's own product contract and evidence loop. Preserve the voyage's approved identity while fixing measurable defects and reviewing aesthetic quality separately.

## Read first

1. Read `docs/POLISH_CONTRACT.md` completely.
2. Read `docs/POLISH_QA.md` completely.
3. Read `PLAN.md` and the relevant implementation or capture files for the scoped surface.

Explicit user instructions govern the current task. The contract governs unstated polish decisions. Current rendered evidence governs claims about current behavior.

## Choose the work mode

- For an audit, diagnosis, plan, or review, remain read-only unless the user explicitly asks for implementation.
- For implementation, state the exact issue, states, viewports, pass condition, and file scope before editing.
- For release review, inspect existing evidence and return `GO`, `NO-GO`, or `INCONCLUSIVE`; do not publish.

## Follow the polish loop

1. Record branch, commit, pre-existing changes, and the authorized scope.
2. Reproduce the problem at an exact state and viewport.
3. Capture a before image and hard-gate evidence using a stable manifest.
4. Classify findings as objective failures or judgment-based improvements and assign P0–P3 severity.
5. Group by root cause and change one bounded batch.
6. Recapture the identical state and viewport. Reject comparisons whose camera, date, zoom, mode, timing, content, or environment changed.
7. Run focused hard gates, then every applicable blocking cell in the contract's state × viewport matrix.
8. Ask an independent reviewer to inspect the evidence before presenting the implementer's explanation.
9. Report changed files, validation, artifacts, unresolved findings, and recommendation.

## Apply project-specific checks

- Treat Mode Carnet as the flagship default and Mode réaliste as a complete alternate view.
- Preserve the globe/route/boat/timeline/story relationship, French voice, real archive material, painted atmosphere, paper-and-ink interface, and restrained maritime ornament.
- Reuse or extend `site/capture.mjs` state vocabulary instead of inventing a disconnected capture path.
- Remember that place names from `site/src/etiquettes.js` are canvas-backed Three.js sprites. DOM overflow and accessibility scans cannot detect their clipping or collisions. Require screenshots plus projected screen rectangles and reserved-UI collision checks.
- Test loading, route endpoints, label-dense near zoom, both modes, playback, story, dive, lightbox, keyboard, reduced motion, and graceful non-WebGL behavior as required by the matrix.
- Do not fix one screenshot by hiding supported content, weakening real copy, shrinking key text below legibility, or changing the tested state.

## Keep authority with the owner

- Never install Impeccable, another external skill, a visual service, or a repository hook as part of ordinary use of this skill.
- Never run `--update-snapshots` or an equivalent, overwrite an authoritative baseline, auto-accept output, raise tolerance, add a mask, disable a state, or rewrite a performance reference to make the current work pass.
- Candidate screenshots and diffs are allowed only under a new immutable run ID. Only the human owner can promote them in a separate explicit action.
- Never push, merge, tag, release, edit Pages/deployment settings, or deploy unless the user separately and explicitly authorizes that publishing action.
- Never claim full accessibility from screenshots or an automated scan.
- Preserve unrelated and pre-existing worktree changes.

## Report findings and handoff

For each finding, provide state, viewport, surface, evidence, observed behavior, user impact, pass condition, objective-versus-judgment classification, severity, confidence, and status.

For a completed batch, lead with the outcome. List exact files changed, focused and full validation, evidence locations, unresolved P2/P3 items, any invalid or missing comparison, and the release recommendation. State plainly that no baseline was promoted and no deployment was performed.
