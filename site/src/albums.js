// Les albums photo de laruel.be rattachés aux escales (data/albums_escales.json,
// produit par pipeline/build_albums.py). Chargés une seule fois, à la demande.

let promesse = null;

export function chargeAlbums() {
  promesse ??= fetch('./data/albums_escales.json')
    .then(reponse => (reponse.ok ? reponse.json() : []))
    .then(albums => (Array.isArray(albums) ? albums : []))
    .catch(() => []);
  return promesse;
}

export function albumsDeLEscale(albums, escale) {
  const cle = `${escale.nom}|${escale.date_arrivee}`;
  return albums.filter(album => album.escales?.includes(cle) && album.photos?.length);
}

// Les films YouTube de la famille (data/videos_escales.json, produit par
// pipeline/build_videos.py), rattachés aux escales où ils ont été tournés.
let promesseVideos = null;

export function chargeVideos() {
  promesseVideos ??= fetch('./data/videos_escales.json')
    .then(reponse => (reponse.ok ? reponse.json() : []))
    .then(videos => (Array.isArray(videos) ? videos : []))
    .catch(() => []);
  return promesseVideos;
}

export function videosDeLEscale(videos, escale) {
  const cle = `${escale.nom}|${escale.date_arrivee}`;
  return videos.filter(video => video.escales?.includes(cle)
    && /^[\w-]{11}$/.test(video.youtube_id ?? ''));
}
