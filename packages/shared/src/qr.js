// Générateur de QR code minimal (mode octets, correction M, versions 1 à 10), sans dépendance.
// Sert à afficher et imprimer le QR d'un point d'accueil ; rien ne sort vers un service tiers.
// Référence : ISO/IEC 18004. Implémentation volontairement directe, vérifiée par décodage dans les tests.

const EC_CODEWORDS_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] // par bloc, niveau M, versions 1..10
const EC_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const ALIGNMENT = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

// GF(256) avec le polynôme 0x11d
const EXP = new Array(512)
const LOG = new Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function generateur(n) {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const suite = new Array(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      suite[j] ^= g[j]
      suite[j + 1] ^= mul(g[j], EXP[i])
    }
    g = suite
  }
  return g
}

function reedSolomon(data, n) {
  const g = generateur(n)
  const reste = new Array(n).fill(0)
  for (const d of data) {
    const facteur = d ^ reste[0]
    reste.shift()
    reste.push(0)
    if (facteur !== 0) for (let i = 0; i < n; i++) reste[i] ^= mul(g[i + 1], facteur)
  }
  return reste
}

function octets(texte) {
  return Array.from(new TextEncoder().encode(texte))
}

function choisirVersion(longueur) {
  for (let v = 1; v <= 10; v++) {
    const capacite = TOTAL_CODEWORDS[v] - EC_CODEWORDS_M[v] * EC_BLOCKS_M[v]
    const entete = v < 10 ? 2 : 2.5 // mode (4 bits) + longueur (8 ou 16 bits), en octets
    if (longueur + Math.ceil(entete) <= capacite) return v
  }
  return null
}

function encoder(texte) {
  const data = octets(texte)
  const version = choisirVersion(data.length)
  if (!version) throw new Error('Texte trop long pour un QR version 10')
  const nbBlocs = EC_BLOCKS_M[version]
  const nbEc = EC_CODEWORDS_M[version]
  const capacite = TOTAL_CODEWORDS[version] - nbEc * nbBlocs
  const bits = []
  const push = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }
  push(0b0100, 4)
  push(data.length, version < 10 ? 8 : 16)
  for (const d of data) push(d, 8)
  push(0, Math.min(4, capacite * 8 - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)
  const mots = []
  for (let i = 0; i < bits.length; i += 8) mots.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  const bourrage = [0xec, 0x11]
  for (let i = 0; mots.length < capacite; i++) mots.push(bourrage[i % 2])
  // Blocs : les premiers blocs peuvent être plus courts d'un mot
  const base = Math.floor(capacite / nbBlocs)
  const longs = capacite % nbBlocs
  const blocs = []
  let pos = 0
  for (let b = 0; b < nbBlocs; b++) {
    const taille = base + (b >= nbBlocs - longs ? 1 : 0)
    const d = mots.slice(pos, pos + taille)
    pos += taille
    blocs.push({ d, ec: reedSolomon(d, nbEc) })
  }
  const sortie = []
  const maxD = Math.max(...blocs.map((b) => b.d.length))
  for (let i = 0; i < maxD; i++) for (const b of blocs) if (i < b.d.length) sortie.push(b.d[i])
  for (let i = 0; i < nbEc; i++) for (const b of blocs) sortie.push(b.ec[i])
  return { version, mots: sortie }
}

function matrice(version) {
  const n = version * 4 + 17
  const m = Array.from({ length: n }, () => new Array(n).fill(null)) // null = libre
  const poser = (r, c, v) => {
    if (r >= 0 && r < n && c >= 0 && c < n) m[r][c] = v
  }
  const motif = (r0, c0) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const bord = r === -1 || r === 7 || c === -1 || c === 7
        const noir = !bord && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
        poser(r0 + r, c0 + c, bord ? 0 : noir ? 1 : 0)
      }
  }
  motif(0, 0)
  motif(0, n - 7)
  motif(n - 7, 0)
  const al = ALIGNMENT[version]
  const dernier = al.length - 1
  al.forEach((r, ri) =>
    al.forEach((c, ci) => {
      if ((ri === 0 && ci === 0) || (ri === 0 && ci === dernier) || (ri === dernier && ci === 0)) return
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) m[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) === 1 ? 0 : 1
    })
  )
  for (let i = 8; i < n - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0 ? 1 : 0
    if (m[i][6] === null) m[i][6] = i % 2 === 0 ? 1 : 0
  }
  // Information de version (à partir de la version 7) : 18 bits, deux copies
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const b = (bits >> i) & 1
      const a = n - 11 + (i % 3)
      const bb = Math.floor(i / 3)
      m[bb][a] = b
      m[a][bb] = b
    }
  }
  // Zones réservées au format (remplies après masquage)
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = 0
    if (m[i][8] === null) m[i][8] = 0
  }
  for (let i = n - 8; i < n; i++) {
    m[8][i] = 0
    m[i][8] = 0
  }
  m[n - 8][8] = 1 // module sombre
  return m
}

const MASQUES = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function placer(m, mots) {
  const n = m.length
  const reserve = m.map((l) => l.map((v) => v !== null))
  const bits = []
  for (const w of mots) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1)
  let k = 0
  let montee = true
  for (let col = n - 1; col > 0; col -= 2, montee = !montee) {
    if (col === 6) col--
    for (let i = 0; i < n; i++) {
      const r = montee ? n - 1 - i : i
      for (const c of [col, col - 1]) {
        if (!reserve[r][c]) {
          m[r][c] = bits[k++] ?? 0
        }
      }
    }
  }
  return reserve
}

function formatBits(masque) {
  const data = (0b00 << 3) | masque // niveau M = 00
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

function ecrireFormat(m, masque) {
  const n = m.length
  const f = formatBits(masque)
  const bit = (i) => (f >> i) & 1
  // Première copie, autour du motif haut-gauche (ligne, colonne)
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i)
  m[7][8] = bit(6)
  m[8][8] = bit(7)
  m[8][7] = bit(8)
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i)
  // Seconde copie : ligne 8 à droite, colonne 8 en bas
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i)
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i)
  m[n - 8][8] = 1
}

function penalite(m) {
  const n = m.length
  let p = 0
  for (let r = 0; r < n; r++) {
    let run = 1
    for (let c = 1; c < n; c++) {
      if (m[r][c] === m[r][c - 1]) {
        run++
        if (run === 5) p += 3
        else if (run > 5) p++
      } else run = 1
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 1
    for (let r = 1; r < n; r++) {
      if (m[r][c] === m[r - 1][c]) {
        run++
        if (run === 5) p += 3
        else if (run > 5) p++
      } else run = 1
    }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3
  const motif1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
  const motif2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n - 11; c++) {
      const l = m[r].slice(c, c + 11)
      const col = Array.from({ length: 11 }, (_, i) => m[c + i]?.[r])
      if (motif1.every((v, i) => v === l[i]) || motif2.every((v, i) => v === l[i])) p += 40
      if (c + 10 < n && (motif1.every((v, i) => v === col[i]) || motif2.every((v, i) => v === col[i]))) p += 40
    }
  let noirs = 0
  for (const l of m) for (const v of l) noirs += v
  const pct = (noirs * 100) / (n * n)
  p += Math.floor(Math.abs(pct - 50) / 5) * 10
  return p
}

/** Renvoie la matrice (tableau de lignes de 0/1) du QR encodant `texte`. */
export function matriceQr(texte) {
  const { version, mots } = encoder(texte)
  let meilleure = null
  let meilleurScore = Infinity
  for (let masque = 0; masque < 8; masque++) {
    const m = matrice(version)
    const reserve = placer(m, mots)
    const n = m.length
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!reserve[r][c] && MASQUES[masque](r, c)) m[r][c] ^= 1
    ecrireFormat(m, masque)
    const score = penalite(m)
    if (score < meilleurScore) {
      meilleurScore = score
      meilleure = m
    }
  }
  return meilleure
}

/** SVG (chaîne) du QR, avec marge de 4 modules. */
export function svgQr(texte, { taille = 200, couleur = '#000', fond = '#fff' } = {}) {
  const m = matriceQr(texte)
  const n = m.length
  const marge = 4
  const total = n + marge * 2
  const rects = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) rects.push(`M${c + marge} ${r + marge}h1v1h-1z`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${taille}" height="${taille}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="${fond}"/><path d="${rects.join('')}" fill="${couleur}"/></svg>`
}
