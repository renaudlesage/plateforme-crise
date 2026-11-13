import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { entreesFlux } from './meteoalarm.ts'
import { lignesAlerteExterne, lireCap, provincesDeZone } from './cap.ts'

const fixture = (nom: string) => readFileSync(new URL(`./fixtures/meteoalarm/${nom}`, import.meta.url), 'utf8')

describe('flux Atom MeteoAlarm (extrait réel du 13/11/2026)', () => {
  it('une entrée par identifiant, triées par émission, lien CAP de MeteoAlarm', () => {
    const { entrees, ecartees } = entreesFlux(fixture('flux_extrait.xml'))
    expect(ecartees).toBe(0)
    expect(entrees.map((e) => e.identifiant)).toEqual([
      '2.49.0.0.56.0.BE.20261113054001.1619148',
      '2.49.0.0.56.0.BE.20261113131223.1619165',
      '2.49.0.0.56.0.BE.20261113131223.1619166',
    ])
    expect(entrees[0]).toMatchObject({ type_message: 'Update', emis_le: '2026-11-13T05:40:01.000Z' })
    expect(entrees[1].lien).toBe('https://feeds.meteoalarm.org/api/v1/warnings/feeds-belgium/ebc37776-84f6-4b5c-811e-cb5b34f737f8')
  })

  it('écarte une entrée dont le lien CAP pointe ailleurs que MeteoAlarm', () => {
    const xml = fixture('flux_extrait.xml').replace(
      'https://feeds.meteoalarm.org/api/v1/warnings/feeds-belgium/0372880c-1a15-43cb-b0be-ea09264a7a30',
      'https://exemple.invalid/cap.xml'
    )
    const { entrees, ecartees } = entreesFlux(xml)
    expect(ecartees).toBe(1)
    expect(entrees).toHaveLength(2)
  })

  it('refuse un document qui n’est pas un flux Atom', () => {
    expect(() => entreesFlux('<alert/>')).toThrow(/feed/)
  })
})

describe('message CAP réel de l’IRM (jaune brouillard, Liège)', () => {
  it('quatre langues, un seul segment rédigé en français, province de Liège, heures en UTC', () => {
    const alerte = lireCap(fixture('jaune_brouillard_liege.xml'))
    expect(alerte.infos).toHaveLength(4)
    const { lignes, ecartes } = lignesAlerteExterne(alerte, 'meteoalarm')
    expect(ecartes).toEqual([])
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      identifiant: '2.49.0.0.56.0.BE.20261113131223.1619164',
      expediteur: 'kmi-irm',
      niveau: 'jaune',
      type_alerte: 'brouillard',
      provinces: ['Liège'],
      langue: 'fr-be',
      titre: 'Avertissement jaune brouillard en Belgique - Liège',
      debut_le: '2026-11-13T23:00:00.000Z',
      fin_le: '2026-11-14T11:00:00.000Z',
    })
  })
})

describe('zones du flux réel', () => {
  it.each([
    ['Kust', ['Flandre-Occidentale']],
    ['La Côte', ['Flandre-Occidentale']],
    ['Coastal zone', ['Flandre-Occidentale']],
    ['Küste', ['Flandre-Occidentale']],
    ['Brabant', ['Brabant flamand', 'Brabant wallon', 'Bruxelles-Capitale']],
    ['Lüttich', ['Liège']],
    ['Luik', ['Liège']],
    ['Antwerp', ['Anvers']],
    ['East Flanders', ['Flandre-Orientale']],
    ['West Flanders', ['Flandre-Occidentale']],
    ['Limburg', ['Limbourg']],
  ])('%s → %j', (zone, provinces) => {
    expect(provincesDeZone(zone)).toEqual(provinces)
  })
})
