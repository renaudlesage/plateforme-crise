import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACTIONS_JOURNAL, dateHeure } from '../lib/libelles'

/**
 * Entrées du journal de la plateforme (ajout seul, écrit par les fonctions
 * plateforme_* et par inviter-membre). `cibleId` restreint à un client ou un
 * utilisateur ; `cle` force un rechargement après une action.
 */
export default function ListeJournal({ limite = 50, cibleId = null, cle = 0, vide = 'Aucune action enregistrée.' }) {
  const [entrees, setEntrees] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('plateforme_journal', { p_limite: limite, p_cible_id: cibleId })
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setEntrees(data ?? [])
    }
    setChargement(false)
  }, [limite, cibleId])

  useEffect(() => {
    charger()
  }, [charger, cle])

  if (chargement) return <p className="text-sm text-sourdine">Chargement…</p>
  if (erreur) return <p className="text-sm text-chaud">{erreur}</p>
  if (entrees.length === 0) {
    return <p className="vide border border-dashed border-trait text-center p-4">{vide}</p>
  }

  return (
    <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
      {entrees.map((e) => (
        <li key={e.id} className="px-4 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm text-encre">
              <strong>{ACTIONS_JOURNAL[e.action] ?? e.action}</strong>
              {e.cible_libelle && <span> · {e.cible_libelle}</span>}
            </p>
            <p className="text-xs text-sourdine font-mono">{dateHeure(e.created_at)}</p>
          </div>
          <p className="text-xs text-sourdine mt-0.5">
            par {e.acteur_email ?? 'inconnu'}
            {resume(e) && <> · {resume(e)}</>}
          </p>
        </li>
      ))}
    </ul>
  )
}

function resume(e) {
  const d = e.details ?? {}
  if (d.niveau_avant && d.niveau_apres) return `${d.niveau_avant} → ${d.niveau_apres}`
  if (d.niveau_apres) return `niveau ${d.niveau_apres}`
  if (d.niveau) return `niveau ${d.niveau}`
  if (d.motif) return `motif : ${d.motif}`
  if (d.avant && d.apres && d.avant.nom !== d.apres.nom) return `ancien nom : ${d.avant.nom}`
  return null
}
