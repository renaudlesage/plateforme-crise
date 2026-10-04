import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const TYPES_CLIENT = [
  { valeur: 'commune', libelle: 'Commune' },
  { valeur: 'province', libelle: 'Province' },
  { valeur: 'federal', libelle: 'Fédéral' },
  { valeur: 'evenement', libelle: 'Événement' },
  { valeur: 'entite_critique', libelle: 'Entité critique (CER)' },
  { valeur: 'autre', libelle: 'Autre' },
]

export default function Clients() {
  const { selectionnerContexte } = useAuth()
  const navigate = useNavigate()

  const [clients, setClients] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [renommage, setRenommage] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase.rpc('lister_clients')
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setClients(data ?? [])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { data, error } = await supabase.rpc('creer_client', {
      p_type: valeurs.type,
      p_nom: valeurs.nom,
    })
    if (error) return { error }
    setEnAjout(false)
    await rafraichir()
    return { data }
  }

  async function renommer(id, nom) {
    const { error } = await supabase.rpc('renommer_client', { p_contexte_id: id, p_nom: nom })
    if (error) setErreur(error.message)
    else {
      setRenommage(null)
      await rafraichir()
    }
  }

  function gererLesComptes(id) {
    selectionnerContexte(id)
    navigate('/comptes')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Clients</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Nouveau client</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Communes, provinces, entités critiques ou événements abonnés à la plateforme. La création
        d'un client vous y rattache automatiquement comme administrateur, le temps d'y inviter le
        véritable administrateur via la page Comptes.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireClient onAnnuler={() => setEnAjout(false)} onValider={creer} />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : clients.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun client pour l'instant.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 bg-surface gap-3">
              <div className="min-w-0">
                {renommage === c.id ? (
                  <FormulaireRenommage
                    nomInitial={c.nom}
                    onAnnuler={() => setRenommage(null)}
                    onValider={(nom) => renommer(c.id, nom)}
                  />
                ) : (
                  <>
                    <p className="text-sm font-medium text-encre truncate">
                      {c.nom}
                      {c.est_plateforme && <span className="jeton ml-2 text-info">plateforme</span>}
                    </p>
                    <p className="text-xs text-sourdine">
                      {TYPES_CLIENT.find((t) => t.valeur === c.type)?.libelle ?? c.type} ·{' '}
                      {c.nb_membres} compte{c.nb_membres === 1 ? '' : 's'}
                    </p>
                  </>
                )}
              </div>
              {renommage !== c.id && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <BoutonDiscret onClick={() => setRenommage(c.id)}>Renommer</BoutonDiscret>
                  <BoutonDiscret onClick={() => gererLesComptes(c.id)}>Gérer les comptes</BoutonDiscret>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireClient({ onValider, onAnnuler }) {
  const [nom, setNom] = useState('')
  const [type, setType] = useState('commune')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({ nom: nom.trim(), type })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Nom</label>
          <input required value={nom} onChange={(e) => setNom(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
            {TYPES_CLIENT.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Création…' : 'Créer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function FormulaireRenommage({ nomInitial, onValider, onAnnuler }) {
  const [nom, setNom] = useState(nomInitial)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onValider(nom.trim())
      }}
      className="flex items-center gap-2"
    >
      <input required autoFocus value={nom} onChange={(e) => setNom(e.target.value)} className="text-sm" />
      <BoutonPrincipal type="submit" className="text-xs">Valider</BoutonPrincipal>
      <BoutonDiscret type="button" onClick={onAnnuler} className="text-xs">Annuler</BoutonDiscret>
    </form>
  )
}
