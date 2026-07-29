import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function SitesQG() {
  const { contexteId } = useAuth()
  const {
    lignes: sites,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('sites_qg', contexteId, { tri: 'priorite' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Sites QG</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un site</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Emplacements du centre de crise, classés par priorité — le site 1 est le principal,
        les suivants sont des solutions de repli.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSite
          prioriteParDefaut={sites.length + 1}
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
      ) : sites.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun site QG enregistré.
        </p>
      ) : (
        <ol className="space-y-2">
          {sites.map((s) =>
            ligneEnEdition === s.id ? (
              <li key={s.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <FormulaireSite
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
              <li key={s.id} className="flex items-start justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">
                    {s.priorite}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {s.nom}
                      {!s.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{s.adresse}</p>
                    {s.latitude != null && s.longitude != null && (
                      <p className="text-xs text-slate-400">{s.latitude}, {s.longitude}</p>
                    )}
                    {Array.isArray(s.equipements) && s.equipements.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        équipements : {s.equipements.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <BoutonDiscret onClick={() => setLigneEnEdition(s.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${s.nom}" ?`)) supprimer(s.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ol>
      )}
    </div>
  )
}

function FormulaireSite({ valeursInitiales = {}, prioriteParDefaut = 1, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? '')
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? '')
  const [priorite, setPriorite] = useState(valeursInitiales.priorite ?? prioriteParDefaut)
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [equipements, setEquipements] = useState(() =>
    Array.isArray(valeursInitiales.equipements) && valeursInitiales.equipements.length > 0
      ? valeursInitiales.equipements
      : ['']
  )
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function majEquipement(index, valeur) {
    setEquipements((prev) => prev.map((e, i) => (i === index ? valeur : e)))
  }

  function ajouterEquipement() {
    setEquipements((prev) => [...prev, ''])
  }

  function retirerEquipement(index) {
    setEquipements((prev) => prev.filter((_, i) => i !== index))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      priorite: Number(priorite),
      actif,
      equipements: equipements.map((e) => e.trim()).filter(Boolean),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Hôtel de Ville - salle du conseil"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
          <input
            required
            type="number"
            min="1"
            value={priorite}
            onChange={(e) => setPriorite(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Équipements</label>
        <div className="space-y-2">
          {equipements.map((eq, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={eq}
                onChange={(e) => majEquipement(i, e.target.value)}
                placeholder="ex. 6 postes téléphoniques"
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <BoutonDiscret type="button" onClick={() => retirerEquipement(i)}>✕</BoutonDiscret>
            </div>
          ))}
        </div>
        <button type="button" onClick={ajouterEquipement} className="mt-2 text-xs text-slate-500 hover:text-slate-800 underline">
          + ajouter un équipement
        </button>
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
