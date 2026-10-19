import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'
import { PROVINCES, TYPES_CLIENT, decomposerType, depuis, libelleType, typeAffiche } from '../lib/libelles'

const sansAccent = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [filtreEtat, setFiltreEtat] = useState('')

  const rafraichir = useCallback(async () => {
    const { data, error } = await supabase.rpc('plateforme_lister_clients')
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

  const visibles = useMemo(() => {
    const q = sansAccent(recherche.trim())
    return clients.filter((c) => {
      if (q && !sansAccent(c.nom).includes(q)) return false
      if (filtreType && typeAffiche(c) !== filtreType) return false
      if (filtreEtat === 'suspendu' && !c.suspendu) return false
      if (filtreEtat === 'actif' && c.suspendu) return false
      if (filtreEtat === 'sans_admin' && (c.nb_admins > 0 || c.est_plateforme)) return false
      return true
    })
  }, [clients, recherche, filtreType, filtreEtat])

  async function creer(valeurs) {
    const { type, sous_type_territorial } = decomposerType(valeurs.type)
    const { data, error } = await supabase.rpc('plateforme_creer_client', {
      p_type: type,
      p_nom: valeurs.nom,
      p_sous_type_territorial: sous_type_territorial,
      p_province: valeurs.province || null,
      p_me_rattacher: valeurs.meRattacher,
    })
    if (error) return { error }
    navigate(`/clients/${data}`)
    return { data }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Clients</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Nouveau client</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Communes, provinces, entités critiques, événements… abonnés à la plateforme. Un client suspendu reste en base
        mais ses membres n'y ont plus accès.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && <FormulaireClient onAnnuler={() => setEnAjout(false)} onValider={creer} />}

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="search"
          placeholder="Rechercher un client"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 min-w-[12rem]"
        />
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES_CLIENT.map((t) => (
            <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
          ))}
        </select>
        <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)}>
          <option value="">Tous les états</option>
          <option value="actif">Actifs</option>
          <option value="suspendu">Suspendus</option>
          <option value="sans_admin">Sans administrateur</option>
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : visibles.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">
          {clients.length === 0 ? "Aucun client pour l'instant." : 'Aucun client ne correspond aux filtres.'}
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {visibles.map((c) => (
            <li key={c.id} className="bg-surface">
              <Link to={`/clients/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 no-underline">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-encre truncate">
                    {c.nom}
                    {c.est_plateforme && <span className="jeton ml-2 text-info">plateforme</span>}
                    {c.suspendu && <span className="jeton ml-2 text-chaud">suspendu</span>}
                    {!c.est_plateforme && c.nb_admins === 0 && <span className="jeton ml-2 text-veille">sans admin</span>}
                    {c.nb_incidents_actifs > 0 && (
                      <span className="jeton ml-2 text-chaud">
                        {c.nb_incidents_actifs} incident{c.nb_incidents_actifs > 1 ? 's' : ''} en cours
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-sourdine">
                    {libelleType(c)}
                    {c.province && ` · ${c.province}`} · {c.nb_membres} compte{c.nb_membres === 1 ? '' : 's'} ·
                    dernière connexion {depuis(c.derniere_activite)}
                  </p>
                </div>
                <span aria-hidden="true" className="text-sourdine">›</span>
              </Link>
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
  const [province, setProvince] = useState('')
  const [meRattacher, setMeRattacher] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({ nom: nom.trim(), type, province, meRattacher })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Province</label>
          <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full">
            <option value="">—</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={meRattacher} onChange={(e) => setMeRattacher(e.target.checked)} />
        Me donner un accès administrateur à ce client (pour le configurer dans l'app Admin)
      </label>

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
