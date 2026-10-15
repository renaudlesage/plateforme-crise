import { useState } from 'react'
import { CHECKLISTS_DEPART, DECLENCHEUR_MODELE_DEPART, profilDe, texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
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
    rafraichir,
  } = useTableContexte('checklist_templates', contexteId, {
    colonnes: '*, roles(id, libelle), niveaux_escalade(id, libelle)',
    tri: 'ordre',
  })
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreRole, setFiltreRole] = useState('')

  const [installation, setInstallation] = useState(null)

  // Rôles à profil de terrain qui n'ont encore AUCUNE action : on leur propose le modèle de départ
  const rolesSansChecklist = roles.filter(
    (r) => r.profil_terrain && CHECKLISTS_DEPART[r.profil_terrain] && !items.some((i) => i.role_id === r.id)
  )

  async function installerModeles() {
    setInstallation({ etat: 'cours' })
    const lignes = rolesSansChecklist.flatMap((r) =>
      CHECKLISTS_DEPART[r.profil_terrain].map((libelle, i) => ({
        contexte_id: contexteId,
        role_id: r.id,
        declencheur: DECLENCHEUR_MODELE_DEPART,
        ordre: i + 1,
        libelle,
      }))
    )
    const { error } = await supabase.from('checklist_templates').insert(lignes)
    if (error) {
      setInstallation({ etat: 'erreur', texte: texteErreur(error) })
      return
    }
    await rafraichir()
    setInstallation({ etat: 'ok', texte: `${lignes.length} actions installées pour ${rolesSansChecklist.length} rôle${rolesSansChecklist.length > 1 ? 's' : ''}.` })
  }

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
        <h1 className="text-xl font-semibold text-encre">Checklists types</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une action</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Actions à réaliser par rôle, regroupées par déclencheur (pré-alerte, alerte, phase
        communale…). L’exécution en temps réel se fera depuis l’app du Comité de Coordination.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {rolesSansChecklist.length > 0 && (
        <div className="border border-trait rounded p-3 mb-4 bg-fond space-y-2">
          <p className="text-sm text-encre">
            {rolesSansChecklist.length} rôle{rolesSansChecklist.length > 1 ? 's' : ''} de terrain sans checklist :{' '}
            {rolesSansChecklist.map((r) => `${r.libelle} (${profilDe(r.profil_terrain)?.court})`).join(', ')}.
          </p>
          <p className="text-xs text-sourdine">
            Un modèle de départ ne reprend que les gestes dans l’application (déclarer un chiffre, traiter une demande…). Il n’invente aucune doctrine d’intervention :
            c’est un point de départ à relire et corriger avec vos experts. Il s’installe sous le déclencheur « {DECLENCHEUR_MODELE_DEPART} ».
          </p>
          <BoutonPrincipal disabled={installation?.etat === 'cours'} onClick={installerModeles}>
            {installation?.etat === 'cours' ? 'Installation…' : 'Installer les modèles de départ'}
          </BoutonPrincipal>
        </div>
      )}
      {installation?.texte && (
        <p role="status" className={`text-sm mb-3 ${installation.etat === 'erreur' ? 'text-chaud' : 'text-encre'}`}>{installation.texte}</p>
      )}

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
          className=""
        >
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.libelle}</option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune action enregistrée.
        </p>
      ) : (
        <div className="space-y-5">
          {groupes.map((groupe) => (
            <div key={groupe.declencheur}>
              <h2 className="text-sm font-semibold text-sourdine mb-2">{groupe.declencheur}</h2>
              <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
                {groupe.items.map((item) =>
                  ligneEnEdition === item.id ? (
                    <li key={item.id} className="bg-fond p-3">
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
                    <li key={item.id} className="flex items-center justify-between px-4 py-2.5 bg-surface">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded bg-surface-2 text-sourdine text-xs flex items-center justify-center">
                          {item.ordre}
                        </span>
                        <div>
                          <p className="text-sm text-encre">{item.libelle}</p>
                          <p className="text-xs text-sourdine">
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
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Action</label>
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Informer le gouverneur du déclenchement"
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Déclencheur</label>
          <input
            required
            list="declencheurs-suggeres"
            value={declencheur}
            onChange={(e) => setDeclencheur(e.target.value)}
            placeholder="ex. Alerte"
            className="w-full"
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
          <label className="block text-xs font-medium text-sourdine mb-1">Rôle</label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Ordre</label>
          <input type="number" min="1" required value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Niveau associé (optionnel)</label>
        <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full">
          <option value="">—</option>
          {niveaux.map((n) => (
            <option key={n.id} value={n.id}>{n.libelle}</option>
          ))}
        </select>
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
