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
/* Zones d'intervention : cercle (centre + rayon) ou contour (polygone) */

/** Nombre maximal de sommets d'un contour tracé à la main (même limite qu'en base). */
export const SOMMETS_MAX_CONTOUR = 50

/**
 * Sommets du contour d'une zone ({lat, lon}, sans répéter le premier), ou null si la zone est un cercle.
 * `z.contour` est un Polygon GeoJSON ([lon, lat], anneau fermé), objet ou texte JSON.
 */
export function contourDeZone(z) {
  let c = z?.contour
  if (!c) return null
  if (typeof c === 'string') {
    try {
      c = JSON.parse(c)
    } catch {
      return null
    }
  }
  const anneau = c?.type === 'Polygon' && Array.isArray(c.coordinates) ? c.coordinates[0] : null
  if (!Array.isArray(anneau)) return null
  const pts = []
  for (const s of anneau) {
    if (!Array.isArray(s) || s.length < 2) continue
    const lon = Number(s[0])
    const lat = Number(s[1])
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon })
  }
  if (pts.length > 1 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lon === pts[pts.length - 1].lon) pts.pop()
  return pts.length >= 3 ? pts : null
}

/** Polygon GeoJSON (anneau fermé, [lon, lat]) à partir de sommets {lat, lon} tracés sur la carte. */
export function polygoneGeoJson(sommets) {
  const anneau = sommets.map((p) => [+Number(p.lon).toFixed(6), +Number(p.lat).toFixed(6)])
  if (anneau.length) anneau.push([...anneau[0]])
  return { type: 'Polygon', coordinates: [anneau] }
}

/**
 * Distance signée, en mètres, d'un point au bord d'un contour : négative dedans, positive dehors.
 * Projection plane locale autour du point (largement suffisante pour des zones de quelques kilomètres).
 */
export function distanceBordContour(p, sommets) {
  const kx = 111320 * Math.cos(rad(p.lat))
  const ky = 111320
  const xy = sommets.map((s) => [(s.lon - p.lon) * kx, (s.lat - p.lat) * ky])
  let dedans = false
  let min = Infinity
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const [xi, yi] = xy[i]
    const [xj, yj] = xy[j]
    // lancer de rayon depuis l'origine (le point) vers +x
    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) dedans = !dedans
    // distance de l'origine au segment [j, i]
    const dx = xi - xj
    const dy = yi - yj
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(xj * dx + yj * dy) / l2))
    const d = Math.hypot(xj + t * dx, yj + t * dy)
    if (d < min) min = d
  }
  return dedans ? -min : min
}

/**
 * Distance signée, en mètres, d'un point au bord d'une zone d'intervention (cercle ou contour) :
 * négative dedans. null si la zone n'a pas de géométrie utilisable. Le contour prime sur le cercle
 * (pour une zone à contour, le rayon en base n'est que le rayon englobant).
 */
export function distanceAuBordZone(p, z) {
  const sommets = contourDeZone(z)
  if (sommets) return distanceBordContour(p, sommets)
  if (z?.centre_latitude == null || z?.centre_longitude == null || z?.rayon_metres == null) return null
  const lat = Number(z.centre_latitude)
  const lon = Number(z.centre_longitude)
  const rayon = Number(z.rayon_metres)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(rayon) || rayon <= 0) return null
  return distanceM(p, { lat, lon }) - rayon
}

/** Le point est-il dans la zone (cercle ou contour) ? */
export function pointDansZone(p, z) {
  const d = distanceAuBordZone(p, z)
  return d != null && d <= 0
}

/**
 * Forme d'affichage d'une zone pour `CarteCrise` (prop `cercles`) : cercle, ou contour (`contour`,
 * [[lat, lon], …]) dessiné en polygone. null si la zone n'a pas de géométrie. `extra` est recopié.
 */
export function formeCarteZone(z, extra = {}) {
  const sommets = contourDeZone(z)
  if (sommets) {
    return { id: z.id, lat: Number(z.centre_latitude ?? sommets[0].lat), lon: Number(z.centre_longitude ?? sommets[0].lon), rayonM: Number(z.rayon_metres) || 0, contour: sommets.map((s) => [s.lat, s.lon]), ...extra }
  }
  if (z?.centre_latitude == null || z?.centre_longitude == null) return null
  return { id: z.id, lat: Number(z.centre_latitude), lon: Number(z.centre_longitude), rayonM: Number(z.rayon_metres) || 100, ...extra }
}

/** Surface approchée (m²) d'un contour {lat, lon} : formule du lacet en projection plane locale. */
export function surfaceContourM2(sommets) {
  if (!sommets || sommets.length < 3) return 0
  const lat0 = sommets[0].lat
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 111320
  let a = 0
  for (let i = 0, j = sommets.length - 1; i < sommets.length; j = i++) {
    a += (sommets[j].lon * kx) * (sommets[i].lat * ky) - (sommets[i].lon * kx) * (sommets[j].lat * ky)
  }
  return Math.abs(a / 2)
}

/** Deux côtés non voisins se croisent-ils ? (contour en « nœud papillon », refusé en base) */
export function contourSeCroise(sommets) {
  const n = sommets.length
  if (n < 4) return false
  const kx = 111320 * Math.cos((sommets[0].lat * Math.PI) / 180)
  const P = sommets.map((s) => [s.lon * kx, s.lat * 111320])
  const orient = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  for (let i = 0; i < n; i++) {
    const a = P[i]
    const b = P[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue // côtés voisins
      const c = P[j]
      const d = P[(j + 1) % n]
      if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return true
    }
  }
  return false
}

/** Problème bloquant du contour, ou null. Mêmes règles qu'en base (3 à 50 sommets, pas de croisement, 100 m² à 500 km²). */
export function problemeContour(sommets) {
  if (!sommets || sommets.length < 3) return 'Touchez au moins 3 coins.'
  if (sommets.length > SOMMETS_MAX_CONTOUR) return `${SOMMETS_MAX_CONTOUR} coins au plus.`
  if (contourSeCroise(sommets)) return 'Le contour se croise : retirez le dernier coin ou recommencez dans l’ordre du tour.'
  const s = surfaceContourM2(sommets)
  if (s < 100) return 'Zone trop petite (moins de 100 m²).'
  if (s > 500e6) return 'Zone trop grande (plus de 500 km²).'
  return null
}

/** « 3,2 ha », « 1,4 km² », « 850 m² ». */
export function libelleSurface(m2) {
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(1).replace('.', ',')} km²`
  if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(1).replace('.', ',')} ha`
  return `${Math.round(m2)} m²`
}

/* ------------------------------------------------------------------ */
/* Géo-barrière : alerte d'approche et d'entrée dans une zone          */

/** Distance, en mètres, à partir de laquelle on prévient qu'une zone approche (mesurée depuis son bord). */
export const SEUIL_APPROCHE_ZONE_M = 150

/**
 * Où se trouve l'appareil par rapport à des zones d'intervention (cercle : centre + rayon, ou contour).
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
 * @param {Array<{centre_latitude, centre_longitude, rayon_metres, contour?}>} zones
 * @param {number} [seuilM]
 */
export function etatGeoBarriere(position, zones, seuilM = SEUIL_APPROCHE_ZONE_M) {
  if (!position || !Array.isArray(zones) || zones.length === 0) return { etat: 'hors', zone: null, distanceBord: null }
  let meilleure = null
  for (const z of zones) {
    const distanceBord = distanceAuBordZone(position, z) // cercle ou contour
    if (distanceBord == null) continue
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
