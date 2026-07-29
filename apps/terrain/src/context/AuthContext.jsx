import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const STORAGE_KEY_CONTEXTE = 'pcops_contexte_id_selectionne'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [chargementSession, setChargementSession] = useState(true)

  // Liste des contextes auxquels l'utilisateur a accès, avec son niveau
  const [acces, setAcces] = useState([])
  const [chargementAcces, setChargementAcces] = useState(false)

  const [contexteId, setContexteId] = useState(
    () => localStorage.getItem(STORAGE_KEY_CONTEXTE) || null
  )

  // --- Session Supabase ---
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

  // --- Accès de l'utilisateur (quels contextes, quel niveau) ---
  const rafraichirAcces = useCallback(async () => {
    if (!session?.user) {
      setAcces([])
      return
    }
    setChargementAcces(true)
    const { data, error } = await supabase
      .from('acces_utilisateurs')
      .select('contexte_id, niveau_acces, role_id, contextes(id, nom, type)')
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Erreur chargement des accès :', error)
      setAcces([])
    } else {
      setAcces(data ?? [])
    }
    setChargementAcces(false)
  }, [session?.user])

  useEffect(() => {
    rafraichirAcces()
  }, [rafraichirAcces])

  // Si le contexte sélectionné en storage n'est plus dans la liste d'accès
  // (changement de compte, accès révoqué...), on le réinitialise.
  useEffect(() => {
    if (!chargementAcces && contexteId && acces.length > 0) {
      const toujoursValide = acces.some((a) => a.contexte_id === contexteId)
      if (!toujoursValide) {
        selectionnerContexte(null)
      }
    }
  }, [acces, chargementAcces]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectionnerContexte(id) {
    setContexteId(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY_CONTEXTE, id)
    } else {
      localStorage.removeItem(STORAGE_KEY_CONTEXTE)
    }
  }

  async function connexion(email, motDePasse) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    })
    return { error }
  }

  async function deconnexion() {
    await supabase.auth.signOut()
    selectionnerContexte(null)
  }

  const contexteActuel = acces.find((a) => a.contexte_id === contexteId) ?? null

  const valeur = {
    session,
    utilisateur: session?.user ?? null,
    chargementSession,
    acces,
    chargementAcces,
    contexteId,
    contexteActuel,
    selectionnerContexte,
    connexion,
    deconnexion,
    rafraichirAcces,
  }

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>')
  return ctx
}
