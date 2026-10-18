/**
 * États dérivés du journal des décisions, partagés par l'écran de saisie, la vue autorité et l'impression.
 * Le registre est en ajout seul : ces états se déduisent des entrées, rien n'est jamais modifié en base.
 */

import { libelleClasseUrgence } from '@plateforme-crise/shared'

export const LIBELLE_NATURE = { decision: 'Décision', correction: 'Correction', reexamen: 'Réexamen' }

/**
 * @param {Array} entrees entrées du journal d'un incident (dans n'importe quel ordre)
 * @param {number} maintenant horodatage de référence (ms)
 * @returns {{ parId: object, remplaceePar: object, reexaminee: Set<string>, depassees: Array, depasse: (e) => boolean }}
 *   - remplaceePar[id] : la correction qui remplace l'entrée `id`
 *   - reexaminee : ids des entrées reprises par un réexamen
 *   - depassees : entrées dont l'échéance est passée sans correction ni réexamen
 */
export function etatsJournal(entrees, maintenant = Date.now()) {
  const parId = Object.fromEntries(entrees.map((e) => [e.id, e]))
  const remplaceePar = {}
  const reexaminee = new Set()
  for (const e of entrees) {
    if (e.nature === 'correction') remplaceePar[e.precedente_id] = e
    if (e.nature === 'reexamen') reexaminee.add(e.precedente_id)
  }
  const depasse = (e) => !!e.echeance && !remplaceePar[e.id] && !reexaminee.has(e.id) && new Date(e.echeance).getTime() <= maintenant
  return { parId, remplaceePar, reexaminee, depassees: entrees.filter(depasse), depasse }
}

/** Affichage de l'auteur d'un enregistrement : e-mail, puis rôle s'il y en a un. */
export function libelleAuteur(auteur) {
  if (!auteur) return null
  if (!auteur.email) return 'compte supprimé'
  return auteur.role_libelle ? `${auteur.email} (${auteur.role_libelle})` : auteur.email
}

/** Éléments auxquels une entrée renvoie (seuil d'action franchi, activation du plan nucléaire, livre de bord), en clair. */
export function liensEntree(e, { declenchements = [], activations = [], livre = [] } = {}) {
  const liens = []
  if (e.declenchement_seuil_id) {
    const d = declenchements.find((x) => x.id === e.declenchement_seuil_id)
    liens.push(`seuil d'action : ${d?.seuils_action?.libelle ?? '—'}`)
  }
  if (e.activation_nucleaire_id) {
    const a = activations.find((x) => x.id === e.activation_nucleaire_id)
    liens.push(`plan nucléaire : ${a ? libelleClasseUrgence(a.classe_urgence) : '—'}`)
  }
  if (e.livre_de_bord_id) {
    const l = livre.find((x) => x.id === e.livre_de_bord_id)
    liens.push(`livre de bord${l ? ` n° ${l.numero_ordre}` : ''}`)
  }
  return liens
}
