import { describe, expect, it } from 'vitest'
import {
  delaiTraitement,
  ecrireCsv,
  exporterChronogramme,
  lireChronogramme,
  lireCsv,
  lireDestinataires,
  lireHoraire,
  modeleChronogramme,
} from './chronogramme.js'

describe('lireCsv / ecrireCsv', () => {
  it('relit ce qu’il écrit (point-virgule, guillemets, retours à la ligne, BOM)', () => {
    const lignes = [['a', 'b;c'], ['dit "oui"', 'deux\nlignes']]
    expect(lireCsv(ecrireCsv(lignes))).toEqual(lignes)
  })
  it('détecte la virgule et la tabulation', () => {
    expect(lireCsv('x,y\n1,2')).toEqual([['x', 'y'], ['1', '2']])
    expect(lireCsv('x\ty\r\n1\t2\r\n')).toEqual([['x', 'y'], ['1', '2']])
  })
  it('ignore les lignes vides', () => {
    expect(lireCsv('a;b\n;\n\n1;2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('lireHoraire', () => {
  it.each([
    ['0', 0], ['65', 65], ['T+65', 65], ['T+65 min', 65], ['1:05', 65], ['01:05:00', 65],
    ['T+1 h 05', 65], ['1h', 60], ['J+2', 2880], ['J+1 2h30', 1590],
  ])('%s → %i', (v, m) => expect(lireHoraire(v)).toBe(m))
  it('refuse l’illisible', () => {
    expect(lireHoraire('bientôt')).toBeNull()
    expect(lireHoraire('')).toBeNull()
  })
})

describe('lireDestinataires', () => {
  it('reconnaît les rôles et signale les inconnus', () => {
    expect(lireDestinataires('D1, Bourgmestre / PC-Ops, d1, Préfet')).toEqual({ roles: ['d1', 'bourgmestre', 'pcops'], inconnus: ['Préfet'] })
  })
})

describe('lireChronogramme', () => {
  it('lit le modèle fourni', () => {
    const r = lireChronogramme(modeleChronogramme())
    expect(r.erreurs).toEqual([])
    expect(r.stimuli.map((s) => [s.heure_scenario_min, s.type_stimulus, s.decompte_minutes])).toEqual([
      [0, 'message', null], [20, 'publication', null], [30, 'decompte', 30],
    ])
    expect(r.stimuli[0].destinataires).toEqual(['d1', 'bourgmestre'])
    expect(r.stimuli[0].reaction_attendue).toBe('Exemple : convoquer le CC')
    expect(r.stimuli[1].canal).toBe('media')
  })
  it('accepte des titres de colonnes proches (casse, accents) et signale les colonnes ignorées', () => {
    const r = lireChronogramme('HEURE;Émetteur;Message;Couleur\n10;Police;Route coupée;rouge')
    expect(r.erreurs).toEqual([])
    expect(r.colonnesIgnorees).toEqual(['Couleur'])
    expect(r.stimuli[0]).toMatchObject({ heure_scenario_min: 10, emetteur: 'Police', texte: 'Route coupée', type_stimulus: 'message', canal: 'autre' })
  })
  it('signale chaque ligne invalide avec son numéro, sans bloquer les autres', () => {
    const r = lireChronogramme('Horaire;Type;Stimulus;Destinataires;Durée décompte (min)\n'
      + 'demain;message;x;;\n5;fax;y;;\n6;decompte;z;;\n7;message;;;\n8;message;ok;Préfet;\n9;message;bon;D2;')
    expect(r.erreurs.map((e) => e.ligne)).toEqual([2, 3, 4, 5, 6])
    expect(r.stimuli).toHaveLength(1)
    expect(r.stimuli[0]).toMatchObject({ heure_scenario_min: 9, destinataires: ['d2'] })
  })
  it('exige les colonnes Horaire et Stimulus', () => {
    expect(lireChronogramme('Type;Émetteur\nmessage;x').erreurs[0].ligne).toBe(1)
  })
  it('trie par horaire', () => {
    const r = lireChronogramme('Horaire;Stimulus\n30;b\n0;a')
    expect(r.stimuli.map((s) => s.texte)).toEqual(['a', 'b'])
  })
})

describe('exporterChronogramme', () => {
  it('produit un fichier réimportable à l’identique', () => {
    const stimuli = [
      { id: 's2', ordre: 2, heure_scenario_min: 75, type_stimulus: 'publication', canal: 'media', emetteur: '@x', texte: 'rumeur; "virale"', destinataires: null },
      { id: 's1', ordre: 1, heure_scenario_min: 0, type_stimulus: 'message', canal: 'telephone', emetteur: 'Police', texte: 'route\ncoupée', destinataires: ['d1', 'pcops'], note_animateur: 'n', livrable: 'l' },
      { id: 's3', ordre: 3, heure_scenario_min: 90, type_stimulus: 'decompte', canal: 'autre', texte: 'rapport', decompte_minutes: 15 },
      { id: 's4', ordre: 4, heure_scenario_min: 100, canal: 'radio', texte: 'ancien', discipline_cible: 'd3' },
    ]
    const actions = [{ stimulus_id: 's1', action: 'fermer la route' }, { stimulus_id: 's1', action: 'prévenir D3' }]
    const r = lireChronogramme(exporterChronogramme(stimuli, actions))
    expect(r.erreurs).toEqual([])
    expect(r.stimuli.map((s) => [s.heure_scenario_min, s.type_stimulus, s.texte, s.destinataires, s.decompte_minutes])).toEqual([
      [0, 'message', 'route\ncoupée', ['d1', 'pcops'], null],
      [75, 'publication', 'rumeur; "virale"', null, null],
      [90, 'decompte', 'rapport', null, 15],
      [100, 'message', 'ancien', ['d3'], null],
    ])
    expect(r.stimuli[0]).toMatchObject({ reaction_attendue: 'fermer la route | prévenir D3', note_animateur: 'n', livrable: 'l' })
  })
})

describe('delaiTraitement', () => {
  it('compte jusqu’au premier « traité »', () => {
    expect(delaiTraitement('2026-11-13T10:00:00Z', [{ traite_le: '2026-11-13T10:12:00Z' }, { traite_le: '2026-11-13T10:04:30Z' }])).toBe(5)
    expect(delaiTraitement('2026-11-13T10:00:00Z', [])).toBeNull()
    expect(delaiTraitement(null, [{ traite_le: '2026-11-13T10:00:00Z' }])).toBeNull()
  })
})
