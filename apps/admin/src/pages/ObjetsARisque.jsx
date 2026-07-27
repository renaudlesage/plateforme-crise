import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const CATEGORIES = [
  { valeur: 'naturel', libelle: 'Naturel' },
  { valeur: 'technologique', libelle: 'Technologique' },
  { valeur: 'industriel', libelle: 'Industriel' },
  { valeur: 'non_localisable', libelle: 'Non localisable' },
  { valeur: 'batiment_particulier', libelle: 'Bâtiment particulier' },
  { valeur: 'evenement', libelle: 'Événement' },
]

const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES.map((c) => [c.valeur, c.libelle]))

export default function ObjetsARisque() {
  const { contexteId } = useAuth()
  const {
    lignes: objets,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('objets_a_risque', contexteId, { tri: 'identification' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState('')

  const objetsFiltres = filtreCategorie
    ? objets.filter((o) => o.categorie === filtreCategorie)
    : objets

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900">Objets à risque</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un objet</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Inventaire des risques identifiés — l'évaluation détaillée et le plan d'action se
        feront depuis la fiche de chaque objet (à venir).
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireObjet
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
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.valeur} value={c.valeur}>
              {c.libelle}
            </option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : objetsFiltres.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun objet à risque enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {objetsFiltres.map((o) =>
            ligneEnEdition === o.id ? (
              <li key={o.id} className="bg-slate-50 p-3">
                <FormulaireObjet
                  valeursInitiales={o}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(o.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={o.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {o.identification}
                    {o.code && <span className="ml-2 text-xs font-mono text-slate-400">{o.code}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {LIBELLE_CATEGORIE[o.categorie] ?? o.categorie}
                    {o.type_risque && <> · {o.type_risque}</>}
                    {o.adresse && <> · {o.adresse}</>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                    {o.capacite_occupants != null && <span>capacité : {o.capacite_occupants}</span>}
                    {o.conformite_prevention != null && (
                      <span>
                        conformité prévention :{' '}
                        {o.conformite_prevention ? 'oui' : 'non'}
                        {o.conformite_date ? ` (${o.conformite_date})` : ''}
                      </span>
                    )}
                    {o.piu_recu != null && <span>PIU reçu : {o.piu_recu ? 'oui' : 'non'}</span>}
                    {o.priorite_declarant != null && <span>priorité déclarant : {o.priorite_declarant}</span>}
                    {o.priorite_cellule_securite != null && (
                      <span>priorité cellule sécurité : {o.priorite_cellule_securite}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(o.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${o.identification}" ?`)) supprimer(o.id)
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

function FormulaireObjet({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? 'naturel')
  const [typeRisque, setTypeRisque] = useState(valeursInitiales.type_risque ?? '')
  const [identification, setIdentification] = useState(valeursInitiales.identification ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? '')
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? '')
  const [capacite, setCapacite] = useState(valeursInitiales.capacite_occupants ?? '')
  const [hauteur, setHauteur] = useState(valeursInitiales.hauteur_infrastructure ?? '')
  const [conformite, setConformite] = useState(valeursInitiales.conformite_prevention ?? false)
  const [conformiteDate, setConformiteDate] = useState(valeursInitiales.conformite_date ?? '')
  const [piuRecu, setPiuRecu] = useState(valeursInitiales.piu_recu ?? false)
  const [prioriteDeclarant, setPrioriteDeclarant] = useState(valeursInitiales.priorite_declarant ?? '')
  const [prioriteCellule, setPrioriteCellule] = useState(valeursInitiales.priorite_cellule_securite ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      code: code.trim() || null,
      categorie,
      type_risque: typeRisque.trim(),
      identification: identification.trim(),
      adresse: adresse.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      capacite_occupants: capacite === '' ? null : Number(capacite),
      hauteur_infrastructure: hauteur.trim() || null,
      conformite_prevention: conformite,
      conformite_date: conformiteDate || null,
      piu_recu: piuRecu,
      priorite_declarant: prioriteDeclarant === '' ? null : Number(prioriteDeclarant),
      priorite_cellule_securite: prioriteCellule === '' ? null : Number(prioriteCellule),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Identification</label>
          <input
            required
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            placeholder="ex. Zoning industriel Nord"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Code interne</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type de risque</label>
          <input value={typeRisque} onChange={(e) => setTypeRisque(e.target.value)} placeholder="ex. seveso_seuil_haut" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Capacité (occupants)</label>
          <input type="number" value={capacite} onChange={(e) => setCapacite(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hauteur infrastructure</label>
          <input value={hauteur} onChange={(e) => setHauteur(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={conformite} onChange={(e) => setConformite(e.target.checked)} />
          Conforme (rapport prévention)
        </label>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date du rapport</label>
          <input type="date" value={conformiteDate} onChange={(e) => setConformiteDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={piuRecu} onChange={(e) => setPiuRecu(e.target.checked)} />
        Plan interne d'urgence (PIU) reçu de l'exploitant
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priorité déclarant (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteDeclarant} onChange={(e) => setPrioriteDeclarant(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priorité cellule sécurité (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteCellule} onChange={(e) => setPrioriteCellule(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
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
