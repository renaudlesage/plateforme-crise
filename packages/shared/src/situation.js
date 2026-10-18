// Page CC › Situation (veille sociétale) : constantes et règles communes à l'Admin (gestion des sources)
// et au CC (page Situation, widget « Sources utiles » d'un incident).
// Tout est du lien sortant : aucun flux, aucun cours, aucune caméra n'est lu ou affiché par Crisiware.

/** Catégories et textes d'introduction : repris à l'identique de la maquette publiée (18/10/2026). */
export const CATEGORIES_SITUATION = [
  { cle: 'marches', libelle: 'Marchés et énergie', intro: "Le thermomètre économique : indices, pétrole, gaz, devises et réseau électrique. Un choc brutal ici précède souvent une tension sociale ou logistique." },
  { cle: 'medias', libelle: 'Médias en direct', intro: "Ce que le public voit et entend, en continu. Utile pour repérer une rumeur ou un décalage avec les messages officiels." },
  { cle: 'routes', libelle: 'Mobilité et caméras routières', intro: "Caméras publiques des gestionnaires de routes et état des transports. Flux officiels uniquement." },
  { cle: 'webcams', libelle: 'Webcams publiques', intro: "Vues publiques de lieux et de cours d'eau. Ajoutez ici les webcams de votre commune." },
  { cle: 'eau', libelle: 'Eau, météo et risques naturels', intro: "Niveaux des rivières, vigilance, séismes, feux de forêt. Première lecture avant toute alerte." },
  { cle: 'nucleaire', libelle: 'Nucléaire et radiologie', intro: "Mesures de radioactivité et informations officielles sur les zones de planification d'urgence." },
  { cle: 'societe', libelle: 'Sécurité, santé et société', intro: "Niveau de la menace, cybersécurité, santé publique." },
]

/** Types de source, dans l'ordre proposé dans les formulaires. */
export const TYPES_SOURCE_SITUATION = [
  { cle: 'cameras', libelle: 'Caméras' },
  { cle: 'video', libelle: 'Direct vidéo' },
  { cle: 'donnees', libelle: 'Données' },
  { cle: 'carte', libelle: 'Carte' },
  { cle: 'presse', libelle: 'Presse' },
  { cle: 'officiel', libelle: 'Officiel' },
]

/** Aléas auxquels une source peut être liée (widget « Sources utiles » d'un incident). « tous » = repli. */
export const ALEAS_SITUATION = [
  { cle: 'inondation', libelle: 'Inondation' },
  { cle: 'nucleaire', libelle: 'Nucléaire / radiologique' },
  { cle: 'feu_de_foret', libelle: 'Feu de forêt' },
  { cle: 'seisme', libelle: 'Séisme' },
  { cle: 'ferroviaire', libelle: 'Accident ferroviaire' },
  { cle: 'tous', libelle: 'Tous les aléas (repli)' },
]

export const libelleCategorieSituation = (cle) => CATEGORIES_SITUATION.find((c) => c.cle === cle)?.libelle ?? cle
export const libelleTypeSource = (cle) => TYPES_SOURCE_SITUATION.find((t) => t.cle === cle)?.libelle ?? 'Source'
export const libelleAleaSituation = (cle) => ALEAS_SITUATION.find((a) => a.cle === cle)?.libelle ?? cle

/** Attributs de tout lien sortant vers une source. */
export const ATTRIBUTS_LIEN_EXTERNE = { target: '_blank', rel: 'noopener noreferrer' }

export const MENTION_CAMERAS =
  "Flux publics ou officiels uniquement : jamais de vidéosurveillance privée. Crisiware n'affiche, ne capture, n'enregistre et n'analyse aucun flux : il ouvre la source dans un nouvel onglet."

export const MENTION_CAMERA_COMMUNALE =
  "Une caméra communale suppose un responsable de traitement et une mention RGPD. La base juridique d'une vidéosurveillance communale relève de la loi caméras : à faire valider avant tout flux nominatif ou enregistré."

export const MENTION_CONSTAT = "Ne mettez ni nom ni donnée individuelle dans le constat."

/** Après ce délai sans contrôle, l'adresse d'une source est à revérifier (Admin › Sources de situation). */
export const DELAI_CONTROLE_JOURS = 90

/** Une vérification (« Marquer vu ») plus vieille que ce seuil est présentée comme ancienne. */
export const SEUIL_VU_ANCIEN_HEURES = 24

/** Nombre maximal de sources proposées dans un incident (anti-surcharge). */
export const MAX_SOURCES_INCIDENT = 5

// Même règle que la contrainte sources_situation_url_check en base : http(s) seulement, nom de domaine (pas d'adresse IP,
// pas d'identifiant avant le @, pas d'espace), 2000 caractères au plus.
const RE_URL = /^https?:\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:[0-9]{1,5})?([/?#]\S*)?$/i

/** Retourne l'adresse nettoyée si elle est acceptable, sinon null. */
export function adresseSituationValide(texte) {
  const u = (texte ?? '').trim()
  if (!u || u.length > 2000 || !RE_URL.test(u)) return null
  return u
}

export const MESSAGE_ADRESSE_INVALIDE =
  "L'adresse doit commencer par https:// (ou http://) suivi d'un nom de domaine : pas d'adresse IP, pas d'identifiant avant le @, pas d'espace."

const sansAccent = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Aléas déduits du type d'événement d'un incident (texte libre : « Inondation », « Nucléaire », « Accident ferroviaire »…). */
export function aleasDepuisTypeEvenement(texte) {
  const t = sansAccent(texte)
  if (!t.trim()) return []
  const aleas = []
  if (/inond|crue|submers|debord|ruissel/.test(t)) aleas.push('inondation')
  if (/nucl|radiolog|radioact/.test(t)) aleas.push('nucleaire')
  if (/(feu|incendie).*(foret|bois|vegetation|nature|lande|bruyere)|(foret|bois|vegetation).*(feu|incendie)/.test(t)) aleas.push('feu_de_foret')
  if (/seism|tremblement de terre/.test(t)) aleas.push('seisme')
  if (/\b(ferroviaire|trains?|rails?|sncb|infrabel|chemins? de fer)\b/.test(t)) aleas.push('ferroviaire')
  return aleas
}

const parOrdre = (a, b) =>
  (a.ordre_affichage ?? 100) - (b.ordre_affichage ?? 100) || (a.nom ?? '').localeCompare(b.nom ?? '', 'fr')

/** Sources locales d'abord, puis nationales ; à égalité, ordre d'affichage puis nom. */
const parPortee = (a, b) => (a.contexte_id ? 0 : 1) - (b.contexte_id ? 0 : 1) || parOrdre(a, b)

/**
 * Sources à proposer dans un incident : d'abord celles liées à l'aléa (locales avant nationales), puis, pour compléter,
 * celles marquées « tous » ; jamais plus de `max` (anti-surcharge). Peut en renvoyer moins de 3 : on n'invente rien.
 */
export function choisirSourcesUtiles(sources, aleas, max = MAX_SOURCES_INCIDENT) {
  const voulus = new Set((aleas ?? []).filter((a) => a !== 'tous'))
  const actives = (sources ?? []).filter((s) => s.actif !== false)
  const liees = actives.filter((s) => (s.aleas_lies ?? []).some((a) => voulus.has(a))).sort(parPortee)
  const ids = new Set(liees.map((s) => s.id))
  const repli = actives.filter((s) => !ids.has(s.id) && (s.aleas_lies ?? []).includes('tous')).sort(parPortee)
  return [...liees, ...repli].slice(0, max)
}

/** Une source est épinglée si l'utilisateur l'a choisi ; à défaut, si elle est « suggérée ». */
export function estEpinglee(source, epingle) {
  return epingle ? epingle.epingle === true : source.suggeree === true
}

/** Caméra ou webcam : soumise aux règles strictes (flux public ou officiel, responsable nommé). */
export const estCameraOuWebcam = (s) => s?.type_source === 'cameras' || s?.categorie === 'webcams'

const FUSEAU = 'Europe/Brussels'

/** Date du jour (ou de l'instant donné) à Bruxelles, au format AAAA-MM-JJ. */
export function jourBelge(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date(instant))
}

export function heureMinuteBelge(instant) {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instant))
}

export function dateCourteBelge(instant) {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(instant))
}

/**
 * Libellé de la dernière vérification d'une source. `ancien` vrai au-delà du seuil (présentée en retrait).
 * Sans vérification : « Jamais vérifiée ici ».
 */
export function libelleVerification(verification, maintenant = Date.now()) {
  if (!verification?.verifie_le) return { texte: 'Jamais vérifiée ici', ancien: true, jamais: true }
  const t = new Date(verification.verifie_le).getTime()
  const ancien = maintenant - t > SEUIL_VU_ANCIEN_HEURES * 3600 * 1000
  const aujourdhui = jourBelge(t) === jourBelge(maintenant)
  const texte = aujourdhui
    ? `Vu aujourd'hui à ${heureMinuteBelge(t)}`
    : `Vu le ${dateCourteBelge(t)} à ${heureMinuteBelge(t)}`
  return { texte, ancien, jamais: false }
}

/** Contrôle de l'adresse : jamais fait, trop ancien, ou récent. `jours` = âge du contrôle. */
export function etatControle(source, maintenant = Date.now()) {
  if (!source?.controle_le) return { etat: 'jamais', texte: 'Adresse non contrôlée', jours: null }
  const jours = Math.floor((maintenant - new Date(`${source.controle_le}T12:00:00Z`).getTime()) / 86400000)
  const date = dateCourteBelge(`${source.controle_le}T12:00:00Z`)
  if (jours > DELAI_CONTROLE_JOURS) return { etat: 'ancien', texte: `Adresse contrôlée le ${date} (à revérifier)`, jours }
  return { etat: 'recent', texte: `Adresse contrôlée le ${date}`, jours }
}

/** Texte de recherche (même logique que la maquette : nom, note, portée, type). */
export function texteRecherche(source) {
  return sansAccent([source.nom, source.note, source.portee, libelleTypeSource(source.type_source)].join(' '))
}

export function correspondRecherche(source, requete) {
  const q = sansAccent(requete).trim()
  return !q || texteRecherche(source).includes(q)
}
