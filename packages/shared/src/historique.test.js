import { describe, expect, it } from 'vitest'
import { grilleDensite, incidentsCsv, incidentsGeoJson, statistiquesIncidents } from './historique.js'
import { lireCsv } from './chronogramme.js'

const I = [
  { nom: 'Orage', type_evenement: 'Inondation', statut: 'cloture', date_debut: '2026-05-30T16:00:00Z', date_fin: '2026-05-31T02:00:00Z', degre_criticite: 2, latitude: 50.501, longitude: 5.501 },
  { nom: 'Crue', type_evenement: 'Inondation', statut: 'cloture', date_debut: '2026-07-14T10:00:00Z', date_fin: '2026-07-14T14:00:00Z', degre_criticite: 3, latitude: 50.502, longitude: 5.502 },
  { nom: 'Cyber; « rançon »', type_evenement: 'Cyberattaque', statut: 'en_cours', date_debut: '2026-08-02T08:00:00Z', est_exercice: true },
  { nom: 'Sans type', statut: 'cloture', date_debut: '2026-08-20T08:00:00Z', date_fin: '2026-08-20T07:00:00Z', latitude: 50.7, longitude: 5.9 },
]

describe('statistiquesIncidents', () => {
  const s = statistiquesIncidents(I)
  it('compte', () => {
    expect([s.total, s.clos, s.ouverts, s.exercices, s.localises]).toEqual([4, 3, 1, 1, 3])
  })
  it('répartit par type, le plus fréquent d’abord', () => {
    expect(s.parType).toEqual([{ cle: 'Inondation', n: 2 }, { cle: 'Cyberattaque', n: 1 }, { cle: 'non précisé', n: 1 }])
  })
  it('remplit les mois sans incident', () => {
    expect(s.parMois).toEqual([{ cle: '2026-05', n: 1 }, { cle: '2026-06', n: 0 }, { cle: '2026-07', n: 1 }, { cle: '2026-08', n: 2 }])
  })
  it('durée médiane des incidents clos, en ignorant une fin antérieure au début', () => {
    expect(s.dureeMedianeHeures).toBe(7)
  })
  it('degrés, dont non précisé', () => {
    expect(s.parCriticite.map((x) => x.n)).toEqual([0, 1, 1, 0, 2])
  })
  it('liste vide', () => {
    expect(statistiquesIncidents([])).toMatchObject({ total: 0, parMois: [], dureeMedianeHeures: null })
  })
})

describe('grilleDensite', () => {
  it('regroupe les incidents proches', () => {
    expect(grilleDensite(I).map((m) => m.n)).toEqual([2, 1])
  })
})

describe('exports', () => {
  it('CSV relisible, durée en heures', () => {
    const l = lireCsv(incidentsCsv(I))
    expect(l).toHaveLength(5)
    expect(l[1][5]).toBe('10')
    expect(l[3][0]).toBe('Cyber; « rançon »')
  })
  it('GeoJSON : incidents localisés, longitude puis latitude', () => {
    const g = JSON.parse(incidentsGeoJson(I))
    expect(g.features).toHaveLength(3)
    expect(g.features[0].geometry.coordinates).toEqual([5.501, 50.501])
    expect(g.features[0].properties.nom).toBe('Orage')
  })
})
