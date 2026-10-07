/**
 * Organes de crise (instances_coordination.type). Libellés affichés partout
 * (Admin : composition ; CC : activation/désactivation par incident).
 * COMITE_COORDINATION est l'ancien type générique : conservé pour les données
 * existantes, plus proposé à la création.
 */
export const ORGANES_CRISE = [
  { valeur: 'CELLULE_SECURITE', libelle: 'Cellule de sécurité' },
  { valeur: 'CC_COM', libelle: 'CC-COM (Comité de Coordination communal)' },
  { valeur: 'CC_PROV', libelle: 'CC-PROV (Comité de Coordination provincial)' },
  { valeur: 'NCCN', libelle: 'NCCN (Centre de crise national)' },
  { valeur: 'PC_OPS', libelle: 'PC-OPS' },
]

const ANCIEN = { valeur: 'COMITE_COORDINATION', libelle: 'Comité de Coordination (générique)' }

export function libelleOrgane(type) {
  return [...ORGANES_CRISE, ANCIEN].find((o) => o.valeur === type)?.libelle ?? type
}
