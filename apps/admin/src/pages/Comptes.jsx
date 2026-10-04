import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const NIVEAUX_ACCES = [
  { valeur: 'lecture', libelle: 'Lecture' },
  { valeur: 'ecriture', libelle: 'Écriture' },
  { valeur: 'admin', libelle: 'Admin' },
]

export default function Comptes() {
  const { contexteId, utilisateur } = useAuth()
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const [membres, setMembres] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)

  const rafraichir = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    const { data, error } = await supabase.rpc('membres_contexte', { p_contexte_id: contexteId })
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setMembres(data ?? [])
    }
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function changerNiveau(acces, niveau) {
    const { error } = await supabase.from('acces_utilisateurs').update({ niveau_acces: niveau }).eq('id', acces.acces_id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function changerRole(acces, roleId) {
    const { error } = await supabase.from('acces_utilisateurs').update({ role_id: roleId || null }).eq('id', acces.acces_id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function revoquer(acces) {
    if (!confirm(`Retirer l'accès de ${acces.email} à ce contexte ?`)) return
    const { error } = await supabase.from('acces_utilisateurs').delete().eq('id', acces.acces_id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Comptes</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Inviter un compte</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Qui a accès à ce contexte, avec quel niveau (lecture / écriture / admin) et quel rôle.
        Une invitation par email crée le compte s'il n'existe pas encore, ou donne simplement
        accès à ce contexte si la personne a déjà un compte ailleurs.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireInvitation
          contexteId={contexteId}
          roles={roles}
          onAnnuler={() => setEnAjout(false)}
          onInvite={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : membres.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun compte n'a encore accès à ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {membres.map((m) => (
            <li key={m.acces_id} className="flex items-center justify-between px-4 py-3 bg-surface gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-encre truncate">
                  {m.email}
                  {m.user_id === utilisateur?.id && <span className="jeton ml-2 text-info">vous</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select value={m.role_id ?? ''} onChange={(e) => changerRole(m, e.target.value)} className="text-xs">
                  <option value="">rôle —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.libelle}</option>
                  ))}
                </select>
                <select value={m.niveau_acces} onChange={(e) => changerNiveau(m, e.target.value)} className="text-xs">
                  {NIVEAUX_ACCES.map((n) => (
                    <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
                  ))}
                </select>
                <BoutonDiscret onClick={() => revoquer(m)}>Retirer</BoutonDiscret>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireInvitation({ contexteId, roles, onAnnuler, onInvite }) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [niveauAcces, setNiveauAcces] = useState('ecriture')
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('inviter-membre', {
      body: {
        contexte_id: contexteId,
        email: email.trim(),
        niveau_acces: niveauAcces,
        role_id: roleId || null,
        redirect_to: `${window.location.origin}/definir-mot-de-passe`,
      },
    })
    setEnCours(false)
    if (error) {
      setErreur(data?.error || error.message)
      return
    }
    if (data?.invite_envoyee) {
      setMessage(`Invitation envoyée à ${email.trim()}.`)
    } else {
      setMessage(`${email.trim()} avait déjà un compte — accès donné à ce contexte.`)
    }
    setEmail('')
    await onInvite()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-sourdine mb-1">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Rôle</label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau d'accès</label>
          <select value={niveauAcces} onChange={(e) => setNiveauAcces(e.target.value)} className="w-full">
            {NIVEAUX_ACCES.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      {message && <p className="text-sm text-ok">{message}</p>}
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Envoi…' : 'Inviter'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Fermer</BoutonDiscret>
      </div>
    </form>
  )
}
