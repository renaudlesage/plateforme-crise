import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES_PLAN = [
  { valeur: 'PGUI', libelle: 'PGUI — plan général' },
  { valeur: 'PPUI', libelle: 'PPUI — plan particulier' },
]

const STATUTS_PLAN = [
  { valeur: 'brouillon', libelle: 'Brouillon' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'archive', libelle: 'Archivé' },
]

export default function PlansUrgence() {
  const { contexteId } = useAuth()
  const {
    lignes: plans,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('plans_urgence', contexteId, { tri: 'type_plan' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Plans d'urgence (PGUI/PPUI)</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Créer un plan</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Le document légal lui-même — structuré selon le classement du Guide de l'éditeur (NCCN) :
        partie administrative, fiches de procédure P1-P9, fiches information I1-I2. Distinct de la
        gestion d'incident en temps réel.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulairePlan
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
      ) : plans.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun plan créé pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {plans.map((p) =>
            ligneEnEdition === p.id ? (
              <li key={p.id} className="bg-fond p-3">
                <FormulairePlan
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
                <Link to={`/plans-urgence/${p.id}`} className="flex-1">
                  <p className="text-sm font-medium text-encre">
                    {TYPES_PLAN.find((t) => t.valeur === p.type_plan)?.libelle ?? p.type_plan}
                    <span className="jeton ml-2 text-info">v{p.version}</span>
                    <span
                      className={`jeton ml-2 ${
                        p.statut === 'valide' ? 'text-chaud' : p.statut === 'archive' ? 'text-sourdine' : 'text-veille'
                      }`}
                    >
                      {STATUTS_PLAN.find((s) => s.valeur === p.statut)?.libelle ?? p.statut}
                    </span>
                  </p>
                  <p className="text-xs text-sourdine mt-0.5">
                    {p.date_redaction && <>rédigé le {p.date_redaction}{p.service_redaction && <> par {p.service_redaction}</>}</>}
                    {p.date_validation && <> · validé le {p.date_validation}{p.service_validation && <> par {p.service_validation}</>}</>}
                  </p>
                </Link>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(p.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer ce plan (v${p.version}) et toutes ses fiches ?`)) supprimer(p.id)
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

function FormulairePlan({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typePlan, setTypePlan] = useState(valeursInitiales.type_plan ?? 'PGUI')
  const [version, setVersion] = useState(valeursInitiales.version ?? '')
  const [dateRedaction, setDateRedaction] = useState(valeursInitiales.date_redaction ?? '')
  const [serviceRedaction, setServiceRedaction] = useState(valeursInitiales.service_redaction ?? '')
  const [dateValidation, setDateValidation] = useState(valeursInitiales.date_validation ?? '')
  const [serviceValidation, setServiceValidation] = useState(valeursInitiales.service_validation ?? '')
  const [frequenceMajMois, setFrequenceMajMois] = useState(valeursInitiales.frequence_maj_mois ?? '')
  const [statut, setStatut] = useState(valeursInitiales.statut ?? 'brouillon')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_plan: typePlan,
      version: version.trim(),
      date_redaction: dateRedaction || null,
      service_redaction: serviceRedaction.trim() || null,
      date_validation: dateValidation || null,
      service_validation: serviceValidation.trim() || null,
      frequence_maj_mois: frequenceMajMois === '' ? null : Number(frequenceMajMois),
      statut,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de plan</label>
          <select value={typePlan} onChange={(e) => setTypePlan(e.target.value)} className="w-full">
            {TYPES_PLAN.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Version</label>
          <input required value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex. 2026-1" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full">
            {STATUTS_PLAN.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de rédaction</label>
          <input type="date" value={dateRedaction} onChange={(e) => setDateRedaction(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Service rédacteur</label>
          <input value={serviceRedaction} onChange={(e) => setServiceRedaction(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de validation</label>
          <input type="date" value={dateValidation} onChange={(e) => setDateValidation(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Service validateur</label>
          <input value={serviceValidation} onChange={(e) => setServiceValidation(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Périodicité de mise à jour (mois)</label>
        <input type="number" min="1" value={frequenceMajMois} onChange={(e) => setFrequenceMajMois(e.target.value)} className="w-full sm:w-40" />
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
