import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'

const NIVEAUX = {
  info: { libelle: 'Information', classe: 'bg-slate-100 text-slate-700 border-slate-200' },
  vigilance: { libelle: 'Vigilance', classe: 'bg-amber-50 text-amber-800 border-amber-200' },
  urgence: { libelle: 'Urgence', classe: 'bg-red-50 text-red-800 border-red-300' },
}

export default function Accueil() {
  const [contexteId, setContexteId] = useState(() => localStorage.getItem(STORAGE_KEY_CONTEXTE) || '')
  const [contextes, setContextes] = useState([])
  const [chargementContextes, setChargementContextes] = useState(true)

  useEffect(() => {
    supabase.rpc('contextes_publics').then(({ data, error }) => {
      if (!error) setContextes(data ?? [])
      setChargementContextes(false)
    })
  }, [])

  function choisirContexte(id) {
    setContexteId(id)
    localStorage.setItem(STORAGE_KEY_CONTEXTE, id)
  }

  function changerDeCommune() {
    setContexteId('')
    localStorage.removeItem(STORAGE_KEY_CONTEXTE)
  }

  const contexteActuel = contextes.find((c) => c.id === contexteId)

  if (!contexteId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-slate-900 text-center mb-1">
            Alertes et informations
          </h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Sélectionnez votre commune pour voir les alertes en cours.
          </p>

          {chargementContextes ? (
            <p className="text-sm text-slate-400 text-center">Chargement…</p>
          ) : contextes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center">Aucune commune disponible pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {contextes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => choisirContexte(c.id)}
                  className="w-full text-left bg-white border border-slate-200 rounded-lg px-4 py-4 text-base font-medium text-slate-900 active:bg-slate-100"
                >
                  {c.nom}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-sm font-medium text-slate-900">{contexteActuel?.nom ?? '…'}</span>
        <div className="flex items-center gap-3">
          <Link to="/benevole" className="text-xs text-slate-600 underline">
            Devenir bénévole
          </Link>
          <button onClick={changerDeCommune} className="text-xs text-slate-500">
            Changer de commune
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <ListeAlertes contexteId={contexteId} />
      </main>
    </div>
  )
}

function ListeAlertes({ contexteId }) {
  const [alertes, setAlertes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('alertes_publiques')
      .select('*')
      .eq('contexte_id', contexteId)
      .eq('actif', true)
      .order('date_publication', { ascending: false })
    if (error) setErreur(error.message)
    else setAlertes(data ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
    // Rafraîchissement automatique toutes les 60 secondes
    const intervalle = setInterval(charger, 60000)
    return () => clearInterval(intervalle)
  }, [charger])

  if (chargement) return <p className="text-sm text-slate-400 text-center mt-10">Chargement…</p>

  if (erreur) return <p className="text-sm text-red-600 text-center mt-10">{erreur}</p>

  if (alertes.length === 0) {
    return (
      <div className="text-center mt-10">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-sm text-slate-500">Aucune alerte en cours pour cette commune.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {alertes.map((a) => {
        const niveau = NIVEAUX[a.niveau_alerte] ?? NIVEAUX.info
        return (
          <li key={a.id} className={`rounded-lg border p-4 ${niveau.classe}`}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1">{niveau.libelle}</p>
            <p className="text-base font-medium">{a.titre}</p>
            <p className="text-sm mt-1">{a.message}</p>
            {a.consignes && (
              <p className="text-sm mt-2 font-medium">Consignes : {a.consignes}</p>
            )}
            {a.zone_concernee && (
              <p className="text-xs mt-2 opacity-75">Zone concernée : {a.zone_concernee}</p>
            )}
            <p className="text-xs mt-2 opacity-60">
              publié le {new Date(a.date_publication).toLocaleString('fr-BE')}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
