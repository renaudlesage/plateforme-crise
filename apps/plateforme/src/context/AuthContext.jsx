import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Console Plateforme : pas de sélection de contexte. Seule compte la qualité
// de super-admin (admin du contexte « plateforme »), revérifiée côté base par
// chaque fonction plateforme_*.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [chargementSession, setChargementSession] = useState(true)
  const [estSuperAdmin, setEstSuperAdmin] = useState(false)
  // Faux tant que la base n'a pas répondu : évite d'afficher « accès refusé » pendant le chargement.
  const [superAdminVerifie, setSuperAdminVerifie] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChargementSession(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nouvelleSession) => {
      setSession(nouvelleSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setEstSuperAdmin(false)
      setSuperAdminVerifie(false)
      return
    }
    setSuperAdminVerifie(false)
    supabase.rpc('est_super_admin').then(({ data, error }) => {
      setEstSuperAdmin(!error && data === true)
      setSuperAdminVerifie(true)
    })
  }, [session?.user?.id])

  async function connexion(email, motDePasse) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    return { error }
  }

  async function deconnexion() {
    await supabase.auth.signOut()
  }

  const valeur = {
    session,
    utilisateur: session?.user ?? null,
    chargementSession,
    estSuperAdmin,
    superAdminVerifie,
    connexion,
    deconnexion,
  }

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>')
  return ctx
}
