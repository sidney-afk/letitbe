# Le Sillage: finish log

Working log for the "make it finished" loop. Newest decisions at the bottom of
each section. Ranked by how much each item matters to a first-time visitor
(Éric and Cécile opening the link for the first time, on a laptop or a phone).

## Needs Sidney

- **Who signed the two books?** PLAN.md says Éric Laruel and Cécile Van
  Winnendael published them; the archive only shows Éric writing "mon livre"
  and the Costa Rica page saying "les livres de nos aventures". The epilogue
  now names the two titles without an author line. If both signed them,
  say so and I will add "d'Éric Laruel et Cécile Van Winnendael" back.

## How the audit was done (2026-10-10, first pass)

- Built `site/` (`npm ci && npm run build`) and served the production build
  (`npm run preview`).
- Walked through it in headless Chromium (software WebGL) as a visitor, with
  real clicks: first load, play the crossing, drag the timeline, story mode,
  "Explorer les escales", open Fakarava, scroll the journal, return, realistic
  mode, end of the voyage, and the no-WebGL fallback. Viewports: 1440×900 and
  390×844 (phone, touch), then the rest of the contract matrix as items are
  fixed.
- Measured what the browser downloads before the globe appears.
- Existing Playwright suite (`npm run test:qa`) used as the regression net.

## Ranked list

Legend: P0 unusable, P1 broken, P2 degraded, P3 refinement.

### 0. The story chapters contained factual errors (P1, integrity) — DONE

- A line-by-line check of the chapter texts against the blog found eight
  errors (e.g. "Hilo après dix-sept jours": the blog says 13; "Dix-neuf jours"
  to the Gambier: 20; "un long hiver austral aux Marquises": it was the
  cyclone season; the Mexico stop never happened; the iguana line said the
  opposite of the blog; chapter V/VI dates) and several overstatements.
- Two ocean crossings were tagged with the wrong chapter, so the story showed
  chapter III during the 2012 return crossing.

### 1. First load is slow and shows an empty blue screen (P1) — DONE

- 18.6 MB is downloaded before the globe appears (measured): the boat model
  alone is 9.6 MB (three uncompressed PNG textures for a figurine that is a
  few dozen pixels wide), and the five photo-realistic textures (4.7 MB) are
  fetched even though the painted "Carnet" mode is the default.
- During that wait the visitor sees a plain blue sky and a lone
  "Explorer les escales" button, no title, no sign that anything is loading.
  On a phone on 4G this lasts many seconds.
- Fix: compress the boat model, load realistic textures only when the visitor
  switches mode, and add a real loading screen (title, a line of ink that
  fills, French message) that hands over to the globe.

### 1b. Half of the blog's photos were silently dropped (P1, content) — DONE

- `pipeline/extract_articles.py` only recognised `<img src=…>` and skipped
  `<img class="photo" src=…>`: 1,122 of the 2,373 photos embedded in the
  blog posts were lost, captions included (e.g. "L'énorme gâteau de
  Syr Daria"), and their captions leaked into the text as run-on sentences.
- Fixed; every post now also keeps its paragraphs and photo positions
  (`blocs`). Stop journals show 1,698 photos instead of about 1,180.

### 2. Nothing tells a first-time visitor what to do (P1) — DONE

- The globe appears with a row of controls but no invitation. The most
  moving feature (the crossing replayed with photos) hides behind a small
  ship's-wheel icon with no label. Parents will not guess it.
- Fix: a short welcome card over the globe (who, what, when, from the real
  archive) with one clear primary action ("Revivre le voyage") and a quiet
  secondary one ("Explorer la carte"). Dismissed for the session.

### 3. Phone: the stop journal header is broken (P1) — DONE

- At 390×844, opening a stop squeezes the dates into a one-word-per-line
  column and cuts "Reprendre la route" off the left edge.
- Cause: a CSS specificity clash puts the mobile scene caption in the same
  grid row as the dates.

### 4. Arriving at a stop shows a blurry, pixelated map (P1) — DONE

- Every stop opens on its real satellite view, in a porthole with an anchor
  at the mooring. On wide screens (≥ 1000 px, Carnet mode) the porthole
  floats large over the sea beside the journal; otherwise it heads the
  journal. The flat red pennant is gone.
- Decision: moving the camera does not help. Mid-ocean atolls are a few
  dark specks on the painted globe at any zoom, so the real image has to
  carry the arrival.


- 125 of the 127 stops zoom the painted globe far past its resolution:
  Fakarava arrives as a flat blue square with a few dark pixels. Only Makogai
  and Opua have a reviewed close-up.
- Every stop already has a real 97 km satellite view (Esri, 1024 px) in
  `media/aerien/`, unused.
- Fix: stop at a distance where the globe is still sharp, and show the real
  aerial view of the stop as a framed "vue du ciel" in the journal (with its
  credit), instead of an enlarged texture.

### 5. During the crossing, photos cover the controls (P1) — DONE

- The polaroids that rise during playback sit on top of
  "Explorer les escales" and the timeline's anchor tab; the second card's
  caption disappears behind the timeline (1440×900).

### 6. The album photos and videos are never shown (P2, high value) — ALBUMS IN PROGRESS

- Decision (2026-10-10): publishing all 4,760 album photos would add about
  400 MB. Instead `pipeline/build_albums.py` picks up to 24 photos per album
  (captioned ones first, spread across the album), attaches each album to
  the stops visited in its period and region, and every album links to its
  complete version, still online on laruel.be. About 69 MB.

- The archive holds 46 albums with 4,760 photos, 4,412 with the parents'
  own captions, and 14 YouTube videos. The site shows none of them; only the
  photos embedded in blog posts appear.
- Fix: per-stop "Album" strip in the journal (photos whose album period and
  place match the stop), and the dated videos in the journal of the matching
  stop. Needs WebP derivatives at a sensible size.

### 7. The voyage has no ending (P2) — DONE

- When playback reaches San Diego it simply stops. The epilogue
  ("La terre ferme") exists only inside story mode.
- Fix: arriving at the end shows the epilogue card and a quiet "Revivre le
  voyage" action.

### 8. No credits, no link to the original site (P2) — DONE

- The boat model is CC BY 4.0 and requires visible attribution; the aerial
  views need their Esri/Maxar credit; the original laruel.be is never
  mentioned although every word comes from it.
- Fix: a small "À propos" colophon: the family's site, the two books,
  credits.

### 9. "Explorer les escales" stays open after use (P2) — DONE

- After choosing a stop and coming back, the menu is still open and covers
  part of the globe (large on a phone).

### 10. The boat reads as a white paper rectangle (P2)

- The follow camera looks straight down on the catamaran, so it reads as a
  white strip, not a boat. A slightly oblique follow view (boat in the lower
  part of the frame, globe curving ahead) would read as a boat under way.

### 11. The 2D fallback shows invented continents (P2)

- With no WebGL, the "map" is green ellipses (not real land) and the route
  sits in a corner; the list cannot open any journal.
- Fix: the real painted world map as a flat image, the route on top, and
  each stop opening its journal.

### 12. Smaller polish (P3)

- Story mode help line ("…la molette zoome") overlaps the subtitle on phones
  and mentions a mouse wheel on touch screens.
- The journal text is one wall of text: the blog's paragraphs (and photo
  captions) were flattened, so sentences run into each other
  ("…Syr Daria Croft On s'est empiffré…"). Rebuild paragraphs from the
  archived HTML. (P2, high value for the parents.)
- The timeline starts on 27 May 2009 "En mer — Martinique → Ste Lucie"
  although the boat left on the 28th (the log table's date is approximate).

- Label collision "Panamá/Aruba/Martinique" at the start of playback (desktop).
- Phone: weather line wraps ("ciel / couvert"), top buttons are bare icons.
- Phone: the story card covers the boat.
- 24 of 134 stops have no blog article; their journal is a single line.

### Promised in PLAN.md and not built

- Animated morph between Carnet and realistic modes; engraved sea-chart
  variant (feature 1).
- Wind particles (feature 2; judged heavy).
- Real time of day for sunrise/sunset during the crossing (feature 4).
- Camping-car route of autumn 2013 (`data/roadtrip.json`) not drawn.

## Done

- **Batch 1 (2026-10-10): first load and layout.**
  - First load 18.6 MB → 5.75 MB on a laptop, about 3.4 MB on a phone:
    boat model meshopt + WebP (9.6 → 1.3 MB, same look), realistic-mode
    textures loaded only on demand (hover/focus preloads, the first switch
    shows a busy globe icon), phones get a 4096 px painted globe (a quarter
    of the GPU memory of the 8192 px one).
  - Loading screen: title, a little sailboat moving along a dotted route as
    the pieces arrive, a French error message with "Réessayer" if loading
    fails, and the map fallback if the graphics driver refuses WebGL. Data,
    stars, boat and relief now download in parallel.
  - Phone journal header fixed (dates on one line, "Reprendre la route" fully
    visible).
  - Playback photos sit above the timeline; "Explorer les escales" steps aside
    during playback, folds away once a journal is opened, and no longer sits
    on the timeline's anchor tab on phones; it no longer appears on the blank
    sky before the globe.
  - Tests: made the Makogai sea-wash check deterministic (it raced the live
    render loop), gave the performance reference enough time on software
    WebGL.
- **Batch 2 (2026-10-10): story facts.** Every chapter text rewritten from
  the archive, each with a short dated quote in the parents' own words
  ("C'est à la fine pointe de l'aube…", "nous avons tous, je pense, une petite
  larme à l'oeil…", "Let It Be, c'est fini…"). Crossing chapters fixed in
  `data/` and in `pipeline/geocode_route.py`. Empty-journal line no longer
  invents a reason. Page description no longer says the boat went to Alaska.

- **Batch 3 (2026-10-10): welcome, journal, ending, credits.**
  - Welcome card ("page de garde") once the globe is ready: who, when, where
    (from the archive), a primary "Larguer les amarres — le voyage en trois
    minutes" and a quiet "Explorer la carte". Escape explores. Phones show
    it low so the globe is visible above.
  - Journals: every photo of the blog back in place (see 1b), paragraphs
    kept, and a "Vue du ciel" porthole at the top of every stop: the real
    satellite image of the place, an anchor where they moored, Esri credit.
  - The replayed voyage now ends on the epilogue card instead of stopping.
  - "À propos et crédits" dialog (from the stop menu and the epilogue):
    laruel.be link, the two books, and every required credit (the boat
    model's CC BY licence among them).
  - Story help line rewritten (no more "molette" on phones).
  - Fixed a 404 on every load (`vues_aeriennes_sentinel.generated.json`).
  - Found and fixed: Escape could not close a dialog while the story was
    open.

## Ideas for later

- During the crossing, a brief chapter title (and its quote) as the boat
  enters each chapter, so the three-minute replay reads as a story.

- Per-chapter ambient sound variations.
- "Ce jour-là" and similar features stay out (owner decision in PLAN.md).

## Decisions

- 2026-10-10: the owner's loop instructions authorize committing, pushing,
  opening and merging pull requests into the default branch
  (`claude/sweet-hopper-im4osx`) in small verified steps. This overrides the
  "never push or merge" and "owner promotes baselines" rules of the polish
  contract and skill for this loop only.
