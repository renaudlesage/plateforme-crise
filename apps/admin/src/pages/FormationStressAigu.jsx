import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const TYPES_MODULE = [
  { valeur: 'sensibilisation_theorique', libelle: 'Sensibilisation théorique' },
  { valeur: 'exercice_simulation', libelle: 'Exercice / simulation' },
  { valeur: 'debriefing_post_exercice', libelle: 'Débriefing post-exercice' },
]

export default function FormationStressAigu() {
  const { contexteId } = useAuth()
  const {
    lignes: modules,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('modules_formation_stress_aigu', contexteId, { tri: 'date_session' })

  const [stresseurs, setStresseurs] = useState([])
  const [reactions, setReactions] = useState([])
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  useEffect(() => {
    supabase.from('referentiel_stresseurs_crise').select('*').order('rang_importance_etude').then(({ data }) => setStresseurs(data ?? []))
    supabase.from('referentiel_reactions_stress_depasse').select('*').then(({ data }) => setReactions(data ?? []))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Facteur humain — stress aigu</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un module</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Sensibilisation et traçabilité des entraînements à la reconnaissance du stress aigu —
        registre de formation, jamais un outil de diagnostic clinique individuel.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="border border-trait rounded p-3 bg-fond">
          <p className="text-xs font-medium text-encre mb-2">Stresseurs principaux (étude Vraie &amp; Gaultier-Gaillard)</p>
          <ol className="list-decimal list-inside text-xs text-sourdine space-y-0.5">
            {stresseurs.map((s) => <li key={s.id}>{s.libelle}</li>)}
          </ol>
        </div>
        <div className="border border-trait rounded p-3 bg-fond">
          <p className="text-xs font-medium text-encre mb-2">4 réactions de stress dépassé (Crocq)</p>
          <ul className="list-disc list-inside text-xs text-sourdine space-y-0.5">
            {reactions.map((r) => <li key={r.id}>{r.libelle}{r.risque_contagion && ' (risque de contagion)'}</li>)}
          </ul>
        </div>
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireModule
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
      ) : modules.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun module de formation enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {modules.map((m) =>
            ligneEnEdition === m.id ? (
              <li key={m.id} className="bg-fond p-3">
                <FormulaireModule
                  valeursInitiales={m}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(m.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    <span className="jeton mr-2 text-info">{TYPES_MODULE.find((t) => t.valeur === m.type_module)?.libelle}</span>
                    {m.date_session && new Date(m.date_session).toLocaleDateString('fr-BE')}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5">
                    {m.public_cible && <>public : {m.public_cible}</>}
                    {m.taux_participation != null && <> · participation : {m.taux_participation}%</>}
                  </p>
                  {m.reactions_abordees?.length > 0 && (
                    <p className="text-xs text-sourdine mt-0.5">réactions abordées : {m.reactions_abordees.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(m.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer ce module ?')) supprimer(m.id)
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

function FormulaireModule({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeModule, setTypeModule] = useState(valeursInitiales.type_module ?? 'sensibilisation_theorique')
  const [publicCible, setPublicCible] = useState(valeursInitiales.public_cible ?? '')
  const [dateSession, setDateSession] = useState(valeursInitiales.date_session ?? '')
  const [reactionsAbordees, setReactionsAbordees] = useState((valeursInitiales.reactions_abordees ?? []).join(', '))
  const [tauxParticipation, setTauxParticipation] = useState(valeursInitiales.taux_participation ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_module: typeModule,
      public_cible: publicCible.trim() || null,
      date_session: dateSession || null,
      reactions_abordees: reactionsAbordees
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      taux_participation: tauxParticipation === '' ? null : Number(tauxParticipation),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de module</label>
          <select value={typeModule} onChange={(e) => setTypeModule(e.target.value)} className="w-full">
            {TYPES_MODULE.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de session</label>
          <input type="date" value={dateSession} onChange={(e) => setDateSession(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Public cible</label>
          <input value={publicCible} onChange={(e) => setPublicCible(e.target.value)} placeholder="ex. cellule de sécurité" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Taux de participation (%)</label>
          <input type="number" min="0" max="100" value={tauxParticipation} onChange={(e) => setTauxParticipation(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Réactions abordées</label>
        <input
          value={reactionsAbordees}
          onChange={(e) => setReactionsAbordees(e.target.value)}
          placeholder="sideration, agitation, fuite_panique, comportement_automate"
          className="w-full"
        />
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
