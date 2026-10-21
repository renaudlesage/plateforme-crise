// =====================================================================
// irm-vigilance (Crisiware)
// Relaie l'avertissement météo OFFICIEL belge. L'IRM n'a pas d'API publique
// gratuite ; Meteoalarm (portail européen qui agrège les services météo
// nationaux, dont l'IRM) expose un flux Atom ouvert (CC BY 4.0).
//
// Appelé côté serveur : le flux Meteoalarm n'autorise pas le CORS depuis un
// navigateur. Cette fonction autorise, elle, le navigateur à lire sa réponse
// (réponse à OPTIONS comprise).
//
// Ne remplace PAS les seuils propres à la commune : l'avertissement officiel
// porte sur une province entière.
// Entrée : GET ?province=Liège  ou  POST {"province":"Liège"}
// =====================================================================

const URL_FLUX = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium'
const URL_PORTAIL = 'https://meteoalarm.org/en/live/country/belgium'
const DUREE_CACHE_MS = 5 * 60 * 1000

const RANG: Record<string, number> = { vert: 0, jaune: 1, orange: 2, rouge: 3 }
const COULEUR_VERS_NIVEAU: Record<string, string> = {
  green: 'vert', yellow: 'jaune', orange: 'orange', red: 'rouge',
}

// Le nom de zone du flux peut être en français, néerlandais ou anglais : on accepte les trois.
const ALIAS_PROVINCES: Record<string, string[]> = {
  'anvers': ['anvers', 'antwerp', 'antwerpen'],
  'brabant flamand': ['brabant flamand', 'flemish brabant', 'vlaams-brabant', 'vlaams brabant'],
  'brabant wallon': ['brabant wallon', 'walloon brabant', 'waals-brabant', 'waals brabant'],
  'bruxelles-capitale': ['bruxelles', 'brussels', 'brussel'],
  'flandre-occidentale': ['flandre-occidentale', 'flandre occidentale', 'west flanders', 'west-vlaanderen', 'west vlaanderen'],
  'flandre-orientale': ['flandre-orientale', 'flandre orientale', 'east flanders', 'oost-vlaanderen', 'oost vlaanderen'],
  'hainaut': ['hainaut', 'hainault', 'henegouwen'],
  'liège': ['liège', 'liege', 'luik'],
  'limbourg': ['limbourg', 'limburg'],
  'luxembourg': ['luxembourg', 'luxemburg'],
  'namur': ['namur', 'namen'],
}

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sansAccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function extraireEntre(bloc: string, balise: string): string | null {
  const m = bloc.match(new RegExp(`<${balise}[^>]*>([\\s\\S]*?)<\\/${balise}>`))
  return m ? m[1].trim() : null
}

let cache: { xml: string; le: number } | null = null

async function lireFlux(): Promise<string> {
  if (cache && Date.now() - cache.le < DUREE_CACHE_MS) return cache.xml
  const reponse = await fetch(URL_FLUX)
  if (!reponse.ok) throw new Error(`Flux inaccessible (HTTP ${reponse.status})`)
  const xml = await reponse.text()
  cache = { xml, le: Date.now() }
  return xml
}

function json(corps: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...ENTETES_CORS, 'Content-Type': 'application/json', ...extra },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ENTETES_CORS })

  let province = new URL(req.url).searchParams.get('province') ?? ''
  if (!province && req.method === 'POST') {
    try {
      province = String((await req.json())?.province ?? '')
    } catch (_e) { /* corps absent ou invalide : on traite comme sans province */ }
  }
  province = province.trim()

  let xml: string
  try {
    xml = await lireFlux()
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : String(e), lien: URL_PORTAIL }, 502)
  }

  const blocs = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
  const tous = blocs.map((bloc) => {
    const titre = extraireEntre(bloc, 'title') ?? ''
    const mCouleur = titre.match(/^(Green|Yellow|Orange|Red)/i)
    const lienMatch = bloc.match(/<link title="([^"]*)" href="([^"]*)" hreflang="en"\/>/)
    return {
      zone: extraireEntre(bloc, 'cap:areaDesc') ?? lienMatch?.[1] ?? 'Zone inconnue',
      evenement: extraireEntre(bloc, 'cap:event') ?? titre,
      niveau: mCouleur ? COULEUR_VERS_NIVEAU[mCouleur[1].toLowerCase()] : 'vert',
      expire_le: extraireEntre(bloc, 'cap:expires'),
      debut_le: extraireEntre(bloc, 'cap:onset'),
      lien: lienMatch?.[2] ?? URL_PORTAIL,
    }
  })

  const cle = sansAccent(province)
  const alias = (ALIAS_PROVINCES[province.toLowerCase()] ?? ALIAS_PROVINCES[cle] ?? [province]).map(sansAccent)
  const pertinents = province
    ? tous.filter((a) => alias.some((x) => x && sansAccent(a.zone).includes(x)))
    : tous

  const pire = pertinents.reduce((acc, a) => (RANG[a.niveau] > RANG[acc] ? a.niveau : acc), 'vert')

  return json(
    {
      province: province || null,
      niveau: pire,
      avertissements: pertinents,
      total_pays: tous.length,
      zones_vues: [...new Set(tous.map((a) => a.zone))].slice(0, 40),
      lien: URL_PORTAIL,
      consulte_le: new Date().toISOString(),
    },
    200,
    { 'Cache-Control': 'public, max-age=300' },
  )
})
