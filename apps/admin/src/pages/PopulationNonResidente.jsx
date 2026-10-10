import { useState } from 'react'
import { SelecteurLocalisation } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES = [
  { valeur: 'camping', libelle: 'Camping' },
  { valeur: 'plaine_de_jeux', libelle: 'Plaine de jeux' },
  { valeur: 'evenement_temporaire', libelle: 'Événement temporaire' },
  { valeur: 'tourisme', libelle: 'Tourisme' },
  { valeur: 'scolaire', libelle: 'Scolaire' },
  { valeur: 'autre', libelle: 'Autre' },
]

export default function PopulationNonResidente() {
  const { contexteId } = useAuth()
  const {
    lignes: populations,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('population_non_residente', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'lieu',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Population non résidente</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un lieu</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Population exposée temporaire — campings, plaines de jeux, tourisme — distincte de la
        population résidente recensée.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulairePopulation
          contacts={contacts}
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
      ) : populations.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun lieu enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {populations.map((p) =>
            ligneEnEdition === p.id ? (
              <li key={p.id} className="bg-fond p-3">
                <FormulairePopulation
                  contacts={contacts}
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
              <li key={p.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {p.lieu}
                    {!p.actif && <span className="ml-2 text-xs text-sourdine">(inactif)</span>}
                  </p>
                  <p className="text-xs text-sourdine">
                    {TYPES.find((t) => t.valeur === p.type_population)?.libelle ?? p.type_population}
                    {p.capacite_max != null && <> · capacité max : {p.capacite_max}</>}
                  </p>
                  {(p.periode_debut || p.periode_fin) && (
                    <p className="text-xs text-sourdine mt-0.5">
                      période : {p.periode_debut ?? '?'} → {p.periode_fin ?? '?'}
                    </p>
                  )}
                  {p.contacts && (
                    <p className="text-xs text-sourdine mt-0.5">gestionnaire : {p.contacts.prenom} {p.contacts.nom}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(p.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${p.lieu}" ?`)) supprimer(p.id)
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

function FormulairePopulation({ contacts = [], valeursInitiales = {}, onValider, onAnnuler }) {
  const [typePopulation, setTypePopulation] = useState(valeursInitiales.type_population ?? TYPES[0].valeur)
  const [lieu, setLieu] = useState(valeursInitiales.lieu ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? null)
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? null)
  const [capaciteMax, setCapaciteMax] = useState(valeursInitiales.capacite_max ?? '')
  const [periodeDebut, setPeriodeDebut] = useState(valeursInitiales.periode_debut ?? '')
  const [periodeFin, setPeriodeFin] = useState(valeursInitiales.periode_fin ?? '')
  const [contactGestionnaireId, setContactGestionnaireId] = useState(valeursInitiales.gestionnaire_contact_id ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_population: typePopulation,
      lieu: lieu.trim(),
      latitude: latitude == null || latitude === '' ? null : Number(latitude),
      longitude: longitude == null || longitude === '' ? null : Number(longitude),
      capacite_max: capaciteMax === '' ? null : Number(capaciteMax),
      periode_debut: periodeDebut || null,
      periode_fin: periodeFin || null,
      gestionnaire_contact_id: contactGestionnaireId || null,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Lieu</label>
          <input
            required
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="ex. Camping des Roches"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <select value={typePopulation} onChange={(e) => setTypePopulation(e.target.value)} className="w-full">
            {TYPES.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-full">
          <label className="block text-xs font-medium text-sourdine mb-1">Position</label>
          <SelecteurLocalisation
            lat={latitude}
            lon={longitude}
            onChange={(lat, lon) => { setLatitude(lat); setLongitude(lon) }}
            hauteur="260px"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Capacité max</label>
          <input type="number" value={capaciteMax} onChange={(e) => setCapaciteMax(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Période — début</label>
          <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Période — fin</label>
          <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Gestionnaire</label>
        <select value={contactGestionnaireId} onChange={(e) => setContactGestionnaireId(e.target.value)} className="w-full">
          <option value="">—</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Actif
      </label>

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
