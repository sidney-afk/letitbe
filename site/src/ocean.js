// L'ambiance sonore : un océan synthétisé en WebAudio — pas un échantillon,
// mais du bruit brownien filtré, gonflé par deux houles lentes déphasées.
// Léger en orbite, plus présent pendant la Traversée.

export function creerOcean() {
  let ctx = null;
  let maitre = null;
  let actif = false;
  let cibleGain = 0;

  function demarre() {
    ctx = new AudioContext();
    maitre = ctx.createGain();
    maitre.gain.value = 0;
    maitre.connect(ctx.destination);

    // bruit brownien (grave, profond) en boucle de 6 s
    const taille = ctx.sampleRate * 6;
    const tampon = ctx.createBuffer(1, taille, ctx.sampleRate);
    const d = tampon.getChannelData(0);
    let b = 0;
    for (let i = 0; i < taille; i++) {
      b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = b * 3.5;
    }
    // adoucit la couture de boucle
    for (let i = 0; i < 2000; i++) {
      const f = i / 2000;
      d[i] = d[i] * f + d[taille - 2000 + i] * (1 - f) * f;
    }

    const fondu = (freq, gainBase, lfoFreq, lfoAmp) => {
      const src = ctx.createBufferSource();
      src.buffer = tampon;
      src.loop = true;
      src.playbackRate.value = 0.85 + Math.random() * 0.3;
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'lowpass';
      filtre.frequency.value = freq;
      filtre.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.value = gainBase;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoFreq;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = lfoAmp;
      lfo.connect(lfoGain).connect(gain.gain);
      src.connect(filtre).connect(gain).connect(maitre);
      src.start();
      lfo.start();
    };

    fondu(380, 0.5, 0.061, 0.28);  // la houle de fond
    fondu(900, 0.22, 0.107, 0.13); // le clapot, déphasé
  }

  function bascule() {
    actif = !actif;
    if (actif && !ctx) demarre();
    if (ctx?.state === 'suspended') ctx.resume();
    return actif;
  }

  function metAJour(dt, enLecture) {
    if (!ctx) return;
    cibleGain = actif ? (enLecture ? 0.34 : 0.15) : 0;
    const g = maitre.gain;
    g.value += (cibleGain - g.value) * Math.min(1, dt * 1.5);
  }

  return { bascule, metAJour, get actif() { return actif; } };
}
