import { describe, expect, it } from 'vitest'
import {
  anneauCercle,
  cerclesDesPoints,
  cerclesDesZones,
  cerclesTraverses,
  interpreterReponseOrs,
  lienGoogleMapsVia,
  longueurTrace,
  multiPolygoneAEviter,
  pointsDePassage,
  distanceM,
  MARGE_ZONE_M,
  RAYON_POINT_BLOQUANT_M,
} from './itineraire'

const C = { lat: 50.3934, lon: 5.5382 }
const auNord = (m: number, o = C) => ({ lat: o.lat + m / 111320, lon: o.lon })
const aLEst = (m: number, o = C) => ({ lat: o.lat, lon: o.lon + m / (111320 * Math.cos((o.lat * Math.PI) / 180)) })

describe('anneauCercle', () => {
  it('ferme l’anneau, 33 points pour 32 sommets, tous à ~rayon du centre', () => {
    const a = anneauCercle(C, 100)
    expect(a.length).toBe(33)
    expect(a[0]).toEqual(a[32])
    for (const [lon, lat] of a) {
      const d = distanceM(C, { lat, lon })
      expect(Math.abs(d - 100) < 2).toBe(true)
    }
  })
})

describe('cerclesDesZones / cerclesDesPoints', () => {
  const zones = [
    { id: 'r', type_zone: 'rouge', centre_latitude: '50.3934', centre_longitude: '5.5382', rayon_metres: '100', date_levee: null },
    { id: 'o', type_zone: 'orange', centre_latitude: 50.3934, centre_longitude: 5.5382, rayon_metres: 1200, date_levee: null },
    { id: 'levee', type_zone: 'rouge', centre_latitude: 50.4, centre_longitude: 5.5, rayon_metres: 100, date_levee: '2026-11-01' },
    { id: 'sans', type_zone: 'rouge', centre_latitude: null, centre_longitude: null, rayon_metres: null, date_levee: null },
    { id: 'jaune', type_zone: 'jaune', centre_latitude: 50.4, centre_longitude: 5.5, rayon_metres: 100, date_levee: null },
  ]
  it('rouge seul par défaut, avec la marge ; orange sur demande ; levées et incomplètes ignorées', () => {
    const r = cerclesDesZones(zones, false)
    expect(r.map((c) => c.id)).toEqual(['r'])
    expect(r[0].rayonM).toBe(100 + MARGE_ZONE_M)
    expect(cerclesDesZones(zones, true).map((c) => c.id)).toEqual(['r', 'o'])
  })
  it('points : route coupée et inondation seulement, rayon fixe', () => {
    const pts = cerclesDesPoints([
      { id: 'a', type: 'route_coupee', latitude: '50.39', longitude: '5.53' },
      { id: 'b', type: 'danger', latitude: 50.39, longitude: 5.53 },
      { id: 'c', type: 'inondation', latitude: 50.39, longitude: 5.53 },
      { id: 'd', type: 'route_coupee', latitude: null, longitude: 5.53 },
    ])
    expect(pts.map((p) => p.id)).toEqual(['a', 'c'])
    expect(pts[0].rayonM).toBe(RAYON_POINT_BLOQUANT_M)
  })
  it('multiPolygone : null sans cercle, sinon un polygone par cercle', () => {
    expect(multiPolygoneAEviter([])).toBeNull()
    const mp = multiPolygoneAEviter(cerclesDesZones(zones, true))!
    expect(mp.type).toBe('MultiPolygon')
    expect(mp.coordinates.length).toBe(2)
    expect(mp.coordinates[0][0].length).toBe(33)
  })
})

describe('cerclesTraverses', () => {
  const rouge = { id: 'r', lat: C.lat, lon: C.lon, rayonM: 100, nature: 'rouge' as const }
  it('un tracé qui passe à 300 m ne traverse rien', () => {
    const t = [aLEst(-1000, auNord(300)), aLEst(1000, auNord(300))]
    expect(cerclesTraverses(t, [rouge])).toEqual([])
  })
  it('un segment droit dont les deux sommets sont hors du cercle mais qui le coupe est détecté', () => {
    const t = [aLEst(-1000), aLEst(1000)]
    expect(cerclesTraverses(t, [rouge]).map((c) => c.id)).toEqual(['r'])
  })
  it('un sommet dans le cercle est détecté, une seule fois', () => {
    const t = [aLEst(-500), C, auNord(20), aLEst(500)]
    expect(cerclesTraverses(t, [rouge]).length).toBe(1)
  })
})

describe('pointsDePassage', () => {
  // tracé rectiligne de 2 km vers l'est, un sommet tous les 50 m
  const trace = Array.from({ length: 41 }, (_, i) => aLEst(i * 50))
  it('au plus 8 points, régulièrement espacés, jamais les extrémités', () => {
    const p = pointsDePassage(trace)
    expect(p.length).toBe(8)
    expect(p[0]).not.toEqual({ lat: +trace[0].lat.toFixed(5), lon: +trace[0].lon.toFixed(5) })
    const ecarts = p.slice(1).map((x, i) => distanceM(p[i], x))
    for (const e of ecarts) expect(Math.abs(e - 2000 / 9) < 60).toBe(true)
  })
  it('tracé court : aucun point', () => {
    expect(pointsDePassage(trace.slice(0, 5))).toEqual([])
    expect(pointsDePassage([C, auNord(100)])).toEqual([])
  })
  it('tracé moyen : moins de 8 points', () => {
    const p = pointsDePassage(trace.slice(0, 11)) // 500 m
    expect(p.length).toBe(2)
  })
})

describe('lienGoogleMapsVia', () => {
  it('origine, destination, points de passage séparés par |, mode', () => {
    const u = lienGoogleMapsVia(C, auNord(1000), [auNord(300), auNord(600)], 'driving')
    const q = new URL(u).searchParams
    expect(q.get('api')).toBe('1')
    expect(q.get('origin')).toBe(`${C.lat},${C.lon}`)
    expect(q.get('waypoints')!.split('|').length).toBe(2)
    expect(q.get('travelmode')).toBe('driving')
  })
  it('sans origine ni point : destination seule', () => {
    const q = new URL(lienGoogleMapsVia(null, C, [])).searchParams
    expect(q.get('origin')).toBeNull()
    expect(q.get('waypoints')).toBeNull()
  })
})

describe('interpreterReponseOrs', () => {
  const rouge = { id: 'r', lat: C.lat, lon: C.lon, rayonM: 125, nature: 'rouge' as const }
  const geo = (pts: { lat: number; lon: number }[], extra: Record<string, unknown> = {}) => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lon, p.lat]) }, properties: { summary: { distance: 2345.6, duration: 321.4 }, ...extra } }],
  })
  it('tracé propre : résumé arrondi, aucun avertissement, points de passage', () => {
    const pts = Array.from({ length: 41 }, (_, i) => aLEst(i * 50, auNord(400)))
    const r = interpreterReponseOrs(geo(pts), [rouge])
    expect(r.distance_m).toBe(2346)
    expect(r.duree_s).toBe(321)
    expect(r.traverse).toEqual([])
    expect(r.avertissements).toEqual([])
    expect(r.points_passage.length).toBe(8)
    expect(r.trace.length).toBe(41)
  })
  it('tracé qui traverse la zone : signalé en premier avertissement', () => {
    const pts = Array.from({ length: 41 }, (_, i) => aLEst(-1000 + i * 50))
    const r = interpreterReponseOrs(geo(pts, { warnings: [{ message: 'Attention ORS' }] }), [rouge])
    expect(r.traverse).toEqual([{ id: 'r', nature: 'rouge' }])
    expect(r.avertissements.length).toBe(2)
    expect(r.avertissements[1]).toBe('Attention ORS')
  })
  it('réponse sans tracé : erreur', () => {
    expect(() => interpreterReponseOrs({ features: [] }, [])).toThrow()
  })
  it('longueurTrace cohérente avec le résumé absent', () => {
    const pts = [C, auNord(1000)]
    const r = interpreterReponseOrs({ features: [{ geometry: { coordinates: pts.map((p) => [p.lon, p.lat]) }, properties: {} }] }, [])
    expect(Math.abs(r.distance_m - Math.round(longueurTrace(pts))) <= 1).toBe(true)
  })
})
