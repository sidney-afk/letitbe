// Le sommaire du carnet : tout le blog du voyage comme la table des matières
// d'un livre de bord. Les chapitres du récit, leurs escales, et sous chaque
// escale les titres des billets écrits là. Une recherche filtre billets et
// escales ; choisir un billet ouvre le carnet de l'escale à ce billet.

const formatJour = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});
const formatAnnee = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const jour = iso => new Date(`${iso}T12:00:00Z`);

// « Noël à Hiva Oa » et « noel hiva » se retrouvent
const cle = texte => (texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function creerSommaire({ escales, mouillagesParCle, carnetsPrets, chapitres, ouvre }) {
  const dialogue = document.getElementById('sommaire');
  if (!dialogue) return null;
  const liste = document.getElementById('sommaire-liste');
  const recherche = document.getElementById('sommaire-recherche');
  const compte = document.getElementById('sommaire-compte');
  let declencheur = null;
  let entrees = null; // [{ element, texte, chapitre, escale }]
  let totalBillets = 0;

  function construit() {
    entrees = [];
    totalBillets = 0;
    const fragment = document.createDocumentFragment();
    let chapitreCourant = null;
    let blocChapitre = null;
    for (const escale of escales) {
      const complet = mouillagesParCle.get(`${escale.nom}|${escale.date_arrivee}`) ?? escale;
      const nomChapitre = complet.chapitre;
      if (nomChapitre !== chapitreCourant) {
        chapitreCourant = nomChapitre;
        blocChapitre = document.createElement('section');
        blocChapitre.className = 'sommaire-chapitre';
        const h = document.createElement('h3');
        const infos = chapitres[nomChapitre];
        const numero = document.createElement('span');
        numero.className = 'sommaire-numero';
        numero.textContent = infos?.numero ?? '';
        const titre = document.createElement('span');
        titre.textContent = nomChapitre ?? '';
        const periode = document.createElement('span');
        periode.className = 'sommaire-periode';
        periode.textContent = infos?.periode ?? '';
        h.append(numero, titre, periode);
        blocChapitre.append(h);
        fragment.append(blocChapitre);
      }
      const articles = complet.articles ?? [];
      totalBillets += articles.length;
      const bloc = document.createElement('div');
      bloc.className = 'sommaire-escale';
      const lieu = document.createElement('button');
      lieu.type = 'button';
      lieu.className = 'sommaire-lieu';
      const nom = document.createElement('span');
      nom.className = 'sommaire-nom';
      nom.textContent = escale.nom;
      const quand = document.createElement('span');
      quand.className = 'sommaire-quand';
      quand.textContent = formatAnnee.format(jour(escale.date_arrivee))
        + (articles.length ? ` · ${articles.length} billet${articles.length > 1 ? 's' : ''}` : '');
      lieu.append(nom, quand);
      lieu.addEventListener('click', () => choisit(escale, null));
      bloc.append(lieu);
      const entreesEscale = [];
      if (articles.length) {
        const ol = document.createElement('ol');
        for (const a of articles) {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          const date = document.createElement('span');
          date.className = 'sommaire-date';
          date.textContent = formatJour.format(jour(a.date));
          const titre = document.createElement('span');
          titre.className = 'sommaire-billet';
          titre.textContent = a.titre || 'Sans titre';
          b.append(date, titre);
          b.addEventListener('click', () => choisit(escale, a.id));
          li.append(b);
          ol.append(li);
          entreesEscale.push({ element: li, texte: cle(`${a.titre} ${escale.nom}`) });
        }
        bloc.append(ol);
      }
      blocChapitre.append(bloc);
      entrees.push({
        bloc, chapitre: blocChapitre, texteLieu: cle(escale.nom), billets: entreesEscale,
      });
    }
    liste.replaceChildren(fragment);
    annonce(totalBillets, escales.length, false);
  }

  function annonce(billets, lieux, filtre) {
    compte.textContent = filtre
      ? (billets || lieux
        ? `${billets} billet${billets > 1 ? 's' : ''}, ${lieux} escale${lieux > 1 ? 's' : ''}`
        : 'Aucun billet ni escale ne correspond.')
      : `${billets} billets écrits en chemin, ${lieux} escales.`;
  }

  function filtre() {
    if (!entrees) return;
    const mots = cle(recherche.value).split(' ').filter(Boolean);
    const correspond = texte => mots.every(m => texte.includes(m));
    let billets = 0;
    let lieux = 0;
    const chapitresVus = new Set();
    for (const e of entrees) {
      // a stop that matches shows all its posts; otherwise only the posts
      // whose title matches
      const lieuTrouve = !mots.length || correspond(e.texteLieu);
      let visibles = 0;
      for (const b of e.billets) {
        const montre = lieuTrouve || correspond(b.texte);
        b.element.hidden = !montre;
        if (montre) visibles++;
      }
      const montreBloc = lieuTrouve || visibles > 0;
      e.bloc.hidden = !montreBloc;
      if (montreBloc) {
        lieux++;
        billets += visibles;
        chapitresVus.add(e.chapitre);
      }
    }
    for (const section of liste.querySelectorAll('.sommaire-chapitre')) {
      section.hidden = !chapitresVus.has(section);
    }
    annonce(billets, lieux, mots.length > 0);
  }

  let choisi = false;
  function choisit(escale, billet) {
    choisi = true;
    dialogue.close();
    ouvre(escale, billet);
  }

  async function montre(depuis) {
    declencheur = depuis ?? document.activeElement;
    if (typeof dialogue.showModal === 'function') dialogue.showModal();
    else dialogue.setAttribute('open', '');
    if (!entrees) {
      compte.textContent = 'Le carnet s’ouvre…';
      await carnetsPrets;
      construit();
      filtre();
    }
    recherche.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const lien = e.target.closest?.('.lien-sommaire');
    if (lien) void montre(lien);
  });
  recherche.addEventListener('input', filtre);
  document.getElementById('sommaire-fermer')?.addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('click', (e) => {
    if (e.target !== dialogue) return;
    const r = dialogue.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      dialogue.close();
    }
  });
  // like « À propos », the open table of contents owns Escape
  addEventListener('keydown', (e) => {
    if (!dialogue.open || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    dialogue.close();
  }, true);
  dialogue.addEventListener('close', () => {
    // after a choice the journal takes the focus; otherwise give it back
    if (!choisi && declencheur?.isConnected) declencheur.focus({ preventScroll: true });
    choisi = false;
    declencheur = null;
  });

  return { montre };
}
