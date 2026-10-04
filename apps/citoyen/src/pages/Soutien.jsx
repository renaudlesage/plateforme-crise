import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'

export default function Soutien() {
  const contexteId = localStorage.getItem(STORAGE_KEY_CONTEXTE) || ''
  const [ressources, setRessources] = useState([])
  const [ressourcesPsychoeducatives, setRessourcesPsychoeducatives] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (!contexteId) {
      setChargement(false)
      return
    }
    Promise.all([
      supabase
        .from('annuaire_soutien_psychologique')
        .select('*')
        .eq('actif', true)
        .or(`contexte_id.is.null,contexte_id.eq.${contexteId}`)
        .order('ordre_affichage'),
      supabase.from('ressources_psychoeducatives').select('*'),
    ]).then(([r, rp]) => {
      if (r.error) setErreur(r.error.message)
      else setRessources(r.data ?? [])
      setRessourcesPsychoeducatives(rp.data ?? [])
      setChargement(false)
    })
  }, [contexteId])

  if (!contexteId) return <Navigate to="/" replace />

  return (
    <div className="participant">
      <div className="bandeau">
        <Link to="/" className="lien">← retour</Link>
      </div>

      <h1 className="text-lg font-semibold text-encre mb-1">Besoin d'en parler ?</h1>
      <p className="text-sm text-sourdine mb-5">
        Une crise peut être éprouvante, pour vous ou pour vos proches. Ces lignes d'écoute
        sont gratuites, anonymes et disponibles en dehors de toute crise déclarée.
      </p>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : erreur ? (
        <p className="message erreur">{erreur}</p>
      ) : ressources.length === 0 ? (
        <p className="vide">Aucune ressource disponible pour l'instant.</p>
      ) : (
        <ul className="space-y-3">
          {ressources.map((r) => (
            <li key={r.id} className="border border-trait rounded p-3 bg-fond">
              <p className="text-base font-medium text-encre">
                {r.nom} <span className="jeton ml-1">{r.numero_telephone}</span>
              </p>
              {r.description && <p className="text-sm text-sourdine mt-1">{r.description}</p>}
              <p className="text-xs text-sourdine mt-1">
                {r.public_cible && <>{r.public_cible}</>}
                {r.public_cible && r.disponibilite && <> · </>}
                {r.disponibilite && <>{r.disponibilite}</>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {ressourcesPsychoeducatives.filter((r) => r.public_cible !== 'intervenant').length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-encre">
            Comment réagir après un événement difficile
          </p>
          {ressourcesPsychoeducatives
            .filter((r) => r.public_cible !== 'intervenant')
            .map((r) => (
              <div key={r.id} className="border border-trait rounded p-3 bg-fond">
                <p className="text-sm font-medium text-encre mb-1">{r.titre}</p>
                <ul className="list-disc list-inside text-sm text-sourdine space-y-1">
                  {(r.contenu ?? []).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
                {r.source && <p className="text-xs text-sourdine mt-2">Source : {r.source}</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
