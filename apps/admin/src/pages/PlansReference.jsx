import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES = ['PGUI', 'PPUI', 'PUI', 'PLAN_INTERNE']

export default function PlansReference() {
  const { contexteId } = useAuth()
  const {
    lignes: plans,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('plans_reference', contexteId, {
    colonnes: '*, objets_a_risque(id, identification)',
    tri: 'nom',
  })
  const { lignes: objetsRisque } = useTableContexte('objets_a_risque', contexteId, { tri: 'identification' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreType, setFiltreType] = useState('')

  const plansFiltres = filtreType ? plans.filter((p) => p.type === filtreType) : plans

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900">Plans de référence</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un plan</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        PGUI, PPUI par risque, PUI des exploitants, ou plans internes de référence.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulairePlan
          objetsRisque={objetsRisque}
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
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Tous types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : plansFiltres.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun plan de référence enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {plansFiltres.map((p) =>
            ligneEnEdition === p.id ? (
              <li key={p.id} className="bg-slate-50 p-3">
                <FormulairePlan
                  objetsRisque={objetsRisque}
                  valeursInitiales={p}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(p.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {p.nom}
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{p.type}</span>
                    {p.version && <span className="ml-1 text-xs text-slate-400">v{p.version}</span>}
                  </p>
                  {p.objets_a_risque?.identification && (
                    <p className="text-xs text-slate-500">objet à risque : {p.objets_a_risque.identification}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                    {p.date_agrement_local && <span>agréé (local) : {p.date_agrement_local}</span>}
                    {p.date_approbation_autorite && <span>approuvé : {p.date_approbation_autorite}</span>}
                    {p.autorite_approbatrice && <span>par : {p.autorite_approbatrice}</span>}
                    {p.frequence_mise_a_jour && <span>MàJ : {p.frequence_mise_a_jour}</span>}
                  </p>
                  {p.fichier_url && (
                    <a href={p.fichier_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                      voir le document
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(p.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${p.nom}" ?`)) supprimer(p.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulairePlan({ objetsRisque, valeursInitiales = {}, onValider, onAnnuler }) {
  const [type, setType] = useState(valeursInitiales.type ?? 'PGUI')
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [version, setVersion] = useState(valeursInitiales.version ?? '')
  const [objetRisqueId, setObjetRisqueId] = useState(valeursInitiales.objet_risque_id ?? '')
  const [dateAgrementLocal, setDateAgrementLocal] = useState(valeursInitiales.date_agrement_local ?? '')
  const [dateApprobation, setDateApprobation] = useState(valeursInitiales.date_approbation_autorite ?? '')
  const [autoriteApprobatrice, setAutoriteApprobatrice] = useState(valeursInitiales.autorite_approbatrice ?? '')
  const [frequenceMaj, setFrequenceMaj] = useState(valeursInitiales.frequence_mise_a_jour ?? '')
  const [fichierUrl, setFichierUrl] = useState(valeursInitiales.fichier_url ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type,
      nom: nom.trim(),
      version: version.trim() || null,
      objet_risque_id: objetRisqueId || null,
      date_agrement_local: dateAgrementLocal || null,
      date_approbation_autorite: dateApprobation || null,
      autorite_approbatrice: autoriteApprobatrice.trim() || null,
      frequence_mise_a_jour: frequenceMaj.trim() || null,
      fichier_url: fichierUrl.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. PPUI Zoning industriel Nord"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Version</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex. 2026-1" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Objet à risque lié</label>
          <select value={objetRisqueId} onChange={(e) => setObjetRisqueId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {objetsRisque.map((o) => (
              <option key={o.id} value={o.id}>{o.identification}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date d'agrément (local)</label>
          <input type="date" value={dateAgrementLocal} onChange={(e) => setDateAgrementLocal(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date d'approbation (autorité)</label>
          <input type="date" value={dateApprobation} onChange={(e) => setDateApprobation(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Autorité approbatrice</label>
          <input value={autoriteApprobatrice} onChange={(e) => setAutoriteApprobatrice(e.target.value)} placeholder="ex. Gouverneur de province" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence de mise à jour</label>
          <input value={frequenceMaj} onChange={(e) => setFrequenceMaj(e.target.value)} placeholder="ex. tous les 3 ans" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Lien vers le document</label>
        <input value={fichierUrl} onChange={(e) => setFichierUrl(e.target.value)} placeholder="https://…" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
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
