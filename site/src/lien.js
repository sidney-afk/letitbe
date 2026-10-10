// Un lien vers une escale ou un billet. L'adresse suit le carnet ouvert
// (…/letitbe/#tuamotu-fakarava-2010-04-08, ou …/billet-412 après un saut
// vers un billet) : on peut l'envoyer, et le lien rouvre le carnet à cet
// endroit. Le bouton Retour (le geste retour d'un téléphone) referme le
// carnet au lieu de quitter le site.

export const slugEscale = escale => `${(escale.nom ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${escale.date_arrivee}`;

export function lisLien(escales) {
  let brut = '';
  try { brut = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
  if (!brut) return null;
  const [lieu, billet] = brut.split('/');
  const escale = escales.find(e => e.date_arrivee && slugEscale(e) === lieu);
  if (!escale) return null;
  const id = /^billet-(\d+)$/.exec(billet ?? '')?.[1];
  return { escale, billet: id ? Number(id) : null };
}

const sansAncre = () => location.pathname + location.search;

export function suisLeCarnet({ plongee, escales, ouvre }) {
  let affiche = ''; // what the address says now
  let empile = false; // an entry of ours sits on top of the history
  let retourDemande = false; // our own history.back(), not the visitor's

  const adresseDe = (escale, billet) => (escale
    ? slugEscale(escale) + (Number.isFinite(billet) ? `/billet-${billet}` : '') : '');
  const adresse = () => adresseDe(plongee.escaleCourante, plongee.billetCourant);

  // Called every frame: cheap, and it catches every way a journal opens,
  // changes or closes (globe, menu, table of contents, neighbours, Escape).
  const titreSite = document.title;
  function metAJour() {
    // the tab (and a bookmark) names the stop being read
    const escale = plongee.escaleCourante;
    const titre = escale ? `${escale.nom} · Le Sillage` : titreSite;
    if (document.title !== titre) document.title = titre;
    const voulue = adresse();
    if (voulue === affiche) return;
    if (voulue && !affiche) {
      history.pushState({ sillage: 'carnet' }, '', `#${voulue}`);
      empile = true;
    } else if (voulue) {
      history.replaceState(history.state, '', `#${voulue}`);
    } else if (empile && history.state?.sillage === 'carnet') {
      empile = false;
      retourDemande = true;
      history.back();
    } else {
      history.replaceState(null, '', sansAncre());
      empile = false;
    }
    affiche = voulue;
  }

  addEventListener('popstate', () => {
    if (retourDemande) {
      retourDemande = false;
      return;
    }
    const lien = lisLien(escales);
    if (!lien) {
      // Back: the journal closes, the globe stays
      affiche = '';
      empile = false;
      if (plongee.escaleCourante) plongee.remonte();
      return;
    }
    // Forward, or an address typed by hand: this entry already names the
    // journal about to open, so nothing more is pushed for it
    affiche = adresseDe(lien.escale, lien.billet);
    empile = history.state?.sillage === 'carnet';
    ouvre(lien.escale, lien.billet);
  });

  // Arriving by a shared link: the journal opens over the globe, and Back
  // then closes it rather than leaving the site.
  function ouvreLienInitial() {
    const lien = lisLien(escales);
    if (!lien) return false;
    history.replaceState(null, '', sansAncre());
    ouvre(lien.escale, lien.billet);
    return true;
  }

  return { metAJour, ouvreLienInitial };
}
