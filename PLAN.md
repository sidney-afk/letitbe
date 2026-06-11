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

1. Crawl + extraction + data model (bloqué jusqu'à l'accès réseau à laruel.be).
2. Globe photoréaliste + route + timeline scrubber + bateau.
3. Plongées vers les mouillages + galeries photos + extraits du blog.
4. Chapitres scrollytelling.
5. Mode Traversée.
6. Fonctionnalités 1–7 (basculement carte ancienne, vents, ciel, météo…).
7. Polish, fallback, audio, déploiement GitHub Pages.

## Reprise de session (handoff)

Ce dépôt était vide ; tout le travail est sur la branche `claude/sweet-hopper-im4osx`.
La session précédente n'avait pas accès réseau à laruel.be (politique « Trusted »).
**Prochaine session** : vérifier l'accès avec
`curl -sI https://www.laruel.be/indexLIB.html`, puis dérouler le pipeline de contenu
ci-dessus avant de coder le globe.
