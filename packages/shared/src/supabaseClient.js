import { createClient } from '@supabase/supabase-js'

/**
 * Crée un client Supabase à partir des variables d'environnement Vite.
 * Chaque app (admin, qg, terrain, citoyen) appelle cette même factory
 * pour éviter toute divergence de configuration entre les 4 frontends.
 *
 * Attendu dans le .env de chaque app :
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 */
export function createSupabaseClient(env) {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans le .env de l\'app.'
    )
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}
