// Trames d'exercice et pièges de la commune (briefing 03, partie C) : vocabulaire commun à l'Admin
// (édition des trames) et au QG (génération d'un exercice). Les codes sont ceux que renvoie la
// fonction pieges_commune() en base.

export const PIEGES_COMMUNE = [
  { code: 'instance_sans_membre', libelle: 'Instance de coordination sans membre' },
  { code: 'seuil_sans_responsable', libelle: "Seuil d'action sans responsable" },
  { code: 'seuil_sans_action_degradee', libelle: "Seuil d'action sans mode dégradé" },
  { code: 'aucun_centre_accueil', libelle: "Aucun centre d'accueil encodé" },
  { code: 'discipline_sans_contact', libelle: 'Discipline sans contact actif' },
  { code: 'discipline_sans_suppleant', libelle: 'Discipline sans suppléant' },
  { code: 'risque_sans_message', libelle: 'Risque sans message public prédéfini' },
]

export const libellePiege = (code) => PIEGES_COMMUNE.find((p) => p.code === code)?.libelle ?? code

export const GRAVITES_PIEGE = {
  haute: { libelle: 'haute', classe: 'text-chaud' },
  moyenne: { libelle: 'moyenne', classe: 'text-veille' },
  basse: { libelle: 'basse', classe: 'text-sourdine' },
}

/** « 2 h 40 », « J+2 », « 25 min » : heure de scénario lisible (minutes depuis le début). */
export function libelleHeureScenario(minutes) {
  const m = Number(minutes) || 0
  if (m >= 1440) {
    const j = Math.floor(m / 1440)
    const reste = m % 1440
    return `J+${j}${reste ? ` ${Math.floor(reste / 60)} h ${String(reste % 60).padStart(2, '0')}` : ''}`
  }
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  return `${m} min`
}
