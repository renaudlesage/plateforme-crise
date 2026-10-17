import { DISCIPLINES } from '@plateforme-crise/shared'

/**
 * Exercices sur mesure — constantes partagées par les écrans du CC.
 *
 * `type_exercice` reste la NATURE de l'exercice (taxonomie NCCN) ;
 * `mode_jeu` dit COMMENT il se joue : sur table (la plateforme sert de livre de bord
 * à l'animateur) ou dans l'outil (un incident marqué « exercice » est ouvert dans le CC).
 */

export const TYPES_EXERCICE = [
  { valeur: 'visite_guidee', libelle: 'Visite guidée' },
  { valeur: 'etude_cas', libelle: 'Étude de cas' },
  { valeur: 'alerte', libelle: 'Exercice d’alerte' },
  { valeur: 'farex', libelle: 'FarEx (fonctionnel partiel)' },
  { valeur: 'ttx', libelle: 'TTX (table-top)' },
  { valeur: 'cpx', libelle: 'CPX (poste de commandement)' },
  { valeur: 'ftx', libelle: 'FTX (grandeur réelle)' },
]
export const LIBELLE_TYPE = Object.fromEntries(TYPES_EXERCICE.map((t) => [t.valeur, t.libelle]))

export const MODES_JEU = [
  {
    valeur: 'sur_table',
    libelle: 'Sur table',
    aide: 'Les joueurs sont autour d’une table ; la plateforme sert de livre de bord à l’animateur. Aucun incident n’est créé.',
  },
  {
    valeur: 'dans_outil',
    libelle: 'Dans l’outil',
    aide: 'Un incident marqué « exercice » est ouvert dans le CC. Il ne peut déclencher ni alerte publique ni signalement citoyen.',
  },
]
export const LIBELLE_MODE = Object.fromEntries(MODES_JEU.map((m) => [m.valeur, m.libelle]))

export const LIBELLE_STATUT_EXERCICE = {
  preparation: 'En préparation',
  en_cours: 'En cours',
  termine: 'Terminé',
}

export const CANAUX = [
  { valeur: 'telephone', libelle: 'Téléphone' },
  { valeur: 'radio', libelle: 'Radio' },
  { valeur: 'mail', libelle: 'Courriel' },
  { valeur: 'be_alert', libelle: 'BE-Alert' },
  { valeur: 'terrain', libelle: 'Terrain' },
  { valeur: 'media', libelle: 'Médias' },
  { valeur: 'citoyen', libelle: 'Citoyen' },
  { valeur: 'autre', libelle: 'Autre' },
]
export const LIBELLE_CANAL = Object.fromEntries(CANAUX.map((c) => [c.valeur, c.libelle]))

// Les disciplines du code couleur + le bourgmestre, que la base accepte comme cible d'un stimulus.
export const DISCIPLINES_EXERCICE = [
  ...DISCIPLINES.map((d) => ({ valeur: d.valeur, libelle: d.libelle })),
  { valeur: 'bourgmestre', libelle: 'Bourgmestre' },
]
export const LIBELLE_DISCIPLINE = Object.fromEntries(DISCIPLINES_EXERCICE.map((d) => [d.valeur, d.libelle]))

export const GRAVITES = [
  { valeur: 'mineure', libelle: 'Mineure' },
  { valeur: 'majeure', libelle: 'Majeure' },
  { valeur: 'critique', libelle: 'Critique' },
]
export const LIBELLE_GRAVITE = Object.fromEntries(GRAVITES.map((g) => [g.valeur, g.libelle]))

export const STATUTS_ACTION = [
  { valeur: 'a_faire', libelle: 'À faire' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'faite', libelle: 'Faite' },
  { valeur: 'verifiee', libelle: 'Vérifiée' },
  { valeur: 'abandonnee', libelle: 'Abandonnée' },
]

/** « T+0 », « T+20 min », « T+1 h 05 » : l'heure DU SCÉNARIO, pas l'heure de la montre. */
export function libelleTScenario(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  if (m < 60) return m === 0 ? 'T+0' : `T+${m} min`
  return `T+${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/** Minutes de scénario écoulées : temps réel × facteur de temps. 0 tant que l'exercice n'a pas démarré. */
export function minutesScenario(ex, maintenant = Date.now()) {
  if (!ex?.debut_reel) return 0
  const fin = ex.fin_reelle ? Date.parse(ex.fin_reelle) : maintenant
  return Math.max(0, ((fin - Date.parse(ex.debut_reel)) / 60000) * Number(ex.facteur_temps || 1))
}

/** « 00:12:30 » — durée réelle écoulée depuis le démarrage. */
export function chrono(ex, maintenant = Date.now()) {
  if (!ex?.debut_reel) return '00:00:00'
  const fin = ex.fin_reelle ? Date.parse(ex.fin_reelle) : maintenant
  const s = Math.max(0, Math.floor((fin - Date.parse(ex.debut_reel)) / 1000))
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

export function heureLocale(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

/** Dernier verdict (atteint / non atteint) d'une action : le plus récent qui tranche ; une simple note n'en change pas. */
export function verdictAction(actionId, observations) {
  const v = observations
    .filter((o) => o.action_id === actionId && o.atteint !== null && o.atteint !== undefined)
    .sort((a, b) => Date.parse(b.horodatage) - Date.parse(a.horodatage))[0]
  return v ? { atteint: v.atteint, a: v.horodatage } : null
}
