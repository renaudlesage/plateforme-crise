import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const LIBELLE_OBLIGATION = {
  coordinateur_designe: 'Coordinateur planification d’urgence désigné',
  cellule_securite_reunion_annuelle: 'Cellule de sécurité réunie (≥1x/an)',
  pgui_elabore: 'PGUI élaboré',
  plan_monodisciplinaire_d5: 'Plan monodisciplinaire D5',
  exercice_multidisciplinaire_annuel: 'Exercice multidisciplinaire (≥1x/an)',
  evaluation_situation_urgence: 'Évaluation de toute situation d’urgence',
}

const LIBELLE_STATUT_OBLIGATION = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  conforme: 'Conforme',
  en_retard: 'En retard',
}

export default function ConformiteLegale() {
  const { contexteId } = useAuth()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-encre mb-1">Conformité légale AR 22 mai 2019</h1>
        <p className="text-sm text-sourdine">
          Obligations chiffrées du bourgmestre, réunions de la cellule de sécurité, matrice de
          risques communale. Depuis la réforme du Livre 6 du Code civil (1er janvier 2025, art.
          6.15), la commune répond désormais sans faute du dommage causé par ses organes — la
          traçabilité du journal de décisions (prévoyance, information de la population) devient
          un argument de défense direct.
        </p>
      </div>

      <BlocObligations contexteId={contexteId} />
      <BlocCelluleSecurite contexteId={contexteId} />
      <BlocMatriceRisques contexteId={contexteId} />
    </div>
  )
}

function BlocObligations({ contexteId }) {
  const { lignes, chargement, erreur, creer, modifier } = useTableContexte(
    'obligations_legales_bourgmestre',
    contexteId,
    { tri: 'type_obligation' }
  )

  async function initialiser() {
    const types = Object.keys(LIBELLE_OBLIGATION)
    for (const type_obligation of types) {
      if (!lignes.some((l) => l.type_obligation === type_obligation)) {
        await creer({ type_obligation, periodicite: type_obligation.includes('annuel') || type_obligation === 'cellule_securite_reunion_annuelle' ? 'annuelle' : 'ponctuelle' })
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-encre">Obligations légales annuelles</h2>
        {lignes.length < Object.keys(LIBELLE_OBLIGATION).length && !chargement && (
          <BoutonDiscret onClick={initialiser}>Initialiser les 6 obligations</BoutonDiscret>
        )}
      </div>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune obligation suivie — cliquez sur « Initialiser » pour créer les 6 obligations de l'AR du 22 mai 2019.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {lignes.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-4 py-3 bg-surface gap-3">
              <div>
                <p className="text-sm font-medium text-encre">{LIBELLE_OBLIGATION[o.type_obligation]}</p>
                <p className="text-xs text-sourdine mt-0.5">
                  {o.base_legale}
                  {o.periodicite && <> · {o.periodicite}</>}
                  {o.derniere_echeance_respectee && <> · dernière échéance respectée : {o.derniere_echeance_respectee}</>}
                  {o.prochaine_echeance && <> · prochaine échéance : {o.prochaine_echeance}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="flex items-center gap-1 text-xs text-sourdine" title="Volet gestion du stress aigu couvert">
                  <input
                    type="checkbox"
                    checked={o.volet_gestion_stress_aigu ?? false}
                    onChange={(e) => modifier(o.id, { volet_gestion_stress_aigu: e.target.checked })}
                  />
                  stress aigu
                </label>
                <input
                  type="date"
                  value={o.prochaine_echeance ?? ''}
                  onChange={(e) => modifier(o.id, { prochaine_echeance: e.target.value || null })}
                  title="Prochaine échéance"
                  className="text-xs"
                />
                <select
                  value={o.statut}
                  onChange={(e) => modifier(o.id, { statut: e.target.value })}
                  className={`pastille-filtre${o.statut === 'en_retard' ? ' actif' : ''}`}
                >
                  {Object.entries(LIBELLE_STATUT_OBLIGATION).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BlocCelluleSecurite({ contexteId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useTableContexte(
    'cellule_securite_communale',
    contexteId,
    { tri: 'date_reunion' }
  )
  const [enAjout, setEnAjout] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-encre">Réunions de la cellule de sécurité</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Enregistrer une réunion</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-3">Obligation légale : au moins une réunion par an.</p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireReunion
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
      ) : lignes.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune réunion enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {[...lignes].reverse().map((r) => (
            <li key={r.id} className="flex items-start justify-between px-4 py-3 bg-surface">
              <div>
                <p className="text-sm font-medium text-encre">{r.date_reunion}</p>
                {r.ordre_du_jour && <p className="text-xs text-sourdine mt-0.5">{r.ordre_du_jour}</p>}
                {r.conjointe_avec_communes?.length > 0 && (
                  <p className="text-xs text-sourdine mt-0.5">Conjointe avec : {r.conjointe_avec_communes.join(', ')}</p>
                )}
                {r.compte_rendu_url && (
                  <a href={r.compte_rendu_url} target="_blank" rel="noreferrer" className="text-xs lien">Compte-rendu</a>
                )}
              </div>
              <BoutonDiscret onClick={() => { if (confirm('Supprimer cette réunion ?')) supprimer(r.id) }}>Supprimer</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireReunion({ onValider, onAnnuler }) {
  const [dateReunion, setDateReunion] = useState('')
  const [ordreDuJour, setOrdreDuJour] = useState('')
  const [compteRenduUrl, setCompteRenduUrl] = useState('')
  const [conjointeAvec, setConjointeAvec] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      date_reunion: dateReunion,
      ordre_du_jour: ordreDuJour.trim() || null,
      compte_rendu_url: compteRenduUrl.trim() || null,
      conjointe_avec_communes: conjointeAvec.trim() ? conjointeAvec.split(',').map((c) => c.trim()).filter(Boolean) : null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de la réunion</label>
          <input required type="date" value={dateReunion} onChange={(e) => setDateReunion(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Communes conjointes (séparées par virgule)</label>
          <input value={conjointeAvec} onChange={(e) => setConjointeAvec(e.target.value)} className="w-full" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Ordre du jour</label>
        <textarea value={ordreDuJour} onChange={(e) => setOrdreDuJour(e.target.value)} rows={2} className="w-full" />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Lien vers le compte-rendu</label>
        <input value={compteRenduUrl} onChange={(e) => setCompteRenduUrl(e.target.value)} className="w-full" />
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function BlocMatriceRisques({ contexteId }) {
  const [categories, setCategories] = useState([])
  const { lignes, chargement, erreur } = useTableContexte('risques_territoire', contexteId, { tri: 'titre' })
  useEffect(() => {
    supabase.from('categories_risques_nccn').select('*').then(({ data }) => setCategories(data ?? []))
  }, [])
  const libelleCategorie = (code) => categories.find((c) => c.categorie === code)?.libelle ?? code
  const nbEvalues = lignes.filter((r) => r.niveau_calcule != null).length
  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-encre">Matrice de risques</h2>
        <Link to="/risques-territoire" className="lien text-sm">Gérer les risques du territoire</Link>
      </div>
      <p className="text-sm text-sourdine mb-3">
        Registre des risques du territoire par catégorie officielle NCCN, classés par niveau (probabilité × impact).
        La probabilité et l'impact se renseignent sur chaque fiche de risque.
        {lignes.length > 0 && <> {nbEvalues} évalué{nbEvalues > 1 ? 's' : ''} sur {lignes.length}.</>}
      </p>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun risque du territoire enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {[...lignes].sort((a, b) => (b.niveau_calcule ?? -1) - (a.niveau_calcule ?? -1)).map((r) => (
            <li key={r.id} className="px-4 py-3 bg-surface">
              <p className="text-sm font-medium text-encre">
                {r.titre}
                <span className="jeton ml-2 text-info">{libelleCategorie(r.categorie)}</span>
                {r.statut === 'ecarte' && <span className="jeton ml-2 text-sourdine">écarté</span>}
                {r.statut === 'a_evaluer' && <span className="jeton ml-2 text-veille">à évaluer</span>}
              </p>
              <p className="text-xs text-sourdine mt-0.5">
                {r.niveau_calcule != null ? (
                  <>
                    probabilité {r.probabilite} × impact {r.impact} = niveau {r.niveau_calcule}
                    {r.date_evaluation && <> · évalué le {r.date_evaluation}</>}
                  </>
                ) : (
                  'probabilité et impact non renseignés'
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
