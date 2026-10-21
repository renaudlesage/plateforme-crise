// =====================================================================
// Lecture des messages CAP (Common Alerting Protocol 1.2, OASIS) des
// avertissements météo — Crisiware, chantier C1 (réveil automatique).
// Indépendante de la source : l'open data de l'IRM et MeteoAlarm
// publient tous deux du CAP. Les paramètres MeteoAlarm `awareness_level`
// et `awareness_type` sont lus en priorité, sinon la sévérité CAP et le
// libellé de l'événement.
// Sortie au vocabulaire de Crisiware : type (orage, pluie, vent,
// chaleur, froid, neige_verglas, brouillard, autre), niveau (vert,
// jaune, orange, rouge), provinces au vocabulaire de contextes.province.
// MeteoAlarm ne publie qu'une zone « Brabant » : elle vaut pour le
// Brabant flamand, le Brabant wallon et Bruxelles-Capitale.
// Pur : utilisable dans une Edge Function (Deno) et dans Vitest (Node).
// =====================================================================

import { enfantsNommes, lireXml, texteEnfant, type NoeudXml } from './xml.ts'

export type Niveau = 'vert' | 'jaune' | 'orange' | 'rouge'
export type TypeAlerte = 'orage' | 'pluie' | 'vent' | 'chaleur' | 'froid' | 'neige_verglas' | 'brouillard' | 'autre'

export const RANG_NIVEAU: Record<Niveau, number> = { vert: 0, jaune: 1, orange: 2, rouge: 3 }

// Même liste et même orthographe que la contrainte de contextes.province (la base fait foi).
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

export interface Geocode {
  nom: string
  valeur: string
}

export interface ZoneCap {
  nom: string
  geocodes: Geocode[]
  provinces: string[]
}

export interface InfoCap {
  langue: string
  evenement: string
  type: TypeAlerte
  niveau: Niveau | null
  severite: string | null
  urgence: string | null
  certitude: string | null
  debut_le: string | null
  fin_le: string | null
  titre: string | null
  description: string | null
  consignes: string | null
  lien: string | null
  zones: ZoneCap[]
}

export interface ReferenceCap {
  expediteur: string
  identifiant: string
  emis_le: string | null
}

export interface AlerteCap {
  version: '1.1' | '1.2'
  identifiant: string
  expediteur: string
  emis_le: string
  statut: string
  type_message: string
  portee: string | null
  references: ReferenceCap[]
  infos: InfoCap[]
}

/** Une ligne de la table `alertes_externes` (une par segment d'un message CAP). */
export interface LigneAlerteExterne {
  source: string
  identifiant: string
  segment: number
  expediteur: string
  emis_le: string
  statut_cap: string
  type_message: string
  portee: string | null
  references_cap: string[]
  langue: string
  evenement: string
  type_alerte: TypeAlerte
  niveau: Niveau
  severite: string | null
  urgence: string | null
  certitude: string | null
  debut_le: string
  fin_le: string | null
  titre: string | null
  description: string | null
  consignes: string | null
  zones: ZoneCap[]
  provinces: string[]
  lien: string | null
}

export class ErreurCap extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurCap'
  }
}

const ESPACES_CAP: Record<string, '1.1' | '1.2'> = {
  'urn:oasis:names:tc:emergency:cap:1.2': '1.2',
  'urn:oasis:names:tc:emergency:cap:1.1': '1.1',
}
const STATUTS = ['Actual', 'Exercise', 'System', 'Test', 'Draft']
const TYPES_MESSAGE = ['Alert', 'Update', 'Cancel', 'Ack', 'Error']
const TAILLE_MAX_CAP = 1_000_000

/** Minuscules, sans accents, ponctuation remplacée par des espaces. */
export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Date CAP avec fuseau (« 2026-05-30T16:00:00+02:00 ») → ISO UTC ; null si absente, sans fuseau ou illisible. */
export function dateIso(valeur: string | null): string | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(valeur)) return null
  const ms = Date.parse(valeur)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

const NIVEAU_PAR_COULEUR: Record<string, Niveau> = { green: 'vert', yellow: 'jaune', orange: 'orange', red: 'rouge' }
const NIVEAU_PAR_RANG: Record<string, Niveau> = { '1': 'vert', '2': 'jaune', '3': 'orange', '4': 'rouge' }
const NIVEAU_PAR_SEVERITE: Record<string, Niveau> = { minor: 'vert', moderate: 'jaune', severe: 'orange', extreme: 'rouge' }

/** `awareness_level` de MeteoAlarm (« 3; orange; Severe ») ou, à défaut, sévérité CAP. */
export function niveauDepuis(awarenessLevel: string | null, severite: string | null): Niveau | null {
  if (awarenessLevel) {
    const morceaux = awarenessLevel.split(';').map((m) => m.trim().toLowerCase())
    const couleur = morceaux.find((m) => NIVEAU_PAR_COULEUR[m])
    if (couleur) return NIVEAU_PAR_COULEUR[couleur]
    if (NIVEAU_PAR_RANG[morceaux[0]]) return NIVEAU_PAR_RANG[morceaux[0]]
  }
  return (severite && NIVEAU_PAR_SEVERITE[severite.trim().toLowerCase()]) || null
}

// Codes `awareness_type` de MeteoAlarm : 7 côtes, 8 feux de forêt, 9 avalanches, 11 inconnu, 12 inondation → autre.
const TYPE_PAR_CODE: Record<string, TypeAlerte> = {
  '1': 'vent',
  '2': 'neige_verglas',
  '3': 'orage',
  '4': 'brouillard',
  '5': 'chaleur',
  '6': 'froid',
  '7': 'autre',
  '8': 'autre',
  '9': 'autre',
  '10': 'pluie',
  '11': 'autre',
  '12': 'autre',
  '13': 'pluie',
}
const TYPE_PAR_LIBELLE: Record<string, TypeAlerte> = {
  wind: 'vent',
  'snow-ice': 'neige_verglas',
  thunderstorm: 'orage',
  thunderstorms: 'orage',
  fog: 'brouillard',
  'high-temperature': 'chaleur',
  'low-temperature': 'froid',
  rain: 'pluie',
  'rain-flood': 'pluie',
}
// Libellé de l'événement (FR, NL, DE, EN), par ordre de priorité : un « orage avec fortes pluies » reste un orage.
const MOTS_TYPE: [TypeAlerte, RegExp][] = [
  ['orage', /\b(orages?|orageu\w*|onweer\w*|gewitter\w*|thunder\w*)\b/],
  ['neige_verglas', /\b(neiges?|verglas|sneeuw\w*|ijzel\w*|gladheid|schnee\w*|glatteis\w*|snow\w*|ice|icy)\b/],
  ['brouillard', /\b(brouillards?|mist|nebel|fog)\b/],
  ['chaleur', /\b(chaleurs?|canicules?|hitte\w*|hitze\w*|heat\w*|high temperatures?)\b/],
  ['froid', /\b(froid|koude|vorst|kalte|frost|cold|low temperatures?)\b/],
  ['vent', /\b(vents?|rafales?|tempetes?|wind\w*|storm\w*|sturm\w*)\b/],
  ['pluie', /\b(pluies?|pluvieu\w*|regen\w*|neerslag|rain\w*|precipitations?)\b/],
]

/** `awareness_type` de MeteoAlarm (« 3; thunderstorm ») ou, à défaut, mots du libellé de l'événement. */
export function typeDepuis(awarenessType: string | null, evenement: string | null): TypeAlerte {
  if (awarenessType) {
    const [code, libelle] = awarenessType.split(';').map((m) => m.trim().toLowerCase())
    const type = TYPE_PAR_CODE[code] ?? TYPE_PAR_LIBELLE[libelle ?? ''] ?? TYPE_PAR_LIBELLE[code]
    if (type) return type
  }
  const texte = normaliser(evenement ?? '')
  return MOTS_TYPE.find(([, motif]) => motif.test(texte))?.[0] ?? 'autre'
}

const ALIAS_PROVINCES: [string, string[]][] = [
  ['Anvers', ['anvers', 'antwerpen', 'antwerp']],
  ['Brabant flamand', ['brabant flamand', 'vlaams brabant', 'flemish brabant', 'flamisch brabant']],
  ['Brabant wallon', ['brabant wallon', 'waals brabant', 'walloon brabant', 'wallonisch brabant']],
  [
    'Bruxelles-Capitale',
    ['region de bruxelles capitale', 'bruxelles capitale', 'bruxelles', 'brussels hoofdstedelijk gewest', 'brussel hoofdstad', 'brussel', 'brussels capital region', 'brussels', 'brussel hauptstadt'],
  ],
  ['Flandre-Occidentale', ['flandre occidentale', 'west vlaanderen', 'west flanders', 'westflandern']],
  ['Flandre-Orientale', ['flandre orientale', 'oost vlaanderen', 'east flanders', 'ostflandern']],
  ['Hainaut', ['hainaut', 'henegouwen', 'hainault', 'hennegau']],
  ['Liège', ['liege', 'luik', 'luttich']],
  ['Limbourg', ['limbourg', 'limburg']],
  ['Luxembourg', ['luxembourg', 'luxemburg']],
  ['Namur', ['namur', 'namen']],
]
const ALIAS_PAR_LONGUEUR = ALIAS_PROVINCES.flatMap(([province, alias]) => alias.map((a) => ({ province, a }))).sort(
  (x, y) => y.a.length - x.a.length,
)
const BRABANT = ['Brabant flamand', 'Brabant wallon', 'Bruxelles-Capitale']

function trierProvinces(provinces: Iterable<string>): string[] {
  return [...new Set(provinces)].sort((a, b) => PROVINCES.indexOf(a) - PROVINCES.indexOf(b))
}

/**
 * Nom de zone (FR, NL, DE ou EN, « Province de … » accepté) → provinces. Une zone peut en nommer plusieurs ; la zone
 * « Brabant » de MeteoAlarm en couvre trois. Liste vide si le nom n'est pas reconnu.
 */
export function provincesDeZone(nom: string): string[] {
  let reste = ` ${normaliser(nom).replace(/^(province|provincie|provinz|prov)( de la| de| du| of| van)? /, '')} `
  const trouvees: string[] = []
  for (const { province, a } of ALIAS_PAR_LONGUEUR) {
    if (reste.includes(` ${a} `)) {
      trouvees.push(province)
      reste = reste.split(` ${a} `).join('  ')
    }
  }
  if (reste.includes(' brabant ')) trouvees.push(...BRABANT)
  return trierProvinces(trouvees)
}

function lireReferences(valeur: string | null): ReferenceCap[] {
  if (!valeur) return []
  return valeur
    .trim()
    .split(/\s+/)
    .map((triplet) => {
      const [expediteur, identifiant, emis] = triplet.split(',')
      return { expediteur: expediteur ?? '', identifiant: identifiant ?? '', emis_le: dateIso(emis ?? null) }
    })
    .filter((r) => r.identifiant)
}

function lireInfo(n: NoeudXml): InfoCap {
  const parametres = new Map<string, string>()
  for (const p of enfantsNommes(n, 'parameter')) {
    const cle = texteEnfant(p, 'valueName')?.toLowerCase()
    const valeur = texteEnfant(p, 'value')
    if (cle && valeur && !parametres.has(cle)) parametres.set(cle, valeur)
  }
  const evenement = texteEnfant(n, 'event') ?? ''
  const severite = texteEnfant(n, 'severity')
  return {
    langue: (texteEnfant(n, 'language') ?? 'en-US').toLowerCase(),
    evenement,
    type: typeDepuis(parametres.get('awareness_type') ?? null, evenement),
    niveau: niveauDepuis(parametres.get('awareness_level') ?? null, severite),
    severite,
    urgence: texteEnfant(n, 'urgency'),
    certitude: texteEnfant(n, 'certainty'),
    debut_le: dateIso(texteEnfant(n, 'onset')) ?? dateIso(texteEnfant(n, 'effective')),
    fin_le: dateIso(texteEnfant(n, 'expires')),
    titre: texteEnfant(n, 'headline'),
    description: texteEnfant(n, 'description'),
    consignes: texteEnfant(n, 'instruction'),
    lien: texteEnfant(n, 'web'),
    zones: enfantsNommes(n, 'area').map((a) => {
      const nom = texteEnfant(a, 'areaDesc') ?? ''
      const geocodes = enfantsNommes(a, 'geocode')
        .map((g) => ({ nom: texteEnfant(g, 'valueName') ?? '', valeur: texteEnfant(g, 'value') ?? '' }))
        .filter((g) => g.nom && g.valeur)
      return { nom, geocodes, provinces: provincesDeZone(nom) }
    }),
  }
}

/** Document CAP 1.1 ou 1.2 → message lu. Lève ErreurCap si le document est illisible ou incomplet. */
export function lireCap(xml: string): AlerteCap {
  let racine: NoeudXml
  try {
    racine = lireXml(xml, { tailleMax: TAILLE_MAX_CAP })
  } catch (e) {
    throw new ErreurCap(`XML illisible : ${e instanceof Error ? e.message : String(e)}`)
  }
  if (racine.nom !== 'alert') throw new ErreurCap(`Élément racine <${racine.nom}> : <alert> attendu`)
  const espace = racine.prefixe ? racine.attributs[`xmlns:${racine.prefixe}`] : racine.attributs.xmlns
  const version = ESPACES_CAP[espace ?? '']
  if (!version) throw new ErreurCap('Espace de noms CAP 1.1 ou 1.2 absent')

  const obligatoire = (nom: string) => {
    const v = texteEnfant(racine, nom)
    if (!v) throw new ErreurCap(`Élément <${nom}> absent`)
    return v
  }
  const identifiant = obligatoire('identifier')
  if (!/^[^\s,<&]{1,255}$/.test(identifiant)) throw new ErreurCap('Identifiant CAP invalide')
  const expediteur = obligatoire('sender')
  const emis_le = dateIso(obligatoire('sent'))
  if (!emis_le) throw new ErreurCap("Date d'émission <sent> illisible ou sans fuseau")
  const statut = obligatoire('status')
  if (!STATUTS.includes(statut)) throw new ErreurCap(`Statut CAP inconnu : ${statut}`)
  const type_message = obligatoire('msgType')
  if (!TYPES_MESSAGE.includes(type_message)) throw new ErreurCap(`Type de message CAP inconnu : ${type_message}`)

  return {
    version,
    identifiant,
    expediteur,
    emis_le,
    statut,
    type_message,
    portee: texteEnfant(racine, 'scope'),
    references: lireReferences(texteEnfant(racine, 'references')),
    infos: enfantsNommes(racine, 'info').map(lireInfo),
  }
}

const PREFERENCE_LANGUE = ['fr', 'nl', 'de', 'en']

function rangLangue(langue: string): number {
  const i = PREFERENCE_LANGUE.indexOf(langue.slice(0, 2))
  return i === -1 ? PREFERENCE_LANGUE.length : i
}

function provincesDeInfo(info: InfoCap): string[] {
  return trierProvinces(info.zones.flatMap((z) => z.provinces))
}

/**
 * Message CAP → lignes de `alertes_externes`, une par segment. Les blocs <info> qui ne diffèrent que par la langue
 * forment un segment, rédigé dans la langue préférée (FR, puis NL, DE, EN) ; un type, un niveau, une période ou des
 * zones différents font un autre segment. Segments triés du plus grave au moins grave, numérotés à partir de 0.
 * Une annulation sans bloc <info> donne une ligne de niveau vert, sans province, pour clore le fil de l'alerte.
 */
export function lignesAlerteExterne(
  alerte: AlerteCap,
  source: string,
  options: { lien?: string | null } = {},
): { lignes: LigneAlerteExterne[]; ecartes: string[] } {
  const ecartes: string[] = []
  if (alerte.type_message === 'Ack' || alerte.type_message === 'Error') {
    return { lignes: [], ecartes: [`Message de type ${alerte.type_message} ignoré`] }
  }

  const groupes = new Map<string, InfoCap[]>()
  for (const info of alerte.infos) {
    if (!info.niveau) {
      ecartes.push(`Bloc <info> (${info.langue}) sans niveau lisible : « ${info.evenement} »`)
      continue
    }
    const codes = info.zones.flatMap((z) => z.geocodes.map((g) => `${g.nom}=${g.valeur}`)).sort()
    const cle = [info.type, info.niveau, info.debut_le ?? '', info.fin_le ?? '', provincesDeInfo(info).join(','), codes.join(',')].join('|')
    groupes.set(cle, [...(groupes.get(cle) ?? []), info])
  }

  const commun = {
    source,
    identifiant: alerte.identifiant,
    expediteur: alerte.expediteur,
    emis_le: alerte.emis_le,
    statut_cap: alerte.statut,
    type_message: alerte.type_message,
    portee: alerte.portee,
    references_cap: alerte.references.map((r) => r.identifiant),
  }

  const segments = [...groupes.entries()]
    .map(([cle, infos]) => ({ cle, info: [...infos].sort((a, b) => rangLangue(a.langue) - rangLangue(b.langue))[0] }))
    .sort((a, b) => RANG_NIVEAU[b.info.niveau as Niveau] - RANG_NIVEAU[a.info.niveau as Niveau] || (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0))

  const lignes: LigneAlerteExterne[] = segments.map(({ info }, segment) => ({
    ...commun,
    segment,
    langue: info.langue,
    evenement: info.evenement,
    type_alerte: info.type,
    niveau: info.niveau as Niveau,
    severite: info.severite,
    urgence: info.urgence,
    certitude: info.certitude,
    debut_le: info.debut_le ?? alerte.emis_le,
    fin_le: info.fin_le,
    titre: info.titre,
    description: info.description,
    consignes: info.consignes,
    zones: info.zones,
    provinces: provincesDeInfo(info),
    lien: info.lien ?? options.lien ?? null,
  }))

  if (!lignes.length && alerte.type_message === 'Cancel') {
    lignes.push({
      ...commun,
      segment: 0,
      langue: 'fr',
      evenement: 'Annulation',
      type_alerte: 'autre',
      niveau: 'vert',
      severite: null,
      urgence: null,
      certitude: null,
      debut_le: alerte.emis_le,
      fin_le: alerte.emis_le,
      titre: null,
      description: null,
      consignes: null,
      zones: [],
      provinces: [],
      lien: options.lien ?? null,
    })
  }
  return { lignes, ecartes }
}
