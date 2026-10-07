/**
 * Bibliothèque de symboles cartographiques — charte graphique opérationnelle
 * belge (« Charte graphique », Mémento opérationnel du cours de gestion de
 * crise, mise à jour 01/03/2016, reprise dans la procédure KCCE « Incident
 * Command System »). Les symboles sont REDESSINÉS ici en SVG (le PDF source
 * ne contient que des images) ; ils respectent les formes et les codes
 * couleur de la charte :
 *   personnes vert · incendie rouge · eau bleu · commandement violet ·
 *   thématique particulière orange · structures/accès noir.
 *
 * Les symboles marqués `extension: true` n'existent pas dans la charte
 * (qui est centrée sur la discipline 1) : ils sont dessinés dans le même
 * esprit pour les besoins de Crisiware (route coupée, police…) et doivent
 * être validés avant d'être présentés comme « officiels ».
 *
 * Module sans JSX et sans dépendance : il produit des chaînes SVG, utilisées
 * à la fois par React (<Symbole/>) et par Leaflet (divIcon, qui veut du HTML).
 * Aucun contenu saisi par un utilisateur n'entre dans ces chaînes.
 */

export const COULEURS_NATURE = {
  personnes: '#3aa53a',
  incendie: '#d71f2d',
  eau: '#1c4f9c',
  commandement: '#8e2a8e',
  thematique: '#f07a1a',
  structure: '#111111',
}

const C = COULEURS_NATURE
const BLEU_POLICE = '#2a3a8c' // D3 dans le lexique de la charte (bleu foncé)
const FOND = '#ffffff'

export const CATEGORIES_SYMBOLES = [
  { cle: 'poste', libelle: 'Postes de commandement' },
  { cle: 'danger', libelle: 'Dangers et points sensibles' },
  { cle: 'sinistre', libelle: 'Sinistre' },
  { cle: 'chemin', libelle: 'Cheminement et accès' },
  { cle: 'eau', libelle: 'Ressources en eau' },
  { cle: 'action', libelle: 'Actions' },
  { cle: 'moyen', libelle: 'Moyens' },
  { cle: 'infra', libelle: 'Infrastructures et logistique' },
]

/* ---------- briques de dessin (viewBox 48 × 48) ---------- */

const etoile = (cx, cy, r1, r2, n) => {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

const rect = (couleur, extra = '', fond = FOND) =>
  `<rect x="4" y="12" width="40" height="24" rx="1.5" fill="${fond}" stroke="${couleur}" stroke-width="3"/>${extra}`

const fanion = (nbPoints, couleur) => {
  const pts = Array.from({ length: nbPoints }, (_, i) => `<circle cx="${14 + i * 7}" cy="6" r="2.6" fill="${couleur}"/>`).join('')
  return `${pts}<path d="M9 11 V45" stroke="${couleur}" stroke-width="3" fill="none"/><rect x="9" y="11" width="32" height="16" fill="${FOND}" stroke="${couleur}" stroke-width="3"/>`
}

const triHaut = (c) => `<polygon points="24,5 44,42 4,42" fill="${c}"/>`
const triBas = (c) => `<polygon points="24,43 44,6 4,6" fill="${c}"/>`

const croisement = (c = '#111') =>
  `<path d="M4 18 H18 V4 M30 4 V18 H44 M4 30 H18 V44 M30 44 V30 H44" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="square"/>`

const infra = (texte) => {
  const taille = texte.length >= 3 ? 13 : 18
  return `<line x1="4" y1="9" x2="44" y2="9" stroke="${C.personnes}" stroke-width="3"/><rect x="4" y="13" width="40" height="24" fill="${FOND}" stroke="${C.personnes}" stroke-width="3"/><text x="24" y="31" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${taille}" font-weight="700" fill="#111">${texte}</text>`
}

const grille = (couleur, cellules = []) => {
  const pleins = cellules
    .map((c) => {
      const x = c.includes('g') ? 4 : 24
      const w = 20
      return `<rect x="${x}" y="${c.includes('h') ? 12 : 24}" width="${w}" height="12" fill="${couleur}"/>`
    })
    .join('')
  return `<rect x="4" y="12" width="40" height="24" fill="${FOND}" stroke="${couleur}" stroke-width="3"/>${pleins}<path d="M24 12 V36 M4 24 H44" stroke="${couleur}" stroke-width="2.5"/>`
}

const citerne = (n) => {
  const pts = Array.from({ length: n }, (_, i) => `<circle cx="${11 + i * 7}" cy="18" r="2.6" fill="${C.eau}"/>`).join('')
  return `${rect(C.incendie)}<line x1="4" y1="26" x2="44" y2="26" stroke="${C.incendie}" stroke-width="2.5"/>${pts}`
}

const defs = []
const ajouter = (code, libelle, categorie, rendu, options = {}) => defs.push({ code, libelle, categorie, rendu, ...options })

/* ---------- postes de commandement ---------- */
ajouter('pc_capo', 'Coordination capo / PC terrain', 'poste', () => fanion(1, C.incendie))
ajouter('pc_mono_d1', 'PC mono-discipline D1', 'poste', () => fanion(2, C.incendie))
ajouter('pc_ops', 'PC-Ops', 'poste', () => fanion(3, C.commandement))
ajouter('comite_coordination', 'Comité de coordination', 'poste', () => fanion(4, C.commandement))
ajouter('sectorisation', 'Sectorisation', 'poste', () =>
  `<polygon points="7,24 15,10 33,10 41,24 33,38 15,38" fill="none" stroke="${C.commandement}" stroke-width="2.5" stroke-dasharray="6 3"/>`)
ajouter('point_transit', 'Point de transit (PT)', 'poste', () =>
  `<path d="M2 24 H14 M30 24 H44" stroke="${C.commandement}" stroke-width="2.5"/><circle cx="22" cy="24" r="8" fill="${FOND}" stroke="${C.commandement}" stroke-width="2.5"/><path d="M38 18 L45 24 L38 30" fill="none" stroke="${C.commandement}" stroke-width="2.5"/>`)

/* ---------- dangers (triangle haut) et points sensibles (triangle bas) ---------- */
const NATURES = [
  ['noir', 'élément pouvant présenter un danger', C.structure],
  ['humain', 'personnes', C.personnes],
  ['incendie', 'incendie', C.incendie],
  ['eau', 'en rapport avec l’eau', C.eau],
  ['risque', 'risque particulier', C.thematique],
]
for (const [nature, libelle, couleur] of NATURES) {
  ajouter(`danger_${nature}`, `Source de danger — ${libelle}`, 'danger', () => triHaut(couleur), { nature })
}
for (const [nature, libelle, couleur] of NATURES) {
  ajouter(`sensible_${nature}`, `Point sensible — ${libelle}`, 'danger', () => triBas(couleur), { nature })
}

/* ---------- sinistre ---------- */
ajouter('sinistre_foyer', 'Sinistre — foyer', 'sinistre', () =>
  `<polygon points="${etoile(24, 24, 20, 10, 9)}" fill="#fde8e8" stroke="${C.incendie}" stroke-width="2.5" stroke-linejoin="round"/>`)
ajouter('sinistre_contour', 'Sinistre — contour', 'sinistre', () =>
  `<ellipse cx="24" cy="24" rx="20" ry="12" fill="none" stroke="${C.incendie}" stroke-width="2.5"/>`)

/* ---------- cheminement ---------- */
ajouter('voie_circulation', 'Voie de circulation', 'chemin', () => croisement())
ajouter('route_barree', 'Route coupée / barrée', 'chemin', () => `${croisement()}<rect x="10" y="20.5" width="28" height="7" fill="${C.incendie}"/>`, { extension: true })
ajouter('sens_circulation', 'Sens de circulation', 'chemin', () =>
  `<path d="M6 18 H42 M36 12 L42 18 L36 24 M6 32 H42 M12 26 L6 32 L12 38" fill="none" stroke="#111" stroke-width="2.5"/>`)
ajouter('acces', 'Accès', 'chemin', () =>
  `<path d="M4 34 Q22 30 42 18 M33 17 L42 18 L38 26" fill="none" stroke="#111" stroke-width="2.5"/>`)
ajouter('ppd', 'Point de première destination (PPD)', 'chemin', () =>
  `<circle cx="24" cy="24" r="17" fill="${FOND}" stroke="#5a4fa6" stroke-width="2.5"/><path d="M12 12 L36 36 M36 12 L12 36" stroke="#5a4fa6" stroke-width="2.5"/>`)
ajouter('point_particulier', 'Point particulier + annotation', 'chemin', () =>
  `<circle cx="24" cy="15" r="11" fill="${FOND}" stroke="#111" stroke-width="2.5"/><path d="M24 26 V45" stroke="#111" stroke-width="2.5"/>`)

/* ---------- ressources en eau ---------- */
ajouter('borne_incendie', 'Bouche ou borne d’incendie', 'eau', () => `<circle cx="24" cy="24" r="17" fill="${C.eau}"/>`)
ajouter('point_eau', 'Point d’eau (courant ou stagnant)', 'eau', () =>
  `<circle cx="24" cy="24" r="18" fill="${FOND}" stroke="${C.eau}" stroke-width="2.5"/><path d="M11 21 q3.2 -4 6.4 0 t6.4 0 t6.4 0 t6.4 0 M11 29 q3.2 -4 6.4 0 t6.4 0 t6.4 0 t6.4 0" fill="none" stroke="${C.eau}" stroke-width="2.3"/>`)

/* ---------- actions défensives ---------- */
ajouter('ligne_arret', 'Défense — ligne d’arrêt', 'action', () =>
  [0, 1, 2, 3].map((i) => `<polygon points="${3 + i * 11},38 ${8.5 + i * 11},26 ${14 + i * 11},38" fill="${C.incendie}"/>`).join(''))
ajouter('isolement', 'Barrage — écran — isolement', 'action', () =>
  Array.from({ length: 8 }, (_, i) => `<polygon points="24,3 29,13 19,13" fill="${C.thematique}" transform="rotate(${i * 45} 24 24)"/>`).join(''))

/* ---------- moyens : le cadre porte la discipline ---------- */
ajouter('moyen_pompiers', 'Pompiers (D1)', 'moyen', () => rect(C.incendie), { discipline: 'd1' })
ajouter('moyen_medical', 'Médical (D2)', 'moyen', () => rect(C.personnes), { discipline: 'd2' })
ajouter('moyen_police', 'Police (D3)', 'moyen', () => rect(BLEU_POLICE), { discipline: 'd3', extension: true })
ajouter('moyen_protection_civile', 'Protection civile', 'moyen', () => rect(C.eau))
ajouter('moyen_autre', 'Autre discipline', 'moyen', () => rect(C.structure))
ajouter('vehicule_officier_1', 'Véhicule officier 1er rang', 'moyen', () => rect(C.incendie, `<polygon points="${etoile(24, 24, 8, 3.4, 5)}" fill="${C.incendie}"/>`), { discipline: 'd1' })
ajouter('vehicule_officier_2', 'Véhicule officier 2e rang', 'moyen', () =>
  rect(C.incendie, `<polygon points="${etoile(15, 24, 7, 3, 5)}" fill="${C.incendie}"/><polygon points="${etoile(33, 24, 7, 3, 5)}" fill="${C.incendie}"/>`), { discipline: 'd1' })
ajouter('autopompe', 'Autopompe', 'moyen', () =>
  rect(C.incendie, `<text x="24" y="29" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="${C.incendie}">P</text>`), { discipline: 'd1' })
ajouter('echelle', 'Engin aérien / échelle', 'moyen', () =>
  rect(C.incendie, `<path d="M12 19 H36 M12 29 H36 M18 19 V29 M30 19 V29" stroke="${C.incendie}" stroke-width="2.5" fill="none"/>`), { discipline: 'd1' })
ajouter('helicoptere', 'Hélicoptère', 'moyen', () =>
  rect(C.incendie, `<polygon points="10,18 24,24 10,30" fill="${C.incendie}"/><polygon points="38,18 24,24 38,30" fill="${C.incendie}"/>`), { discipline: 'd1' })
ajouter('citerne_4k', 'Camion-citerne < 4 000 l', 'moyen', () => citerne(1), { discipline: 'd1' })
ajouter('citerne_8k', 'Camion-citerne 8 000 l', 'moyen', () => citerne(2), { discipline: 'd1' })
ajouter('citerne_12k', 'Camion-citerne > 12 000 l', 'moyen', () => citerne(3), { discipline: 'd1' })
ajouter('citerne_20k', 'Camion-citerne > 20 000 l', 'moyen', () => citerne(4), { discipline: 'd1' })
ajouter('ambulance', 'Ambulance', 'moyen', () => grille(C.personnes), { discipline: 'd2' })
ajouter('pit', 'PIT', 'moyen', () => grille(C.personnes, ['hg']), { discipline: 'd2' })
ajouter('smur', 'SMUR / MUG', 'moyen', () => grille(C.personnes, ['hg', 'hd']), { discipline: 'd2' })

/* ---------- infrastructures et logistique ---------- */
ajouter('infra_p', 'Parking (P)', 'infra', () => infra('P'))
ajouter('infra_dz', 'Zone d’hélicoptère (DZ)', 'infra', () => infra('DZ'))
ajouter('infra_pma', 'Poste médical avancé (PMA)', 'infra', () => infra('PMA'))
ajouter('infra_h', 'Hôpital (H)', 'infra', () => infra('H'))
ajouter('infra_mor', 'Morgue (MOR)', 'infra', () => infra('MOR'))
ajouter('infra_ca', 'Centre d’accueil (CA)', 'infra', () => infra('CA'))
ajouter('infra_pool', 'Point de rassemblement du personnel (Pool)', 'infra', () => infra('Pool'))
ajouter('infra_pr', 'Point de rassemblement de la population', 'infra', () => infra('PR'), { extension: true })

export const SYMBOLES = defs
const parCode = new Map(defs.map((d) => [d.code, d]))

export function symboleDe(code) {
  return parCode.get(code) ?? null
}

/**
 * Chaîne SVG complète d'un symbole.
 * @param {string} code
 * @param {{taille?: number, badge?: string|null}} [options] badge = pastille de discipline dans le coin
 */
export function svgSymbole(code, { taille = 32, badge = null } = {}) {
  const s = parCode.get(code)
  if (!s) return ''
  const pastille = badge ? `<circle cx="40" cy="8" r="7" fill="${badge}" stroke="#fff" stroke-width="2.5"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${taille}" height="${taille}" role="img" aria-label="${s.libelle.replace(/"/g, '')}" style="display:block;overflow:visible">${s.rendu()}${pastille}</svg>`
}
