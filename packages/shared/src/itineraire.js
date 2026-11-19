/* Itinéraire sûr (palier 2 de la géo-barrière) : côté client, on ne calcule rien ; on appelle l'Edge Function
 * `itineraire-sur` et on présente son résultat. Ici : le lien Google Maps et les libellés. */

/** Lien Google Maps « itinéraire » avec points de passage (ce sont des arrêts : Google les annonce comme tels). */
export function lienGoogleMapsVia(depart, arrivee, via = [], mode = 'driving') {
  const p = new URLSearchParams({ api: '1', destination: `${arrivee.lat},${arrivee.lon}`, travelmode: mode })
  if (depart) p.set('origin', `${depart.lat},${depart.lon}`)
  if (via.length) p.set('waypoints', via.map((v) => `${v.lat},${v.lon}`).join('|'))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

/** « 4 min », « 1 h 05 ». */
export function libelleDuree(secondes) {
  const m = Math.round(Number(secondes) / 60)
  if (!Number.isFinite(m) || m <= 0) return '< 1 min'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/** Phrase courte sur ce qui a été évité : « 1 zone rouge, 2 routes coupées ». */
export function libelleEvites(evites) {
  if (!evites) return ''
  const parts = []
  if (evites.rouges) parts.push(`${evites.rouges} zone${evites.rouges > 1 ? 's' : ''} rouge${evites.rouges > 1 ? 's' : ''}`)
  if (evites.oranges) parts.push(`${evites.oranges} zone${evites.oranges > 1 ? 's' : ''} orange${evites.oranges > 1 ? 's' : ''}`)
  if (evites.points_bloquants) parts.push(`${evites.points_bloquants} route${evites.points_bloquants > 1 ? 's' : ''} coupée${evites.points_bloquants > 1 ? 's' : ''} / inondée${evites.points_bloquants > 1 ? 's' : ''}`)
  return parts.length ? parts.join(', ') : 'aucune zone à éviter pour le moment'
}

/**
 * Lit l'erreur rendue par `supabase.functions.invoke` : le corps JSON de la fonction s'il existe
 * ({ error, code }), sinon un message générique. Asynchrone car le corps doit être lu.
 */
export async function messageErreurFonction(error, data) {
  if (data?.error) return { message: data.error, code: data.code ?? null }
  try {
    const corps = await error?.context?.json?.()
    if (corps?.error) return { message: corps.error, code: corps.code ?? null }
  } catch {
    /* pas de corps lisible */
  }
  if (error?.name === 'FunctionsFetchError') return { message: 'Réseau indisponible : itinéraire impossible pour le moment.', code: 'reseau' }
  return { message: error?.message || 'Itinéraire indisponible.', code: null }
}
