// =====================================================================
// ingestion-alerte-externe
// ---------------------------------------------------------------------
// Récepteur du pont Eventware -> Crisiware (§6 du briefing du
// 2026-10-04). Reçoit ce que la fonction diffuser-alerte d'Eventware
// envoie à un canal webhook : { source, evenement, alerte: { niveau,
// titre, message, consigne, emise_le } }.
//
// Pas de JWT Supabase ici — l'appelant est un autre produit, pas un
// utilisateur connecté. L'authentification se fait par secret partagé
// (en-tête X-Diffusion-Secret, même convention qu'Eventware utilise
// pour ses propres canaux sortants), résolu vers un contexte précis via
// sources_externes_alertes. Tourne avec la clé de service : c'est ce
// pairage, pas une session utilisateur, qui autorise l'écriture.
//
// Briefing 03, A1 (décision de Ren du 2026-11-02) : l'alerte reçue n'est
// jamais publiée d'office. Elle est enregistrée inactive, « à valider » ;
// la commune la publie ou la rejette (valider_alerte_recue). La base
// l'impose de toute façon (alertes_publiques_garde_fous) : la version v1
// déployée, qui envoyait actif = true, est déjà neutralisée par la
// migration b03a.
//
// Briefing 03, D (exercice conjoint) : une charge portant « exercice.code »
// n'est acceptée que par une source d'exercice du même exercice, et part
// vers recevoir_alerte_exercice() (livre de bord de l'incident d'exercice
// et chronologie de l'exercice), jamais vers alertes_publiques. Une source
// d'exercice refuse une charge non marquée (E3, E4 ; la base les impose
// aussi).
//
// Chaque appel est journalisé (accepté ou rejeté) dans
// journal_ingestions_externes, pour pouvoir diagnostiquer un pairage
// mal configuré sans dépendre des logs de la fonction.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'x-diffusion-secret, content-type',
}

// Eventware connaît 4 niveaux (information, vigilance, urgence,
// evacuation) ; Crisiware n'en retient que 3 (info, vigilance,
// urgence). 'evacuation' est le plus grave côté Eventware : il se
// ramène au plus grave côté Crisiware plutôt que d'être rejeté ou
// dilué. Le niveau d'origine reste tracé dans niveau_externe_origine.
const CORRESPONDANCE_NIVEAUX: Record<string, string> = {
  information: 'info',
  vigilance: 'vigilance',
  urgence: 'urgence',
  evacuation: 'urgence',
}

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...ENTETES_CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ENTETES_CORS })
  if (req.method !== 'POST') return json({ erreur: 'Méthode non autorisée' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const secret = req.headers.get('x-diffusion-secret') ?? req.headers.get('X-Diffusion-Secret')

  let charge: any = null
  try {
    charge = await req.json()
  } catch {
    // On journalise même une charge illisible, sans source résolue.
    await supabase.from('journal_ingestions_externes').insert({
      statut: 'rejete',
      motif_rejet: 'Corps de requête invalide (JSON attendu)',
    })
    return json({ erreur: 'Corps de requête invalide' }, 400)
  }

  if (!secret) {
    await supabase.from('journal_ingestions_externes').insert({
      statut: 'rejete',
      motif_rejet: 'En-tête X-Diffusion-Secret manquant',
      charge_recue: charge,
    })
    return json({ erreur: 'Authentification manquante' }, 401)
  }

  const { data: source, error: erreurSource } = await supabase
    .from('sources_externes_alertes')
    .select('id, contexte_id, actif, deleted_at, objets, est_exercice')
    .eq('secret', secret)
    .is('deleted_at', null)
    .maybeSingle()

  if (erreurSource || !source || !source.actif) {
    await supabase.from('journal_ingestions_externes').insert({
      statut: 'rejete',
      motif_rejet: 'Secret inconnu, inactif ou supprimé',
      charge_recue: charge,
    })
    return json({ erreur: 'Authentification refusée' }, 401)
  }

  if (!(source.objets ?? ['alerte']).includes('alerte')) {
    await supabase.from('journal_ingestions_externes').insert({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: 'rejete',
      motif_rejet: 'Source non autorisée pour les alertes',
      charge_recue: charge,
    })
    return json({ erreur: 'Source non autorisée pour les alertes' }, 403)
  }

  // E4 : une source réelle refuse une charge d'exercice, une source d'exercice une charge réelle.
  const marqueeExercice = Boolean(charge?.exercice?.code)
  if (marqueeExercice !== Boolean(source.est_exercice)) {
    await supabase.from('journal_ingestions_externes').insert({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: 'rejete',
      motif_rejet: marqueeExercice
        ? 'Charge marquée exercice reçue par une source réelle'
        : 'Charge non marquée exercice reçue par une source d\'exercice',
      charge_recue: charge,
    })
    return json({ erreur: 'Charge refusée : exercice et réel ne se mélangent pas' }, 409)
  }

  if (marqueeExercice) {
    const { data: recu, error } = await supabase.rpc('recevoir_alerte_exercice', { p_source: source.id, p_charge: charge })
    await supabase.from('journal_ingestions_externes').insert({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: error ? 'rejete' : 'ok',
      motif_rejet: error ? error.message.slice(0, 500) : null,
      charge_recue: charge,
    })
    if (error) return json({ erreur: 'Alerte d\'exercice refusée', detail: error.message }, 400)
    return json({ ...recu, exercice: true })
  }

  const alerte = charge?.alerte
  if (!alerte?.titre || !alerte?.message) {
    await supabase.from('journal_ingestions_externes').insert({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: 'rejete',
      motif_rejet: 'Champs alerte.titre / alerte.message manquants',
      charge_recue: charge,
    })
    return json({ erreur: 'Charge invalide : titre et message requis' }, 400)
  }

  const niveauOrigine: string | undefined = alerte.niveau
  const niveauInterne = CORRESPONDANCE_NIVEAUX[niveauOrigine ?? ''] ?? 'info'

  const { data: alerteRecue, error: erreurInsertion } = await supabase
    .from('alertes_publiques')
    .insert({
      contexte_id: source.contexte_id,
      titre: alerte.titre,
      message: alerte.message,
      consignes: alerte.consigne ?? null,
      niveau_alerte: niveauInterne,
      niveau_externe_origine: niveauOrigine ?? null,
      zone_concernee: charge?.evenement ?? null,
      // A1 : jamais publiée d'office, la commune valide (la base l'impose aussi).
      actif: false,
      date_publication: alerte.emise_le ?? new Date().toISOString(),
      provenance: 'externe',
      source_externe_id: source.id,
    })
    .select('id')
    .single()

  if (erreurInsertion || !alerteRecue) {
    await supabase.from('journal_ingestions_externes').insert({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: 'rejete',
      motif_rejet: erreurInsertion?.message ?? 'Échec insertion alerte',
      charge_recue: charge,
    })
    return json({ erreur: 'Échec de création de l\'alerte' }, 500)
  }

  await supabase.from('journal_ingestions_externes').insert({
    source_externe_id: source.id,
    contexte_id: source.contexte_id,
    statut: 'ok',
    charge_recue: charge,
    alerte_publique_id: alerteRecue.id,
  })

  return json({ alerte_id: alerteRecue.id, niveau_retenu: niveauInterne, statut: 'a_valider' })
})
