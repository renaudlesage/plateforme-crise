import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const TYPES = [
  { valeur: 'CELLULE_SECURITE', libelle: 'Cellule de sécurité' },
  { valeur: 'COMITE_COORDINATION', libelle: 'Comité de coordination' },
  { valeur: 'PC_OPS', libelle: 'PC-Ops' },
]

export default function InstancesCoordination() {
  const { contexteId } = useAuth()
  const {
    lignes: instances,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('instances_coordination', contexteId, {
    colonnes: '*, roles(id, libelle)',
    tri: 'type',
  })
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [instanceOuverte, setInstanceOuverte] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900">Instances de coordination</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une instance</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Cellule de sécurité, comité de coordination, PC-Ops — avec leur composition.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireInstance
          roles={roles}
          niveaux={niveaux}
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : instances.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune instance de coordination enregistrée.
        </p>
      ) : (
        <ul className="space-y-2">
          {instances.map((i) =>
            ligneEnEdition === i.id ? (
              <li key={i.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <FormulaireInstance
                  roles={roles}
                  niveaux={niveaux}
                  valeursInitiales={i}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(i.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={i.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex items-start justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {TYPES.find((t) => t.valeur === i.type)?.libelle ?? i.type}
                    </p>
                    <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                      {i.frequence_reunion && <span>fréquence : {i.frequence_reunion}</span>}
                      {i.roles?.libelle && <span>présidée par : {i.roles.libelle}</span>}
                      {i.mode_deliberation && <span>mode : {i.mode_deliberation}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <BoutonDiscret onClick={() => setInstanceOuverte(instanceOuverte === i.id ? null : i.id)}>
                      {instanceOuverte === i.id ? 'Fermer les membres' : 'Voir les membres'}
                    </BoutonDiscret>
                    <BoutonDiscret onClick={() => setLigneEnEdition(i.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm('Supprimer cette instance ?')) supprimer(i.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
                {instanceOuverte === i.id && <GestionMembres instanceId={i.id} />}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireInstance({ roles, niveaux, valeursInitiales = {}, onValider, onAnnuler }) {
  const [type, setType] = useState(valeursInitiales.type ?? TYPES[0].valeur)
  const [niveauId, setNiveauId] = useState(valeursInitiales.niveau_id ?? '')
  const [frequenceReunion, setFrequenceReunion] = useState(valeursInitiales.frequence_reunion ?? '')
  const [modeDeliberation, setModeDeliberation] = useState(valeursInitiales.mode_deliberation ?? '')
  const [quorumRegle, setQuorumRegle] = useState(valeursInitiales.quorum_regle ?? '')
  const [presidentRoleId, setPresidentRoleId] = useState(valeursInitiales.president_role_id ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type,
      niveau_id: niveauId || null,
      frequence_reunion: frequenceReunion.trim() || null,
      mode_deliberation: modeDeliberation.trim() || null,
      quorum_regle: quorumRegle.trim() || null,
      president_role_id: presidentRoleId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type d'instance</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {TYPES.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Niveau associé</label>
          <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Président (rôle)</label>
          <select value={presidentRoleId} onChange={(e) => setPresidentRoleId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence de réunion</label>
          <input value={frequenceReunion} onChange={(e) => setFrequenceReunion(e.target.value)} placeholder="ex. 2x/an" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mode de délibération</label>
          <input value={modeDeliberation} onChange={(e) => setModeDeliberation(e.target.value)} placeholder="ex. consensuel" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Règle de quorum</label>
          <input value={quorumRegle} onChange={(e) => setQuorumRegle(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionMembres({ instanceId }) {
  const { contexteId } = useAuth()
  const { lignes: tousContacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [membres, setMembres] = useState([])
  const [chargement, setChargement] = useState(true)
  const [contactASelectionner, setContactASelectionner] = useState('')
  const [voixDeliberative, setVoixDeliberative] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('instances_coordination_membres')
      .select('instance_id, contact_id, voix_deliberative, contacts(id, nom, prenom, fonction)')
      .eq('instance_id', instanceId)
    if (error) setErreur(error.message)
    else setMembres(data ?? [])
    setChargement(false)
  }, [instanceId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouterMembre(e) {
    e.preventDefault()
    if (!contactASelectionner) return
    const { error } = await supabase.from('instances_coordination_membres').insert({
      instance_id: instanceId,
      contact_id: contactASelectionner,
      voix_deliberative: voixDeliberative,
    })
    if (error) {
      setErreur(error.message)
    } else {
      setContactASelectionner('')
      await rafraichir()
    }
  }

  async function retirerMembre(contactId) {
    const { error } = await supabase
      .from('instances_coordination_membres')
      .delete()
      .eq('instance_id', instanceId)
      .eq('contact_id', contactId)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  const contactsDisponibles = tousContacts.filter(
    (c) => !membres.some((m) => m.contact_id === c.id)
  )

  return (
    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
      <p className="text-xs font-medium text-slate-600 mb-2">Membres</p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : membres.length === 0 ? (
        <p className="text-sm text-slate-400 mb-3">Aucun membre pour l'instant.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {membres.map((m) => (
            <li key={m.contact_id} className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-slate-200">
              <span>
                {m.contacts?.prenom} {m.contacts?.nom}
                {m.contacts?.fonction && <span className="text-slate-400"> — {m.contacts.fonction}</span>}
                {!m.voix_deliberative && <span className="ml-2 text-xs text-slate-400">(sans voix délibérative)</span>}
              </span>
              <BoutonDiscret onClick={() => retirerMembre(m.contact_id)}>Retirer</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={ajouterMembre} className="flex flex-wrap items-center gap-2">
        <select
          value={contactASelectionner}
          onChange={(e) => setContactASelectionner(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white flex-1 min-w-[180px]"
        >
          <option value="">Ajouter un contact…</option>
          {contactsDisponibles.map((c) => (
            <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={voixDeliberative} onChange={(e) => setVoixDeliberative(e.target.checked)} />
          voix délibérative
        </label>
        <BoutonDiscret type="submit" disabled={!contactASelectionner}>Ajouter</BoutonDiscret>
      </form>
    </div>
  )
}
