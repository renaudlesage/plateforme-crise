import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import BenevolesEntraide from './BenevolesEntraide'

const CATEGORIES = [
  'vehicule',
  'transport_personnes',
  'genie_civil',
  'signalisation',
  'materiel_divers',
  'alimentation',
  'hebergement',
  'interprete',
  'personnel',
  'reservoir_souple',
]

const DIMENSIONS_CAPACITE = [
  { valeur: 'doctrine', libelle: 'Doctrine' },
  { valeur: 'organisation', libelle: 'Organisation' },
  { valeur: 'entrainement', libelle: 'Entraînement' },
  { valeur: 'materiel', libelle: 'Matériel' },
  { valeur: 'leadership', libelle: 'Leadership' },
  { valeur: 'personnel', libelle: 'Personnel' },
  { valeur: 'interoperabilite', libelle: 'Interopérabilité' },
]

export default function Ressources() {
  const [onglet, setOnglet] = useState('ressources')

  return (
    <div>
      <div className="onglets">
        <button
          onClick={() => setOnglet('ressources')}
          className={`module${onglet === 'ressources' ? ' actif' : ''}`}
        >
          Ressources
        </button>
        <button
          onClick={() => setOnglet('benevoles')}
          className={`module${onglet === 'benevoles' ? ' actif' : ''}`}
        >
          Bénévoles (réseau citoyen)
        </button>
      </div>

      {onglet === 'ressources' ? <ListeRessources /> : <BenevolesEntraide />}
    </div>
  )
}

function ListeRessources() {
  const { contexteId } = useAuth()
  const {
    lignes: ressources,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('ressources', contexteId, {
    colonnes: '*, contacts(id, nom, prenom), conventions(id, partenaire)',
    tri: 'nom',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const { lignes: conventions } = useTableContexte('conventions', contexteId, { tri: 'partenaire' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreType, setFiltreType] = useState('')

  const ressourcesFiltrees = ressources.filter((r) => {
    if (filtreCategorie && r.categorie !== filtreCategorie) return false
    if (filtreType && r.type_public_prive !== filtreType) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Ressources</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une ressource</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Moyens matériels et humains mobilisables — publics ou privés sous convention.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireRessource
          contacts={contacts}
          conventions={conventions}
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <select
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className=""
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          className=""
        >
          <option value="">Public + privé</option>
          <option value="public">Public</option>
          <option value="prive">Privé</option>
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : ressourcesFiltrees.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune ressource ne correspond.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {ressourcesFiltrees.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="bg-fond p-3">
                <FormulaireRessource
                  contacts={contacts}
                  conventions={conventions}
                  valeursInitiales={r}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(r.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={r.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {r.nom}
                    <span className={`jeton ml-2 ${r.type_public_prive === 'public' ? 'text-info' : 'text-veille'}`}>
                      {r.type_public_prive}
                    </span>
                  </p>
                  <p className="text-xs text-sourdine">
                    {r.categorie.replace(/_/g, ' ')}
                    {r.dimension_capacite && (
                      <span className="jeton ml-2">
                        {DIMENSIONS_CAPACITE.find((d) => d.valeur === r.dimension_capacite)?.libelle ?? r.dimension_capacite}
                      </span>
                    )}
                  </p>
                  {r.attributs && Object.keys(r.attributs).length > 0 && (
                    <p className="text-xs text-sourdine mt-0.5 flex flex-wrap gap-x-3">
                      {Object.entries(r.attributs).map(([cle, valeur]) => (
                        <span key={cle}>{cle} : {String(valeur)}</span>
                      ))}
                    </p>
                  )}
                  {r.contacts && (
                    <p className="text-xs text-sourdine mt-0.5">
                      contact : {r.contacts.prenom} {r.contacts.nom}
                    </p>
                  )}
                  {r.conventions && (
                    <p className="text-xs text-sourdine mt-0.5">
                      convention : {r.conventions.partenaire}
                    </p>
                  )}
                  {r.disponible_hors_contexte && (
                    <p className="text-xs text-info mt-0.5">
                      partageable hors contexte{r.rayon_partage_km ? ` (rayon ${r.rayon_partage_km} km)` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${r.nom}" ?`)) supprimer(r.id)
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

function FormulaireRessource({ contacts, conventions = [], valeursInitiales = {}, onValider, onAnnuler }) {
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? CATEGORIES[0])
  const [dimensionCapacite, setDimensionCapacite] = useState(valeursInitiales.dimension_capacite ?? '')
  const [typePublicPrive, setTypePublicPrive] = useState(valeursInitiales.type_public_prive ?? 'public')
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [contactId, setContactId] = useState(valeursInitiales.contact_id ?? '')
  const [conventionId, setConventionId] = useState(valeursInitiales.convention_id ?? '')
  const [attributs, setAttributs] = useState(() => {
    const initial = valeursInitiales.attributs ?? {}
    const entries = Object.entries(initial)
    return entries.length > 0 ? entries.map(([cle, valeur]) => ({ cle, valeur: String(valeur) })) : [{ cle: '', valeur: '' }]
  })
  const [disponibleHorsContexte, setDisponibleHorsContexte] = useState(valeursInitiales.disponible_hors_contexte ?? false)
  const [operationnelDeNuit, setOperationnelDeNuit] = useState(valeursInitiales.operationnel_de_nuit ?? false)
  const [rayonPartageKm, setRayonPartageKm] = useState(valeursInitiales.rayon_partage_km ?? '')
  const [conditionsPartage, setConditionsPartage] = useState(valeursInitiales.conditions_partage ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function majAttribut(index, champ, valeur) {
    setAttributs((prev) => prev.map((a, i) => (i === index ? { ...a, [champ]: valeur } : a)))
  }

  function ajouterAttribut() {
    setAttributs((prev) => [...prev, { cle: '', valeur: '' }])
  }

  function retirerAttribut(index) {
    setAttributs((prev) => prev.filter((_, i) => i !== index))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const attributsObjet = Object.fromEntries(
      attributs.filter((a) => a.cle.trim()).map((a) => [a.cle.trim(), a.valeur])
    )
    const { error } = await onValider({
      categorie,
      type_public_prive: typePublicPrive,
      nom: nom.trim(),
      contact_id: contactId || null,
      convention_id: conventionId || null,
      attributs: attributsObjet,
      dimension_capacite: dimensionCapacite || null,
      disponible_hors_contexte: disponibleHorsContexte,
      operationnel_de_nuit: operationnelDeNuit,
      rayon_partage_km: rayonPartageKm === '' ? null : Number(rayonPartageKm),
      conditions_partage: conditionsPartage.trim() || null,
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
            placeholder="ex. Camion-citerne 5000L"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <div className="flex gap-4 pt-1.5">
            <label className="flex items-center gap-1.5 text-sm text-sourdine">
              <input type="radio" checked={typePublicPrive === 'public'} onChange={() => setTypePublicPrive('public')} />
              Public
            </label>
            <label className="flex items-center gap-1.5 text-sm text-sourdine">
              <input type="radio" checked={typePublicPrive === 'prive'} onChange={() => setTypePublicPrive('prive')} />
              Privé
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Contact associé</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">
          Dimension de capacité <span className="text-sourdine">(cadre DOTMLPI-E — commission Schmitz)</span>
        </label>
        <select value={dimensionCapacite} onChange={(e) => setDimensionCapacite(e.target.value)} className="w-full sm:w-64">
          <option value="">—</option>
          {DIMENSIONS_CAPACITE.map((d) => (
            <option key={d.valeur} value={d.valeur}>{d.libelle}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Convention associée</label>
        <select value={conventionId} onChange={(e) => setConventionId(e.target.value)} className="w-full">
          <option value="">—</option>
          {conventions.map((c) => (
            <option key={c.id} value={c.id}>{c.partenaire}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">
          Attributs <span className="text-sourdine">(libres selon la catégorie : capacité, immatriculation, permis…)</span>
        </label>
        <div className="space-y-2">
          {attributs.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={a.cle}
                onChange={(e) => majAttribut(i, 'cle', e.target.value)}
                placeholder="clé (ex. capacité)"
                className="flex-1"
              />
              <input
                value={a.valeur}
                onChange={(e) => majAttribut(i, 'valeur', e.target.value)}
                placeholder="valeur (ex. 9 places)"
                className="flex-1"
              />
              <BoutonDiscret type="button" onClick={() => retirerAttribut(i)}>✕</BoutonDiscret>
            </div>
          ))}
        </div>
        <button type="button" onClick={ajouterAttribut} className="mt-2 text-xs text-sourdine hover:text-encre underline">
          + ajouter un attribut
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={operationnelDeNuit} onChange={(e) => setOperationnelDeNuit(e.target.checked)} />
        Opérationnel de nuit (engageable 24 h/24)
      </label>

      <div className="space-y-2 border border-trait rounded p-3">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={disponibleHorsContexte} onChange={(e) => setDisponibleHorsContexte(e.target.checked)} />
          Partageable avec les contextes voisins (coordination inter-zone)
        </label>
        {disponibleHorsContexte && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Rayon de partage (km)</label>
              <input type="number" value={rayonPartageKm} onChange={(e) => setRayonPartageKm(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Conditions de partage</label>
              <input value={conditionsPartage} onChange={(e) => setConditionsPartage(e.target.value)} className="w-full" />
            </div>
          </div>
        )}
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
