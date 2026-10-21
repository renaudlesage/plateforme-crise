import { describe, expect, it } from 'vitest'
import {
  alertesDeLaCommune,
  apercuDestinataires,
  attributionAlerte,
  bilanTraitement,
  evenementSaisi,
  erreurParametres,
  erreurRegle,
  erreurSaisie,
  etatFlux,
  etatRegle,
  groupesSeuils,
  instantDepuisChampLocal,
  jourHeureBelge,
  minutesDepuisIntervalle,
  resumeRegle,
  texteFenetre,
  texteValidite,
} from './reveil.js'

const COMMUNE = 'commune-liege'

describe('alertesDeLaCommune', () => {
  const alertes = [
    { id: 'namur', contexte_id: null, provinces: ['Namur'], niveau: 'rouge', recu_le: '2026-05-30T15:00:00Z' },
    { id: 'liege-jaune', contexte_id: null, provinces: ['Liège'], niveau: 'jaune', recu_le: '2026-05-30T16:00:00Z' },
    { id: 'liege-orange', contexte_id: null, provinces: ['Liège', 'Namur'], niveau: 'orange', recu_le: '2026-05-30T15:30:00Z' },
    { id: 'saisie-ici', contexte_id: COMMUNE, provinces: ['Liège'], niveau: 'jaune', recu_le: '2026-05-30T17:00:00Z' },
    { id: 'saisie-ailleurs', contexte_id: 'autre', provinces: ['Liège'], niveau: 'rouge', recu_le: '2026-05-30T17:00:00Z' },
  ]

  it('garde les flux de la province et les saisies de la commune, du plus grave au plus récent', () => {
    expect(alertesDeLaCommune(alertes, { contexteId: COMMUNE, province: 'Liège' }).map((a) => a.id)).toEqual([
      'liege-orange',
      'saisie-ici',
      'liege-jaune',
    ])
  })

  it('sans province, ne garde que les avertissements encodés pour la commune', () => {
    expect(alertesDeLaCommune(alertes, { contexteId: COMMUNE, province: null }).map((a) => a.id)).toEqual(['saisie-ici'])
  })
})

describe('attributionAlerte', () => {
  it('cite le service national, l’heure d’émission en heure belge et MeteoAlarm', () => {
    expect(attributionAlerte({ source: 'meteoalarm', emis_le: '2026-05-30T15:42:00Z' })).toBe(
      'Source : IRM/KMI via MeteoAlarm (www.meteoalarm.org), émis le 30/05 à 17:42',
    )
  })

  it('distingue la saisie manuelle et la démonstration', () => {
    expect(attributionAlerte({ source: 'saisie', recu_le: '2026-11-02T08:05:00Z' })).toBe(
      'Encodé par la commune le 02/11 à 09:05 (avertissement reçu par un autre canal)',
    )
    expect(attributionAlerte({ source: 'fixture', recu_le: '2026-11-02T08:05:00Z' })).toMatch(/^Démonstration \(exercice\)/)
  })

  it('jourHeureBelge tient compte de l’heure d’été', () => {
    expect(jourHeureBelge('2026-07-01T22:30:00Z')).toBe('02/07 à 00:30')
    expect(jourHeureBelge(null)).toBe('—')
  })
})

describe('règles', () => {
  it('résume une règle avec sa source et sa fenêtre horaire', () => {
    expect(resumeRegle({ type_alerte: 'orage', niveau_min: 'orange', source: 'toutes' }, 'Orages S1 — Pré-activation')).toBe(
      'Orages, orange ou plus → Orages S1 — Pré-activation',
    )
    expect(
      resumeRegle({ type_alerte: 'pluie', niveau_min: 'rouge', source: 'meteoalarm', heure_debut: '22:00:00', heure_fin: '06:00:00' }, 'S2'),
    ).toBe('Pluie, rouge (MeteoAlarm (IRM), de 22:00 à 06:00) → S2')
    expect(texteFenetre(null, '06:00:00')).toBe('')
  })

  it('état d’une règle d’après les réveils des événements ouverts', () => {
    const regle = { actif: true, seuil_action_id: 's1' }
    const reveils = [
      { seuil_action_id: 's1', arme_le: '2026-05-30T15:43:00Z', acquitte_le: '2026-05-30T15:50:00Z', incident_ouvert: true },
      { seuil_action_id: 's1', arme_le: '2026-05-30T17:05:00Z', acquitte_le: null, incident_ouvert: true },
      { seuil_action_id: 's0', arme_le: '2026-05-30T18:00:00Z', acquitte_le: null, incident_ouvert: true },
    ]
    expect(etatRegle(regle, reveils).etat).toBe('declenchee')
    expect(etatRegle(regle, reveils.slice(0, 1)).etat).toBe('acquittee')
    expect(etatRegle(regle, [{ ...reveils[1], incident_ouvert: false }]).etat).toBe('armee')
    expect(etatRegle({ ...regle, actif: false }, reveils).etat).toBe('inactive')
    expect(etatRegle({ ...regle, seuils_action: { actif: false } }, reveils).etat).toBe('seuil_inactif')
  })

  it('période de validité d’un avertissement', () => {
    expect(texteValidite({ debut_le: '2026-05-30T15:42:00Z', fin_le: '2026-05-31T04:00:00Z' })).toBe('du 30/05 à 17:42 au 31/05 à 06:00')
    expect(texteValidite({ debut_le: '2026-05-30T15:42:00Z', fin_le: null })).toBe('dès le 30/05 à 17:42, sans fin annoncée')
  })

  it('regroupe les seuils par fiche, fiches nommées d’abord, seuils dans l’ordre', () => {
    const groupes = groupesSeuils([
      { id: 'g', libelle: 'Générique', ordre: 1 },
      { id: 'o2', libelle: 'Orages S2', ordre: 2, risques_territoire: { titre: 'Orages' } },
      { id: 'b', libelle: 'Barrage S1', ordre: 1, objets_a_risque: { identification: 'Barrage de la Gileppe' } },
      { id: 'o1', libelle: 'Orages S1', ordre: 1, risques_territoire: { titre: 'Orages' } },
    ])
    expect(groupes.map((g) => [g.fiche, g.seuils.map((s) => s.id)])).toEqual([
      ['Barrage de la Gileppe', ['b']],
      ['Orages', ['o1', 'o2']],
      ['Seuils génériques', ['g']],
    ])
  })

  it('refuse une règle incomplète ou une fenêtre bancale', () => {
    const ok = { seuil_action_id: 's1', type_alerte: 'orage', niveau_min: 'orange' }
    expect(erreurRegle(ok)).toBeNull()
    expect(erreurRegle({ ...ok, seuil_action_id: '' })).toMatch(/seuil/)
    expect(erreurRegle({ ...ok, niveau_min: 'vert' })).toMatch(/niveau/)
    expect(erreurRegle({ ...ok, heure_debut: '22:00' })).toMatch(/fenêtre/)
    expect(erreurRegle({ ...ok, heure_debut: '22:00', heure_fin: '22:00' })).toMatch(/différer/)
  })
})

describe('saisie manuelle', () => {
  it('exige type, niveau, texte, une fin à venir et après le début', () => {
    const ok = { type_alerte: 'orage', niveau: 'orange', titre: 'Orange orages, appel du CORTEX' }
    const maintenant = Date.parse('2026-05-30T12:00:00Z')
    expect(erreurSaisie(ok, maintenant)).toBeNull()
    expect(erreurSaisie({ ...ok, niveau: 'vert' }, maintenant)).toMatch(/niveau/)
    expect(erreurSaisie({ ...ok, titre: '  ' }, maintenant)).toMatch(/Décrivez/)
    expect(erreurSaisie({ ...ok, debut_le: '2026-05-30T18:00:00Z', fin_le: '2026-05-30T17:00:00Z' }, maintenant)).toMatch(/suivre le début/)
    expect(erreurSaisie({ ...ok, fin_le: '2026-05-30T11:00:00Z' }, maintenant)).toMatch(/déjà passée/)
    expect(erreurSaisie({ ...ok, debut_le: '2026-05-31T18:00:00Z', fin_le: '2026-06-01T06:00:00Z' }, maintenant)).toBeNull()
    expect(evenementSaisi('neige_verglas')).toBe('Avertissement neige ou verglas')
  })

  it('bilan après enregistrement, selon le passage dans le moteur', () => {
    expect(bilanTraitement({ nb_reveils: 1, erreur: null })).toEqual({
      type: 'ok',
      texte: 'Avertissement enregistré : 1 seuil armé, événement en veille ouvert ou complété, destinataires mis en file.',
    })
    expect(bilanTraitement({ nb_reveils: 0, erreur: null }).texte).toMatch(/Aucun seuil armé/)
    expect(bilanTraitement(null).type).toBe('ok')
    expect(bilanTraitement({ nb_reveils: 0, erreur: 'panne' })).toEqual({
      type: 'erreur',
      texte: 'Avertissement enregistré, mais le réveil automatique a échoué : panne',
    })
  })

  it('convertit un champ datetime-local', () => {
    expect(instantDepuisChampLocal('')).toBeNull()
    expect(instantDepuisChampLocal('pas une date')).toBeNull()
    expect(instantDepuisChampLocal('2026-05-30T18:00')).toMatch(/^2026-05-30T\d\d:00:00\.000Z$/)
  })
})

describe('flux et intervalles', () => {
  const maintenant = Date.parse('2026-10-21T10:00:00Z')

  it('lit les intervalles Postgres', () => {
    expect(minutesDepuisIntervalle('00:15:00')).toBe(15)
    expect(minutesDepuisIntervalle('24:00:00')).toBe(1440)
    expect(minutesDepuisIntervalle('1 day')).toBe(1440)
    expect(minutesDepuisIntervalle('2 days 01:30:00')).toBe(2970)
    expect(minutesDepuisIntervalle('')).toBeNull()
    expect(minutesDepuisIntervalle('15 minutes')).toBeNull()
  })

  it('aperçu des destinataires : comptes, rôles sans compte, codes inconnus, suppléants', () => {
    const roles = [
      { id: 'r-planu', code: 'PLANU' },
      { id: 'r-bourg', code: 'AUTORITE_COMMUNALE' },
      { id: 'r-com', code: 'COMMUNICATION' },
    ]
    const membres = [
      { user_id: 'u1', email: 'planu@commune.test', role_id: 'r-planu' },
      { user_id: 'u2', email: 'presse@commune.test', role_id: 'r-com' },
    ]
    const contacts = [
      { id: 'c-planu', role_id: 'r-planu', actif: true },
      { id: 'c-adjoint', est_suppleant_de: 'c-planu', actif: true, email: 'adjoint@commune.test' },
      { id: 'c-ancien', est_suppleant_de: 'c-planu', actif: false, email: 'ancien@commune.test' },
      { id: 'c-sans-mail', est_suppleant_de: 'c-planu', actif: true, email: ' ' },
      { id: 'c-presse-bis', est_suppleant_de: 'c-com', actif: true, email: 'bis@commune.test' },
    ]
    const a = apercuDestinataires({ codes: ['PLANU', 'AUTORITE_COMMUNALE', 'DIR_INFO'], roles, membres, contacts })
    expect(a.comptes.map((m) => m.user_id)).toEqual(['u1'])
    expect(a.rolesSansCompte.map((r) => r.code)).toEqual(['AUTORITE_COMMUNALE'])
    expect(a.codesInconnus).toEqual(['DIR_INFO'])
    expect(a.suppleants.map((c) => c.id)).toEqual(['c-adjoint', 'c-sans-mail'])
    expect(a.suppleantsSansEmail.map((c) => c.id)).toEqual(['c-sans-mail'])
  })

  it('contrôle les paramètres de réveil', () => {
    expect(erreurParametres({ roles: ['PLANU'], delaiMinutes: '15' })).toBeNull()
    expect(erreurParametres({ roles: [], delaiMinutes: 15 })).toMatch(/rôle/)
    expect(erreurParametres({ roles: ['PLANU'], delaiMinutes: 0 })).toMatch(/délai/)
    expect(erreurParametres({ roles: ['PLANU'], delaiMinutes: '2.5' })).toMatch(/délai/)
    expect(erreurParametres({ roles: ['PLANU'], delaiMinutes: 1441 })).toMatch(/délai/)
  })

  it('distingue flux non branché, muet, en erreur et à jour', () => {
    expect(etatFlux(null, maintenant).etat).toBe('non_branche')
    expect(etatFlux({ actif: false, silence_max: '01:00:00', dernier_succes_le: '2026-10-21T09:50:00Z' }, maintenant).etat).toBe('non_branche')
    expect(etatFlux({ silence_max: '01:00:00', dernier_succes_le: '2026-10-21T08:30:00Z' }, maintenant).etat).toBe('muet')
    expect(etatFlux({ silence_max: '01:00:00', dernier_succes_le: null }, maintenant).etat).toBe('muet')
    expect(etatFlux({ silence_max: '01:00:00', dernier_succes_le: '2026-10-21T09:50:00Z', echecs_consecutifs: 2 }, maintenant).etat).toBe('erreur')
    expect(etatFlux({ silence_max: '01:00:00', dernier_succes_le: '2026-10-21T09:50:00Z', echecs_consecutifs: 0 }, maintenant)).toMatchObject({
      etat: 'ok',
      dernierSucces: '2026-10-21T09:50:00Z',
    })
  })
})
