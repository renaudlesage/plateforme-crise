import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function SeuilsAction() {
  const { contexteId } = useAuth()
  const {
    lignes: seuils,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('seuils_action', contexteId, {
    colonnes: '*, objets_a_risque(id, identification), roles(id, libelle)',
    tri: 'ordre',
  })
  const { lignes: objetsRisque } = useTableContexte('objets_a_risque', contexteId, { tri: 'identification' })
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })
  const { lignes: ressources } = useTableContexte('ressources', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const seuilsTries = [...seuils].sort((a, b) => a.ordre - b.ordre)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Seuils d'action</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un seuil</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Seuil → action → responsable, formalisés à l'avance pour ne pas décider dans l'urgence
        ce qui peut l'être à froid. Rattachables à un objet à risque précis, ou génériques.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSeuil
          objetsRisque={objetsRisque}
          roles={roles}
          ressources={ressources}
          prioriteParDefaut={seuils.length + 1}
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
      ) : seuilsTries.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun seuil d'action défini.
        </p>
      ) : (
        <ol className="space-y-2">
          {seuilsTries.map((s) =>
            ligneEnEdition === s.id ? (
              <li key={s.id} className="bg-fond rounded p-3 border border-trait">
                <FormulaireSeuil
                  objetsRisque={objetsRisque}
                  roles={roles}
                  ressources={ressources}
                  valeursInitiales={s}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(s.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={s.id} className="bg-surface border border-trait rounded p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {s.libelle}
                      {!s.actif && <span className="ml-2 text-xs text-sourdine">(inactif)</span>}
                    </p>
                    <p className="text-xs text-sourdine mt-1">
                      <strong>Seuil :</strong> {s.seuil_description}
                    </p>
                    <p className="text-xs text-sourdine mt-0.5">
                      <strong>Action :</strong> {s.action}
                    </p>
                    <p className="text-xs text-sourdine mt-1">
                      {s.roles?.libelle && <>responsable : {s.roles.libelle}</>}
                      {s.objets_a_risque?.identification && <> · objet : {s.objets_a_risque.identification}</>}
                    </p>
                    {s.action_degradee && (
                      <p className="text-xs text-veille mt-0.5">
                        <strong>si ressource indisponible :</strong> {s.action_degradee}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setLigneEnEdition(s.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm(`Supprimer "${s.libelle}" ?`)) supprimer(s.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
              </li>
            )
          )}
        </ol>
      )}
    </div>
  )
}

function FormulaireSeuil({ objetsRisque, roles, ressources = [], valeursInitiales = {}, prioriteParDefaut = 1, onValider, onAnnuler }) {
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [seuilDescription, setSeuilDescription] = useState(valeursInitiales.seuil_description ?? '')
  const [action, setAction] = useState(valeursInitiales.action ?? '')
  const [responsableRoleId, setResponsableRoleId] = useState(valeursInitiales.responsable_role_id ?? '')
  const [objetRisqueId, setObjetRisqueId] = useState(valeursInitiales.objet_risque_id ?? '')
  const [ordre, setOrdre] = useState(valeursInitiales.ordre ?? prioriteParDefaut)
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [ressourceSubstitutionId, setRessourceSubstitutionId] = useState(valeursInitiales.ressource_substitution_id ?? '')
  const [actionDegradee, setActionDegradee] = useState(valeursInitiales.action_degradee ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      libelle: libelle.trim(),
      seuil_description: seuilDescription.trim(),
      action: action.trim(),
      responsable_role_id: responsableRoleId || null,
      objet_risque_id: objetRisqueId || null,
      ordre: Number(ordre),
      actif,
      ressource_substitution_id: ressourceSubstitutionId || null,
      action_degradee: actionDegradee.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Libellé</label>
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Fermeture préventive du pont"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Description du seuil</label>
        <textarea
          required
          value={seuilDescription}
          onChange={(e) => setSeuilDescription(e.target.value)}
          rows={2}
          placeholder="ex. Niveau de la rivière > 2,5m à la station de mesure X"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Action à déclencher</label>
        <textarea
          required
          value={action}
          onChange={(e) => setAction(e.target.value)}
          rows={2}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Responsable</label>
          <select value={responsableRoleId} onChange={(e) => setResponsableRoleId(e.target.value)} className="w-full">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Objet à risque lié</label>
          <select value={objetRisqueId} onChange={(e) => setObjetRisqueId(e.target.value)} className="w-full">
            <option value="">— générique —</option>
            {objetsRisque.map((o) => (
              <option key={o.id} value={o.id}>{o.identification}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Ordre</label>
          <input type="number" min="1" value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Actif
      </label>

      <div className="space-y-2 border border-trait rounded p-3">
        <p className="text-xs font-medium text-sourdine">Repli en cascade si la ressource principale est indisponible</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Ressource de substitution</label>
            <select value={ressourceSubstitutionId} onChange={(e) => setRessourceSubstitutionId(e.target.value)} className="w-full">
              <option value="">—</option>
              {ressources.map((r) => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Action dégradée</label>
            <input value={actionDegradee} onChange={(e) => setActionDegradee(e.target.value)} className="w-full" />
          </div>
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
