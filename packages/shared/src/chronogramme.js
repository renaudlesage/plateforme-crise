/**
 * Chronogramme d'exercice : import et export en CSV lisible par Excel (point-virgule, UTF-8 avec BOM).
 * Idée reprise de Mur@il (import du chronogramme depuis un tableur) ; aucun code repris (Mur@il est sous GPL v3).
 *
 * Pas de dépendance : Excel ouvre et enregistre ce format (« CSV UTF-8 »). Une colonne inconnue est ignorée ;
 * une ligne invalide est signalée avec son numéro et n'est pas importée.
 */

export const TYPES_STIMULUS = [
  { valeur: 'message', libelle: 'Message', aide: 'Arrive dans la boîte de réception des rôles destinataires.' },
  { valeur: 'publication', libelle: 'Publication', aide: 'Paraît sur le fil social simulé (pression médiatique et citoyenne). Jamais publié hors de l’exercice.' },
  { valeur: 'decompte', libelle: 'Décompte', aide: 'Affiche un compte à rebours aux joueurs (ex. « rapport au gouverneur dans 30 min »).' },
]
export const LIBELLE_TYPE_STIMULUS = Object.fromEntries(TYPES_STIMULUS.map((t) => [t.valeur, t.libelle]))

export const ROLES_EXERCICE = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'd1', libelle: 'D1' },
  { valeur: 'd2', libelle: 'D2' },
  { valeur: 'd3', libelle: 'D3' },
  { valeur: 'd4', libelle: 'D4' },
  { valeur: 'd5', libelle: 'D5' },
  { valeur: 'pcops', libelle: 'PC-Ops' },
  { valeur: 'bourgmestre', libelle: 'Bourgmestre' },
]

const CANAUX = ['telephone', 'radio', 'mail', 'be_alert', 'terrain', 'media', 'citoyen', 'autre']

/** Colonnes du modèle, dans l'ordre de l'export. */
export const COLONNES_CHRONOGRAMME = [
  { cle: 'horaire', titre: 'Horaire' },
  { cle: 'type', titre: 'Type' },
  { cle: 'canal', titre: 'Canal' },
  { cle: 'emetteur', titre: 'Émetteur' },
  { cle: 'destinataires', titre: 'Destinataires' },
  { cle: 'texte', titre: 'Stimulus' },
  { cle: 'reaction_attendue', titre: 'Réaction attendue' },
  { cle: 'note_animateur', titre: 'Note animateur' },
  { cle: 'livrable', titre: 'Livrable' },
  { cle: 'decompte_minutes', titre: 'Durée décompte (min)' },
]

/** Minuscules, sans accents ni ponctuation : « Réaction attendue » → « reactionattendue ». */
export function normaliser(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const ALIAS_COLONNES = {
  horaire: ['horaire', 'heure', 'heurescenario', 'heurescenariomin', 't', 'minute', 'minutes'],
  type: ['type', 'typestimulus'],
  canal: ['canal', 'moyen'],
  emetteur: ['emetteur', 'expediteur', 'de', 'source', 'auteur'],
  destinataires: ['destinataires', 'destinataire', 'a', 'cible', 'roles', 'role'],
  texte: ['stimulus', 'stimuli', 'texte', 'message', 'contenu'],
  reaction_attendue: ['reactionattendue', 'reactionsattendues', 'actionattendue', 'attendu'],
  note_animateur: ['noteanimateur', 'commentaire', 'note', 'notes'],
  livrable: ['livrable', 'livrables'],
  decompte_minutes: ['dureedecomptemin', 'dureedecompte', 'decompte', 'decompteminutes', 'duree'],
}

const ALIAS_TYPES = {
  message: 'message', mail: 'message', courriel: 'message', appel: 'message',
  publication: 'publication', tweet: 'publication', post: 'publication', reseausocial: 'publication', social: 'publication', pms: 'publication',
  decompte: 'decompte', compteurarebours: 'decompte', comptearebours: 'decompte', minuteur: 'decompte',
}

const ALIAS_CANAUX = {
  telephone: 'telephone', tel: 'telephone', appel: 'telephone', radio: 'radio', astrid: 'radio',
  mail: 'mail', courriel: 'mail', email: 'mail', bealert: 'be_alert', terrain: 'terrain',
  media: 'media', medias: 'media', presse: 'media', citoyen: 'citoyen', citoyens: 'citoyen', population: 'citoyen', autre: 'autre',
}

const ALIAS_ROLES = {
  tous: 'tous', toutes: 'tous', all: 'tous',
  d1: 'd1', d2: 'd2', d3: 'd3', d4: 'd4', d5: 'd5',
  pcops: 'pcops', pcoperationnel: 'pcops',
  bourgmestre: 'bourgmestre', bgm: 'bourgmestre', maire: 'bourgmestre',
}

/** Découpe un CSV (séparateur détecté : « ; », « , » ou tabulation ; guillemets et retours à la ligne gérés). */
export function lireCsv(texte) {
  const t = String(texte ?? '').replace(/^﻿/, '')
  const premiere = t.split(/\r?\n/, 1)[0] ?? ''
  const compte = (c) => premiere.split(c).length - 1
  const sep = [';', '\t', ','].reduce((m, c) => (compte(c) > compte(m) ? c : m), ';')
  const lignes = []
  let ligne = []
  let champ = ''
  let guillemets = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') {
        champ += '"'
        i++
      } else if (c === '"') guillemets = false
      else champ += c
    } else if (c === '"') guillemets = true
    else if (c === sep) {
      ligne.push(champ)
      champ = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else champ += c
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ)
    lignes.push(ligne)
  }
  return lignes.filter((l) => l.some((c) => c.trim() !== ''))
}

/** Écrit un CSV pour Excel : BOM, point-virgule, CRLF ; champs entre guillemets au besoin. */
export function ecrireCsv(lignes) {
  const champ = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + lignes.map((l) => l.map(champ).join(';')).join('\r\n') + '\r\n'
}

/**
 * Horaire de scénario en minutes : « 65 », « T+65 », « 1:05 », « 01:05 », « T+1 h 05 », « 1h », « J+2 » (2880).
 * Renvoie null si illisible.
 */
export function lireHoraire(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  let m
  if ((m = s.match(/^(?:t\+?)?(\d+)(?:min)?$/))) return Number(m[1])
  if ((m = s.match(/^(?:t\+?)?(\d+)[:h](\d{1,2})?(?::\d{2})?$/))) return Number(m[1]) * 60 + Number(m[2] ?? 0)
  if ((m = s.match(/^j\+?(\d+)(?:(\d+)[:h](\d{1,2})?)?$/))) return Number(m[1]) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  return null
}

/** « T+65 » → « 1:05 » pour l'export (relu par lireHoraire). */
export function ecrireHoraire(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** « D1, Bourgmestre / PC-Ops » → ['d1', 'bourgmestre', 'pcops'] ; inconnus renvoyés à part. */
export function lireDestinataires(v) {
  const roles = []
  const inconnus = []
  for (const brut of String(v ?? '').split(/[,|/+;\n]/)) {
    const n = normaliser(brut)
    if (!n) continue
    const r = ALIAS_ROLES[n]
    if (r) {
      if (!roles.includes(r)) roles.push(r)
    } else inconnus.push(brut.trim())
  }
  return { roles, inconnus }
}

/**
 * Lit un chronogramme CSV. Renvoie { stimuli, erreurs, colonnesIgnorees }.
 * Chaque stimulus : { heure_scenario_min, type_stimulus, canal, emetteur, destinataires, texte,
 *                     reaction_attendue, note_animateur, livrable, decompte_minutes, ligne }.
 */
export function lireChronogramme(texte) {
  const lignes = lireCsv(texte)
  if (lignes.length === 0) return { stimuli: [], erreurs: [{ ligne: 1, message: 'Fichier vide.' }], colonnesIgnorees: [] }

  const index = {}
  const colonnesIgnorees = []
  lignes[0].forEach((titre, i) => {
    const n = normaliser(titre)
    const cle = Object.keys(ALIAS_COLONNES).find((k) => ALIAS_COLONNES[k].includes(n))
    if (cle && index[cle] === undefined) index[cle] = i
    else if (titre.trim()) colonnesIgnorees.push(titre.trim())
  })
  const erreurs = []
  if (index.horaire === undefined || index.texte === undefined) {
    erreurs.push({ ligne: 1, message: 'Colonnes « Horaire » et « Stimulus » obligatoires sur la première ligne.' })
    return { stimuli: [], erreurs, colonnesIgnorees }
  }

  const stimuli = []
  for (let k = 1; k < lignes.length; k++) {
    const l = lignes[k]
    const val = (cle) => (index[cle] === undefined ? '' : String(l[index[cle]] ?? '').trim())
    const numero = k + 1
    const problemes = []

    const heure = lireHoraire(val('horaire'))
    if (heure === null) problemes.push(`horaire « ${val('horaire')} » illisible`)
    const texteStimulus = val('texte')
    if (!texteStimulus) problemes.push('stimulus vide')

    const typeBrut = normaliser(val('type'))
    const type = typeBrut ? ALIAS_TYPES[typeBrut] : 'message'
    if (!type) problemes.push(`type « ${val('type')} » inconnu (message, publication ou décompte)`)

    const canalBrut = normaliser(val('canal'))
    const canal = canalBrut ? ALIAS_CANAUX[canalBrut] ?? (CANAUX.includes(canalBrut) ? canalBrut : null) : type === 'publication' ? 'media' : 'autre'
    if (!canal) problemes.push(`canal « ${val('canal')} » inconnu`)

    const { roles, inconnus } = lireDestinataires(val('destinataires'))
    if (inconnus.length) problemes.push(`destinataire(s) inconnu(s) : ${inconnus.join(', ')}`)

    let decompte = null
    if (type === 'decompte') {
      decompte = Number(val('decompte_minutes').replace(',', '.'))
      if (!Number.isInteger(decompte) || decompte < 1 || decompte > 1440) problemes.push('un décompte a une durée de 1 à 1440 minutes')
    }
    const livrable = val('livrable')
    if (livrable.length > 500) problemes.push('livrable trop long (500 caractères au plus)')

    if (problemes.length) {
      erreurs.push({ ligne: numero, message: problemes.join(' ; ') })
      continue
    }
    stimuli.push({
      ligne: numero,
      heure_scenario_min: heure,
      type_stimulus: type,
      canal,
      emetteur: val('emetteur') || null,
      destinataires: type === 'message' && roles.length ? roles : null,
      texte: texteStimulus,
      reaction_attendue: val('reaction_attendue') || null,
      note_animateur: val('note_animateur') || null,
      livrable: livrable || null,
      decompte_minutes: decompte,
    })
  }
  stimuli.sort((a, b) => a.heure_scenario_min - b.heure_scenario_min || a.ligne - b.ligne)
  return { stimuli, erreurs, colonnesIgnorees }
}

/** Exporte les stimuli d'un exercice au format du modèle (réimportable). `actions` : actions attendues liées. */
export function exporterChronogramme(stimuli, actions = []) {
  const lignes = [COLONNES_CHRONOGRAMME.map((c) => c.titre)]
  for (const s of [...stimuli].sort((a, b) => a.heure_scenario_min - b.heure_scenario_min || (a.ordre ?? 0) - (b.ordre ?? 0))) {
    const roles = s.destinataires ?? (s.discipline_cible ? [s.discipline_cible] : [])
    lignes.push([
      ecrireHoraire(s.heure_scenario_min),
      s.type_stimulus ?? 'message',
      s.canal ?? '',
      s.emetteur ?? '',
      roles.map((r) => ROLES_EXERCICE.find((x) => x.valeur === r)?.libelle ?? r).join(', '),
      s.texte ?? '',
      actions.filter((a) => a.stimulus_id === s.id).map((a) => a.action).join(' | '),
      s.note_animateur ?? '',
      s.livrable ?? '',
      s.decompte_minutes ?? '',
    ])
  }
  return ecrireCsv(lignes)
}

/** Modèle vierge à télécharger, avec deux lignes d'exemple fictives. */
export function modeleChronogramme() {
  return ecrireCsv([
    COLONNES_CHRONOGRAMME.map((c) => c.titre),
    ['0:00', 'message', 'telephone', 'Exemple : zone de secours', 'D1, Bourgmestre', 'Exemple : texte lu aux joueurs', 'Exemple : convoquer le CC', 'Exemple : note pour l’animateur', '', ''],
    ['0:20', 'publication', 'media', '@exemple_citoyen', '', 'Exemple : rumeur sur le fil social #exercice', '', '', '', ''],
    ['0:30', 'decompte', 'autre', 'Animation', '', 'Exemple : premier rapport au gouverneur', '', '', 'Rapport écrit', '30'],
  ])
}

/** Délai de prise en charge en minutes (lancé → premier « traité »), ou null. */
export function delaiTraitement(lanceA, traitements) {
  if (!lanceA || !traitements?.length) return null
  const premier = Math.min(...traitements.map((t) => Date.parse(t.traite_le)))
  return Math.max(0, Math.round((premier - Date.parse(lanceA)) / 60000))
}
