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
