// La météo vécue (fonctionnalité 7 du plan) : réanalyse ERA5 précalculée le
// long de la route (content/meteo.json). Le bulletin du jour s'affiche dans
// la timeline, et la scène respire avec : nuages plus denses, lumière plus
// terne les jours de grisaille — aux bons endroits, aux bonnes dates.

export async function creerMeteo() {
  const reponse = await fetch('./data/meteo.json');
  const jours = await reponse.json();
  const parDate = new Map(jours.map(j => [j.date, j]));

  const ligne = document.getElementById('meteo-jour');

  function pour(t) {
    const d = new Date(t).toISOString().slice(0, 10);
    return parDate.get(d) ?? null;
  }

  function bulletin(j) {
    if (!j || j.vent_max_kmh == null) return '';
    const morceaux = [`vent ${Math.round(j.vent_max_kmh)} km/h`];
    if (j.vague_max_m != null) {
      morceaux.push(`mer ${j.vague_max_m.toLocaleString('fr-FR')} m`);
    }
    if (j.pluie_mm >= 4) {
      morceaux.push(`pluie ${Math.round(j.pluie_mm)} mm`);
    } else if (j.nebulosite_pct >= 75) {
      morceaux.push('ciel couvert');
    } else if (j.nebulosite_pct <= 25) {
      morceaux.push('grand beau');
    }
    if (j.rafales_max_kmh >= 65) morceaux.push('⚠ coup de vent');
    return morceaux.join(' · ');
  }

  function applique(t) {
    const j = pour(t);
    ligne.textContent = bulletin(j);
    if (!j || j.vent_max_kmh == null) {
      return { nuages: 1, lumiere: 1 };
    }
    // nébulosité 0-100 % -> densité de nuages 0.55-1.45 ;
    // grisaille + pluie -> lumière qui baisse jusqu'à -20 %
    const neb = (j.nebulosite_pct ?? 50) / 100;
    const pluie = Math.min(1, (j.pluie_mm ?? 0) / 25);
    return {
      nuages: 0.55 + neb * 0.9,
      lumiere: 1 - neb * 0.12 - pluie * 0.08,
    };
  }

  return { pour, applique };
}
