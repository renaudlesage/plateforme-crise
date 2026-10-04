import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

export default function AnnuaireSoutien() {
  const { contexteId } = useAuth()
  const {
    lignes: ressourcesLocales,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('annuaire_soutien_psychologique', contexteId, {
    tri: 'ordre_affichage',
  })

  const [ressourcesNationales, setRessourcesNationales] = useState([])
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  useState(() => {
    supabase
      .from('annuaire_soutien_psychologique')
      .select('*')
      .is('contexte_id', null)
      .order('ordre_affichage')
      .then(({ data }) => setRessourcesNationales(data ?? []))
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Annuaire de soutien psychologique</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une ressource locale</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Affiché côté citoyen (page "Besoin d'en parler ?"). Les ressources nationales
        (Télé-Accueil, Écoute Enfants, Centre de Prévention du Suicide) sont communes à
        toutes les communes et gérées par la plateforme ; ajoutez ici vos propres relais
        locaux (service social communal, PMS, maison médicale de garde…).
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireRessource
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <h2 className="text-sm font-semibold text-sourdine mt-5 mb-2">Ressources locales</h2>
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : ressourcesLocales.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune ressource locale enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {ressourcesLocales.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="bg-fond p-3">
                <FormulaireRessource
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
                    {r.nom} <span className="jeton ml-2">{r.numero_telephone}</span>
                    {!r.actif && <span className="jeton ml-2 text-chaud">masqué</span>}
                  </p>
                  {r.description && <p className="text-xs text-sourdine mt-0.5">{r.description}</p>}
                  <p className="text-xs text-sourdine mt-0.5">
                    {r.public_cible}
                    {r.public_cible && r.disponibilite && ' · '}
                    {r.disponibilite}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer la ressource "${r.nom}" ?`)) supprimer(r.id)
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

      <h2 className="text-sm font-semibold text-sourdine mt-6 mb-2">Ressources nationales (lecture seule)</h2>
      <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow opacity-80">
        {ressourcesNationales.map((r) => (
          <li key={r.id} className="px-4 py-3 bg-surface">
            <p className="text-sm font-medium text-encre">
              {r.nom} <span className="jeton ml-2">{r.numero_telephone}</span>
            </p>
            {r.description && <p className="text-xs text-sourdine mt-0.5">{r.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FormulaireRessource({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [numeroTelephone, setNumeroTelephone] = useState(valeursInitiales.numero_telephone ?? '')
  const [description, setDescription] = useState(valeursInitiales.description ?? '')
  const [publicCible, setPublicCible] = useState(valeursInitiales.public_cible ?? '')
  const [disponibilite, setDisponibilite] = useState(valeursInitiales.disponibilite ?? '')
  const [ordreAffichage, setOrdreAffichage] = useState(valeursInitiales.ordre_affichage ?? 10)
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      numero_telephone: numeroTelephone.trim(),
      description: description.trim() || null,
      public_cible: publicCible.trim() || null,
      disponibilite: disponibilite.trim() || null,
      ordre_affichage: Number(ordreAffichage) || 0,
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
          <input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Service social communal" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Numéro de téléphone</label>
          <input required value={numeroTelephone} onChange={(e) => setNumeroTelephone(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Public cible</label>
          <input value={publicCible} onChange={(e) => setPublicCible(e.target.value)} placeholder="ex. adultes" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Disponibilité</label>
          <input value={disponibilite} onChange={(e) => setDisponibilite(e.target.value)} placeholder="ex. 24h/24, 7j/7" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Ordre d'affichage</label>
          <input type="number" value={ordreAffichage} onChange={(e) => setOrdreAffichage(e.target.value)} className="w-full" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Visible côté citoyen
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
