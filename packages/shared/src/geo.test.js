import { describe, expect, it } from 'vitest'
import { distanceM, etatGeoBarriere, transitionGeoBarriere, SEUIL_APPROCHE_ZONE_M } from './geo.js'

// Logne (Ferrières) : zone rouge de 100 m, zone rouge voisine de 50 m plus au nord.
const CENTRE = { lat: 50.3934, lon: 5.5382 }
const Z100 = { id: 'a', centre_latitude: '50.3934', centre_longitude: '5.5382', rayon_metres: '100' }
const Z50 = { id: 'b', centre_latitude: 50.3964, centre_longitude: 5.5382, rayon_metres: 50 }

// Point à `m` mètres au nord du centre (1° de latitude ≈ 111 320 m).
const auNord = (m) => ({ lat: CENTRE.lat + m / 111320, lon: CENTRE.lon })

describe('etatGeoBarriere', () => {
  it('sans position ou sans zone : hors', () => {
    expect(etatGeoBarriere(null, [Z100])).toEqual({ etat: 'hors', zone: null, distanceBord: null })
    expect(etatGeoBarriere(CENTRE, [])).toEqual({ etat: 'hors', zone: null, distanceBord: null })
    expect(etatGeoBarriere(CENTRE, null)).toEqual({ etat: 'hors', zone: null, distanceBord: null })
  })

  it('au centre : dedans, distance au bord négative égale au rayon', () => {
    const r = etatGeoBarriere(CENTRE, [Z100])
    expect(r.etat).toBe('dedans')
    expect(r.zone.id).toBe('a')
    expect(r.distanceBord).toBe(-100)
  })

  it('à 99 m du centre : encore dedans ; à 101 m : approche', () => {
    expect(etatGeoBarriere(auNord(99), [Z100]).etat).toBe('dedans')
    const r = etatGeoBarriere(auNord(101), [Z100])
    expect(r.etat).toBe('approche')
    expect(r.distanceBord).toBe(1)
  })

  it('le seuil d’approche est mesuré depuis le bord, pas depuis le centre', () => {
    expect(etatGeoBarriere(auNord(100 + SEUIL_APPROCHE_ZONE_M - 1), [Z100]).etat).toBe('approche')
    expect(etatGeoBarriere(auNord(100 + SEUIL_APPROCHE_ZONE_M + 5), [Z100]).etat).toBe('hors')
    // seuil personnalisé
    expect(etatGeoBarriere(auNord(140), [Z100], 30).etat).toBe('hors')
  })

  it('plusieurs zones : la plus profondément pénétrée gagne quand on est dedans', () => {
    // à 300 m au nord : dans Z50 (centre à ~334 m), hors Z100
    const r = etatGeoBarriere(auNord(320), [Z100, Z50])
    expect(r.etat).toBe('dedans')
    expect(r.zone.id).toBe('b')
  })

  it('plusieurs zones : hors de toutes, la plus proche est renvoyée', () => {
    const r = etatGeoBarriere(auNord(700), [Z100, Z50])
    expect(r.etat).toBe('hors')
    expect(r.zone.id).toBe('b')
  })

  it('ignore les zones sans centre ou sans rayon exploitable', () => {
    const r = etatGeoBarriere(CENTRE, [{ centre_latitude: null, centre_longitude: null, rayon_metres: 100 }, { ...Z100, rayon_metres: 0 }])
    expect(r.etat).toBe('hors')
    expect(r.zone).toBeNull()
  })

  it('cohérent avec distanceM (chaînes numériques acceptées)', () => {
    const p = auNord(250)
    const attendu = Math.round(distanceM(p, CENTRE) - 100)
    expect(etatGeoBarriere(p, [Z100]).distanceBord).toBe(attendu)
  })
})

describe('transitionGeoBarriere', () => {
  const E = (etat) => ({ etat })
  it('entrée depuis hors ou depuis approche', () => {
    expect(transitionGeoBarriere(E('hors'), E('dedans'))).toBe('entree')
    expect(transitionGeoBarriere(E('approche'), E('dedans'))).toBe('entree')
    expect(transitionGeoBarriere(null, E('dedans'))).toBe('entree')
  })
  it('sortie vers approche ou vers hors', () => {
    expect(transitionGeoBarriere(E('dedans'), E('approche'))).toBe('sortie')
    expect(transitionGeoBarriere(E('dedans'), E('hors'))).toBe('sortie')
  })
  it('approche seulement depuis hors ; retour hors sans événement', () => {
    expect(transitionGeoBarriere(E('hors'), E('approche'))).toBe('approche')
    expect(transitionGeoBarriere(E('approche'), E('hors'))).toBeNull()
  })
  it('rien sans changement d’état', () => {
    expect(transitionGeoBarriere(E('dedans'), E('dedans'))).toBeNull()
    expect(transitionGeoBarriere(E('hors'), E('hors'))).toBeNull()
    expect(transitionGeoBarriere(null, null)).toBeNull()
  })
})
