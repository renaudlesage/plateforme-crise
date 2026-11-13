// =====================================================================
// ingest-meteoalarm — Crisiware, chantier C1 (réveil automatique)
// ---------------------------------------------------------------------
// Lit le flux Atom MeteoAlarm de la Belgique (avertissements de l'IRM),
// puis chaque message CAP pas encore connu, et les enregistre dans
// alertes_externes (source « meteoalarm », une ligne par segment).
// L'enregistrement passe par meteoalarm_ingerer() : le lot est inséré
// d'un bloc, puis le moteur de réveil ne traite que le dernier message de
// chaque fil, s'il n'est pas expiré (un message ancien ou déjà remplacé
// ne réveille personne).
//
// Appel : par la tâche pg_cron ingest_meteoalarm (toutes les 10 minutes),
// sans jeton. N'importe qui peut l'appeler, mais meteoalarm_reserver()
// refuse un second passage moins de 4 minutes après le précédent : un
// appel en trop ne peut ni écrire autre chose que le flux officiel, ni
// faire interroger MeteoAlarm plus souvent.
// Aucun secret, aucune donnée personnelle : rien à masquer dans les
// journaux. État du passage dans jobs_etat (jobs_signaler).
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { lignesAlerteExterne, lireCap } from '../_shared/cap.ts'
import { URL_FLUX_BELGIQUE, entreesFlux } from '../_shared/meteoalarm.ts'

const TACHE = 'ingest_meteoalarm'
const MAX_MESSAGES_PAR_PASSAGE = 60
const DELAI_MS = 20_000
const TAILLE_MAX = 5_000_000

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
}

async function lire(url: string): Promise<string> {
  const controleur = new AbortController()
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS)
  try {
    const r = await fetch(url, {
      signal: controleur.signal,
      headers: { Accept: 'application/atom+xml, application/xml, text/xml', 'User-Agent': 'plateforme-crise-ingestion/1.0' },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status} sur ${new URL(url).pathname}`)
    const texte = await r.text()
    if (texte.length > TAILLE_MAX) throw new Error('Réponse trop volumineuse')
    return texte
  } finally {
    clearTimeout(minuterie)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ erreur: 'Méthode non autorisée' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: reserve, error: erreurReserve } = await supabase.rpc('meteoalarm_reserver')
  if (erreurReserve) return json({ erreur: 'Réservation impossible' }, 500)
  if (!reserve) return json({ ignore: 'Passage trop rapproché du précédent' }, 429)

  try {
    const { entrees, ecartees } = entreesFlux(await lire(URL_FLUX_BELGIQUE))

    const identifiants = entrees.map((e) => e.identifiant)
    const connus = new Set<string>()
    for (let i = 0; i < identifiants.length; i += 100) {
      const { data, error } = await supabase
        .from('alertes_externes')
        .select('identifiant')
        .eq('source', 'meteoalarm')
        .in('identifiant', identifiants.slice(i, i + 100))
      if (error) throw new Error(`Lecture des messages connus : ${error.message}`)
      for (const l of data ?? []) connus.add(l.identifiant)
    }
    const nouveaux = entrees.filter((e) => !connus.has(e.identifiant))
    const aLire = nouveaux.slice(0, MAX_MESSAGES_PAR_PASSAGE)

    const lignes: Record<string, unknown>[] = []
    const problemes: string[] = []
    for (const e of aLire) {
      try {
        const xml = await lire(e.lien)
        const alerte = lireCap(xml)
        if (alerte.identifiant !== e.identifiant) throw new Error('identifiant différent de celui du flux')
        const { lignes: l, ecartes } = lignesAlerteExterne(alerte, 'meteoalarm')
        problemes.push(...ecartes.map((x) => `${e.identifiant} : ${x}`))
        for (const ligne of l) lignes.push({ ...ligne, cap_brut: xml })
      } catch (err) {
        // Message illisible ou injoignable : il sera retenté au passage suivant.
        problemes.push(`${e.identifiant} : ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    let bilan: unknown = { inseres: 0 }
    if (lignes.length) {
      const { data, error } = await supabase.rpc('meteoalarm_ingerer', { p_lignes: lignes })
      if (error) throw new Error(`Enregistrement : ${error.message}`)
      bilan = data
    }

    // Le flux a été lu : succès, même si un message isolé a échoué (il sera retenté).
    await supabase.rpc('jobs_signaler', { p_nom: TACHE, p_succes: true })
    return json({
      entrees: entrees.length,
      ecartees,
      nouvelles: nouveaux.length,
      lues: aLire.length,
      reportees: nouveaux.length - aLire.length,
      problemes: problemes.slice(0, 20),
      bilan,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.rpc('jobs_signaler', { p_nom: TACHE, p_succes: false, p_erreur: message.slice(0, 500) })
    return json({ erreur: message }, 502)
  }
})
