import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTableContexte } from '../../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../../components/Boutons'

const ROLES_PARAGON = [
  { valeur: 'org_admin', libelle: 'Org-Admin' },
  { valeur: 'contact_manager', libelle: 'Contact manager' },
  { valeur: 'emergency_plan_manager', libelle: 'Emergency plan manager' },
]

export default function Paragon() {
  const { contexteId } = useAuth()
  const { lignes: mappages, chargement, erreur, creer, modifier, supprimer } = useTableContexte(
    'paragon_role_mapping',
    contexteId,
    { colonnes: '*, roles(id, libelle)', tri: 'role_paragon' }
  )
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const [enAjout, setEnAjout] = useState(false)

  const rolesParagonDisponibles = ROLES_PARAGON.filter((rp) => !mappages.some((m) => m.role_paragon === rp.valeur))

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-medium text-encre">Interopérabilité Paragon</h2>
          <p className="text-sm text-sourdine">
            Correspondance entre les rôles du Portail national de sécurité Paragon (NCCN) et les
            rôles Crisiware, pour faciliter un futur import de contacts ou de plans. Paragon n'est
            ni un canal d'urgence (112/101) ni un dépôt d'informations classifiées.
          </p>
        </div>
        {!enAjout && rolesParagonDisponibles.length > 0 && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une correspondance</BoutonPrincipal>
        )}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireMappage
          rolesParagonDisponibles={rolesParagonDisponibles}
          roles={roles}
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : mappages.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune correspondance de rôle Paragon définie.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {mappages.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-2.5 bg-surface">
              <p className="text-sm text-encre">
                <span className="jeton mr-2 text-info">{ROLES_PARAGON.find((r) => r.valeur === m.role_paragon)?.libelle}</span>
                →
                <select
                  value={m.role_crisiware_id ?? ''}
                  onChange={(e) => modifier(m.id, { role_crisiware_id: e.target.value || null })}
                  className="ml-2 text-xs"
                >
                  <option value="">— aucun —</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
                </select>
              </p>
              <BoutonDiscret onClick={() => supprimer(m.id)}>Supprimer</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FormulaireMappage({ rolesParagonDisponibles, roles, onValider, onAnnuler }) {
  const [roleParagon, setRoleParagon] = useState(rolesParagonDisponibles[0]?.valeur ?? '')
  const [roleCrisiwareId, setRoleCrisiwareId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      role_paragon: roleParagon,
      role_crisiware_id: roleCrisiwareId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-3 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Rôle Paragon</label>
          <select value={roleParagon} onChange={(e) => setRoleParagon(e.target.value)} className="w-full">
            {rolesParagonDisponibles.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Rôle Crisiware correspondant</label>
          <select value={roleCrisiwareId} onChange={(e) => setRoleCrisiwareId(e.target.value)} className="w-full">
            <option value="">— aucun —</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
          </select>
        </div>
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
