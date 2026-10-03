import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function InfrastructuresCritiques() {
  const { contexteId } = useAuth()
  const {
    lignes: infrastructures,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('infrastructures_critiques', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Infrastructures critiques</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une infrastructure</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Réseaux, télécom, énergie... géolocalisés, avec leur exposition aux risques — distinct
        des fonctions critiques (qui suivent un service, pas un lieu).
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireInfrastructure
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
      ) : infrastructures.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune infrastructure critique enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {infrastructures.map((i) =>
            ligneEnEdition === i.id ? (
              <li key={i.id} className="bg-slate-50 p-3">
                <FormulaireInfrastructure
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
              <li key={i.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {i.nom}
                    {!i.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                    {i.niveau_criticite != null && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        criticité {i.niveau_criticite}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {i.type}
                    {i.adresse && <> · {i.adresse}</>}
                  </p>
                  {i.expositions_risques?.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">exposée à : {i.expositions_risques.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(i.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${i.nom}" ?`)) supprimer(i.id)
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

function FormulaireInfrastructure({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [type, setType] = useState(valeursInitiales.type ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? '')
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? '')
  const [expositions, setExpositions] = useState((valeursInitiales.expositions_risques ?? []).join(', '))
  const [niveauCriticite, setNiveauCriticite] = useState(valeursInitiales.niveau_criticite ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      type: type.trim(),
      adresse: adresse.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      expositions_risques: expositions.split(',').map((s) => s.trim()).filter(Boolean),
      niveau_criticite: niveauCriticite === '' ? null : Number(niveauCriticite),
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Poste électrique Nord"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <input required value={type} onChange={(e) => setType(e.target.value)} placeholder="ex. électricité, télécom, eau" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Niveau de criticité (1-4)</label>
          <input type="number" min="1" max="4" value={niveauCriticite} onChange={(e) => setNiveauCriticite(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Expositions aux risques (séparées par des virgules)</label>
        <input value={expositions} onChange={(e) => setExpositions(e.target.value)} placeholder="ex. inondation, feu de forêt" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
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
