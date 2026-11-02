// =====================================================================
// ingestion-dossier-evenement
// ---------------------------------------------------------------------
// Briefing 03, partie B : réception du dossier de sécurité qu'un
// organisateur dépose dans Eventware (contrat du briefing 01) :
//   { source, type: 'dossier_securite',
//     evenement: { jeton_public, nom, commune, date_debut, date_fin, frequentation_max },
//     dossier: { reference, version, statut, niveau_dmp, lien_consultation, maj_le } }
//
// Même modèle qu'ingestion-alerte-externe : pas de JWT (l'appelant est un
// autre produit), secret partagé dans l'en-tête X-Diffusion-Secret, résolu
// vers une source jumelée (sources_externes_alertes) qui doit déclarer
// l'objet « dossier ». Tout le travail en base (rapprochement avec
// l'événement suivi, proposition d'un événement inconnu, idempotence par
// version) est fait par recevoir_dossier_evenement(), exécutable par la
// seule clé de service.
//
// Chaque appel est journalisé dans journal_ingestions_externes. Le lien
// de consultation porte un jeton d'accès : il est masqué dans la copie
// journalisée de la charge.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'x-diffusion-secret, content-type',
}

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...ENTETES_CORS, 'Content-Type': 'application/json' },
  })
}

// Copie de la charge sans le jeton d'accès du lien de consultation.
function chargeJournalisable(charge: any) {
  if (!charge || typeof charge !== 'object') return charge
  const copie = structuredClone(charge)
  if (copie?.dossier?.lien_consultation) copie.dossier.lien_consultation = '[masqué]'
  return copie
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ENTETES_CORS })
  if (req.method !== 'POST') return json({ erreur: 'Méthode non autorisée' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const journaliser = (ligne: Record<string, unknown>) =>
    supabase.from('journal_ingestions_externes').insert({ objet: 'dossier', ...ligne })

  const secret = req.headers.get('x-diffusion-secret')

  let charge: any = null
  try {
    charge = await req.json()
  } catch {
    await journaliser({ statut: 'rejete', motif_rejet: 'Corps de requête invalide (JSON attendu)' })
    return json({ erreur: 'Corps de requête invalide' }, 400)
  }

  if (!secret) {
    await journaliser({ statut: 'rejete', motif_rejet: 'En-tête X-Diffusion-Secret manquant', charge_recue: chargeJournalisable(charge) })
    return json({ erreur: 'Authentification manquante' }, 401)
  }

  const { data: source, error: erreurSource } = await supabase
    .from('sources_externes_alertes')
    .select('id, contexte_id, actif, objets')
    .eq('secret', secret)
    .is('deleted_at', null)
    .maybeSingle()

  if (erreurSource || !source || !source.actif) {
    await journaliser({ statut: 'rejete', motif_rejet: 'Secret inconnu, inactif ou supprimé', charge_recue: chargeJournalisable(charge) })
    return json({ erreur: 'Authentification refusée' }, 401)
  }
  if (!(source.objets ?? []).includes('dossier')) {
    await journaliser({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: 'rejete',
      motif_rejet: 'Source non autorisée pour les dossiers',
      charge_recue: chargeJournalisable(charge),
    })
    return json({ erreur: 'Source non autorisée pour les dossiers' }, 403)
  }

  const { data: resultat, error } = await supabase.rpc('recevoir_dossier_evenement', { p_source: source.id, p_charge: charge })
  if (error || !resultat) {
    await journaliser({
      source_externe_id: source.id,
      contexte_id: source.contexte_id,
      statut: 'rejete',
      motif_rejet: (error?.message ?? 'Échec de la réception').slice(0, 500),
      charge_recue: chargeJournalisable(charge),
    })
    return json({ erreur: 'Dossier refusé', detail: error?.message ?? null }, 400)
  }

  await journaliser({
    source_externe_id: source.id,
    contexte_id: source.contexte_id,
    statut: 'ok',
    charge_recue: chargeJournalisable(charge),
    dossier_id: resultat.dossier_id ?? null,
  })

  return json(resultat)
})
