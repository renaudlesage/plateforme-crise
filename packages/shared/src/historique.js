import { ecrireCsv } from './chronogramme.js'

/**
 * Historique des incidents (C6, idée reprise de Kalisio Crisis : historique, densité, statistiques, exports ;
 * aucun code repris). Fonctions pures, sur les lignes de la table incidents.
 */

const heures = (i) => (i.date_fin && i.date_debut ? (Date.parse(i.date_fin) - Date.parse(i.date_debut)) / 3600000 : null)

function mediane(valeurs) {
  if (valeurs.length === 0) return null
  const t = [...valeurs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

function compter(liste, cle) {
  const n = new Map()
  for (const x of liste) {
    const k = cle(x)
    n.set(k, (n.get(k) ?? 0) + 1)
  }
  return n
}

/** Synthèse : nombres, répartition par type, par mois (AAAA-MM, mois sans incident inclus), par degré, durée médiane. */
export function statistiquesIncidents(incidents) {
  const clos = incidents.filter((i) => i.statut === 'cloture')
  const parType = [...compter(incidents, (i) => i.type_evenement?.trim() || 'non précisé')]
    .map(([cle, n]) => ({ cle, n }))
    .sort((a, b) => b.n - a.n || a.cle.localeCompare(b.cle))
  const parCriticite = [1, 2, 3, 4, null].map((d) => ({ cle: d, n: incidents.filter((i) => (i.degre_criticite ?? null) === d).length }))

  const mois = compter(incidents.filter((i) => i.date_debut), (i) => i.date_debut.slice(0, 7))
  const cles = [...mois.keys()].sort()
  const parMois = []
  if (cles.length) {
    let [a, m] = cles[0].split('-').map(Number)
    const [af, mf] = cles[cles.length - 1].split('-').map(Number)
    while (a < af || (a === af && m <= mf)) {
      const k = `${a}-${String(m).padStart(2, '0')}`
      parMois.push({ cle: k, n: mois.get(k) ?? 0 })
      m += 1
      if (m > 12) {
        m = 1
        a += 1
      }
    }
  }

  const durees = clos.map(heures).filter((h) => h !== null && h >= 0)
  return {
    total: incidents.length,
    clos: clos.length,
    ouverts: incidents.length - clos.length,
    exercices: incidents.filter((i) => i.est_exercice).length,
    localises: incidents.filter((i) => i.latitude != null && i.longitude != null).length,
    parType,
    parMois,
    parCriticite,
    dureeMedianeHeures: mediane(durees),
  }
}

/** Regroupe les incidents localisés par maille (en degrés ; 0,01° ≈ 1 km) pour une carte de densité. */
export function grilleDensite(incidents, pas = 0.01) {
  const mailles = new Map()
  for (const i of incidents) {
    if (i.latitude == null || i.longitude == null) continue
    const la = Math.floor(Number(i.latitude) / pas)
    const lo = Math.floor(Number(i.longitude) / pas)
    const k = `${la}:${lo}`
    const m = mailles.get(k) ?? { lat: (la + 0.5) * pas, lon: (lo + 0.5) * pas, n: 0 }
    m.n += 1
    mailles.set(k, m)
  }
  return [...mailles.values()].sort((a, b) => b.n - a.n)
}

const COLONNES = ['nom', 'type_evenement', 'statut', 'date_debut', 'date_fin', 'degre_criticite', 'phase_cycle_vie', 'est_exercice', 'latitude', 'longitude']

/** Export CSV pour Excel. */
export function incidentsCsv(incidents) {
  return ecrireCsv([
    ['Nom', 'Type', 'Statut', 'Début', 'Fin', 'Durée (h)', 'Degré', 'Phase', 'Exercice', 'Latitude', 'Longitude'],
    ...incidents.map((i) => {
      const h = heures(i)
      return [
        i.nom, i.type_evenement ?? '', i.statut ?? '', i.date_debut ?? '', i.date_fin ?? '',
        h === null ? '' : String(Math.round(h * 10) / 10).replace('.', ','),
        i.degre_criticite ?? '', i.phase_cycle_vie ?? '', i.est_exercice ? 'oui' : 'non', i.latitude ?? '', i.longitude ?? '',
      ]
    }),
  ])
}

/** Export GeoJSON (incidents localisés seulement), pour un SIG. */
export function incidentsGeoJson(incidents) {
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: incidents
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(i.longitude), Number(i.latitude)] },
          properties: Object.fromEntries(COLONNES.filter((c) => c !== 'latitude' && c !== 'longitude').map((c) => [c, i[c] ?? null])),
        })),
    },
    null,
    1
  )
}
