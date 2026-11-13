/**
 * Réveil automatique (chantier C1) : vocabulaire et logique pure partagés par le QG et l'Admin (sans React ni réseau).
 *
 * Les avertissements officiels arrivent dans `alertes_externes` (flux MeteoAlarm, saisie manuelle par la commune,
 * démonstration du super-admin). Une règle de réveil arme un seuil d'action de la commune ; le serveur ne retient que
 * le seuil le plus élevé de chaque fiche, ouvre ou complète un événement en veille et met en file les notifications.
 * Un réveil attend ensuite son « Vu, je prends ». Ce module ne fait que présenter et contrôler : tout se décide en base.
 */

import { NIVEAUX } from './meteo.js'

export const TYPES_AVERTISSEMENT = [
  { cle: 'orage', libelle: 'Orages' },
  { cle: 'pluie', libelle: 'Pluie' },
  { cle: 'vent', libelle: 'Vent' },
  { cle: 'chaleur', libelle: 'Chaleur' },
  { cle: 'froid', libelle: 'Froid' },
  { cle: 'neige_verglas', libelle: 'Neige ou verglas' },
  { cle: 'brouillard', libelle: 'Brouillard' },
  { cle: 'autre', libelle: 'Autre phénomène' },
]

/** Niveaux qui peuvent armer une règle ou être encodés à la main (le vert n'est pas un avertissement). */
export const NIVEAUX_AVERTISSEMENT = ['jaune', 'orange', 'rouge']

export const SOURCES_REGLE = [
  { cle: 'toutes', libelle: 'Toutes les sources' },
  { cle: 'meteoalarm', libelle: 'MeteoAlarm (IRM)' },
  { cle: 'irm', libelle: 'Open data IRM' },
  { cle: 'saisie', libelle: 'Saisie manuelle' },
]

/** Valeurs appliquées par le serveur tant que la commune n'a rien encodé (table parametres_reveil). */
export const ROLES_A_REVEILLER_DEFAUT = ['PLANU', 'AUTORITE_COMMUNALE']
export const DELAI_ESCALADE_DEFAUT_MIN = 15

/** Nom de la tâche d'ingestion du flux météo dans jobs_etat (absente tant que le flux n'est pas branché). */
export const TACHE_FLUX_METEO = 'ingest_meteoalarm'

const LIBELLE_SOURCE_ALERTE = {
  meteoalarm: 'IRM via MeteoAlarm',
  irm: 'IRM',
  saisie: 'Saisie manuelle',
  fixture: 'Démonstration (exercice)',
}

const FUSEAU = 'Europe/Brussels'

export function libelleTypeAvertissement(cle) {
  return TYPES_AVERTISSEMENT.find((t) => t.cle === cle)?.libelle ?? 'Avertissement'
}

export function libelleSourceRegle(cle) {
  return SOURCES_REGLE.find((s) => s.cle === cle)?.libelle ?? cle
}

export function libelleSourceAlerte(source) {
  return LIBELLE_SOURCE_ALERTE[source] ?? source
}

/** « 30/05 à 17:42 », en heure de Belgique quel que soit le fuseau de l'écran. */
export function jourHeureBelge(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const jour = new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, day: '2-digit', month: '2-digit' }).format(d)
  const heure = new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${jour} à ${heure}`
}

/**
 * Mention de source affichée avec chaque avertissement. Conditions de MeteoAlarm : citer le service national (IRM),
 * l'heure d'émission et renvoyer à www.meteoalarm.org.
 */
export function attributionAlerte(a) {
  switch (a?.source) {
    case 'meteoalarm':
      return `Source : IRM/KMI via MeteoAlarm (www.meteoalarm.org), émis le ${jourHeureBelge(a.emis_le)}`
    case 'irm':
      return `Source : IRM/KMI, émis le ${jourHeureBelge(a.emis_le)}`
    case 'saisie':
      return `Encodé par la commune le ${jourHeureBelge(a.recu_le ?? a.emis_le)} (avertissement reçu par un autre canal)`
    default:
      return `Démonstration (exercice), créée le ${jourHeureBelge(a?.recu_le ?? a?.emis_le)}`
  }
}

/**
 * Avertissements qui concernent la commune : ceux des flux sur sa province, et ceux encodés pour elle seule.
 * Du plus grave au moins grave, puis du plus récent au plus ancien.
 */
export function alertesDeLaCommune(alertes, { contexteId, province }) {
  return (alertes ?? [])
    .filter((a) => (a.contexte_id ? a.contexte_id === contexteId : Boolean(province) && (a.provinces ?? []).includes(province)))
    .sort((x, y) => (NIVEAUX[y.niveau] ?? 0) - (NIVEAUX[x.niveau] ?? 0) || String(y.recu_le ?? '').localeCompare(String(x.recu_le ?? '')))
}

/** « de 22:00 à 06:00 » (une fenêtre peut passer minuit) ; chaîne vide sans fenêtre. Heures reçues en « HH:MM:SS ». */
export function texteFenetre(debut, fin) {
  if (!debut || !fin) return ''
  return `de ${String(debut).slice(0, 5)} à ${String(fin).slice(0, 5)}`
}

/** Résumé lisible d'une règle : « Orages, orange ou plus → Orages S1 — Pré-activation ». */
export function resumeRegle(regle, seuilLibelle) {
  const niveau = regle.niveau_min === 'rouge' ? 'rouge' : `${regle.niveau_min} ou plus`
  const precisions = [
    regle.source && regle.source !== 'toutes' ? libelleSourceRegle(regle.source) : null,
    texteFenetre(regle.heure_debut, regle.heure_fin) || null,
  ].filter(Boolean)
  return `${libelleTypeAvertissement(regle.type_alerte)}, ${niveau}${precisions.length ? ` (${precisions.join(', ')})` : ''} → ${seuilLibelle ?? 'seuil inconnu'}`
}

/** « du 30/05 à 17:42 au 31/05 à 06:00 », ou « dès le 30/05 à 17:42, sans fin annoncée ». */
export function texteValidite(a) {
  const debut = jourHeureBelge(a.debut_le)
  return a.fin_le ? `du ${debut} au ${jourHeureBelge(a.fin_le)}` : `dès le ${debut}, sans fin annoncée`
}

/**
 * État d'une règle pour l'onglet Avertissements du CC, d'après les réveils des événements encore ouverts de la commune :
 * inactive ; seuil inactif (le serveur ignore alors la règle) ; armée (aucun réveil en cours pour son seuil) ;
 * déclenchée (réveil pas encore acquitté) ; acquittée. Chaque réveil porte `seuil_action_id`, `arme_le`,
 * `acquitte_le` et `incident_ouvert` ; la règle peut porter son seuil (`seuils_action.actif`).
 */
export function etatRegle(regle, reveils) {
  if (!regle.actif) return { etat: 'inactive' }
  if (regle.seuils_action?.actif === false) return { etat: 'seuil_inactif' }
  const dernier = (reveils ?? [])
    .filter((r) => r.seuil_action_id === regle.seuil_action_id && r.incident_ouvert !== false)
    .sort((a, b) => String(b.arme_le).localeCompare(String(a.arme_le)))[0]
  if (!dernier) return { etat: 'armee' }
  return { etat: dernier.acquitte_le ? 'acquittee' : 'declenchee', reveil: dernier }
}

export const LIBELLE_ETAT_REGLE = {
  inactive: 'Inactive',
  seuil_inactif: 'Seuil inactif',
  armee: 'Armée',
  declenchee: 'Déclenchée, à acquitter',
  acquittee: 'Acquittée',
}

/** Contrôles d'une règle avant enregistrement : message à afficher, ou null. */
export function erreurRegle(v) {
  if (!v?.seuil_action_id) return 'Choisissez le seuil à armer.'
  if (!TYPES_AVERTISSEMENT.some((t) => t.cle === v.type_alerte)) return "Choisissez le type d'avertissement."
  if (!NIVEAUX_AVERTISSEMENT.includes(v.niveau_min)) return 'Choisissez le niveau minimal.'
  if (Boolean(v.heure_debut) !== Boolean(v.heure_fin)) return "Une fenêtre horaire a un début et une fin, ou ni l'un ni l'autre."
  if (v.heure_debut && v.heure_debut === v.heure_fin) return 'Le début et la fin de la fenêtre horaire doivent différer.'
  return null
}

/**
 * Contrôles d'un avertissement encodé à la main (`titre` : ce que dit l'avertissement) : message à afficher, ou null.
 * Un avertissement déjà terminé n'a rien à réveiller.
 */
export function erreurSaisie(v, maintenant = Date.now()) {
  if (!TYPES_AVERTISSEMENT.some((t) => t.cle === v?.type_alerte)) return "Choisissez le type d'avertissement."
  if (!NIVEAUX_AVERTISSEMENT.includes(v.niveau)) return 'Choisissez le niveau : jaune, orange ou rouge.'
  if (!v.titre?.trim()) return "Décrivez l'avertissement en quelques mots."
  if (v.fin_le && Date.parse(v.fin_le) <= maintenant) return 'La fin est déjà passée : cet avertissement est terminé.'
  if (v.debut_le && v.fin_le && Date.parse(v.fin_le) <= Date.parse(v.debut_le)) return 'La fin doit suivre le début.'
  return null
}

/** Intitulé enregistré pour un avertissement encodé à la main : « Avertissement orages ». */
export function evenementSaisi(typeAlerte) {
  return `Avertissement ${libelleTypeAvertissement(typeAlerte).toLowerCase()}`
}

/**
 * Message affiché après l'enregistrement d'un avertissement, d'après son passage dans le moteur de réveil
 * (ligne de alertes_externes_traitements, éventuellement absente).
 */
export function bilanTraitement(traitement) {
  if (traitement?.erreur) {
    return { type: 'erreur', texte: `Avertissement enregistré, mais le réveil automatique a échoué : ${traitement.erreur}` }
  }
  const n = traitement?.nb_reveils ?? 0
  if (n > 0) {
    return {
      type: 'ok',
      texte: `Avertissement enregistré : ${n} seuil${n > 1 ? 's' : ''} armé${n > 1 ? 's' : ''}, événement en veille ouvert ou complété, destinataires mis en file.`,
    }
  }
  return {
    type: 'ok',
    texte: "Avertissement enregistré. Aucun seuil armé : aucune règle n'est remplie, ou un niveau égal ou plus élevé a déjà réveillé la commune pour cette fiche.",
  }
}

/** Valeur d'un champ « datetime-local » (heure de l'écran) → instant ISO ; null si vide ou illisible. */
export function instantDepuisChampLocal(valeur) {
  if (!valeur) return null
  const ms = Date.parse(valeur)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Intervalle Postgres (« 00:15:00 », « 24:00:00 », « 1 day 02:00:00 ») → minutes ; null si illisible. */
export function minutesDepuisIntervalle(valeur) {
  const m = String(valeur ?? '').match(/^(?:(\d+) days?)? ?(?:(\d+):(\d{2}):(\d{2}))?$/)
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** Contrôles des paramètres de réveil : au moins un rôle (vingt au plus), délai d'escalade entier de 1 à 1440 minutes. */
export function erreurParametres({ roles, delaiMinutes }) {
  if (!roles?.length) return 'Cochez au moins un rôle à réveiller.'
  if (roles.length > 20) return 'Vingt rôles au plus.'
  const n = Number(delaiMinutes)
  if (!Number.isInteger(n) || n < 1 || n > 1440) return "Le délai d'escalade va de 1 à 1440 minutes (24 heures)."
  return null
}

/**
 * Qui le réveil préviendra, d'après les codes de rôles cochés, avec la même sélection que le serveur
 * (reveil_destinataires, reveil_escalader) : comptes de la commune qui portent ces rôles, rôles sans aucun compte,
 * codes absents de la commune, suppléants actifs de l'annuaire prévenus à l'escalade (et ceux sans adresse e-mail).
 * `membres` : lignes de membres_contexte (réservée à l'admin de la commune) ; `contacts` : annuaire de la commune.
 */
export function apercuDestinataires({ codes, roles, membres, contacts }) {
  const choisis = (roles ?? []).filter((r) => codes.includes(r.code))
  const idsRoles = new Set(choisis.map((r) => r.id))
  const comptes = (membres ?? []).filter((m) => idsRoles.has(m.role_id))
  const titulaires = new Set((contacts ?? []).filter((c) => idsRoles.has(c.role_id)).map((c) => c.id))
  const suppleants = (contacts ?? []).filter((c) => c.actif !== false && titulaires.has(c.est_suppleant_de))
  return {
    comptes,
    rolesSansCompte: choisis.filter((r) => !comptes.some((m) => m.role_id === r.id)),
    codesInconnus: codes.filter((code) => !choisis.some((r) => r.code === code)),
    suppleants,
    suppleantsSansEmail: suppleants.filter((c) => !c.email?.trim()),
  }
}

/**
 * Seuils d'action regroupés par fiche (risque du territoire, objet à risque, sinon « Seuils génériques »), pour choisir
 * le seuil qu'une règle arme. Le serveur ne retient que le seuil le plus élevé de chaque fiche : l'ordre est affiché.
 */
export function groupesSeuils(seuils) {
  const groupes = new Map()
  for (const s of seuils ?? []) {
    const fiche = s.risques_territoire?.titre ?? s.objets_a_risque?.identification ?? null
    const cle = fiche ?? ''
    if (!groupes.has(cle)) groupes.set(cle, { fiche: fiche ?? 'Seuils génériques', seuils: [] })
    groupes.get(cle).seuils.push(s)
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'fr')))
    .map(([, g]) => ({ ...g, seuils: g.seuils.sort((x, y) => (x.ordre ?? 0) - (y.ordre ?? 0)) }))
}

/**
 * État du flux météo d'après sa tâche dans jobs_etat : non branché (pas de tâche visible, ou tâche désactivée), muet
 * (aucun succès depuis plus longtemps que le silence toléré : à signaler, l'absence d'avertissement ne veut alors rien
 * dire), en erreur (le dernier passage a échoué) ou à jour.
 */
export function etatFlux(tache, maintenant = Date.now()) {
  if (!tache || tache.actif === false) return { etat: 'non_branche' }
  const silenceMs = (minutesDepuisIntervalle(tache.silence_max) ?? 60) * 60000
  const dernier = tache.dernier_succes_le ? Date.parse(tache.dernier_succes_le) : null
  const base = { dernierSucces: tache.dernier_succes_le ?? null, erreur: tache.derniere_erreur ?? null }
  if (dernier === null || maintenant - dernier > silenceMs) return { etat: 'muet', ...base }
  if ((tache.echecs_consecutifs ?? 0) > 0) return { etat: 'erreur', ...base }
  return { etat: 'ok', ...base }
}
