import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook générique pour les tables de configuration (roles, niveaux_escalade,
 * disciplines...) qui partagent toutes le même pattern : scope par
 * contexte_id, CRUD simple, tri par un champ donné.
 */
export function useTableContexte(nomTable, contexteId, { colonnes = '*', tri = null } = {}) {
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    let requete = supabase.from(nomTable).select(colonnes).eq('contexte_id', contexteId)
    if (tri) requete = requete.order(tri, { ascending: true })

    const { data, error } = await requete
    if (error) {
      setErreur(error.message)
      setLignes([])
    } else {
      setLignes(data ?? [])
    }
    setChargement(false)
  }, [nomTable, contexteId, colonnes, tri])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase
      .from(nomTable)
      .insert({ ...valeurs, contexte_id: contexteId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(id, valeurs) {
    const { error } = await supabase.from(nomTable).update(valeurs).eq('id', id)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function supprimer(id) {
    const { error } = await supabase.from(nomTable).delete().eq('id', id)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  return { lignes, chargement, erreur, rafraichir, creer, modifier, supprimer }
}
