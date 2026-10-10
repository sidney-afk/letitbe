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
      if (!ecran) return;
      ecran.classList.add('fini');
      ecran.setAttribute('aria-busy', 'false');
      const retire = () => { ecran.hidden = true; };
      ecran.addEventListener('transitionend', retire, { once: true });
      setTimeout(retire, 1600);
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
