import { createClient } from 'jsr:@supabase/supabase-js@2'

// Edge Function : invite un nouvel utilisateur (ou donne accès à un compte
// existant) sur un contexte donné. Nécessaire car la création/liaison d'un
// compte Auth exige la clé service_role, jamais exposée côté client.
// Appel attendu : POST { contexte_id, email, niveau_acces, role_id?, redirect_to? }
// avec le JWT de l'utilisateur appelant (verify_jwt=true) — ses droits
// admin sur ce contexte (ou super-admin de la plateforme, depuis la console
// Plateforme) sont vérifiés avant toute action.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reponseJson(corps: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(corps), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { contexte_id, email, niveau_acces, role_id, redirect_to } = await req.json()

    if (!contexte_id || !email || !niveau_acces) {
      return reponseJson({ error: 'contexte_id, email et niveau_acces sont requis' }, { status: 400 })
    }
    if (!['lecture', 'ecriture', 'admin'].includes(niveau_acces)) {
      return reponseJson({ error: 'niveau_acces invalide' }, { status: 400 })
    }

    // Client "utilisateur" : respecte la RLS, pour vérifier que l'appelant
    // a bien les droits admin sur le contexte visé (ou est super-admin)
    // avant d'utiliser la clé service_role ci-dessous.
    const supabaseUtilisateur = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: estAdmin, error: erreurAcces } = await supabaseUtilisateur.rpc('a_acces', {
      p_contexte_id: contexte_id,
      p_min: 'admin',
    })
    let autorise = !erreurAcces && estAdmin === true
    let parSuperAdmin = false
    if (!autorise) {
      const { data: estSuperAdmin, error: erreurSuperAdmin } = await supabaseUtilisateur.rpc('est_super_admin')
      autorise = parSuperAdmin = !erreurSuperAdmin && estSuperAdmin === true
    }
    if (!autorise) {
      return reponseJson({ error: 'Accès refusé : droits administrateur requis sur ce contexte' }, { status: 403 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let userId: string | null = null
    let inviteEnvoyee = false

    const { data: invitation, error: erreurInvitation } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      redirect_to ? { redirectTo: redirect_to } : undefined
    )

    if (invitation?.user) {
      userId = invitation.user.id
      inviteEnvoyee = true
    } else if (erreurInvitation) {
      const dejaInscrit = /already.*(registered|exists)/i.test(erreurInvitation.message ?? '')
      if (!dejaInscrit) {
        return reponseJson({ error: erreurInvitation.message }, { status: 400 })
      }
      // Compte déjà existant (ex. déjà accès à un autre contexte) : on le
      // retrouve pour lui donner accès ici aussi, sans ré-inviter.
      let page = 1
      while (!userId) {
        const { data: liste, error: erreurListe } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
        if (erreurListe || !liste || liste.users.length === 0) break
        const trouve = liste.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase())
        if (trouve) userId = trouve.id
        if (liste.users.length < 200) break
        page += 1
      }
      if (!userId) {
        return reponseJson({ error: "Compte existant introuvable (contacter l'administrateur Supabase)" }, { status: 404 })
      }
    }

    const { error: erreurUpsert } = await supabaseAdmin
      .from('acces_utilisateurs')
      .upsert(
        { user_id: userId, contexte_id, role_id: role_id || null, niveau_acces },
        { onConflict: 'user_id,contexte_id' }
      )

    if (erreurUpsert) {
      return reponseJson({ error: erreurUpsert.message }, { status: 500 })
    }

    // Trace dans le journal de la plateforme quand l'invitation vient de la console.
    if (parSuperAdmin) {
      const { data: appelant } = await supabaseUtilisateur.auth.getUser()
      const { data: contexte } = await supabaseAdmin.from('contextes').select('nom').eq('id', contexte_id).maybeSingle()
      await supabaseAdmin.from('journal_plateforme').insert({
        acteur_id: appelant?.user?.id ?? null,
        acteur_email: appelant?.user?.email ?? null,
        action: inviteEnvoyee ? 'utilisateur_invite' : 'acces_donne',
        cible_type: 'utilisateur',
        cible_id: userId,
        cible_libelle: `${email} → ${contexte?.nom ?? contexte_id}`,
        details: { user_id: userId, contexte_id, niveau_apres: niveau_acces, role_id: role_id || null },
      })
    }

    return reponseJson({ invite_envoyee: inviteEnvoyee, user_id: userId })
  } catch (e) {
    return reponseJson({ error: e instanceof Error ? e.message : 'Erreur inconnue' }, { status: 500 })
  }
})
