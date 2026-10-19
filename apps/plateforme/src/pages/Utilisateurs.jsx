import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { NIVEAUX_ACCES, depuis, jour } from '../lib/libelles'

const sansAccent = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Tous les comptes de la plateforme, avec leurs accès client par client.
 * L'invitation d'un nouveau compte se fait depuis la fiche du client (le
 * compte n'existe que rattaché à un client) ; ici on donne/retire des accès à
 * des comptes existants, et on désactive un compte (plus aucune connexion).
 */
export default function Utilisateurs() {
  const { utilisateur } = useAuth()
  const [params, setParams] = useSearchParams()
  const [utilisateurs, setUtilisateurs] = useState([])
  const [clients, setClients] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtre, setFiltre] = useState('')
  const [ouvert, setOuvert] = useState(null)
  const recherche = params.get('q') ?? ''

  const charger = useCallback(async () => {
    const [u, c] = await Promise.all([supabase.rpc('plateforme_lister_utilisateurs'), supabase.rpc('plateforme_lister_clients')])
    if (u.error || c.error) setErreur((u.error ?? c.error).message)
    else {
      setErreur(null)
      setUtilisateurs(u.data ?? [])
      setClients(c.data ?? [])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const visibles = useMemo(() => {
    const q = sansAccent(recherche.trim())
    return utilisateurs.filter((u) => {
      if (q && !sansAccent(u.email).includes(q) && !u.acces.some((a) => sansAccent(a.contexte_nom).includes(q))) return false
      if (filtre === 'super_admin' && !u.est_super_admin) return false
      if (filtre === 'desactive' && !u.desactive) return false
      if (filtre === 'invitation' && !u.invitation_en_attente) return false
      if (filtre === 'sans_acces' && u.acces.length > 0) return false
      return true
    })
  }, [utilisateurs, recherche, filtre])

  // Un seul utilisateur déplié ; la recherche par email (lien depuis un client) le déplie d'office.
  const deplie = ouvert ?? (visibles.length === 1 ? visibles[0].user_id : null)

  async function action(promesse) {
    const { error } = await promesse
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      await charger()
    }
  }

  function basculerActivation(u) {
    const question = u.desactive
      ? `Réactiver le compte ${u.email} ?`
      : `Désactiver le compte ${u.email} ? Il ne pourra plus se connecter à aucune application (sa session en cours expire au plus tard dans l'heure). Ses accès sont conservés.`
    if (!confirm(question)) return
    action(supabase.rpc('plateforme_desactiver_utilisateur', { p_user_id: u.user_id, p_desactive: !u.desactive }))
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Utilisateurs</h1>
      <p className="text-sm text-sourdine mb-4">
        Tous les comptes, tous clients confondus. Pour inviter une nouvelle personne, passez par la fiche du client
        concerné ; un super-administrateur s'invite depuis la fiche du contexte plateforme.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="search"
          placeholder="Email ou nom de client"
          value={recherche}
          onChange={(e) => {
            setOuvert(null)
            setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
          }}
          className="flex-1 min-w-[12rem]"
        />
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)}>
          <option value="">Tous les comptes</option>
          <option value="super_admin">Super-administrateurs</option>
          <option value="invitation">Invitation en attente</option>
          <option value="sans_acces">Sans accès</option>
          <option value="desactive">Désactivés</option>
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : visibles.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun compte ne correspond.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {visibles.map((u) => (
            <li key={u.user_id}>
              <button
                type="button"
                className="ligne-depliable"
                aria-expanded={deplie === u.user_id}
                onClick={() => setOuvert(deplie === u.user_id ? '' : u.user_id)}
              >
                {/* Marges sur un bloc interne : la règle globale button.ligne-depliable remet tout à zéro. */}
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-encre truncate">
                    {u.email}
                    {u.user_id === utilisateur?.id && <span className="jeton ml-2 text-info">vous</span>}
                    {u.est_super_admin && <span className="jeton ml-2 text-info">super-admin</span>}
                    {u.desactive && <span className="jeton ml-2 text-chaud">désactivé</span>}
                    {u.invitation_en_attente && <span className="jeton ml-2 text-veille">invitation en attente</span>}
                    {u.acces.length === 0 && <span className="jeton ml-2 text-veille">sans accès</span>}
                  </p>
                  <p className="text-xs text-sourdine">
                    {u.acces.length === 0
                      ? 'Aucun client'
                      : u.acces.map((a) => `${a.contexte_nom} (${a.niveau_acces})`).join(' · ')}{' '}
                    · dernière connexion {depuis(u.last_sign_in_at)}
                  </p>
                </div>
              </button>

              {deplie === u.user_id && (
                <div className="px-4 pb-4 bg-fond border-t border-trait">
                  <p className="text-xs text-sourdine pt-3 mb-2">
                    Compte créé le {jour(u.created_at)}. Chaque changement est inscrit au journal.
                  </p>
                  <AccesUtilisateur u={u} clients={clients} onAction={action} />
                  <div className="mt-3">
                    {u.user_id !== utilisateur?.id && (
                      <BoutonDiscret onClick={() => basculerActivation(u)}>
                        {u.desactive ? 'Réactiver le compte' : 'Désactiver le compte'}
                      </BoutonDiscret>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AccesUtilisateur({ u, clients, onAction }) {
  const [contexteId, setContexteId] = useState('')
  const [niveau, setNiveau] = useState('lecture')
  const sansAcces = clients.filter((c) => !u.acces.some((a) => a.contexte_id === c.id))

  function definir(contexte, niveauAcces, roleId) {
    return onAction(
      supabase.rpc('plateforme_definir_acces', {
        p_user_id: u.user_id,
        p_contexte_id: contexte,
        p_niveau_acces: niveauAcces,
        p_role_id: roleId ?? null,
      })
    )
  }

  function retirer(a) {
    if (!confirm(`Retirer l'accès de ${u.email} à « ${a.contexte_nom} » ?`)) return
    onAction(supabase.rpc('plateforme_retirer_acces', { p_acces_id: a.acces_id }))
  }

  return (
    <>
      {u.acces.length > 0 && (
        <ul className="divide-y divide-trait border border-trait rounded bg-surface mb-3">
          {u.acces.map((a) => (
            <li key={a.acces_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <p className="text-sm text-encre">
                <Link to={`/clients/${a.contexte_id}`} className="lien">{a.contexte_nom}</Link>
                {a.est_plateforme && a.niveau_acces === 'admin' && <span className="jeton ml-2 text-info">super-admin</span>}
                {a.role_libelle && <span className="text-xs text-sourdine"> · {a.role_libelle}</span>}
              </p>
              <div className="flex items-center gap-2">
                <select value={a.niveau_acces} onChange={(e) => definir(a.contexte_id, e.target.value, a.role_id)} className="text-xs">
                  {NIVEAUX_ACCES.map((n) => (
                    <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
                  ))}
                </select>
                <BoutonDiscret onClick={() => retirer(a)}>Retirer</BoutonDiscret>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sansAcces.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (contexteId) definir(contexteId, niveau, null).then(() => setContexteId(''))
          }}
        >
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Donner accès à</label>
            <select value={contexteId} onChange={(e) => setContexteId(e.target.value)} required>
              <option value="">Choisir un client…</option>
              {sansAcces.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}{c.est_plateforme ? ' (plateforme)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)}>
              {NIVEAUX_ACCES.map((n) => (
                <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
              ))}
            </select>
          </div>
          <BoutonPrincipal type="submit">Ajouter</BoutonPrincipal>
        </form>
      )}
    </>
  )
}
