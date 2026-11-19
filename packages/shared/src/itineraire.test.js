import { describe, expect, it } from 'vitest'
import { lienGoogleMapsVia, libelleDuree, libelleEvites } from './itineraire.js'

describe('itineraire (client)', () => {
  it('lien Google Maps : origine, destination, points, mode', () => {
    const q = new URL(lienGoogleMapsVia({ lat: 50.1, lon: 5.1 }, { lat: 50.2, lon: 5.2 }, [{ lat: 50.15, lon: 5.15 }], 'walking')).searchParams
    expect(q.get('origin')).toBe('50.1,5.1')
    expect(q.get('destination')).toBe('50.2,5.2')
    expect(q.get('waypoints')).toBe('50.15,5.15')
    expect(q.get('travelmode')).toBe('walking')
    expect(new URL(lienGoogleMapsVia(null, { lat: 1, lon: 2 })).searchParams.get('origin')).toBeNull()
  })
  it('durées', () => {
    expect(libelleDuree(20)).toBe('< 1 min')
    expect(libelleDuree(250)).toBe('4 min')
    expect(libelleDuree(3900)).toBe('1 h 05')
  })
  it('évités', () => {
    expect(libelleEvites({ rouges: 1, oranges: 0, points_bloquants: 2 })).toBe('1 zone rouge, 2 routes coupées / inondées')
    expect(libelleEvites({ rouges: 0, oranges: 0, points_bloquants: 0 })).toBe('aucune zone à éviter pour le moment')
  })
})
