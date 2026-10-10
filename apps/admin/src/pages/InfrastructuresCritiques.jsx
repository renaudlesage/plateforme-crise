import { useState } from 'react'
import { SelecteurLocalisation } from '@plateforme-crise/shared'
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
  } = useTableContexte('infrastructures_critiques', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'nom',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Infrastructures critiques</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une infrastructure</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Réseaux, télécom, énergie... géolocalisés, avec leur exposition aux risques — distinct
        des fonctions critiques (qui suivent un service, pas un lieu).
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireInfrastructure
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
      ) : infrastructures.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune infrastructure critique enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {infrastructures.map((i) =>
            ligneEnEdition === i.id ? (
              <li key={i.id} className="bg-fond p-3">
                <FormulaireInfrastructure
                  contacts={contacts}
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
              <li key={i.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {i.nom}
                    {!i.actif && <span className="ml-2 text-xs text-sourdine">(inactif)</span>}
                    {i.degre_criticite != null && (
                      <span className="jeton ml-2 bg-encre text-fond">
                        criticité {i.degre_criticite}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-sourdine">
                    {i.type}
                    {i.adresse && <> · {i.adresse}</>}
                  </p>
                  {i.expositions_risques?.length > 0 && (
                    <p className="text-xs text-sourdine mt-0.5">exposée à : {i.expositions_risques.join(', ')}</p>
                  )}
                  {i.contacts && (
                    <p className="text-xs text-sourdine mt-0.5">gestionnaire : {i.contacts.prenom} {i.contacts.nom}</p>
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

function FormulaireInfrastructure({ contacts = [], valeursInitiales = {}, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [type, setType] = useState(valeursInitiales.type ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? null)
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? null)
  const [expositions, setExpositions] = useState((valeursInitiales.expositions_risques ?? []).join(', '))
  const [niveauCriticite, setNiveauCriticite] = useState(valeursInitiales.degre_criticite ?? '')
  const [gestionnaireContactId, setGestionnaireContactId] = useState(valeursInitiales.gestionnaire_contact_id ?? '')
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
      latitude: latitude == null || latitude === '' ? null : Number(latitude),
      longitude: longitude == null || longitude === '' ? null : Number(longitude),
      expositions_risques: expositions.split(',').map((s) => s.trim()).filter(Boolean),
      degre_criticite: niveauCriticite === '' ? null : Number(niveauCriticite),
      gestionnaire_contact_id: gestionnaireContactId || null,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Poste électrique Nord"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <input required value={type} onChange={(e) => setType(e.target.value)} placeholder="ex. électricité, télécom, eau" className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Adresse</label>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-full">
          <label className="block text-xs font-medium text-sourdine mb-1">Position</label>
          <SelecteurLocalisation
            lat={latitude}
            lon={longitude}
            onChange={(lat, lon) => { setLatitude(lat); setLongitude(lon) }}
            hauteur="260px"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau de criticité (1-4)</label>
          <input type="number" min="1" max="4" value={niveauCriticite} onChange={(e) => setNiveauCriticite(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Expositions aux risques (séparées par des virgules)</label>
        <input value={expositions} onChange={(e) => setExpositions(e.target.value)} placeholder="ex. inondation, feu de forêt" className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Gestionnaire</label>
        <select value={gestionnaireContactId} onChange={(e) => setGestionnaireContactId(e.target.value)} className="w-full">
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
