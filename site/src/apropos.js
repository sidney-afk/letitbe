// « À propos et crédits » : une fenêtre de parchemin, ouverte depuis le menu
// des escales ou l'épilogue. Le <dialog> natif gère le focus et Échap.

export function activeAPropos() {
  const dialogue = document.getElementById('a-propos');
  if (!dialogue) return;
  let declencheur = null;

  document.addEventListener('click', (e) => {
    const lien = e.target.closest?.('.lien-a-propos');
    if (!lien) return;
    declencheur = lien;
    if (typeof dialogue.showModal === 'function') dialogue.showModal();
    else dialogue.setAttribute('open', '');
    document.getElementById('a-propos-fermer')?.focus();
    // a link can point at a section (« L'équipage et le bateau »)
    const section = lien.dataset.section && document.getElementById(lien.dataset.section);
    dialogue.scrollTop = section ? section.offsetTop - 16 : 0;
  });
  document.getElementById('a-propos-fermer')?.addEventListener('click', () => dialogue.close());
  // a click on the dimmed backdrop (outside the parchment) closes it
  dialogue.addEventListener('click', (e) => {
    if (e.target !== dialogue) return;
    const r = dialogue.getBoundingClientRect();
    const dehors = e.clientX < r.left || e.clientX > r.right
      || e.clientY < r.top || e.clientY > r.bottom;
    if (dehors) dialogue.close();
  });
  // The story and the journal listen to Escape on the window too. While this
  // dialog is open it owns the key: close it and let nobody else react.
  addEventListener('keydown', (e) => {
    if (!dialogue.open || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    dialogue.close();
  }, true);
  dialogue.addEventListener('close', () => {
    if (declencheur?.isConnected) declencheur.focus({ preventScroll: true });
    declencheur = null;
  });
}
