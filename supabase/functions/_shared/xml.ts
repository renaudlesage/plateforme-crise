// =====================================================================
// Lecteur XML minimal (Crisiware), sans dépendance.
// Suffisant pour les messages CAP 1.2 et les flux ATOM d'avertissements :
// éléments, attributs, texte, sections CDATA, entités prédéfinies et
// numériques. Refuse les déclarations DOCTYPE et ENTITY (ni entité
// externe ni expansion) et les documents trop volumineux.
// Le préfixe d'espace de noms est retiré du nom (`cap:event` → `event`)
// et gardé à part ; les URI d'espace de noms ne sont pas résolues.
// Pur : utilisable dans une Edge Function (Deno) et dans Vitest (Node).
// =====================================================================

export interface NoeudXml {
  nom: string
  prefixe: string | null
  attributs: Record<string, string>
  enfants: NoeudXml[]
  texte: string
}

export class ErreurXml extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurXml'
  }
}

const TAILLE_MAX_DEFAUT = 2_000_000

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Entités prédéfinies et numériques ; un « & » isolé ou une entité inconnue restent tels quels. */
export function decoderEntites(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]+);/g, (brut, e: string) => {
    if (e[0] !== '#') return ENTITES[e] ?? brut
    const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : brut
  })
}

function lireAttributs(source: string, balise: string): Record<string, string> {
  const attributs: Record<string, string> = {}
  const motif = /\s*([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y
  let i = 0
  while (i < source.length && source.slice(i).trim()) {
    motif.lastIndex = i
    const m = motif.exec(source)
    if (!m) throw new ErreurXml(`Attribut illisible dans <${balise}>`)
    attributs[m[1]] = decoderEntites(m[2] ?? m[3] ?? '')
    i = motif.lastIndex
  }
  return attributs
}

/** Document XML → élément racine. Lève ErreurXml si le document est mal formé ou refusé. */
export function lireXml(xml: string, options: { tailleMax?: number } = {}): NoeudXml {
  const tailleMax = options.tailleMax ?? TAILLE_MAX_DEFAUT
  if (typeof xml !== 'string' || !xml.trim()) throw new ErreurXml('Document vide')
  if (xml.length > tailleMax) throw new ErreurXml(`Document trop volumineux (${xml.length} caractères, ${tailleMax} au plus)`)

  const pile: { noeud: NoeudXml; nomComplet: string }[] = []
  let racine: NoeudXml | null = null
  let i = xml.charCodeAt(0) === 0xfeff ? 1 : 0

  const ajouterTexte = (t: string) => {
    if (pile.length) pile[pile.length - 1].noeud.texte += t
    else if (t.trim()) throw new ErreurXml("Texte hors de l'élément racine")
  }

  while (i < xml.length) {
    const debut = xml.indexOf('<', i)
    if (debut === -1) {
      ajouterTexte(decoderEntites(xml.slice(i)))
      break
    }
    if (debut > i) ajouterTexte(decoderEntites(xml.slice(i, debut)))

    if (xml.startsWith('<!--', debut)) {
      const fin = xml.indexOf('-->', debut + 4)
      if (fin === -1) throw new ErreurXml('Commentaire non fermé')
      i = fin + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', debut)) {
      const fin = xml.indexOf(']]>', debut + 9)
      if (fin === -1) throw new ErreurXml('Section CDATA non fermée')
      if (!pile.length) throw new ErreurXml("Section CDATA hors de l'élément racine")
      pile[pile.length - 1].noeud.texte += xml.slice(debut + 9, fin)
      i = fin + 3
      continue
    }
    if (xml.startsWith('<!', debut)) throw new ErreurXml('Déclarations DOCTYPE et ENTITY refusées')
    if (xml.startsWith('<?', debut)) {
      const fin = xml.indexOf('?>', debut + 2)
      if (fin === -1) throw new ErreurXml('Instruction de traitement non fermée')
      i = fin + 2
      continue
    }
    if (xml.startsWith('</', debut)) {
      const fin = xml.indexOf('>', debut + 2)
      if (fin === -1) throw new ErreurXml('Balise fermante non terminée')
      const nomComplet = xml.slice(debut + 2, fin).trim()
      const ouvert = pile.pop()
      if (!ouvert || ouvert.nomComplet !== nomComplet) throw new ErreurXml(`Balise fermante </${nomComplet}> inattendue`)
      i = fin + 1
      continue
    }

    // Balise ouvrante : le « > » final est cherché hors des valeurs d'attribut entre guillemets.
    let fin = debut + 1
    let guillemet = ''
    while (fin < xml.length) {
      const c = xml[fin]
      if (guillemet) {
        if (c === guillemet) guillemet = ''
      } else if (c === '"' || c === "'") guillemet = c
      else if (c === '>') break
      fin++
    }
    if (fin >= xml.length) throw new ErreurXml('Balise ouvrante non terminée')
    let contenu = xml.slice(debut + 1, fin)
    const vide = contenu.endsWith('/')
    if (vide) contenu = contenu.slice(0, -1)
    const nomComplet = contenu.match(/^[^\s/>="']+/)?.[0]
    if (!nomComplet) throw new ErreurXml('Nom de balise illisible')
    const deuxPoints = nomComplet.indexOf(':')
    const noeud: NoeudXml = {
      nom: deuxPoints === -1 ? nomComplet : nomComplet.slice(deuxPoints + 1),
      prefixe: deuxPoints === -1 ? null : nomComplet.slice(0, deuxPoints),
      attributs: lireAttributs(contenu.slice(nomComplet.length), nomComplet),
      enfants: [],
      texte: '',
    }
    if (pile.length) pile[pile.length - 1].noeud.enfants.push(noeud)
    else if (racine) throw new ErreurXml('Plusieurs éléments racine')
    else racine = noeud
    if (!vide) pile.push({ noeud, nomComplet })
    i = fin + 1
  }

  if (pile.length) throw new ErreurXml(`Balise <${pile[pile.length - 1].nomComplet}> non fermée`)
  if (!racine) throw new ErreurXml('Aucun élément racine')
  return racine
}

/** Premier enfant direct portant ce nom local (préfixe ignoré). */
export function enfant(n: NoeudXml | null | undefined, nom: string): NoeudXml | null {
  return n?.enfants.find((e) => e.nom === nom) ?? null
}

/** Enfants directs portant ce nom local (préfixe ignoré). */
export function enfantsNommes(n: NoeudXml | null | undefined, nom: string): NoeudXml[] {
  return n ? n.enfants.filter((e) => e.nom === nom) : []
}

/** Texte du premier enfant direct de ce nom, sans espaces de bord ; null s'il est absent ou vide. */
export function texteEnfant(n: NoeudXml | null | undefined, nom: string): string | null {
  const t = enfant(n, nom)?.texte.trim()
  return t ? t : null
}
