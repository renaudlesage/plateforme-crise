import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import ListeJournal from '../components/ListeJournal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  NIVEAUX_ACCES, PROVINCES, TYPES_CLIENT, URL_ADMIN, dateHeure, decomposerType, depuis, jour, libelleType, typeAffiche,
} from '../lib/libelles'

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enEdition, setEnEdition] = useState(false)
  // Incrémenté après chaque action pour recharger le journal du client.
  const [version, setVersion] = useState(0)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('plateforme_lister_clients')
    if (error) {
      setErreur(error.message)
      return
    }
    const trouve = (data ?? []).find((c) => c.id === id)
    setClient(trouve ?? null)
    setIntrouvable(!trouve)
    setVersion((v) => v + 1)
  }, [id])

  useEffect(() => {
    charger()
  }, [charger])

  async function enregistrer(valeurs) {
    const { type, sous_type_territorial } = decomposerType(valeurs.type)
    const { error } = await supabase.rpc('plateforme_modifier_client', {
      p_contexte_id: id,
      p_nom: valeurs.nom,
      p_type: type,
      p_sous_type_territorial: sous_type_territorial,
      p_province: valeurs.province || null,
      p_notes_plateforme: valeurs.notes,
    })
    if (error) return { error }
    setEnEdition(false)
    await charger()
    return {}
  }

  async function basculerSuspension() {
    let motif = null
    if (!client.suspendu) {
      motif = prompt(
        `Suspendre « ${client.nom} » ? Ses ${client.nb_membres} compte(s) perdront l'accès à ses données jusqu'à réactivation.\n\nMotif (facultatif) :`,
        ''
      )
      if (motif === null) return
    } else if (!confirm(`Réactiver « ${client.nom} » ? Ses membres retrouveront leur accès.`)) {
      return
    }
    const { error } = await supabase.rpc('plateforme_suspendre_client', {
      p_contexte_id: id,
      p_suspendu: !client.suspendu,
      p_motif: motif,
    })
    if (error) setErreur(error.message)
    else await charger()
  }

  if (introuvable) {
    return (
      <div>
        <p className="text-sm text-sourdine mb-2">Client introuvable.</p>
        <Link to="/clients" className="lien text-sm">← Retour aux clients</Link>
      </div>
    )
  }
  if (!client) return erreur ? <p className="text-sm text-chaud">{erreur}</p> : <p className="text-sm text-sourdine">Chargement…</p>

  return (
    <div>
      <Link to="/clients" className="lien text-sm">← Clients</Link>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 mb-1">
        <h1 className="text-xl font-semibold text-encre">
          {client.nom}
          {client.est_plateforme && <span className="jeton ml-2 text-info">plateforme</span>}
          {client.suspendu && <span className="jeton ml-2 text-chaud">suspendu</span>}
        </h1>
        {!enEdition && (
          <div className="flex gap-2">
            <BoutonDiscret onClick={() => setEnEdition(true)}>Modifier</BoutonDiscret>
            {!client.est_plateforme && (
              <BoutonDiscret onClick={basculerSuspension}>{client.suspendu ? 'Réactiver' : 'Suspendre'}</BoutonDiscret>
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        {libelleType(client)}
        {client.province && ` · ${client.province}`} · créé le {jour(client.created_at)} · {client.nb_incidents_actifs} incident
        {client.nb_incidents_actifs === 1 ? '' : 's'} en cours · dernière connexion d'un membre {depuis(client.derniere_activite)}
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {client.suspendu && (
        <p className="message erreur mb-4">
          Suspendu le {dateHeure(client.suspendu_le)}
          {client.motif_suspension && <> — {client.motif_suspension}</>}. Les membres ne voient plus aucune donnée de ce client.
        </p>
      )}

      {enEdition ? (
        <FormulaireClient client={client} onValider={enregistrer} onAnnuler={() => setEnEdition(false)} />
      ) : (
        client.notes_plateforme && (
          <p className="text-sm text-encre border border-trait rounded p-3 mb-4 bg-surface whitespace-pre-line">
            <span className="block text-xs text-sourdine mb-1">Notes internes (visibles des seuls super-admins)</span>
            {client.notes_plateforme}
          </p>
        )
      )}

      <Membres client={client} onChange={charger} />

      <h2 className="font-medium text-encre mt-6 mb-2">Historique</h2>
      <ListeJournal cibleId={id} limite={30} cle={version} vide="Aucune action enregistrée pour ce client." />
    </div>
  )
}

function FormulaireClient({ client, onValider, onAnnuler }) {
  const [nom, setNom] = useState(client.nom)
  const [type, setType] = useState(typeAffiche(client))
  const [province, setProvince] = useState(client.province ?? '')
  const [notes, setNotes] = useState(client.notes_plateforme ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({ nom: nom.trim(), type, province, notes })
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
        <div className="sm:col-span-4">
          <label className="block text-xs font-medium text-sourdine mb-1">Notes internes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contrat, interlocuteur, particularités… (jamais visible du client)"
            className="w-full"
          />
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function Membres({ client, onChange }) {
  const { utilisateur } = useAuth()
  const [membres, setMembres] = useState([])
  const [roles, setRoles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)

  const charger = useCallback(async () => {
    const [m, r] = await Promise.all([
      supabase.rpc('plateforme_membres_client', { p_contexte_id: client.id }),
      supabase.rpc('plateforme_roles_client', { p_contexte_id: client.id }),
    ])
    if (m.error || r.error) setErreur((m.error ?? r.error).message)
    else {
      setErreur(null)
      setMembres(m.data ?? [])
      setRoles(r.data ?? [])
    }
    setChargement(false)
  }, [client.id])

  useEffect(() => {
    charger()
  }, [charger])

  async function apresAction(error) {
    if (error) {
      setErreur(error.message)
      return
    }
    await charger()
    await onChange()
  }

  async function changer(m, niveau, roleId) {
    const { error } = await supabase.rpc('plateforme_definir_acces', {
      p_user_id: m.user_id,
      p_contexte_id: client.id,
      p_niveau_acces: niveau,
      p_role_id: roleId || null,
    })
    await apresAction(error)
  }

  async function retirer(m) {
    if (!confirm(`Retirer l'accès de ${m.email} à « ${client.nom} » ?`)) return
    const { error } = await supabase.rpc('plateforme_retirer_acces', { p_acces_id: m.acces_id })
    await apresAction(error)
  }

  return (
    <section>
      <div className="flex items-center justify-between mt-2 mb-1">
        <h2 className="font-medium text-encre">
          {client.est_plateforme ? 'Super-administrateurs et équipe plateforme' : 'Comptes ayant accès'}
        </h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Inviter un compte</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        {client.est_plateforme
          ? 'Un accès « Admin » au contexte plateforme fait de la personne un super-administrateur (accès à cette console et à tous les clients).'
          : 'Les rôles se définissent dans l\'app Admin du client (Configuration). Au moins un compte « Admin » est nécessaire pour que le client se gère seul.'}
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireInvitation
          client={client}
          roles={roles}
          onFermer={() => setEnAjout(false)}
          onInvite={async () => {
            await charger()
            await onChange()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : membres.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun compte n'a accès à ce client.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {membres.map((m) => (
            <li key={m.acces_id} className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-encre truncate">
                  <Link to={`/utilisateurs?q=${encodeURIComponent(m.email)}`} className="no-underline text-encre">{m.email}</Link>
                  {m.user_id === utilisateur?.id && <span className="jeton ml-2 text-info">vous</span>}
                </p>
                <p className="text-xs text-sourdine">dernière connexion {depuis(m.last_sign_in_at)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!client.est_plateforme && (
                  <select value={m.role_id ?? ''} onChange={(e) => changer(m, m.niveau_acces, e.target.value)} className="text-xs">
                    <option value="">rôle —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.libelle}</option>
                    ))}
                  </select>
                )}
                <select value={m.niveau_acces} onChange={(e) => changer(m, e.target.value, m.role_id)} className="text-xs">
                  {NIVEAUX_ACCES.map((n) => (
                    <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
                  ))}
                </select>
                <BoutonDiscret onClick={() => retirer(m)}>Retirer</BoutonDiscret>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!client.est_plateforme && URL_ADMIN && (
        <p className="text-xs text-sourdine mt-2">
          Configuration détaillée (rôles, référentiels…) : <a className="lien" href={URL_ADMIN}>app Admin</a>, en sélectionnant ce
          client (nécessite un accès admin à ce client).
        </p>
      )}
    </section>
  )
}

function FormulaireInvitation({ client, roles, onFermer, onInvite }) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  // Depuis la console, on invite le plus souvent l'administrateur du client.
  const [niveauAcces, setNiveauAcces] = useState('admin')
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    setMessage(null)
    // Un membre d'un client définit son mot de passe dans l'app Admin ; un
    // super-admin le fait ici.
    const base = !client.est_plateforme && URL_ADMIN ? URL_ADMIN.replace(/\/$/, '') : window.location.origin
    const { data, error } = await supabase.functions.invoke('inviter-membre', {
      body: {
        contexte_id: client.id,
        email: email.trim(),
        niveau_acces: niveauAcces,
        role_id: roleId || null,
        redirect_to: `${base}/definir-mot-de-passe`,
      },
    })
    setEnCours(false)
    if (error) {
      // supabase-js ne remonte pas le corps de la réponse d'erreur dans `data`.
      let detail = null
      try {
        detail = (await error.context?.json?.())?.error
      } catch {
        // corps illisible : on garde le message générique
      }
      setErreur(detail || error.message)
      return
    }
    setMessage(
      data?.invite_envoyee
        ? `Invitation envoyée à ${email.trim()}.`
        : `${email.trim()} avait déjà un compte — accès donné à ce client.`
    )
    setEmail('')
    await onInvite()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>
        {!client.est_plateforme && (
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Rôle</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full">
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.libelle}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau d'accès</label>
          <select value={niveauAcces} onChange={(e) => setNiveauAcces(e.target.value)} className="w-full">
            {NIVEAUX_ACCES.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-sourdine">
        Crée le compte et envoie un email d'invitation, ou donne simplement l'accès si la personne a déjà un compte.
      </p>

      {message && <p className="text-sm text-ok">{message}</p>}
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Envoi…' : 'Inviter'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onFermer}>Fermer</BoutonDiscret>
      </div>
    </form>
  )
}
