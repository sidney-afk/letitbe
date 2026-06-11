# Le Sillage — Plan du projet

> Site hommage aux cinq années de la famille Laruel à bord du voilier **Let It Be**.
> Objectif : une expérience 3D immersive, entièrement en **français**, qui émerveille
> les parents (Éric & Cécile) — un chef-d'œuvre web 2026. Hébergement : GitHub Pages,
> site 100 % statique, aucun backend.

## Contexte (recherches déjà effectuées)

- **Le voyage** : ~5 ans, ~24 500 milles nautiques. Caraïbes (Martinique, Los Roques…)
  → Panama → Galápagos → traversée du Pacifique (Marquises, Tuamotu, Tonga, Fidji)
  → Nouvelle-Zélande → remontée du Pacifique jusqu'en **Alaska** → descente de la côte
  américaine → fin du chapitre bateau à **San Diego** (un 13 janvier) → Mexique (La Paz)
  → camping-car à travers les USA (~5 000 miles) → installation au **Costa Rica**
  (finca + chambres d'hôtes).
- **Le bateau** : « Let It Be », ancien bateau de location personnalisé par la famille.
  Type/modèle exact à déterminer à partir des photos du site.
- **Les livres** : Éric Laruel & Cécile Van Winnendael ont publié
  « Les p'tites bites : Le Pacifique à la voile » (t. 1) et « 95° de latitude Nord » (t. 2).
- **Le site existant** (source de tout le contenu) : https://www.laruel.be
  - `indexLIB.html` — page d'accueil du voyage
  - `Home/home.html` — accueil général
  - `/blogactu/` — blog WordPress avec articles datés (`?p=NNN`, catégories `?cat=N`,
    archives paginées `?paged=NN`) ; ex. cat=7 = « Préparation du bateau »
  - `/Actu/actuNN.html` — pages chronologiques par étape (ex. actu09 = « 2010 Tonga - Fidji »)
  - `/data/album/<Lieu>/targetNN.html` — albums photos par lieu (Alaska, USA2, Los Roques…)
    avec navigation Première/Précédente/Suivante/Vignettes
- Dates exactes du voyage : **à extraire du blog** (probablement ~2009–2014).
- ⚠️ Le site original d'Éric reste intact ; le nouveau site est un hommage qui peut
  pointer vers « la version originale ».

## La vision approuvée — une seule expérience 3D continue

1. **Intro** : écran noir, bruit d'eau → caméra au ras d'un **océan simulé en temps réel**
   (vagues, reflets du soleil) → le titre *Le Sillage* apparaît → au scroll, la caméra
   s'élève, l'horizon se courbe → on est **en orbite autour d'une Terre photoréaliste**
   (atmosphère, nuages, lumières nocturnes, vraies étoiles).
2. **Le sillage** : la route des 5 ans se dessine — ligne lumineuse avec particules
   d'écume. Globe manipulable librement (rotation, zoom).
3. **La plongée** : clic sur un mouillage → la caméra plonge orbite → nuages → niveau de
   la mer ; les photos et les **vrais extraits du blog de cette semaine-là** émergent de
   l'eau. On remonte et on continue.
4. **Les chapitres** (scrollytelling) : récit organisé par océan — L'Atlantique,
   Les Caraïbes, Le Grand Pacifique, La Nouvelle-Zélande, La remontée vers l'Alaska,
   La côte américaine, La terre ferme. Le scroll pilote la caméra le long de la route.
5. **Mode Traversée** : bouton « lecture » → les 5 ans rejoués en ~3 minutes, vol
   automatique au-dessus de la route, photos qui affleurent au passage, ambiance sonore.
6. **La timeline (demandée par Sidney)** : un **curseur temporel** du départ à l'arrivée,
   toujours accessible. On le fait glisser → le bateau se déplace sur sa trajectoire,
   la caméra suit, la date et le lieu défilent en direct. La timeline sert aussi de
   barre de progression au Mode Traversée (Traversée = scrub automatique).

## Fonctionnalités techniques approuvées (toutes)

1. **Le basculement de carte** : un clic morphe la planète entière entre Terre satellite
   photoréaliste et **carte marine ancienne gravée** (sépia, hachures de profondeur,
   rose des vents). Même globe, même route.
2. **Les vents réels** : champ de particules animées des vents sur les océans
   (effet earth.nullschool.net) — couplé à la timeline pour afficher les vents
   **historiques réels** à la date sélectionnée (voir météo ci-dessous).
3. **Le vrai ciel** : ciel nocturne astronomiquement exact selon date + position
   (la Croix du Sud exactement là où ils l'ont vue).
4. **Soleil et terminateur réels** : ligne jour/nuit qui avance ; levers/couchers de
   soleil vécus pendant la Traversée.
5. **Le voilier 3D** : un petit Let It Be fidèle au vrai bateau (modélisé d'après les
   photos du site — coque, couleurs, gréement), qui gîte sous le vent, sillage d'écume.
   Visible en Traversée et quand on scrubbe la timeline.
6. **Transitions liquides** : les photos émergent de l'eau, se dissolvent en embruns.
7. **La météo vécue (données réelles)** : météo historique **ERA5** (réanalyse ECMWF,
   couverture mondiale horaire depuis 1940) via l'API gratuite **Open-Meteo Historical**
   (archive-api.open-meteo.com, + API marine pour les vagues). **Précalculer** pendant le
   build : vent, vagues, nébulosité, pluie le long de la route aux dates exactes →
   stocké en JSON statique, aucun appel API à l'exécution. Les tempêtes du récit
   deviennent des données : ciel qui s'assombrit, pluie, éclairs aux bons endroits.

### Écartées pour l'instant (ne pas prioriser)
« Ce jour-là », compteurs animés, « Vous avez grandi », lettre cachée — Sidney n'était
pas convaincu (sauf peut-être plus tard).

## Pipeline de contenu (première étape de la prochaine session)

1. **Crawler laruel.be** intégralement : blog (tous les articles avec dates), pages Actu,
   albums photos (télécharger les images), page d'accueil.
2. Construire le modèle de données :
   - `data/route.json` — polyline horodatée de la trajectoire complète (bateau + RV)
   - `data/mouillages.json` — { nom, coordonnées, dates, photos[], extraits de blog,
     chapitre }
   - Photos optimisées (AVIF/WebP + fallback), miniatures + plein écran.
3. Géocoder chaque étape ; reconstituer les dates exactes depuis les articles.
4. Précalculer la météo ERA5 le long de la route.
5. Identifier le type de bateau sur les photos pour modéliser le voilier 3D.

## Choix techniques

- **Three.js** (WebGL2), shaders custom (océan Gerstner, atmosphère, morph de textures).
- Textures : NASA Blue Marble / Black Marble (lumières nocturnes), nuages ; relief océan.
- Site statique, bundler Vite, déploiement **GitHub Pages** (workflow Actions).
- Cible : PC puissant de Sidney d'abord, mais prévoir un **fallback 2D élégant**
  (carte plate + timeline) pour vieux appareils/mobiles — personne ne doit voir un
  écran noir.
- Tout le texte d'interface en français (« Embarquer », « Jeter l'ancre ici »,
  « Reprendre la route »…).

## Étapes de build

1. ✅ Crawl + extraction + data model — **fait** (voir « État du pipeline » ci-dessous).
> ⚠️ **Direction artistique (demande de Sidney, juin 2026)** : les rendus
> photoréalistes de la Terre sont jugés trop austères — Sidney imagine une
> esthétique **plus enfantine, plus joviale**. À discuter avec lui avant le
> polish : proposer des pistes (globe illustré façon carnet de voyage /
> aquarelle, couleurs saturées et chaleureuses, soleil descriptif…). La piste
> aquarelle pourrait devenir un mode du « basculement de carte » (fonctionnalité
> 1). L'architecture ne change pas : seuls les textures/shaders/UI s'habillent.

2. ✅ Globe photoréaliste + route + timeline scrubber + bateau — **fait** (`site/`,
   Vite + Three.js ; `cd site && npm install && npm run dev`). Terminateur réel
   (déclinaison saisonnière, longitude subsolaire ancrée au bateau pour éviter
   le stroboscope en lecture), nuages, halo, étoiles d'ambiance, mouillages
   survolables/cliquables, lecture ~3 min. Vérif visuelle headless :
   `node capture.mjs <url> <png> <ms> "date=… zoom=…"` (npm i playwright-core).
   Workflow Pages prêt : `.github/workflows/deploy.yml` (déploie depuis `main` ;
   activer Settings → Pages → GitHub Actions).
3. ✅ Plongées vers les mouillages + galeries photos + extraits du blog —
   **fait** : clic sur une perle → vol de caméra (2,6 s) vers l'ancre →
   « carnet de bord » qui glisse à droite : articles complets datés + photos
   légendées qui émergent en cascade, lightbox plein écran, « Reprendre la
   route » / Échap pour remonter. Photos servies en WebP
   (`site/public/media/`, 1 178 fichiers, 33 Mo, généré par
   `pipeline/sync_site_media.py` depuis `content/media/`).
4. ✅ Chapitres scrollytelling — **fait** : bouton « ☰ Embarquer dans le
   récit » → la molette fait avancer le bateau d'escale en escale (mapping
   sur la séquence d'escales, pas le temps brut : les 17 mois néo-zélandais
   ne pèsent pas les ¾ du défilement), caméra rapprochée qui suit, cartes de
   chapitre (I → VIII + épilogue « La terre ferme ») avec textes
   d'introduction originaux dans `site/src/recit.js`, indicateur de
   progression, timeline synchronisée. Cliquer une perle quitte le récit et
   plonge.
5. Mode Traversée.
6. Fonctionnalités 1–7 (basculement carte ancienne, vents, ciel, météo…).
7. Polish, fallback, audio, déploiement GitHub Pages.

## État du pipeline de contenu (session de juin 2026)

Tout le contenu de laruel.be est archivé et structuré sur cette branche.
Scripts dans `pipeline/` (Python : requests, beautifulsoup4, lxml, pillow),
tous relançables et idempotents.

| Fichier | Contenu |
|---|---|
| `content/site/` | Miroir fidèle du site (4 943 pages + 12 171 images, 700 Mo) |
| `content/manifest.json` | URL → chemin, statut, taille, sha1 de chaque fichier |
| `content/articles.json` | **720 articles datés** (13/2/2008 → 9/7/2017), textes + images légendées |
| `content/albums.json` | **46 albums, 4 760 photos** avec légendes |
| `content/route_log.json` | 134 escales depuis les tables de log de `/Voyages` |
| `content/mouillages.json` | Escales géocodées (table curatée + validations) |
| `content/meteo.json` | Météo ERA5 quotidienne : 1 693 jours (vent, rafales, nébulosité, pluie, T°, vagues `era5_ocean`) |
| `content/videos.json` | 14 vidéos YouTube datées (toutes encore en ligne) |
| `data/roadtrip.json` | Route camping-car sept-oct 2013 : 24 étapes, 4 972 miles (compteur dans les titres « Mxxxx - … ») |
| `content/media/` | Dérivés WebP pleine taille + miniatures 480 px |
| `content/bateau.json` | Caractéristiques et photos de référence du bateau |
| `data/route.json` | Polyline horodatée : 134 points, log 0 → 24 490 nm |
| `data/mouillages.json` | Escales enrichies : 537 articles rattachés par date |
| `data/albums.json` | Albums pour le site |

### Découvertes importantes

- **Le blog WordPress `/blogactu/` est mort** (HTTP 500, PHP 8 incompatible) mais
  son contenu intégral existe en statique dans `/Actu/actuNN.html` (01–18 + actu.html)
  → c'est la source des 720 articles. Rien n'est perdu.
- **Le voyage** : départ Martinique (Le Marin) **27/5/2009**, fin bateau
  **San Diego 13/1/2014** (24 490 nm au log). NZ = 17 mois d'« hivernage » à
  Whangarei (voyages NZ/Australie sans le bateau) — géré dans les jointures
  et la trace météo.
- **Le bateau** : catamaran **Fountaine-Pajot 2004, 14,05 m × 7,38 m**, 123 m²,
  4 cabines (très probablement un **Bahia 46**, à confirmer sur photos —
  `content/bateau.json`). ⚠️ Un catamaran **ne gîte presque pas** : adapter
  l'animation 3D prévue (« gîte sous le vent ») → tangage/roulis légers plutôt.
- **Dates exactes** : tables de log Date/Lieu/nm dans `/Voyages/trajet*.html`,
  croisées avec les dates des articles. Les traversées sont des lignes de log
  (ex. « Transpacifique 24/7→12/8/09 »), interpolées en orthodromie.
- **33 images de contenu cassées sur le site original** (404 à la source,
  listées dans le manifeste) — récupérables un jour via la Wayback Machine,
  mais `web.archive.org` est **bloqué par la politique réseau** de cet
  environnement (l'API `archive.org` répond, elle).
- Open-Meteo (geocoding, archive ERA5, marine) et Nominatim sont accessibles.

### Reste à faire (contenu)

- ~~Route camping-car~~ ✅ `data/roadtrip.json` (le roadtrip des parcs s'est fait
  **pendant** l'escale de San Francisco, sept-oct 2013, en plein shutdown
  fédéral — pas après La Paz comme le supposait le contexte initial).
- `content/media/` (WebP + miniatures) n'est **pas committé** (~480 Mo,
  régénérable : `python3 pipeline/optimize_images.py`). Générer les **AVIF**
  au build final (`--avif`, lent).
- La météo vécue est validée contre le récit (ex. les 5 jours de pluie à Suva
  fin nov. 2010 : 27-41 mm/j, 96-100 % de nuages dans ERA5 ✓ ; la tempête de
  la transpacifique retour : rafales 94 km/h, vagues 6,3 m le 28/5/2012).
  Vagues : modèle `era5_ocean` obligatoire (le modèle par défaut ne couvre
  pas 2009-2014) ; 4 jours/1693 sans vagues (points enclavés/artefacts
  d'interpolation côtière).
- Confirmer le modèle exact du bateau sur les photos `Navigation/images/bateau*.jpg`.
- Associer albums ↔ chapitres (les périodes des albums sont dans `albums.json`).

## Reprise de session (handoff)

Tout le travail est sur la branche `claude/gallant-newton-j3rxtc` (la branche
`claude/sweet-hopper-im4osx` ne contient que le PLAN initial).
**Prochaine session** : étape 2 du build — squelette Vite + Three.js, globe
photoréaliste (textures NASA), tracé de la route depuis `data/route.json`,
timeline scrubber, et le petit catamaran qui suit la trace.
