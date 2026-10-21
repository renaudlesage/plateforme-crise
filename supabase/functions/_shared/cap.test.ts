import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ErreurCap, dateIso, lignesAlerteExterne, lireCap, niveauDepuis, provincesDeZone, typeDepuis } from './cap.ts'

const fixture = (nom: string) => readFileSync(new URL(`./fixtures/cap/${nom}`, import.meta.url), 'utf8')
const lignes = (nom: string) => lignesAlerteExterne(lireCap(fixture(nom)), 'meteoalarm')

describe('lireCap et lignesAlerteExterne sur les fixtures', () => {
  it('jaune vent, province de Namur : bloc français retenu même s’il vient après le néerlandais', () => {
    const { lignes: l, ecartes } = lignes('jaune_vent_namur.xml')
    expect(ecartes).toEqual([])
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({
      identifiant: 'fixture.crisiware.20260530.jaune-vent-namur',
      segment: 0,
      niveau: 'jaune',
      type_alerte: 'vent',
      provinces: ['Namur'],
      langue: 'fr-be',
      titre: 'Avertissement jaune pour le vent en province de Namur',
      consignes: "Rangez ou fixez les objets susceptibles d'être emportés par le vent.",
    })
  })

  it('orange orages, province de Liège (démo D1) : quatre langues, un seul segment, heures en UTC', () => {
    const alerte = lireCap(fixture('orange_orages_liege.xml'))
    expect(alerte).toMatchObject({ version: '1.2', statut: 'Actual', type_message: 'Alert', emis_le: '2026-05-30T15:42:00.000Z' })
    expect(alerte.infos).toHaveLength(4)
    expect(alerte.infos.every((i) => i.niveau === 'orange' && i.type === 'orage')).toBe(true)
    expect(alerte.infos.map((i) => i.zones[0].provinces)).toEqual([['Liège'], ['Liège'], ['Liège'], ['Liège']])

    const { lignes: l } = lignesAlerteExterne(alerte, 'meteoalarm')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({
      niveau: 'orange',
      type_alerte: 'orage',
      provinces: ['Liège'],
      debut_le: '2026-05-30T16:00:00.000Z',
      fin_le: '2026-05-31T00:00:00.000Z',
      severite: 'Severe',
      lien: 'https://www.meteoalarm.org',
      description: 'Orages localement violents, grêle & fortes pluies (plus de 30 l/m² en une heure).',
      consignes: 'Évitez les déplacements <non essentiels> ; ne vous abritez pas sous les arbres.',
    })
    expect(l[0].zones[0].geocodes).toEqual([{ nom: 'NUTS2', valeur: 'BE33' }])
  })

  it('rouge pluie, province de Luxembourg', () => {
    const { lignes: l } = lignes('rouge_pluie_luxembourg.xml')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ niveau: 'rouge', type_alerte: 'pluie', provinces: ['Luxembourg'], urgence: 'Immediate', certitude: 'Observed' })
  })

  it('un avertissement sur trois provinces donne un segment avec les trois provinces', () => {
    const { lignes: l } = lignes('orange_vent_multi_provinces.xml')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ niveau: 'orange', type_alerte: 'vent', provinces: ['Liège', 'Luxembourg', 'Namur'] })
    expect(l[0].zones.map((z) => z.nom)).toEqual(['Liège', 'Namur', 'Luxembourg'])
  })

  it('la zone « Brabant » vaut pour le Brabant flamand, le Brabant wallon et Bruxelles-Capitale (préfixe cap:)', () => {
    const { lignes: l } = lignes('jaune_neige_brabant.xml')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({
      niveau: 'jaune',
      type_alerte: 'neige_verglas',
      langue: 'en-gb',
      provinces: ['Brabant flamand', 'Brabant wallon', 'Bruxelles-Capitale'],
    })
  })

  it('une mise à jour garde la référence du message précédent', () => {
    const { lignes: l } = lignes('maj_rouge_orages_liege.xml')
    expect(l[0]).toMatchObject({
      type_message: 'Update',
      niveau: 'rouge',
      references_cap: ['fixture.crisiware.20260530.orange-orages-liege'],
    })
    expect(lireCap(fixture('maj_rouge_orages_liege.xml')).references[0]).toEqual({
      expediteur: 'fixtures@crisiware.invalid',
      identifiant: 'fixture.crisiware.20260530.orange-orages-liege',
      emis_le: '2026-05-30T15:42:00.000Z',
    })
  })

  it('une annulation sans bloc info donne une ligne verte, sans province, qui clôt le fil', () => {
    const { lignes: l } = lignes('annulation_orages_liege.xml')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({
      type_message: 'Cancel',
      niveau: 'vert',
      provinces: [],
      references_cap: ['fixture.crisiware.20260530.rouge-orages-liege'],
    })
  })

  it('sans paramètres MeteoAlarm : niveau tiré de la sévérité, type du libellé, début de <effective>', () => {
    const { lignes: l } = lignes('orange_orages_sans_parametres.xml')
    expect(l[0]).toMatchObject({ niveau: 'orange', type_alerte: 'orage', provinces: ['Liège'], debut_le: '2026-05-30T16:00:00.000Z' })
  })

  it('deux niveaux dans un message : deux segments, le plus grave en premier', () => {
    const { lignes: l } = lignes('deux_niveaux.xml')
    expect(l.map((x) => [x.segment, x.niveau, x.provinces])).toEqual([
      [0, 'orange', ['Liège']],
      [1, 'jaune', ['Namur']],
    ])
  })
})

describe('messages refusés ou écartés', () => {
  const cap = (corps: string, racine = '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">') =>
    `${racine}${corps}${racine.startsWith('<alert') ? '</alert>' : ''}`
  const entete = (s = '') =>
    `<identifier>x.1</identifier><sender>s@exemple.invalid</sender><sent>2026-05-30T10:00:00+02:00</sent><status>Actual</status><msgType>Alert</msgType><scope>Public</scope>${s}`

  it.each([
    [cap(entete().replace('<identifier>x.1</identifier>', '')), /<identifier> absent/],
    [cap(entete().replace('x.1', 'x 1')), /Identifiant CAP invalide/],
    [cap(entete().replace('+02:00', '')), /sans fuseau/],
    [cap(entete().replace('Actual', 'Reel')), /Statut CAP inconnu/],
    [cap(entete(), '<alert>'), /Espace de noms/],
    ['<feed xmlns="urn:oasis:names:tc:emergency:cap:1.2"/>', /<alert> attendu/],
    ['<!DOCTYPE alert><alert/>', /XML illisible/],
  ])('lève ErreurCap : %s', (xml, motif) => {
    expect(() => lireCap(xml)).toThrow(ErreurCap)
    expect(() => lireCap(xml)).toThrow(motif)
  })

  it('écarte un bloc info sans niveau lisible et ignore les accusés de réception', () => {
    const sansNiveau = lireCap(cap(entete('<info><language>fr</language><event>Avis</event><severity>Unknown</severity></info>')))
    expect(lignesAlerteExterne(sansNiveau, 'irm')).toEqual({ lignes: [], ecartes: ['Bloc <info> (fr) sans niveau lisible : « Avis »'] })

    const accuse = lireCap(cap(entete().replace('<msgType>Alert</msgType>', '<msgType>Ack</msgType>')))
    expect(lignesAlerteExterne(accuse, 'irm').lignes).toEqual([])
  })
})

describe('correspondances', () => {
  it.each([
    ['Liège', ['Liège']],
    ['Luik', ['Liège']],
    ['Lüttich', ['Liège']],
    ['Province de Liège', ['Liège']],
    ['Provincie Antwerpen', ['Anvers']],
    ['West-Vlaanderen', ['Flandre-Occidentale']],
    ['East Flanders', ['Flandre-Orientale']],
    ['Région de Bruxelles-Capitale', ['Bruxelles-Capitale']],
    ['Brussel', ['Bruxelles-Capitale']],
    ['Brabant wallon', ['Brabant wallon']],
    ['Vlaams-Brabant', ['Brabant flamand']],
    ['Brabant', ['Brabant flamand', 'Brabant wallon', 'Bruxelles-Capitale']],
    ['Liège, Namur et Luxembourg', ['Liège', 'Luxembourg', 'Namur']],
    ['Hainaut', ['Hainaut']],
    ['Limburg', ['Limbourg']],
    ['Wallonie', []],
    ['', []],
  ])('provincesDeZone(%j)', (nom, attendu) => {
    expect(provincesDeZone(nom)).toEqual(attendu)
  })

  it('niveau : awareness_level prioritaire, sinon sévérité CAP', () => {
    expect(niveauDepuis('3; orange; Severe', 'Moderate')).toBe('orange')
    expect(niveauDepuis('4', null)).toBe('rouge')
    expect(niveauDepuis(null, 'Moderate')).toBe('jaune')
    expect(niveauDepuis(null, 'Unknown')).toBeNull()
    expect(niveauDepuis(null, null)).toBeNull()
  })

  it('type : awareness_type prioritaire, sinon mots du libellé (FR, NL, DE, EN)', () => {
    expect(typeDepuis('5; high-temperature', 'Avertissement')).toBe('chaleur')
    expect(typeDepuis('thunderstorm', null)).toBe('orage')
    expect(typeDepuis('12; flooding', null)).toBe('autre')
    expect(typeDepuis(null, 'Avertissement canicule')).toBe('chaleur')
    expect(typeDepuis(null, 'Waarschuwing gladheid')).toBe('neige_verglas')
    expect(typeDepuis(null, 'Orages avec fortes pluies')).toBe('orage')
    expect(typeDepuis(null, 'Dichte mist')).toBe('brouillard')
    expect(typeDepuis(null, 'Avertissement événement')).toBe('autre')
  })

  it('dateIso exige un fuseau', () => {
    expect(dateIso('2026-05-30T18:00:00+02:00')).toBe('2026-05-30T16:00:00.000Z')
    expect(dateIso('2026-05-30T16:00:00Z')).toBe('2026-05-30T16:00:00.000Z')
    expect(dateIso('2026-05-30T18:00:00-00:00')).toBe('2026-05-30T18:00:00.000Z')
    expect(dateIso('2026-05-30T18:00:00')).toBeNull()
    expect(dateIso('demain')).toBeNull()
  })
})
