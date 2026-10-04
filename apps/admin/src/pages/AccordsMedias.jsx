import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const NIVEAUX = [
  { valeur: 'communal', libelle: 'Communal' },
  { valeur: 'provincial', libelle: 'Provincial' },
  { valeur: 'national', libelle: 'National' },
]

export default function AccordsMedias() {
  const { contexteId } = useAuth()
  const {
    lignes: accords,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('accords_medias', contexteId, { tri: 'partenaire_media' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Accords-cadres médias</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un accord</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Accords-cadres juridiques entre l'autorité et les médias (fiche D5/9 annexe, guide IBZ
        2007) — préparés avant la crise, pour que les fiches soient prêtes avant la crise, pas
        pendant.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireAccord
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
      ) : accords.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun accord-cadre média enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {accords.map((a) =>
            ligneEnEdition === a.id ? (
              <li key={a.id} className="bg-fond p-3">
                <FormulaireAccord
                  valeursInitiales={a}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(a.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={a.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {a.niveau && <span className="jeton mr-2 text-info">{NIVEAUX.find((n) => n.valeur === a.niveau)?.libelle ?? a.niveau}</span>}
                    {a.partenaire_media}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5">
                    {a.date_signature && <>signé le {new Date(a.date_signature).toLocaleDateString('fr-BE')}</>}
                    {a.terminated_at || a.date_resiliation ? (
                      <span className="text-chaud ml-2">résilié</span>
                    ) : null}
                  </p>
                  {a.document_url && (
                    <a href={a.document_url} target="_blank" rel="noreferrer" className="lien text-xs mt-1 inline-block">
                      Document
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(a.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer cet accord ?')) supprimer(a.id)
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

function FormulaireAccord({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [partenaireMedia, setPartenaireMedia] = useState(valeursInitiales.partenaire_media ?? '')
  const [niveau, setNiveau] = useState(valeursInitiales.niveau ?? 'communal')
  const [dateSignature, setDateSignature] = useState(valeursInitiales.date_signature ?? '')
  const [dateDebutValidite, setDateDebutValidite] = useState(valeursInitiales.date_debut_validite ?? '')
  const [dateResiliation, setDateResiliation] = useState(valeursInitiales.date_resiliation ?? '')
  const [motifResiliation, setMotifResiliation] = useState(valeursInitiales.motif_resiliation ?? '')
  const [documentUrl, setDocumentUrl] = useState(valeursInitiales.document_url ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    if (!partenaireMedia.trim()) return
    setEnCours(true)
    const { error } = await onValider({
      partenaire_media: partenaireMedia.trim(),
      niveau,
      date_signature: dateSignature || null,
      date_debut_validite: dateDebutValidite || null,
      date_resiliation: dateResiliation || null,
      motif_resiliation: motifResiliation.trim() || null,
      document_url: documentUrl.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Média partenaire</label>
          <input required value={partenaireMedia} onChange={(e) => setPartenaireMedia(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full">
            {NIVEAUX.map((n) => <option key={n.valeur} value={n.valeur}>{n.libelle}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de signature</label>
          <input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de début de validité</label>
          <input type="date" value={dateDebutValidite} onChange={(e) => setDateDebutValidite(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de résiliation</label>
          <input type="date" value={dateResiliation} onChange={(e) => setDateResiliation(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Document (URL)</label>
          <input value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Motif de résiliation</label>
        <textarea value={motifResiliation} onChange={(e) => setMotifResiliation(e.target.value)} rows={2} className="w-full" />
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
