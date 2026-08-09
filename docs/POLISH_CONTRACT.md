# Le Sillage polish contract

Status: project source of truth for visual and interaction polish.

This contract defines what “finished” means for Le Sillage. It applies to human and automated work on the rendered experience. A polish pass may repair, clarify, simplify, or refine the product, but it must not silently redesign the product, rewrite its history, move its quality thresholds, approve its own evidence, or publish itself.

## Product promise

Le Sillage is an intimate, French-language voyage atlas and family tribute built around the five-year journey of *Let It Be*. It is not a dashboard, a generic map utility, a geography game, or a catalogue of effects.

The experience should feel like opening a treasured travel journal that becomes a living globe:

1. The globe, route, boat, date, and story describe one continuous journey.
2. Real route, date, weather, blog, and photo material remain the source of narrative truth.
3. The default **Mode Carnet** is the flagship expression. **Mode réaliste** is a complete alternate view, not a separate product and not the default.
4. The timeline remains an understandable, reachable spine of the experience whenever a full-screen story surface does not intentionally replace it.
5. Decoration supports orientation, memory, and emotion. It never wins over legibility or control.

## Design invariants

### Preserve

- The clear-air, painted-world direction: a light blue sky, cotton clouds, milky watercolor ocean, matte relief, and half-Lambert/cel-shaded character. Defaulting to generic black space is a regression.
- The treasure-map vocabulary: cream paper, lived-in grain, brown ink, aged gold, restrained red accents, stamped route marks, compass and maritime motifs.
- The established type roles: IM Fell English / IM Fell English SC for expressive display moments and EB Garamond for readable narrative and interface text. A fallback must preserve the same old-style serif character.
- The route as a continuous, readable trace and the boat as a slightly oversized, toy-like character. Their intentionally non-literal proportions are part of the emotional miniature-map quality.
- The relationship between what the camera shows and what the timeline, place, date, and weather say.
- French interface copy and the warm, personal voice of the archive.
- Real archive material. Do not invent route facts, dates, weather, quotations, photos, or family details to fill a layout.
- Tactile, hand-made irregularity where it has narrative meaning: a wax seal, paper edges, a boat-shaped timeline thumb, taped photographs, and calligraphic marks.
- Calm, continuous motion that communicates travel, depth, or emergence. Provide an equivalent, complete experience when reduced motion is requested.
- Both render modes, the story, the anchorage dive, the lightbox, playback, scrubbing, follow mode, sound control, and an elegant non-WebGL fallback as supported product surfaces.

### Avoid

- Generic SaaS composition: interchangeable card grids, sterile system typography, product-tour chrome, analytic dashboards, or a toolbar that dominates the voyage.
- Fashion pasted over the project: purple gradients, neon, glassmorphism, glossy 3D badges, emoji used as replacement icons, gratuitous blur, or ornamental motion with no narrative job.
- “More polish” expressed as more texture, more clouds, more labels, more shadows, or more controls. Restraint is part of the direction.
- Labels, clouds, route marks, title, panels, or controls competing for the same pixels. Scenery may frame the story; it must not conceal it.
- Cut-off or ellipsized titles, visible text collisions, unreachable controls, accidental horizontal scroll, clipped fixed surfaces, or content hidden under the viewport edge.
- Solving a screenshot by hiding a supported feature, weakening real content, shrinking important text below legibility, masking the failed region, or changing the tested state.
- Replacing the globe-first composition with a conventional page without an explicit product decision. The 2D view is a graceful capability fallback, not an aesthetic shortcut.
- Adding de-prioritized features such as counters, “Ce jour-là,” “Vous avez grandi,” or a hidden letter without a new product decision.
- Broad redesign during a bounded polish fix. Prefer the smallest root-cause change that improves every affected state.

## Supported viewports

These are CSS viewport sizes. Deterministic visual captures use device pixel ratio 1 unless a test explicitly says otherwise. `P390@2` and one desktop high-DPI smoke run cover scaling behavior.

| ID | Viewport | Role |
| --- | ---: | --- |
| P360 | 360 × 800 | narrow phone portrait |
| P390 | 390 × 844 | reference phone portrait |
| L844 | 844 × 390 | short phone landscape |
| T768 | 768 × 1024 | tablet portrait |
| T1024 | 1024 × 768 | tablet landscape |
| D1366 | 1366 × 768 | minimum reference laptop |
| D1440 | 1440 × 900 | primary deterministic desktop |
| D1920 | 1920 × 1080 | large desktop |

The product is supported at every size above. A smaller screen may use a deliberate compact composition or the graceful 2D fallback, but it may not present a cropped desktop composition or a blank screen.

## State × viewport release matrix

Legend:

- **B** — blocking release capture: run hard gates and human visual review on every release candidate.
- **G** — blocking functional/geometry gates; add a visual capture when the changed area can affect this state.
- **S** — required smoke check before a public release and whenever the related surface changes.

| State | P360 | P390 | L844 | T768 | T1024 | D1366 | D1440 | D1920 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Loading → ready, Mode Carnet | G | B | G | G | G | B | B | G |
| Carnet at route start | B | B | B | G | G | B | B | B |
| Carnet mid-route, normal zoom | G | B | G | G | G | B | B | G |
| Americas/near-zoom label stress | B | B | B | G | G | B | B | B |
| Mode réaliste, same mid-route state | S | B | S | G | G | B | B | G |
| Timeline start / midpoint / end | B | B | B | B | B | B | B | B |
| Playback paused / running | S | B | S | G | G | B | B | S |
| Story card, first and dense chapter | S | B | S | G | G | B | B | S |
| Anchorage dive, top and scrolled | S | B | S | B | B | B | B | S |
| Lightbox open / closed | S | B | S | G | G | B | B | S |
| Keyboard focus traversal | S | B | S | B | B | B | B | S |
| Reduced-motion journey | S | B | S | G | G | B | B | S |
| Loading failure / non-WebGL fallback | S | B | S | G | G | B | B | S |

Chromium in the pinned capture environment is the deterministic visual reference. Firefox and WebKit are blocking functional smoke targets at P390, D1366, and D1440; their raster output is reviewed, not compared pixel-for-pixel with Chromium. A real touch-device check at P390 or narrower is required before a public release that changes touch, zoom, fixed controls, panels, or fallback behavior.

## Hard gates

Hard gates are binary. A failed hard gate blocks a release recommendation.

### Geometry and layout

- The document has no accidental horizontal or vertical page overflow. The dive/story panel may scroll only inside its intentional scroll container.
- Every persistent control and every primary title is fully inside the usable viewport, including safe-area insets, at all supported viewports.
- Persistent UI surfaces do not overlap one another. Text is not clipped or ellipsized unless the contract for that specific field explicitly allows truncation and the full value remains available.
- Primary touch targets are at least 44 × 44 CSS pixels, with at least 8 CSS pixels between adjacent targets where their hit areas could be confused.
- A visible control never depends on hover alone. Hover treatments must have keyboard-focus and touch equivalents.

### Globe labels and scene composition

Location names are canvas textures on Three.js sprites, not DOM text. DOM overflow checks alone can never pass this gate.

For every deterministic capture, the test harness must project each visible label into screen space and evaluate its actual rendered rectangle:

- Priority is deterministic: the current journey location, the selected/keyboard-focused anchorage, and visible route endpoints outrank contextual place names. Record the applied order in the state manifest.
- A priority label has zero intersection with another visible label, persistent UI, or the viewport unsafe area.
- A non-priority label must be culled, clustered, faded, or repositioned when its overlap exceeds 10% of the smaller label rectangle.
- The viewport safe area is at least 16 CSS pixels plus any device safe-area inset. Reserved UI rectangles are expanded by 8 CSS pixels before collision testing.
- A label that is technically in front of the globe but unreadable because it is clipped, scaled into another label, or persistently concealed by foreground scenery is a failure.
- Anchor, route, and label remain visually associated. A displaced label must not imply the wrong anchorage.

### Interaction and accessibility

- Playback, timeline scrubbing, mode switching, sound, story, anchorage dive, lightbox close, follow mode, and return-to-globe paths complete without error.
- All interactive DOM controls are reachable and operable by keyboard. Focus is visible; modal surfaces contain focus appropriately and return it on close; no keyboard trap is introduced.
- Control names, pressed/expanded state, dialog semantics, headings, and range values are exposed to assistive technology. Canvas-only information that is necessary to understand or navigate the journey has a meaningful DOM equivalent.
- Automated accessibility scans report zero critical or serious violations. That result is a gate, not a claim of full accessibility; keyboard and screen-reader-oriented review remain required.
- `prefers-reduced-motion: reduce` removes non-essential travel, parallax, flourish, and autoplay motion without removing content or leaving the interface in a transitional state.

### Reliability and content

- There are zero uncaught exceptions, unhandled rejections, failed required assets, or unexpected 4xx/5xx requests from ready through the tested interaction.
- No supported state is blank, permanently loading, or black. A WebGL or capability failure reaches the useful fallback with an understandable French message.
- Date, place, weather, route position, boat, story, and selected media do not contradict one another in a deterministic state.
- Production build and the focused automated checks pass before visual approval.

### Performance

Performance comparisons are valid only on the same pinned browser, hardware/runner class, viewport, data, and capture state. Establish the first human-ratified performance reference before setting absolute budgets. Until then, a candidate fails if the five-run median regresses by more than 10% for ready time, playback frame time, transferred JavaScript, or peak memory without an approved explanation. Software-rendered CI WebGL and real-GPU observations must not be mixed into one baseline.

## Visual gates

Visual gates require a reviewer looking at consistent before/after evidence. A pixel diff is an alarm, not an aesthetic decision.

A release candidate passes only when:

- The voyage, route, boat, and current place/date form the first readable hierarchy; chrome and ornament are subordinate.
- The main state can be understood in roughly three seconds without prior knowledge.
- Type remains comfortably readable over both rendering modes and at label-dense camera angles.
- Space feels intentional. No edge appears accidentally crowded, empty, cut off, or visually heavier than its importance.
- Clouds, grain, glint, shadows, foam, markers, and flourishes add depth without hiding the route, boat, labels, or controls.
- Mode Carnet remains recognizably painted and tactile; Mode réaliste remains coherent and complete rather than an unstyled exception.
- Motion has a legible beginning and end, preserves orientation, and does not make controls or text chase the camera.
- Compact layouts feel composed for their viewport rather than scaled down from desktop.
- The visual reviewer finds no unresolved P0/P1 issue and the owner has accepted or explicitly deferred every P2 issue.

Severity:

- **P0 — unusable:** blank/frozen experience, data loss, or no path out of a core state.
- **P1 — broken:** clipped/unreachable primary control, unreadable key text, severe collision, broken core interaction, or materially false journey state.
- **P2 — degraded:** obvious hierarchy, spacing, consistency, motion, or secondary accessibility problem.
- **P3 — refinement:** small improvement with no meaningful task or comprehension cost.

## Authority and safety boundaries

### Baselines

- Automation may create timestamped **candidate** screenshots, metrics, diffs, and contact sheets.
- Automation must never run an update-baseline mode, copy actual output over expected output, promote a candidate, raise a tolerance, add a mask, or weaken a gate to make its own change pass.
- Only the human owner may promote an authoritative visual or performance baseline, in a separate explicit action after reviewing the exact same state and environment.
- A baseline change is not a bug fix. It must explain why the intended product changed, show the old and new evidence, and be reviewable independently from unrelated implementation work.
- If deterministic capture is impossible, mark the comparison inconclusive. Do not manufacture stability by hiding the unstable region.

### Publishing

- Polish automation may inspect, edit within an explicitly authorized scope, build, run local previews, test, and prepare evidence.
- It must never push, merge, tag, create a release, deploy GitHub Pages, edit deployment credentials/settings, or trigger a deployment unless the user separately and explicitly authorizes that publishing action.
- Passing this contract produces a **release recommendation**, not a release.

### External layers

The contract is tool-independent. Playwright, an accessibility scanner, performance tooling, or a visual-review service may implement parts of it, but none becomes the quality authority.

[Impeccable](https://github.com/pbakaus/impeccable) is an optional future critique vocabulary, not an installed dependency and not part of the current gate. If it is ever evaluated, pin a reviewed version, keep it project-local, inspect its instructions and hook behavior first, and require owner approval before any installation or hook. It may suggest changes; it may not override this contract, approve baselines, or publish.

## Definition of done

A polish batch is done only when its intended states improve, unaffected states remain intact, all applicable hard gates pass, the blocking matrix is captured, an independent visual review is recorded, and the human owner can make a release decision from the evidence. “Looks better in one screenshot” is not completion.
