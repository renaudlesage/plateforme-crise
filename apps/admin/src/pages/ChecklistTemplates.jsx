import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function ChecklistTemplates() {
  const { contexteId } = useAuth()
  const {
    lignes: items,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('checklist_templates', contexteId, {
    colonnes: '*, roles(id, libelle), niveaux_escalade(id, libelle)',
    tri: 'ordre',
  })
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreRole, setFiltreRole] = useState('')

  const itemsFiltres = filtreRole ? items.filter((i) => i.role_id === filtreRole) : items

  // Regroupement par déclencheur, dans l'ordre d'apparition
  const groupes = []
  for (const item of itemsFiltres) {
    let groupe = groupes.find((g) => g.declencheur === item.declencheur)
    if (!groupe) {
      groupe = { declencheur: item.declencheur, items: [] }
      groupes.push(groupe)
    }
    groupe.items.push(item)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Checklists types</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une action</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Actions à réaliser par rôle, regroupées par déclencheur (pré-alerte, alerte, phase
        communale…). L'exécution en temps réel se fera depuis l'app QG.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireItem
          roles={roles}
          niveaux={niveaux}
          prioriteParDefaut={items.length + 1}
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <div className="mb-3">
        <select
          value={filtreRole}
          onChange={(e) => setFiltreRole(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.libelle}</option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune action enregistrée.
        </p>
      ) : (
        <div className="space-y-5">
          {groupes.map((groupe) => (
            <div key={groupe.declencheur}>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">{groupe.declencheur}</h2>
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                {groupe.items.map((item) =>
                  ligneEnEdition === item.id ? (
                    <li key={item.id} className="bg-slate-50 p-3">
                      <FormulaireItem
                        roles={roles}
                        niveaux={niveaux}
                        valeursInitiales={item}
                        onAnnuler={() => setLigneEnEdition(null)}
                        onValider={async (valeurs) => {
                          const { error } = await modifier(item.id, valeurs)
                          if (!error) setLigneEnEdition(null)
                          return { error }
                        }}
                      />
                    </li>
                  ) : (
                    <li key={item.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center">
                          {item.ordre}
                        </span>
                        <div>
                          <p className="text-sm text-slate-900">{item.libelle}</p>
                          <p className="text-xs text-slate-400">
                            {item.roles?.libelle}
                            {item.niveaux_escalade?.libelle && <> · {item.niveaux_escalade.libelle}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <BoutonDiscret onClick={() => setLigneEnEdition(item.id)}>Modifier</BoutonDiscret>
                        <BoutonDiscret
                          onClick={() => {
                            if (confirm('Supprimer cette action ?')) supprimer(item.id)
                          }}
                        >
                          Supprimer
                        </BoutonDiscret>
                      </div>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormulaireItem({ roles, niveaux, valeursInitiales = {}, prioriteParDefaut = 1, onValider, onAnnuler }) {
  const [roleId, setRoleId] = useState(valeursInitiales.role_id ?? '')
  const [niveauId, setNiveauId] = useState(valeursInitiales.niveau_id ?? '')
  const [declencheur, setDeclencheur] = useState(valeursInitiales.declencheur ?? '')
  const [ordre, setOrdre] = useState(valeursInitiales.ordre ?? prioriteParDefaut)
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      role_id: roleId || null,
      niveau_id: niveauId || null,
      declencheur: declencheur.trim(),
      ordre: Number(ordre),
      libelle: libelle.trim(),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Informer le gouverneur du déclenchement"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Déclencheur</label>
          <input
            required
            list="declencheurs-suggeres"
            value={declencheur}
            onChange={(e) => setDeclencheur(e.target.value)}
            placeholder="ex. Alerte"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <datalist id="declencheurs-suggeres">
            <option value="Pré-alerte" />
            <option value="Alerte" />
            <option value="Phase communale" />
            <option value="Phase provinciale" />
            <option value="Levée de phase" />
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ordre</label>
          <input type="number" min="1" required value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Niveau associé (optionnel)</label>
        <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
          <option value="">—</option>
          {niveaux.map((n) => (
            <option key={n.id} value={n.id}>{n.libelle}</option>
          ))}
        </select>
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
