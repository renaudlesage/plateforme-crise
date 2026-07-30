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

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const seuilsTries = [...seuils].sort((a, b) => a.ordre - b.ordre)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Seuils d'action</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un seuil</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Seuil → action → responsable, formalisés à l'avance pour ne pas décider dans l'urgence
        ce qui peut l'être à froid. Rattachables à un objet à risque précis, ou génériques.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSeuil
          objetsRisque={objetsRisque}
          roles={roles}
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
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : seuilsTries.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun seuil d'action défini.
        </p>
      ) : (
        <ol className="space-y-2">
          {seuilsTries.map((s) =>
            ligneEnEdition === s.id ? (
              <li key={s.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <FormulaireSeuil
                  objetsRisque={objetsRisque}
                  roles={roles}
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
              <li key={s.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {s.libelle}
                      {!s.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      <strong>Seuil :</strong> {s.seuil_description}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <strong>Action :</strong> {s.action}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {s.roles?.libelle && <>responsable : {s.roles.libelle}</>}
                      {s.objets_a_risque?.identification && <> · objet : {s.objets_a_risque.identification}</>}
                    </p>
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

function FormulaireSeuil({ objetsRisque, roles, valeursInitiales = {}, prioriteParDefaut = 1, onValider, onAnnuler }) {
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [seuilDescription, setSeuilDescription] = useState(valeursInitiales.seuil_description ?? '')
  const [action, setAction] = useState(valeursInitiales.action ?? '')
  const [responsableRoleId, setResponsableRoleId] = useState(valeursInitiales.responsable_role_id ?? '')
  const [objetRisqueId, setObjetRisqueId] = useState(valeursInitiales.objet_risque_id ?? '')
  const [ordre, setOrdre] = useState(valeursInitiales.ordre ?? prioriteParDefaut)
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
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
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Libellé</label>
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Fermeture préventive du pont"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description du seuil</label>
        <textarea
          required
          value={seuilDescription}
          onChange={(e) => setSeuilDescription(e.target.value)}
          rows={2}
          placeholder="ex. Niveau de la rivière > 2,5m à la station de mesure X"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Action à déclencher</label>
        <textarea
          required
          value={action}
          onChange={(e) => setAction(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
          <select value={responsableRoleId} onChange={(e) => setResponsableRoleId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Objet à risque lié</label>
          <select value={objetRisqueId} onChange={(e) => setObjetRisqueId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">— générique —</option>
            {objetsRisque.map((o) => (
              <option key={o.id} value={o.id}>{o.identification}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ordre</label>
          <input type="number" min="1" value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Actif
      </label>

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
