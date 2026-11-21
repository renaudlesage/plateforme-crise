// =====================================================================
// Itinéraire sûr (Crisiware) — logique pure, sans Deno, testée par Vitest.
//
// Transforme les zones de l'incident (cercles : centre + rayon) et les points
// terrain bloquants (route coupée, inondation) en polygones GeoJSON à éviter,
// vérifie qu'un tracé rendu par le moteur de routage ne les traverse pas, et
// choisit les points de passage à donner à Google Maps pour forcer le même
// contournement.
//
// Convention : les positions internes sont { lat, lon } ; GeoJSON est [lon, lat].
// =====================================================================

export type Position = { lat: number; lon: number }
export type Cercle = { id?: string; lat: number; lon: number; rayonM: number; nature: 'rouge' | 'orange' | 'route_coupee' | 'inondation' }

const R_TERRE = 6371000
const RAD = Math.PI / 180

/** Distance haversine en mètres. */
export function distanceM(a: Position, b: Position): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLon = (b.lon - a.lon) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * R_TERRE * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Rayon de sécurité posé autour d'un point terrain bloquant (une route coupée n'a pas de rayon déclaré). */
export const RAYON_POINT_BLOQUANT_M = 40
/** Marge ajoutée au rayon des zones : le moteur route sur l'axe de la voie, on veut rester à l'écart du bord. */
export const MARGE_ZONE_M = 25

/**
 * Anneau GeoJSON ([lon, lat], fermé) approchant un cercle par `n` sommets.
 * Approximation plane locale, largement suffisante pour des rayons de quelques kilomètres.
 */
export function anneauCercle(centre: Position, rayonM: number, n = 32): number[][] {
  const dLat = rayonM / 111320
  const dLon = rayonM / (111320 * Math.cos(centre.lat * RAD))
  const pts: number[][] = []
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n
    pts.push([+(centre.lon + dLon * Math.cos(t)).toFixed(6), +(centre.lat + dLat * Math.sin(t)).toFixed(6)])
  }
  pts.push(pts[0])
  return pts
}

/** Zones d'intervention (lignes de `zones_intervention`) → cercles à éviter, selon le profil demandé. */
export function cerclesDesZones(
  zones: Array<{ id: string; type_zone: string; centre_latitude: unknown; centre_longitude: unknown; rayon_metres: unknown; date_levee?: unknown }>,
  inclureOrange: boolean
): Cercle[] {
  const res: Cercle[] = []
  for (const z of zones) {
    if (z.date_levee) continue
    if (z.type_zone !== 'rouge' && !(inclureOrange && z.type_zone === 'orange')) continue
    const lat = Number(z.centre_latitude)
    const lon = Number(z.centre_longitude)
    const r = Number(z.rayon_metres)
    if (z.centre_latitude == null || z.centre_longitude == null || z.rayon_metres == null) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(r) || r <= 0) continue
    res.push({ id: z.id, lat, lon, rayonM: r + MARGE_ZONE_M, nature: z.type_zone as Cercle['nature'] })
  }
  return res
}

/** Points terrain ouverts de type route coupée ou inondation → petits cercles à éviter. */
export function cerclesDesPoints(points: Array<{ id: string; type: string; latitude: unknown; longitude: unknown }>): Cercle[] {
  const res: Cercle[] = []
  for (const p of points) {
    if (p.type !== 'route_coupee' && p.type !== 'inondation') continue
    if (p.latitude == null || p.longitude == null) continue
    const lat = Number(p.latitude)
    const lon = Number(p.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    res.push({ id: p.id, lat, lon, rayonM: RAYON_POINT_BLOQUANT_M, nature: p.type as Cercle['nature'] })
  }
  return res
}

/** MultiPolygon GeoJSON attendu par OpenRouteService dans `options.avoid_polygons` (null si rien à éviter). */
export function multiPolygoneAEviter(cercles: Cercle[]): { type: 'MultiPolygon'; coordinates: number[][][][] } | null {
  if (cercles.length === 0) return null
  return { type: 'MultiPolygon', coordinates: cercles.map((c) => [anneauCercle({ lat: c.lat, lon: c.lon }, c.rayonM)]) }
}

/** Un point est-il dans un des cercles ? Renvoie le cercle, sinon null. */
export function cercleContenant(p: Position, cercles: Cercle[]): Cercle | null {
  for (const c of cercles) if (distanceM(p, { lat: c.lat, lon: c.lon }) <= c.rayonM) return c
  return null
}

/** Tous les cercles qui contiennent le point (zones superposées : rouge dans orange, route coupée dans une zone…). */
export function cerclesContenant(p: Position, cercles: Cercle[]): Cercle[] {
  return cercles.filter((c) => distanceM(p, { lat: c.lat, lon: c.lon }) <= c.rayonM)
}

/**
 * Prépare le calcul :
 *  - `zoneArrivee` : la zone rouge ou orange qui contient la destination (le calcul est alors refusé), sinon null ;
 *  - `zonesDepart` : TOUS les cercles qui contiennent le départ (il faut bien en sortir) ;
 *  - `cerclesCalcul` : les cercles à éviter, sans ceux du départ. C'est sur eux que porte aussi le contrôle
 *    de non-traversée : le tracé commence forcément dans la zone de départ, il ne faut pas le lui reprocher.
 */
export function preparerCercles(depart: Position, arrivee: Position, cercles: Cercle[]) {
  const zoneArrivee = cerclesContenant(arrivee, cercles).find((c) => c.nature === 'rouge' || c.nature === 'orange') ?? null
  const zonesDepart = cerclesContenant(depart, cercles)
  const cerclesCalcul = cercles.filter((c) => !zonesDepart.includes(c))
  return { zoneArrivee, zonesDepart, cerclesCalcul }
}

/**
 * Le tracé (positions successives) traverse-t-il un cercle ? On teste chaque sommet et des points
 * intermédiaires tous les `pasM` mètres, car deux sommets d'un segment droit peuvent encadrer un cercle.
 */
export function cerclesTraverses(trace: Position[], cercles: Cercle[], pasM = 20): Cercle[] {
  const vus = new Set<Cercle>()
  if (cercles.length === 0 || trace.length === 0) return []
  for (let i = 0; i < trace.length; i++) {
    const a = trace[i]
    const c = cercleContenant(a, cercles)
    if (c) vus.add(c)
    if (i + 1 >= trace.length) break
    const b = trace[i + 1]
    const d = distanceM(a, b)
    const n = Math.floor(d / pasM)
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1)
      const m = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }
      const cm = cercleContenant(m, cercles)
      if (cm) vus.add(cm)
    }
  }
  return [...vus]
}

/** Longueur cumulée du tracé, en mètres. */
export function longueurTrace(trace: Position[]): number {
  let l = 0
  for (let i = 1; i < trace.length; i++) l += distanceM(trace[i - 1], trace[i])
  return l
}

/**
 * Points de passage à donner à Google Maps (au plus `n`, 8 par défaut : la limite de l'URL est 9, on garde
 * une marge) : le tracé est découpé en n+1 tronçons de longueur égale et on prend le sommet le plus
 * proche de chaque frontière. Les extrémités ne sont jamais reprises. Sur un tracé très court
 * (< 2 × `minEcartM`), aucun point : la destination seule suffit.
 */
export function pointsDePassage(trace: Position[], n = 8, minEcartM = 150): Position[] {
  if (trace.length < 3) return []
  const total = longueurTrace(trace)
  if (total < 2 * minEcartM) return []
  const nb = Math.max(1, Math.min(n, Math.floor(total / minEcartM) - 1))
  const cibles: number[] = []
  for (let k = 1; k <= nb; k++) cibles.push((total * k) / (nb + 1))
  const res: Position[] = []
  let cumul = 0
  let ic = 0
  for (let i = 1; i < trace.length && ic < cibles.length; i++) {
    const seg = distanceM(trace[i - 1], trace[i])
    while (ic < cibles.length && cumul + seg >= cibles[ic]) {
      // sommet le plus proche de la cible, hors extrémités
      const versFin = cumul + seg - cibles[ic] <= cibles[ic] - cumul
      const idx = versFin ? i : i - 1
      const p = trace[Math.min(Math.max(idx, 1), trace.length - 2)]
      if (!res.length || distanceM(res[res.length - 1], p) >= minEcartM / 2) res.push({ lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5) })
      ic++
    }
    cumul += seg
  }
  return res
}

/** Lien Google Maps « itinéraire » avec points de passage (ce sont des arrêts : Google les annonce comme tels). */
export function lienGoogleMapsVia(depart: Position | null, arrivee: Position, via: Position[], mode: 'driving' | 'walking' = 'driving'): string {
  const p = new URLSearchParams({ api: '1', destination: `${arrivee.lat},${arrivee.lon}`, travelmode: mode })
  if (depart) p.set('origin', `${depart.lat},${depart.lon}`)
  if (via.length) p.set('waypoints', via.map((v) => `${v.lat},${v.lon}`).join('|'))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

/** Coordonnées GeoJSON ([lon, lat]) d'une LineString → positions. */
export function traceDepuisGeoJson(coords: unknown): Position[] {
  if (!Array.isArray(coords)) return []
  const res: Position[] = []
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) continue
    const lon = Number(c[0])
    const lat = Number(c[1])
    if (Number.isFinite(lat) && Number.isFinite(lon)) res.push({ lat, lon })
  }
  return res
}

export type ResultatItineraire = {
  trace: Position[]
  distance_m: number
  duree_s: number
  points_passage: Position[]
  traverse: Array<{ id?: string; nature: string }>
  avertissements: string[]
}

/**
 * Lit la réponse GeoJSON d'OpenRouteService (`/v2/directions/{profil}/geojson`) et la complète :
 * tracé, résumé, points de passage, et contrôle indépendant que le tracé ne traverse aucun cercle.
 */
export function interpreterReponseOrs(reponse: unknown, cercles: Cercle[]): ResultatItineraire {
  const r = reponse as { features?: Array<{ geometry?: { coordinates?: unknown }; properties?: { summary?: { distance?: number; duration?: number }; warnings?: Array<{ message?: string }> } }> }
  const f = r?.features?.[0]
  if (!f?.geometry?.coordinates) throw new Error('Réponse du moteur sans tracé')
  const trace = traceDepuisGeoJson(f.geometry.coordinates)
  if (trace.length < 2) throw new Error('Tracé vide')
  const distance_m = Math.round(Number(f.properties?.summary?.distance ?? longueurTrace(trace)))
  const duree_s = Math.round(Number(f.properties?.summary?.duration ?? 0))
  const traverses = cerclesTraverses(trace, cercles)
  const avertissements: string[] = []
  for (const w of f.properties?.warnings ?? []) if (w?.message) avertissements.push(String(w.message))
  if (traverses.length) {
    avertissements.unshift(
      `Le moteur n'a pas trouvé de contournement complet : le tracé traverse encore ${traverses.length} zone(s) à éviter. Ne le suivez pas sans ordre.`
    )
  }
  return {
    trace,
    distance_m,
    duree_s,
    points_passage: pointsDePassage(trace),
    traverse: traverses.map((c) => ({ id: c.id, nature: c.nature })),
    avertissements,
  }
}
