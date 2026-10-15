/**
 * Veille météo de la commune : logique pure (sans React ni réseau), partagée par les applications.
 *
 * Principe (fiche STD-05 d'Eventware) : le seuil de décision se fixe À FROID, avant le phénomène.
 * Ici on ne fait que confronter la prévision aux seuils écrits et rappeler la consigne décidée d'avance.
 * Ce module ne diffuse rien à la population : c'est un geste humain, ailleurs.
 *
 * Nomenclature IRM : vert, jaune, orange, rouge. Le « jaune » est un signal précoce placé à 80 % du seuil
 * de vigilance — pas une nouvelle mesure, juste un signal plus tôt avec les mêmes données.
 *
 * Source des prévisions : Open-Meteo (sans clé). Les valeurs de seuil livrées par défaut sont des points
 * de départ : elles ne remplacent ni l'avis des experts (IRM, zone de secours, cellule de crise) ni le plan
 * d'urgence communal.
 */

export const NIVEAUX = { vert: 0, jaune: 1, orange: 2, rouge: 3 }
export const LIBELLE_NIVEAU = { vert: 'Vert', jaune: 'Jaune', orange: 'Orange', rouge: 'Rouge' }
export const CRITERES = ['vent', 'pluie', 'chaleur', 'froid', 'orage']
export const LIBELLE_CRITERE = {
  vent: 'Vent',
  pluie: 'Précipitations',
  chaleur: 'Chaleur',
  froid: 'Froid',
  orage: 'Orage',
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

/** Points de départ, identiques à ceux d'Eventware. À valider par la commune. */
export const SEUILS_DEFAUT = {
  rafale_vigilance_kmh: 50,
  rafale_critique_kmh: 70,
  pluie_vigilance_mm: 5,
  pluie_critique_mm: 15,
  temp_max_vigilance: 30,
  temp_min_vigilance: 2,
  alerte_orage: true,
  consignes: {},
}

export const URL_PORTAIL_METEOALARM = 'https://meteoalarm.org/en/live/country/belgium'

export function urlOpenMeteo(lat, lon) {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code' +
    '&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code' +
    '&forecast_days=2&timezone=auto'
  )
}

/** Code météo WMO (Open-Meteo) → libellé court. */
export function libelleCodeMeteo(code) {
  if (code == null) return ''
  if (code === 0) return 'Ciel dégagé'
  if (code <= 2) return 'Peu nuageux'
  if (code === 3) return 'Couvert'
  if (code === 45 || code === 48) return 'Brouillard'
  if (code >= 51 && code <= 57) return 'Bruine'
  if (code >= 61 && code <= 67) return 'Pluie'
  if (code >= 71 && code <= 77) return 'Neige'
  if (code >= 80 && code <= 82) return 'Averses'
  if (code === 85 || code === 86) return 'Averses de neige'
  if (code >= 95) return 'Orage'
  return ''
}

/**
 * Open-Meteo donne des heures locales SANS fuseau (« 2026-10-15T22:00 ») et, à part, `utc_offset_seconds`.
 * On en tire un instant réel (ISO UTC), pour que le calcul ne dépende pas du fuseau de l'écran qui regarde.
 */
export function heureEnInstant(t, utcOffsetSec) {
  if (utcOffsetSec == null || /Z|[+-]\d\d:?\d\d$/.test(t)) return t
  return new Date(Date.parse(`${t}Z`) - utcOffsetSec * 1000).toISOString()
}

const FUSEAU = 'Europe/Brussels'

/** Heure (« 22 h ») en heure de Belgique, quel que soit le fuseau de l'écran. */
export function heureBelge(iso) {
  return new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', hour12: false, timeZone: FUSEAU }).format(new Date(iso)).replace(/\D/g, '').padStart(2, '0')
}

/** Réponse Open-Meteo → liste d'heures des 36 prochaines heures (à partir d'une demi-heure avant maintenant). */
export function extraire(hourly, maintenantMs = Date.now(), utcOffsetSec = null) {
  if (!hourly?.time) return []
  const debut = maintenantMs - 30 * 60 * 1000
  return hourly.time
    .map((t, i) => ({
      heure: heureEnInstant(t, utcOffsetSec),
      temp: hourly.temperature_2m?.[i] ?? 0,
      pluie: hourly.precipitation?.[i] ?? 0,
      vent: hourly.wind_speed_10m?.[i] ?? 0,
      rafale: hourly.wind_gusts_10m?.[i] ?? 0,
      code: hourly.weather_code?.[i] ?? 0,
    }))
    .filter((x) => new Date(x.heure).getTime() >= debut)
    .slice(0, 36)
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

/**
 * Évalue une heure de prévision, critère par critère. Retourne les déclencheurs (un par critère touché)
 * pour que chaque phénomène garde sa propre consigne. Le jaune n'a pas de consigne (signal précoce).
 */
export function evaluer(h, s) {
  const declencheurs = []
  const c = s?.consignes ?? {}
  const ajouter = (critere, niveau, motif, cleConsigne) =>
    declencheurs.push({ critere, niveau, motif, consigne: (cleConsigne && c[cleConsigne]) || null })

  const rafV = num(s?.rafale_vigilance_kmh)
  const rafC = num(s?.rafale_critique_kmh)
  if (rafC != null && h.rafale >= rafC) ajouter('vent', 'rouge', `rafales ${Math.round(h.rafale)} km/h`, 'vent_alarme')
  else if (rafV != null && h.rafale >= rafV) ajouter('vent', 'orange', `rafales ${Math.round(h.rafale)} km/h`, 'vent_alerte')
  else if (rafV != null && h.rafale >= rafV * 0.8) ajouter('vent', 'jaune', `rafales ${Math.round(h.rafale)} km/h`, null)

  const plV = num(s?.pluie_vigilance_mm)
  const plC = num(s?.pluie_critique_mm)
  if (plC != null && h.pluie >= plC) ajouter('pluie', 'rouge', `pluie ${h.pluie} mm/h`, 'pluie_alarme')
  else if (plV != null && h.pluie >= plV) ajouter('pluie', 'orange', `pluie ${h.pluie} mm/h`, 'pluie_alerte')
  else if (plV != null && h.pluie >= plV * 0.8) ajouter('pluie', 'jaune', `pluie ${h.pluie} mm/h`, null)

  const tMax = num(s?.temp_max_vigilance)
  const tMin = num(s?.temp_min_vigilance)
  if (tMax != null && h.temp >= tMax) ajouter('chaleur', 'orange', `${Math.round(h.temp)} °C`, 'chaleur_alerte')
  if (tMin != null && h.temp <= tMin) ajouter('froid', 'orange', `${Math.round(h.temp)} °C`, 'froid_alerte')

  // Codes Open-Meteo 95 à 99 : orage, avec ou sans grêle
  if (s?.alerte_orage && h.code >= 95) ajouter('orage', 'rouge', 'orage annoncé', 'orage_alarme')

  const niveau = declencheurs.reduce((pire, d) => (NIVEAUX[d.niveau] > NIVEAUX[pire] ? d.niveau : pire), 'vert')
  return { niveau, declencheurs }
}

/**
 * Synthèse de la prévision : heures évaluées, pire heure, pire déclencheur par critère (jaune exclu, il reste
 * purement visuel) et niveaux/motifs prêts à envoyer à `consigner_meteo`.
 */
export function synthese(hourly, seuils, maintenantMs = Date.now(), utcOffsetSec = null) {
  const evaluees = extraire(hourly, maintenantMs, utcOffsetSec).map((h) => ({ ...h, ...evaluer(h, seuils ?? {}) }))
  const pire = evaluees.reduce((acc, h) => (NIVEAUX[h.niveau] > NIVEAUX[acc.niveau] ? h : acc), { niveau: 'vert' })

  const pireParCritere = {}
  for (const h of evaluees) {
    for (const d of h.declencheurs) {
      if (d.niveau === 'jaune') continue
      const deja = pireParCritere[d.critere]
      if (!deja || NIVEAUX[d.niveau] > NIVEAUX[deja.niveau]) pireParCritere[d.critere] = { ...d, heure: h.heure }
    }
  }
  const niveaux = {}
  const motifs = {}
  for (const c of CRITERES) {
    niveaux[c] = pireParCritere[c]?.niveau ?? 'vert'
    if (pireParCritere[c]) motifs[c] = pireParCritere[c].motif
  }
  const echeance = pire.niveau === 'vert' ? null : evaluees.find((h) => h.niveau === pire.niveau)?.heure ?? null

  return { evaluees, pire, pireParCritere, niveaux, motifs, echeance, cle: CRITERES.map((c) => `${c}:${niveaux[c]}`).join(',') }
}

/** « 14:00 (dans 3 h) », « maintenant », ou jour + heure au-delà de 24 h. */
export function quand(iso, maintenantMs = Date.now()) {
  const d = new Date(iso)
  const dans = Math.round((d.getTime() - maintenantMs) / 3600000)
  const heure = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU })
  if (dans <= 0) return 'maintenant'
  if (dans < 24) return `${heure} (dans ${dans} h)`
  return d.toLocaleString('fr-BE', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: FUSEAU })
}
