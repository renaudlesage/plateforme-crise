import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function SirenesZones() {
  const { contexteId } = useAuth()
  const {
    lignes: zones,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('zones_sirenes', contexteId, { tri: 'zone_code' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Zones sirènes</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une zone</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Zones couvertes par le réseau de sirènes (rayon réflexe de 15 km autour des sites
        Seveso/nucléaires). Utilisées lors du déclenchement réflexe depuis la fiche incident.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireZone
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
      ) : zones.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune zone sirène enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {zones.map((z) =>
            ligneEnEdition === z.id ? (
              <li key={z.id} className="bg-fond p-3">
                <FormulaireZone
                  valeursInitiales={z}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(z.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={z.id} className="flex items-center justify-between px-4 py-2.5 bg-surface">
                <span className="text-sm text-encre">
                  <span className="jeton mr-2">{z.zone_code}</span>
                  rayon {z.rayon_km} km
                </span>
                <div className="flex gap-2">
                  <BoutonDiscret onClick={() => setLigneEnEdition(z.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer cette zone ?')) supprimer(z.id)
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

function FormulaireZone({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [zoneCode, setZoneCode] = useState(valeursInitiales.zone_code ?? '')
  const [rayonKm, setRayonKm] = useState(valeursInitiales.rayon_km ?? 15)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    if (!zoneCode.trim()) return
    setEnCours(true)
    const { error } = await onValider({
      zone_code: zoneCode.trim(),
      rayon_km: rayonKm === '' ? null : Number(rayonKm),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code de zone</label>
          <input required value={zoneCode} onChange={(e) => setZoneCode(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Rayon (km)</label>
          <input type="number" step="0.1" value={rayonKm} onChange={(e) => setRayonKm(e.target.value)} className="w-full" />
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
