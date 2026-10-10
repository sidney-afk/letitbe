// L'écran d'accueil pendant le chargement : le titre, et un petit voilier
// qui avance sur une ligne de pointillés à mesure que les pièces du voyage
// arrivent. Il cède la place au globe dès que tout est prêt, ou explique
// en français ce qui n'a pas marché.

export function creerChargement(etapesTotal) {
  const ecran = document.getElementById('chargement');
  const avance = ecran?.querySelector('.chargement-avance');
  const message = document.getElementById('chargement-message');
  const reessayer = document.getElementById('chargement-reessayer');
  let faites = 0;

  function regle(fraction) {
    ecran?.style.setProperty('--progression', String(Math.min(1, Math.max(0, fraction))));
    avance?.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  }
  regle(0.04);

  reessayer?.addEventListener('click', () => location.reload());

  return {
    // Marque une étape terminée ; renvoie la valeur pour s'enchaîner.
    etape(valeur) {
      faites += 1;
      regle(0.04 + 0.96 * faites / etapesTotal);
      return valeur;
    },
    suivre(promesse) {
      return promesse.then(valeur => this.etape(valeur));
    },
    termine() {
      regle(1);
      if (!ecran || ecran.classList.contains('fini')) return;
      ecran.classList.remove('accueil');
      ecran.classList.add('fini');
      ecran.setAttribute('aria-busy', 'false');
      document.body.classList.remove('accueil-ouvert');
      const retire = () => { ecran.hidden = true; };
      ecran.addEventListener('transitionend', retire, { once: true });
      setTimeout(retire, 1600);
    },
    // La page de garde : le globe est prêt derrière un voile léger, et le
    // visiteur choisit son chemin. Renvoie 'traversee' ou 'explorer'.
    accueil() {
      regle(1);
      const corps = document.getElementById('accueil-corps');
      const traversee = document.getElementById('accueil-traversee');
      const explorer = document.getElementById('accueil-explorer');
      if (!ecran || !corps || !traversee || !explorer) {
        this.termine();
        return Promise.resolve('explorer');
      }
      ecran.setAttribute('aria-busy', 'false');
      ecran.setAttribute('role', 'dialog');
      ecran.setAttribute('aria-modal', 'true');
      ecran.setAttribute('aria-labelledby', 'accueil-titre');
      ecran.setAttribute('aria-describedby', 'accueil-texte');
      ecran.querySelector('.chargement-titre')?.setAttribute('id', 'accueil-titre');
      ecran.querySelector('.chargement-titre')?.removeAttribute('aria-hidden');
      corps.hidden = false;
      ecran.classList.add('accueil');
      document.body.classList.add('accueil-ouvert');
      traversee.focus({ preventScroll: true });

      return new Promise((resolve) => {
        let fait = false;
        const choisit = (choix) => {
          if (fait) return;
          fait = true;
          removeEventListener('keydown', clavier, true);
          this.termine();
          resolve(choix);
        };
        const clavier = (e) => {
          // the "À propos" dialog, opened from this card, owns the keyboard
          if (document.querySelector('dialog[open]')) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            choisit('explorer');
          } else if (e.key === 'Tab') {
            // keep the focus inside the card
            const boutons = [...ecran.querySelectorAll('button:not([hidden])')]
              .filter(b => b.offsetParent !== null);
            if (!boutons.length) return;
            e.preventDefault();
            const i = boutons.indexOf(document.activeElement);
            const pas = e.shiftKey ? -1 : 1;
            boutons[(i + pas + boutons.length) % boutons.length].focus();
          }
        };
        addEventListener('keydown', clavier, true);
        traversee.addEventListener('click', () => choisit('traversee'), { once: true });
        explorer.addEventListener('click', () => choisit('explorer'), { once: true });
        this.ferme = () => choisit('explorer');
      });
    },
    // Ferme l'accueil sans choix explicite (capture, tests, raccourcis).
    ferme() {
      this.termine();
    },
    echec(erreur) {
      console.error(erreur);
      if (!ecran) return;
      ecran.classList.add('echec');
      ecran.setAttribute('aria-busy', 'false');
      if (message) {
        message.textContent = 'Le voyage n’a pas pu se charger. '
          + 'Vérifiez la connexion, puis réessayez.';
      }
      if (reessayer) reessayer.hidden = false;
    },
  };
}
