import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BasculeTheme from '../components/BasculeTheme'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'

const NIVEAUX = {
  info: { libelle: 'Information', classe: 'niv-information' },
  vigilance: { libelle: 'Vigilance', classe: 'niv-vigilance' },
  urgence: { libelle: 'Urgence', classe: 'niv-urgence' },
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
      <div className="participant">
        <h1 className="text-xl font-semibold text-encre text-center mb-1">
          Alertes et informations
        </h1>
        <p className="text-sm text-sourdine text-center mb-6">
          Sélectionnez votre commune pour voir les alertes en cours.
        </p>

        {chargementContextes ? (
          <p className="vide text-center">Chargement…</p>
        ) : contextes.length === 0 ? (
          <p className="vide text-center">Aucune commune disponible pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {contextes.map((c) => (
              <button key={c.id} onClick={() => choisirContexte(c.id)} className="bouton-terrain discret">
                {c.nom}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="participant">
      <div className="bandeau">
        <span className="text-sm font-medium text-encre">{contexteActuel?.nom ?? '…'}</span>
        <div className="flex items-center gap-3">
          <Link to="/benevole" className="lien">
            Devenir bénévole
          </Link>
          <button type="button" className="lien" onClick={changerDeCommune}>
            Changer de commune
          </button>
          <BasculeTheme />
        </div>
      </div>

      <ListeAlertes contexteId={contexteId} />
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

  if (chargement) return <p className="vide text-center mt-10">Chargement…</p>

  if (erreur) return <p className="message erreur text-center mt-10">{erreur}</p>

  if (alertes.length === 0) {
    return (
      <div className="text-center mt-10">
        <p className="text-2xl mb-2">✅</p>
        <p className="vide">Aucune alerte en cours pour cette commune.</p>
      </div>
    )
  }

  return (
    <div className="bandeaux">
      {alertes.map((a) => {
        const niveau = NIVEAUX[a.niveau_alerte] ?? NIVEAUX.info
        return (
          <div key={a.id} className={`bandeau-alerte ${niveau.classe}`}>
            <div className="niv">{niveau.libelle}</div>
            <div className="contenu">
              <p className="text-base font-medium">{a.titre}</p>
              <p className="msg">{a.message}</p>
              {a.consignes && <p className="consigne">Consignes : {a.consignes}</p>}
              {a.zone_concernee && <p className="meta">Zone concernée : {a.zone_concernee}</p>}
              <p className="meta">publié le {new Date(a.date_publication).toLocaleString('fr-BE')}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
