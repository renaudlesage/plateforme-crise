// Petits calculs géographiques partagés (distance, cap, itinéraire). Pas de dépendance.

const R_TERRE_M = 6371000
const rad = (d) => (d * Math.PI) / 180

/** Distance en mètres entre deux points {lat, lon} (formule de haversine). */
export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_TERRE_M * Math.asin(Math.sqrt(h))
}

/** Cap en degrés (0 = nord, 90 = est) de a vers b. */
export function capDegres(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon))
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

const POINTS_CARDINAUX = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

/** « NE », « SO »… pour un cap en degrés. */
export function capLibelle(deg) {
  return POINTS_CARDINAUX[Math.round(deg / 45) % 8]
}

/** « 240 m » ou « 1,3 km ». */
export function libelleDistance(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

/** « à 240 m, cap NE » depuis `depuis` vers `vers`. */
export function distanceEtCap(depuis, vers) {
  return `à ${libelleDistance(distanceM(depuis, vers))}, cap ${capLibelle(capDegres(depuis, vers))}`
}

/** Lien d'itinéraire qui s'ouvre dans l'application de cartes du téléphone. */
export function lienItineraire(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
}

/** « il y a 3 min », « il y a 2 h 10 ». */
export function ilYA(date) {
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000))
  if (s < 60) return 'à l’instant'
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return `il y a ${h} h ${String(m % 60).padStart(2, '0')}`
}

/** Durée écoulée depuis `date`, en heures décimales. */
export function heuresDepuis(date) {
  return (Date.now() - new Date(date).getTime()) / 3600000
}

/**
 * Position actuelle de l'appareil, en une promesse (null si indisponible ou trop longue).
 * @returns {Promise<{lat:number, lon:number, precision_m:number}|null>}
 */
export function positionActuelle(delaiMs = 6000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, precision_m: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: delaiMs, maximumAge: 15000 }
    )
  })
}

/* ------------------------------------------------------------------ */
/* Géo-barrière : alerte d'approche et d'entrée dans une zone          */

/** Distance, en mètres, à partir de laquelle on prévient qu'une zone approche (mesurée depuis son bord). */
export const SEUIL_APPROCHE_ZONE_M = 150

/**
 * Où se trouve l'appareil par rapport à des zones circulaires (zones d'intervention : centre + rayon).
 *
 * Retourne { etat, zone, distanceBord } :
 *  - 'dedans'   : dans au moins une zone (la plus profondément pénétrée est renvoyée ; distanceBord ≤ 0) ;
 *  - 'approche' : hors de toute zone, mais à moins de `seuilM` du bord de la plus proche ;
 *  - 'hors'     : loin de tout (zone = la plus proche s'il y en a une, sinon null).
 *
 * Pure : aucune hystérésis ici. C'est l'appelant qui décide quand vibrer ou journaliser, à partir des
 * transitions d'état. L'imprécision GPS n'est pas corrigée : une précision de 30 m sur une zone de
 * 100 m donne des bascules au bord, que l'appelant lisse (voir `transitionGeoBarriere`).
 *
 * @param {{lat:number, lon:number}|null} position
 * @param {Array<{centre_latitude:number|string, centre_longitude:number|string, rayon_metres:number|string}>} zones
 * @param {number} [seuilM]
 */
export function etatGeoBarriere(position, zones, seuilM = SEUIL_APPROCHE_ZONE_M) {
  if (!position || !Array.isArray(zones) || zones.length === 0) return { etat: 'hors', zone: null, distanceBord: null }
  let meilleure = null
  for (const z of zones) {
    if (z.centre_latitude == null || z.centre_longitude == null || z.rayon_metres == null) continue
    const lat = Number(z.centre_latitude)
    const lon = Number(z.centre_longitude)
    const rayon = Number(z.rayon_metres)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(rayon) || rayon <= 0) continue
    const distanceBord = distanceM(position, { lat, lon }) - rayon
    if (!meilleure || distanceBord < meilleure.distanceBord) meilleure = { zone: z, distanceBord }
  }
  if (!meilleure) return { etat: 'hors', zone: null, distanceBord: null }
  const etat = meilleure.distanceBord <= 0 ? 'dedans' : meilleure.distanceBord <= seuilM ? 'approche' : 'hors'
  return { etat, zone: meilleure.zone, distanceBord: Math.round(meilleure.distanceBord) }
}

/**
 * Transition à journaliser entre deux états successifs de `etatGeoBarriere` :
 *  - 'entree' quand on passe de hors/approche à dedans ;
 *  - 'sortie' quand on quitte dedans (vers approche ou hors) ;
 *  - 'approche' quand on passe de hors à approche (alerte locale, non journalisée) ;
 *  - null sinon.
 * Les changements de zone en restant dedans (deux zones rouges voisines) ne produisent rien.
 */
export function transitionGeoBarriere(avant, apres) {
  const a = avant?.etat ?? 'hors'
  const b = apres?.etat ?? 'hors'
  if (a === b) return null
  if (b === 'dedans') return 'entree'
  if (a === 'dedans') return 'sortie'
  if (a === 'hors' && b === 'approche') return 'approche'
  return null
}

/**
 * Lissage de la sortie de zone : quitter une zone (dedans → approche/hors) n'est cru qu'après `delaiMs`
 * passés dehors, pour qu'un point GPS imprécis au bord ne produise pas une sortie puis une entrée fantômes.
 * L'entrée, elle, est crue tout de suite : mieux vaut une alerte de trop qu'une de moins.
 *
 * Pure. Rend l'état à retenir (`apres`), le début de l'attente en cours (`attente`, null s'il n'y en a pas)
 * et l'heure à laquelle il faudra réévaluer (`echeance`) : l'appelant doit alors réévaluer MÊME sans nouvelle
 * position, sinon un appareil immobile ou écran éteint resterait « dedans » indéfiniment.
 *
 * @param {{etat:string}} avant état retenu précédemment
 * @param {{etat:string}} brut état calculé sur la position courante
 * @param {number|null} attente début de l'attente de sortie en cours (ms), ou null
 * @param {number} maintenant (ms)
 * @param {number} delaiMs
 */
export function lisserSortieZone(avant, brut, attente, maintenant, delaiMs) {
  if (avant?.etat === 'dedans' && brut?.etat !== 'dedans') {
    const debut = attente ?? maintenant
    if (maintenant - debut < delaiMs) return { apres: avant, attente: debut, echeance: debut + delaiMs }
    return { apres: brut, attente: null, echeance: null }
  }
  return { apres: brut, attente: null, echeance: null }
}
