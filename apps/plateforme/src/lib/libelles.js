// Libellés partagés par les pages de la console Plateforme.

// Types proposés à la création : GAL et intercommunale sont stockés en
// type « autre » + sous_type_territorial (contrainte de la table contextes).
export const TYPES_CLIENT = [
  { valeur: 'commune', libelle: 'Commune' },
  { valeur: 'province', libelle: 'Province' },
  { valeur: 'federal', libelle: 'Fédéral' },
  { valeur: 'evenement', libelle: 'Événement' },
  { valeur: 'entite_critique', libelle: 'Entité critique (CER)' },
  { valeur: 'gal', libelle: "GAL (Groupe d'Action Locale)" },
  { valeur: 'intercommunale', libelle: 'Intercommunale' },
  { valeur: 'autre', libelle: 'Autre' },
]

export const SOUS_TYPES = ['gal', 'intercommunale']

/** Valeur du sélecteur « type » d'un client (sous-type prioritaire). */
export function typeAffiche(c) {
  return c.sous_type_territorial ?? c.type
}

export function libelleType(c) {
  return TYPES_CLIENT.find((t) => t.valeur === typeAffiche(c))?.libelle ?? c.type
}

/** Décompose la valeur du sélecteur en { type, sous_type_territorial } pour la base. */
export function decomposerType(valeur) {
  return SOUS_TYPES.includes(valeur)
    ? { type: 'autre', sous_type_territorial: valeur }
    : { type: valeur, sous_type_territorial: null }
}

export const PROVINCES = [
  'Anvers',
  'Brabant flamand',
  'Brabant wallon',
  'Bruxelles-Capitale',
  'Flandre-Occidentale',
  'Flandre-Orientale',
  'Hainaut',
  'Liège',
  'Limbourg',
  'Luxembourg',
  'Namur',
]

export const NIVEAUX_ACCES = [
  { valeur: 'lecture', libelle: 'Lecture' },
  { valeur: 'ecriture', libelle: 'Écriture' },
  { valeur: 'admin', libelle: 'Admin' },
]

export const ACTIONS_JOURNAL = {
  client_cree: 'Client créé',
  client_modifie: 'Client modifié',
  client_suspendu: 'Client suspendu',
  client_reactive: 'Client réactivé',
  acces_donne: 'Accès donné',
  acces_modifie: 'Accès modifié',
  acces_retire: 'Accès retiré',
  utilisateur_invite: 'Utilisateur invité',
  utilisateur_desactive: 'Compte désactivé',
  utilisateur_reactive: 'Compte réactivé',
}

export const PHASES_CYCLE_VIE = {
  veille: 'Veille',
  vigilance: 'Vigilance',
  pre_alerte: 'Pré-alerte',
  alerte: 'Alerte',
  phase_active: 'Phase active',
  levee: 'Levée',
  post_crise: 'Post-crise',
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
const FORMAT_JOUR = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium' })

export function dateHeure(iso) {
  return iso ? FORMAT_DATE.format(new Date(iso)) : '—'
}

export function jour(iso) {
  return iso ? FORMAT_JOUR.format(new Date(iso)) : '—'
}

/** « il y a 3 j », « il y a 2 h »… pour la dernière activité. */
export function depuis(iso) {
  if (!iso) return 'jamais'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 60) return `il y a ${Math.max(minutes, 1)} min`
  const heures = Math.round(minutes / 60)
  if (heures < 48) return `il y a ${heures} h`
  return `il y a ${Math.round(heures / 24)} j`
}

/** URL de l'app Admin (lien « ouvrir dans Admin », redirection après invitation). */
export const URL_ADMIN = import.meta.env.VITE_URL_ADMIN || null
