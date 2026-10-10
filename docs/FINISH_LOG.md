# Le Sillage: finish log

Working log for the "make it finished" loop. Newest decisions at the bottom of
each section. Ranked by how much each item matters to a first-time visitor
(Éric and Cécile opening the link for the first time, on a laptop or a phone).

## Needs Sidney

- **The boat's look (taste call, not blocking).** During the crossing the
  3D catamaran is seen from straight above and reads as a small white
  rectangle with an ink outline, not as a sailboat. This is your own
  11 August change ("Improve Let It Be catamaran presentation": a stable
  model that never turns toward the camera, locked flat by tests), which
  replaced the earlier figurine that turned to show its profile from afar.
  Three options: keep it; bring back the profile view from afar (your
  second-round note: "de loin il pivote pour se montrer de profil"); or a
  hand-drawn sailboat like the one on the timeline. Say which and I will
  build it.

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

### 6. The album photos and videos are never shown (P2, high value) — DONE

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

### 10. The boat reads as a white paper rectangle (P2) — IMPROVED

- Batch 5: an ink silhouette (constant 1.6 px, drawn under the model so
  only the outer rim shows) and a soft shadow on the water. It now reads as
  a drawn figurine. Still seen from straight above during follow, so it
  remains a white catamaran deck rather than a sailboat profile.
- Decision: the earlier sessions deliberately locked the model flat on the
  sea and never turned toward the camera (tests codify it). Turning it into
  a profile "game piece" or adding sails was tried before and rejected as
  a "drone" silhouette. Kept that decision; revisit only with Sidney.

- The follow camera looks straight down on the catamaran, so it reads as a
  white strip, not a boat. A slightly oblique follow view (boat in the lower
  part of the frame, globe curving ahead) would read as a boat under way.

### 11. The 2D fallback shows invented continents (P2) — DONE (batch 5)

- With no WebGL, the "map" is green ellipses (not real land) and the route
  sits in a corner; the list cannot open any journal.
- Fix: the real painted world map as a flat image, the route on top, and
  each stop opening its journal.

### 12. Smaller polish (P3)

- ~~Story mode help line ("…la molette zoome") overlaps the subtitle on
  phones~~ Fixed in batches 3 and 6.
- ~~The journal text is one wall of text: the blog's paragraphs (and photo
  captions) were flattened, so sentences run into each other
  ("…Syr Daria Croft On s'est empiffré…").~~ Fixed in batch 2 (posts are
  rebuilt from the archived HTML as paragraphs and photos in their order).
- ~~The timeline starts on 27 May 2009 "En mer — Martinique → Ste Lucie"
  although the boat left on the 28th~~ — fixed in batch 4.

- ~~Label collision "Panamá/Aruba/Martinique" at the start of playback
  (desktop).~~ Not seen any more in the third pass (labels reworked).
- ~~Phone: weather line wraps ("ciel / couvert"), top buttons are bare
  icons.~~ Fixed in batch 8.
- ~~Phone: the story card covers the boat.~~ Fixed in batch 6.
- 24 of 134 stops have no blog article; their journal is a single line.

### Promised in PLAN.md and not built

- ~~Animated morph between Carnet and realistic modes~~ (a dissolve, batch
  15); engraved sea-chart variant (feature 1) still open.
- Wind particles (feature 2; judged heavy).
- Real time of day for sunrise/sunset during the crossing (feature 4).
- ~~Camping-car route of autumn 2013 (`data/roadtrip.json`) not drawn.~~
  Built in batch 7.

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

- **Batch 4 (2026-10-10): the crossing as a story.**
  - Pacing: the replay used raw calendar time, so the boat sat still at
    Whangarei for about 45 of the 180 seconds. It now runs on a "story
    clock": each day at sea keeps its weight, a stop counts for 1.5 to
    7 days, very long stays a little more (`voyage.lecture` in `geo.js`).
    The NZ wintering now takes 4 s, the 20-day Pacific crossing about 5 s.
    The timeline slider stays linear in time.
  - The rising photos now come from the blog and the albums of that stop,
    preferring photos with the family's own short caption, which is shown
    on the print ("Taravai : visite à terre. Eric cueille des piments").
  - Each chapter is announced by a brief title as the boat enters it.
  - Satellite porthole preloaded during the dive flight; dark sea tone
    while it loads.
  - The family's films: 8 of the 14 YouTube videos are placed in the
    journal of the stop they name (Tahanea's mantas, the Tonga whales,
    "Le port du Marin présenté par Sidney"…). `pipeline/build_videos.py`
    keeps the mapping explicit; "Sous l'eau" (July 2010) names no place and
    stays unplaced; the five pre-departure videos are outside the voyage.
    Thumbnails are hosted with the site; the YouTube player (no-cookie)
    loads only on click, with a "Voir sur YouTube" link as a fallback.
  - Departure date: the boat left Le Marin on 28 May 2009 at dawn (blog,
    "D Day"); the log table said 27. The timeline now starts at anchor in
    Martinique, and the "D Day" post sits in the Sainte-Lucie journal.

- **Batch 5 (2026-10-10): boat and first load.**
  - Ink outline and water shadow on the catamaran (see 10).
  - The journals (1.3 MB of blog posts) download right after the globe
    appears instead of before: phone first load 3.4 → 3.0 MB before the
    globe (18.6 MB at the start of the day).
  - Phones: a tap had to land within about 12 px of a stop's small ring
    to open it (measured). A tap that misses now opens the nearest visible
    stop within 30 px, a fingertip's reach.
  - Fallback without WebGL: the real painted map of the voyage's half of
    the world (`pipeline/carte_fallback.py`, 126 KB) with the route and
    every stop, and each stop of the list opens its journal in place.
    Fixed a grid bug that slid the list under the map on phones.
  - "À propos" gains **L'équipage** (the five sepia portraits and roles
    from laruel.be's crew page — "La capitaine", "Le fidèle lieutenant",
    "Le moussaillon n°1/2/3" — each with one line in the family's words) and
    **Le bateau** (Let It Be under sail, the Maori treble clef on the hull,
    and the specifications from the boat page). The welcome card links to it
    ("L'équipage et le bateau").
  - The journal panel now fades in rather than sliding: the slide (an
    offset) waited for a first frame in headless runs and left the panel
    40 px off-screen; the header still glides.
  - Decision (test): the fallback page is one intentional vertical scroll
    container; the containment check now lets its content continue below
    the fold (never past the sides). Nested scroll areas on a phone were
    worse than a page that scrolls.

- **Batch 7 (2026-10-10): the 2013 road trip, and journals that hold still.**
  - The five-week camper-van trip through the western parks (23 posts,
    4,972 miles on the counter the family wrote at the top of each post)
    happened during the San Francisco stop and was invisible: its posts sat
    deep inside the San Francisco journal and the globe never showed it.
  - On the globe: a dark dashed line on a pale ribbon across the land, so it
    reads as a road and not as the golden sea route. Zoomed in, each stop
    gets a small ink dot; hovering shows the place, the date and the
    mileage ("Bryce Canyon · 18 oct. 2013 · en camping-car, 3 495 miles");
    clicking (or a fingertip nearby) opens the San Francisco journal right
    at that post. From afar, hovering the line says what it is and opens
    the trip.
  - In the San Francisco journal: a card at the top announces the trip;
    before its first post, a short introduction in the family's words
    ("bien sage dans la marina", five weeks, the mile counter), a small map
    painted like the globe (`pipeline/carte_roadtrip.py`, 53 KB) with the
    trail and the big names, and the list of the 23 posts. Every dot and
    every row jumps to its post, which is underlined for a moment like a
    highlighter. Same section in the no-WebGL fallback.
  - Facts checked against the 23 posts: M740 says "à Rupert, Idaho", not
    Twin Falls (fixed); the departure day is never written ("après 3 jours
    de route"), so the start has no date; the line passes through the
    places the posts name between stops (Davis, Idaho Falls, Salt Lake City,
    Valley of the Gods, Goosenecks, Canyon de Chelly, Sedona, Mono Lake,
    Sequoia). The map says the exact roads were not recorded.
  - Every journal photo now carries its size in the data
    (`pipeline/dimensions_photos.py`, 1,698 post photos and 1,042 album
    photos), so its place is reserved before it loads: the page no longer
    jumps while reading, and a jump to a post lands on it. A jump also holds
    its post while the albums and films arrive above it.
  - The stop tooltip said "nm au log": now "milles au log", like the
    journal.
  - Tests: the road trip on the globe (hover, click, the journal opening at
    that post, the map and list jumps, the line back after closing) and in
    the fallback.
  - The journal header now rises a few pixels as the panel fades in,
    instead of sliding in from the right: in one headless run the slide
    waited for its first frame and the header sat 28 px past the screen
    edge (the Nuku Hiva containment check). Rising from below can never
    leave the screen.

## Second first-time-visitor pass (2026-10-10, after batch 5)

Laptop 1366×768 (welcome → explore → hover → click a stop → journal →
album → back → story → realistic → keyboard → 1024×768) and phone 390×844
(welcome → crossing → pause → tap a stop → journal → album → back → story
→ realistic → rotate to landscape). No errors, no failed requests.

Found and fixed (batch 6):
- Rotating a phone made the timeline vanish and fade back in over ~3 s:
  phone and desktop used different entrance animations, and switching
  layout restarted it. One animation now, the timeline centred by margins.
- After the welcome card the controls took ~3 s to appear (staggered
  delays designed for the old load); now 0.1–0.55 s.
- Leaving a journal on a phone left the camera zoomed on one region (orbit
  3.0 instead of the phone's whole-globe 7.9): it now returns to the
  visitor's own zoom.

- Keyboard: after closing the welcome card (Escape or a button), focus
  stayed on its fading, invisible buttons and Tab cycled through them. The
  card is now inert as it fades, and focus moves to "Explorer les escales"
  (or the play button after "Larguer les amarres").

- Phone, story mode: the chapter card covered the boat. On upright phones
  the card now sits low above the timeline (long text scrolls inside) and
  the globe view shifts up (`camera.setViewOffset`) so the boat shows
  above it; the stop menu steps aside while the story is open.

Seen and left as is:
- In headless runs the journal and porthole appear late; traced to the
  headless frame rate, not the product (image loaded, animation pending).

## Third first-time-visitor pass (2026-10-10, after batch 7)

Laptop 1366×768 and phones 390×844 and 360×740: welcome → "Larguer les
amarres" → crossing at 1.5, 4, 9 and 20 s → pause. No errors.

Found and fixed (batch 8):
- Phone: the weather line broke in the middle of its words ("grand /
  beau", "pluie 7 / mm"). Each part of the bulletin is now one unbreakable
  piece, and a phone keeps the pieces that fit on one line.
- Phone: pausing the crossing brought "Explorer les escales" back exactly
  where a rising photo sat, covering its caption. Paused, the photos now
  sink away at once.
- Phone: the two top buttons were bare icons (a globe, a book). They now
  carry one short word: "Réaliste" (or "Carnet") and "Récit" (or
  "Quitter").

Seen and left as is:
- The boat at crossing zoom still reads as a white rectangle seen from
  above (see Needs Sidney: it is his explicit design, locked by tests).

Built next (batch 9):
- **Escale précédente / suivante.** At the end of every journal (and under
  the line of a stop without a post) two buttons open the neighbouring
  stops, so the voyage can be read stop after stop like the logbook,
  without going back to the globe. From a reviewed close-up (Makogai,
  Opua) the camera first rises through the sea wash, then flies on.
  Moving between journals keeps what the visitor left on the map (focus,
  lens, zoom) for the final return; before, entering a second stop would
  have recorded the close-up's 5° lens as "the map's".
- **Posts filed under the wrong stop (found through the new buttons).**
  "Nananu, ça sent la pizza" sat in Naigani's journal while Nananu said
  no post was written there. The date rule picked the shortest stay
  around a post's date, and a short stop next door often won. Now a post
  whose title names one of the candidate stops goes to that stop
  (`pipeline/build_data.py`): 29 posts moved, each to the place its own
  title names ("Bora Bora, ne croyez pas tout…" from Raiatea to Bora
  Bora, "Les Gambier, enfin !" from the crossing to Gambier, the Fatu Hiva
  posts from Tahuata to Fatu Hiva, the Canadian anchorages). Nothing else
  changed: the rebuilt data was identical before the rule change.

Built next (batch 10):
- **23 posts could not be read anywhere.** Posts dated during a sea
  crossing were filed under the crossing itself, and a crossing has no
  journal on the site: the whole first Pacific crossing diary ("Traversée
  du Pacifique J3 … J20"), the four "En mer" of the return crossing,
  "Farewell New Zealand", the Panama Canal day ("Colon, le grand jour",
  "Lac Gatun - Balboa"), "Equateur", "Bye Bye Hawaii", "San Francisco,
  arrivée dans la brume". Crossings no longer own posts: a post goes to
  the stop it was written at, or, written at sea, opens the journal of
  the stop the boat was sailing to ("✉ écrit en mer").
- **Le sommaire du carnet.** The whole logbook as a table of contents:
  the eight chapters of the story, their stops, and under each stop the
  titles of its posts, 537 in all. A search box finds a post or a place
  ("noel hiva", "baleines", "fakarava"); choosing a post opens that
  stop's journal right at it. Reached from "Explorer les escales" and from
  the welcome card, for a visitor who comes to read rather than explore.
- Batch 11: a "Sommaire" button in every journal's header opens the table
  of contents on top of the journal, so a reader hops from post to post
  without going back to the globe. While a native dialog is open, the
  journal no longer pulls the keyboard focus back into itself.
- Batch 12: **the crossings have their photos.** During the three-minute
  replay, photos rose only at stops, so the long ocean crossings (the
  heart of the voyage) passed with nothing on screen. At sea the replay now
  shows the photos of the posts written on board that very day: the dorado
  on the stern ("Une dorade coryphène sur la jupe bâbord"), "Message in a
  bottle", the broken topping lift, "Vitesse du bateau: 14.3 noeuds, ça
  décoiffe !!", the equator crossing, each captioned "En mer · <date>".
  And the "écrit en mer" label is now only given when it is true (during
  a logged crossing, or when the title says so): "Los Roques" and the two
  Nuku Hiva posts lose it, and the two San Blas posts move from Panama's
  journal to San Blas, the stop their titles name.
- Batch 13: each story chapter card ends with "Lire les billets de ce
  chapitre", which opens the table of contents at that chapter; choosing a
  post leaves the story for the journal. Found on the way: on a laptop
  768 px high, a long chapter card reached down over "Explorer les
  escales" (the menu took the clicks). The menu now steps aside during
  the story on every screen, as it already did on phones.
- Test decision (follow-up): the same 30 s allowance now covers the two
  other tests that make the first realistic switch (controls and Escape,
  main smoke path), after one of them hit the 8 s default too. Noted as a
  product item: phones decode the 5400 px realistic day map as well.
- Test decision: the realistic-mode layout check gave the mode switch the
  default 8 s, but since batch 1 the first switch waits for the realistic
  textures. In one run they downloaded in 0.13 s and the software decode of
  the 5400 px day map took the rest. The check now allows 30 s for that
  first switch (passes 2 runs out of 2); the busy globe icon covers the
  wait for a real visitor.
- Test decision: "aerial imagery stays hidden during the dive" stepped the
  flight by hand while the page's own loop kept moving it, so one slow run
  finished the flight before the mid-flight check. It now pauses the live
  loop first, exactly like the sea-wash test next to it (passes 3 runs out
  of 3). Same assertions, nothing skipped.
- Testing note: in headless Chromium the page's animation clock freezes
  once the globe renders (measured: `document.timeline` stops advancing
  even with the 3D loop stopped). Screenshots taken without reduced
  motion can show panels mid-fade; the suite runs with reduced motion and
  my visual checks now do too.

## Fourth first-time-visitor pass (2026-10-10, after batch 13)

Tablet 1024×768 and 768×1024, phone on its side 844×390, then 1366×768:
welcome → globe → menu → table of contents → a journal → story → crossing.
Overlaps measured from the page itself (element boxes), with animations
forced to their end, since the headless clock freezes. No errors.

Found and fixed (batch 14):
- Phone on its side: the open "Explorer les escales" menu started 57 px
  above the screen, its own header out of reach (the new table-of-contents
  button made it taller). On short screens its body now scrolls and its
  header stays below the title.
- Phone on its side: the story card ran 8 px under the timeline. It now
  stops above the timeline and its anchor tab.
- Upright tablet (768 px): the sound seal sat 44 px over the end of the
  title, the full button labels being too wide. Up to 900 px the top
  buttons now use their icon and one word, as on phones.
- The ❧ closing a chapter card was pinned to the card's corner and sat on
  the last words of a card that scrolls; it now follows the text.

Built next (batch 15):
- **The two maps dissolve into each other** (PLAN feature 1, "le
  basculement de carte… morphe"). Switching between the painted globe and
  the realistic one used to jump. The last frame of the old look is now
  copied onto a veil above the scene (below every control) that fades out
  over 0.9 s, so one map seems laid over the other. Skipped for visitors
  who ask for reduced motion. Not built: the engraved sea-chart variant,
  and wind particles (PLAN judged them heavy).

## Ideas for later

- Chapter quotes could also appear during the crossing (kept to titles for
  now: three minutes leave little reading time).

- Per-chapter ambient sound variations.
- "Ce jour-là" and similar features stay out (owner decision in PLAN.md).

## Decisions

- 2026-10-10: the owner's loop instructions authorize committing, pushing,
  opening and merging pull requests into the default branch
  (`claude/sweet-hopper-im4osx`) in small verified steps. This overrides the
  "never push or merge" and "owner promotes baselines" rules of the polish
  contract and skill for this loop only.
