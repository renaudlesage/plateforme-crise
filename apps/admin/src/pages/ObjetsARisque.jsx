import { useState } from 'react'
import { SelecteurLocalisation } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import {
  GestionEvaluationsRisque,
  GestionFonctionsCritiques,
  GestionLiensObjetRisque,
  GestionMesuresCompensatoires,
  GestionPlansAction,
} from '../components/SousBlocsRisque'

const CATEGORIES = [
  { valeur: 'naturel', libelle: 'Naturel' },
  { valeur: 'technologique', libelle: 'Technologique' },
  { valeur: 'industriel', libelle: 'Industriel' },
  { valeur: 'batiment_particulier', libelle: 'Bâtiment particulier' },
  { valeur: 'evenement', libelle: 'Événement' },
]

const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES.map((c) => [c.valeur, c.libelle]))

const NIVEAUX_CONFIDENTIALITE = [
  { valeur: 'public', libelle: 'Public' },
  { valeur: 'restreint', libelle: 'Restreint' },
  { valeur: 'confidentiel', libelle: 'Confidentiel' },
]

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
        <h1 className="text-xl font-semibold text-encre">Objets à risque</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un objet</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Particularités localisées du territoire — site Seveso, école, barrage, maison de repos,
        festival — qui génèrent un risque ou y sont exposées. Les menaces elles-mêmes (inondation,
        cyberattaque, canicule…) sont décrites dans les Risques du territoire, auxquels chaque objet
        peut être rattaché.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

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
          className=""
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
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : objetsFiltres.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun objet à risque enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {objetsFiltres.map((o) =>
            ligneEnEdition === o.id ? (
              <li key={o.id} className="bg-fond p-3">
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
              <li key={o.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {o.identification}
                    {o.code && <span className="ml-2 text-xs font-mono text-sourdine">{o.code}</span>}
                  </p>
                  <p className="text-xs text-sourdine">
                    {LIBELLE_CATEGORIE[o.categorie] ?? o.categorie}
                    {o.type_risque && <> · {o.type_risque}</>}
                    {o.adresse && <> · {o.adresse}</>}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5 flex flex-wrap gap-x-3">
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
                    {o.ppd_requis && <span className="text-veille">PPD requis</span>}
                    {o.aggrave_etendue_crue && <span className="text-chaud">aggravé par la crue</span>}
                    {o.niveau_confidentialite && o.niveau_confidentialite !== 'restreint' && (
                      <span>confidentialité : {o.niveau_confidentialite}</span>
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
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? 'batiment_particulier')
  const [typeRisque, setTypeRisque] = useState(valeursInitiales.type_risque ?? '')
  const [identification, setIdentification] = useState(valeursInitiales.identification ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? null)
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? null)
  const [capacite, setCapacite] = useState(valeursInitiales.capacite_occupants ?? '')
  const [hauteur, setHauteur] = useState(valeursInitiales.hauteur_infrastructure ?? '')
  const [conformite, setConformite] = useState(valeursInitiales.conformite_prevention ?? false)
  const [conformiteDate, setConformiteDate] = useState(valeursInitiales.conformite_date ?? '')
  const [piuRecu, setPiuRecu] = useState(valeursInitiales.piu_recu ?? false)
  const [prioriteDeclarant, setPrioriteDeclarant] = useState(valeursInitiales.priorite_declarant ?? '')
  const [prioriteCellule, setPrioriteCellule] = useState(valeursInitiales.priorite_cellule_securite ?? '')
  const [niveauConfidentialite, setNiveauConfidentialite] = useState(valeursInitiales.niveau_confidentialite ?? 'restreint')
  const [ppdRequis, setPpdRequis] = useState(valeursInitiales.ppd_requis ?? false)
  const [aggraveCrue, setAggraveCrue] = useState(valeursInitiales.aggrave_etendue_crue ?? false)
  const [ppdConditions, setPpdConditions] = useState(valeursInitiales.ppd_conditions ?? '')
  const [ppdDistanceSecurite, setPpdDistanceSecurite] = useState(valeursInitiales.ppd_distance_securite_m ?? '')
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
      latitude: latitude == null || latitude === '' ? null : Number(latitude),
      longitude: longitude == null || longitude === '' ? null : Number(longitude),
      capacite_occupants: capacite === '' ? null : Number(capacite),
      hauteur_infrastructure: hauteur.trim() || null,
      conformite_prevention: conformite,
      conformite_date: conformiteDate || null,
      piu_recu: piuRecu,
      priorite_declarant: prioriteDeclarant === '' ? null : Number(prioriteDeclarant),
      priorite_cellule_securite: prioriteCellule === '' ? null : Number(prioriteCellule),
      niveau_confidentialite: niveauConfidentialite,
      ppd_requis: ppdRequis,
      aggrave_etendue_crue: aggraveCrue,
      ppd_conditions: ppdConditions.trim() || null,
      ppd_distance_securite_m: ppdDistanceSecurite === '' ? null : Number(ppdDistanceSecurite),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Identification</label>
          <input
            required
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            placeholder="ex. Zoning industriel Nord"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code interne</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full">
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type d'objet</label>
          <input value={typeRisque} onChange={(e) => setTypeRisque(e.target.value)} placeholder="ex. seveso_seuil_haut, établissement scolaire" className="w-full" />
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
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Capacité (occupants)</label>
          <input type="number" value={capacite} onChange={(e) => setCapacite(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Hauteur infrastructure</label>
          <input value={hauteur} onChange={(e) => setHauteur(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={conformite} onChange={(e) => setConformite(e.target.checked)} />
          Conforme (rapport prévention)
        </label>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date du rapport</label>
          <input type="date" value={conformiteDate} onChange={(e) => setConformiteDate(e.target.value)} className="w-full" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={piuRecu} onChange={(e) => setPiuRecu(e.target.checked)} />
        Plan interne d'urgence (PIU) reçu de l'exploitant
      </label>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={aggraveCrue} onChange={(e) => setAggraveCrue(e.target.checked)} />
        Risque aggravé en cas de crue (l'étendue de l'inondation peut étendre ou aggraver l'événement)
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Priorité déclarant (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteDeclarant} onChange={(e) => setPrioriteDeclarant(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Priorité cellule sécurité (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteCellule} onChange={(e) => setPrioriteCellule(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau de confidentialité</label>
          <select value={niveauConfidentialite} onChange={(e) => setNiveauConfidentialite(e.target.value)} className="w-full">
            {NIVEAUX_CONFIDENTIALITE.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2 border border-trait rounded p-3">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={ppdRequis} onChange={(e) => setPpdRequis(e.target.checked)} />
          Plan particulier d'urgence et d'intervention (PPUI) requis
        </label>
        {ppdRequis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Conditions de déclenchement du PPUI</label>
              <textarea value={ppdConditions} onChange={(e) => setPpdConditions(e.target.value)} rows={2} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Distance de sécurité (m)</label>
              <input type="number" value={ppdDistanceSecurite} onChange={(e) => setPpdDistanceSecurite(e.target.value)} className="w-full" />
            </div>
          </div>
        )}
      </div>

      {valeursInitiales.id ? (
        <div className="space-y-3 border border-trait rounded p-3">
          <p className="text-xs font-medium text-sourdine">Risques, évaluation et suivi de l'objet</p>
          <GestionLiensObjetRisque cote="objet" id={valeursInitiales.id} />
          <GestionEvaluationsRisque parent={{ colonne: 'objet_risque_id', id: valeursInitiales.id }} />
          <GestionPlansAction parent={{ colonne: 'objet_risque_id', id: valeursInitiales.id }} />
          <GestionFonctionsCritiques parent={{ table: 'objets_a_risque_fonctions_critiques', colonne: 'objet_id', id: valeursInitiales.id }} />
          <GestionMesuresCompensatoires parent={{ colonne: 'objet_risque_id', id: valeursInitiales.id }} />
        </div>
      ) : (
        <p className="text-xs text-sourdine">
          Les risques liés, l'évaluation, le plan d'action et les fonctions critiques se renseignent après
          l'enregistrement, en modifiant l'objet.
        </p>
      )}

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
