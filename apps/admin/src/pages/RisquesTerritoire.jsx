import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'
import { PACK_DEMARRAGE_RISQUES } from '../data/packDemarrageRisques'
import {
  GestionEvaluationsRisque,
  GestionFonctionsCritiques,
  GestionLiensObjetRisque,
  GestionMesuresCompensatoires,
  GestionPlansAction,
} from '../components/SousBlocsRisque'

// Catégories officielles NCCN (table categories_risques_nccn, clé `categorie`).
const CATEGORIES = [
  { valeur: 'naturel', libelle: 'Naturel' },
  { valeur: 'technologique', libelle: 'Technologique' },
  { valeur: 'man_made', libelle: 'Anthropique (man-made)' },
  { valeur: 'sanitaire', libelle: 'Sanitaire' },
]
const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES.map((c) => [c.valeur, c.libelle]))

const STATUTS = [
  { valeur: 'a_evaluer', libelle: 'À évaluer' },
  { valeur: 'retenu', libelle: 'Retenu' },
  { valeur: 'ecarte', libelle: 'Écarté' },
]
const LIBELLE_STATUT = Object.fromEntries(STATUTS.map((s) => [s.valeur, s.libelle]))

const NIVEAUX_CONFIDENTIALITE = [
  { valeur: 'public', libelle: 'Public' },
  { valeur: 'restreint', libelle: 'Restreint' },
  { valeur: 'confidentiel', libelle: 'Confidentiel' },
]

// Champs de la fiche de risque (scénario), dans l'ordre du formulaire.
const CHAMPS_SCENARIO = [
  { cle: 'declencheur', libelle: 'Déclencheur', lignes: 2, aide: 'ex. Avertissement orange IRM, crue > seuil X à la station Y' },
  { cle: 'signaux_faibles', libelle: 'Signaux précurseurs à surveiller', lignes: 3 },
  { cle: 'effets_directs', libelle: 'Effets directs', lignes: 4 },
  { cle: 'effets_cascade', libelle: 'Effets de cascade et post-crise', lignes: 4, aide: 'ex. coupure électrique → pompes hors service → aggravation inondation' },
  { cle: 'messages_publics_predefinis', libelle: 'Messages publics pré-rédigés', lignes: 4 },
  { cle: 'mesures_compensatoires', libelle: 'Mesures compensatoires, rôles par discipline, mode dégradé', lignes: 4 },
  { cle: 'decisions_a_preparer', libelle: 'Décisions à préparer', lignes: 4 },
  { cle: 'mesures_preventives', libelle: 'Mesures préventives et ressources à cadastrer', lignes: 4 },
  { cle: 'sources', libelle: 'Sources (REX, références)', lignes: 2 },
]

export default function RisquesTerritoire() {
  const { contexteId } = useAuth()
  const {
    lignes: risques,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
    rafraichir,
  } = useTableContexte('risques_territoire', contexteId, { tri: 'titre' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [afficherEcartes, setAfficherEcartes] = useState(false)
  const [importEnCours, setImportEnCours] = useState(false)
  const [erreurImport, setErreurImport] = useState(null)

  const packDejaImporte = risques.some((r) => r.code?.startsWith('STARTER-'))
  // Seules les fiches dont le code manque sont proposées : un contexte qui a déjà
  // le pack reçoit les fiches ajoutées depuis, sans doublon des autres.
  const codesPresents = new Set(risques.map((r) => r.code).filter(Boolean))
  const fichesAImporter = PACK_DEMARRAGE_RISQUES.filter((f) => !codesPresents.has(f.code))

  async function importerPackDemarrage() {
    const n = fichesAImporter.length
    if (!confirm(`Importer ${n} fiche${n > 1 ? 's' : ''} du pack de démarrage ?`)) return
    setImportEnCours(true)
    setErreurImport(null)
    const { error } = await importerFiches(fichesAImporter)
    setImportEnCours(false)
    if (error) setErreurImport(error.message)
    else await rafraichir()
  }

  // Une fiche peut porter des seuils d'action et un plan d'action : ils sont insérés
  // après elle, puis restent éditables dans leurs formulaires habituels.
  async function importerFiches(fiches) {
    const lignes = fiches.map(({ seuils, plan_action, ...r }) => ({ ...r, contexte_id: contexteId }))
    const { data: crees, error } = await supabase.from('risques_territoire').insert(lignes).select('id, code')
    if (error) return { error }
    const idParCode = Object.fromEntries(crees.map((r) => [r.code, r.id]))
    const seuils = fiches.flatMap((f) =>
      (f.seuils ?? []).map((s) => ({ ...s, contexte_id: contexteId, risque_id: idParCode[f.code] }))
    )
    const etapes = fiches.flatMap((f) =>
      (f.plan_action ?? []).map((libelle, i) => ({ risque_id: idParCode[f.code], ordre: i + 1, libelle, statut: 'a_faire' }))
    )
    const [s, e] = await Promise.all([
      seuils.length ? supabase.from('seuils_action').insert(seuils) : { error: null },
      etapes.length ? supabase.from('plans_action_risque').insert(etapes) : { error: null },
    ])
    const erreurLiee = s.error || e.error
    if (erreurLiee) {
      // Pas de fiche importée à moitié : on retire les fiches créées (seuils et étapes suivent en cascade).
      await supabase.from('risques_territoire').delete().in('id', crees.map((r) => r.id))
      return { error: erreurLiee }
    }
    return { error: null }
  }

  const risquesFiltres = risques
    .filter((r) => !filtreCategorie || r.categorie === filtreCategorie)
    .filter((r) => afficherEcartes || r.statut !== 'ecarte')
  const nbEcartes = risques.filter((r) => r.statut === 'ecarte').length

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-encre">Risques du territoire</h1>
        <div className="flex gap-2">
          {fichesAImporter.length > 0 && !chargement && (
            <BoutonDiscret onClick={importerPackDemarrage} disabled={importEnCours}>
              {importEnCours
                ? 'Import…'
                : packDejaImporte
                  ? `Importer les nouvelles fiches du pack (${fichesAImporter.length})`
                  : `Importer le pack de démarrage (${fichesAImporter.length} fiches)`}
            </BoutonDiscret>
          )}
          {!enAjout && (
            <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un risque</BoutonPrincipal>
          )}
        </div>
      </div>
      <p className="text-sm text-sourdine mb-4">
        Menaces potentielles pour la commune — inondation, cyberattaque, canicule, rejet nucléaire… —
        avec leur fiche de risque : déclencheur, effets, seuils d'action, messages, plan d'action.
        Les particularités localisées du territoire (site Seveso, école, barrage) sont des objets à
        risque, rattachés aux risques qu'ils génèrent ou auxquels ils sont exposés.
      </p>
      {erreurImport && <p className="text-sm text-chaud mb-2">{erreurImport}</p>}
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireRisque
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className="">
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
          ))}
        </select>
        {nbEcartes > 0 && (
          <label className="flex items-center gap-2 text-sm text-sourdine">
            <input type="checkbox" checked={afficherEcartes} onChange={(e) => setAfficherEcartes(e.target.checked)} />
            Afficher les risques écartés ({nbEcartes})
          </label>
        )}
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : risquesFiltres.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun risque du territoire enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {risquesFiltres.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="bg-fond p-3">
                <FormulaireRisque
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
                    {r.titre}
                    {r.code && <span className="ml-2 text-xs font-mono text-sourdine">{r.code}</span>}
                    {r.statut !== 'retenu' && (
                      <span className={`jeton ml-2 ${r.statut === 'ecarte' ? 'text-sourdine' : 'text-veille'}`}>
                        {LIBELLE_STATUT[r.statut] ?? r.statut}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-sourdine">
                    {LIBELLE_CATEGORIE[r.categorie] ?? r.categorie}
                    {r.type_risque && <> · {r.type_risque}</>}
                    {r.niveau_calcule != null && (
                      <> · niveau {r.niveau_calcule} (probabilité {r.probabilite} × impact {r.impact})</>
                    )}
                    {r.niveau_confidentialite && r.niveau_confidentialite !== 'restreint' && (
                      <> · confidentialité : {r.niveau_confidentialite}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3 items-center">
                  <Link to={`/risques-territoire/${r.id}/impression`} className="lien text-sm">Imprimer</Link>
                  <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer le risque "${r.titre}" et ses seuils, étapes et évaluations ?`)) supprimer(r.id)
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

function FormulaireRisque({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [titre, setTitre] = useState(valeursInitiales.titre ?? '')
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? 'naturel')
  const [typeRisque, setTypeRisque] = useState(valeursInitiales.type_risque ?? '')
  const [statut, setStatut] = useState(valeursInitiales.statut ?? 'retenu')
  const [probabilite, setProbabilite] = useState(valeursInitiales.probabilite ?? '')
  const [impact, setImpact] = useState(valeursInitiales.impact ?? '')
  const [dateEvaluation, setDateEvaluation] = useState(valeursInitiales.date_evaluation ?? '')
  const [niveauConfidentialite, setNiveauConfidentialite] = useState(valeursInitiales.niveau_confidentialite ?? 'restreint')
  const [scenario, setScenario] = useState(
    Object.fromEntries(CHAMPS_SCENARIO.map((c) => [c.cle, valeursInitiales[c.cle] ?? '']))
  )
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const niveau = probabilite !== '' && impact !== '' ? Number(probabilite) * Number(impact) : null

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      titre: titre.trim(),
      code: code.trim() || null,
      categorie,
      type_risque: typeRisque.trim() || null,
      statut,
      probabilite: probabilite === '' ? null : Number(probabilite),
      impact: impact === '' ? null : Number(impact),
      date_evaluation: dateEvaluation || null,
      niveau_confidentialite: niveauConfidentialite,
      ...Object.fromEntries(CHAMPS_SCENARIO.map((c) => [c.cle, scenario[c.cle].trim() || null])),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
          <input
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="ex. Inondation par crue de l'Ourthe"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code interne</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Catégorie NCCN</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full">
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de risque</label>
          <input value={typeRisque} onChange={(e) => setTypeRisque(e.target.value)} placeholder="ex. crue_cours_eau, cyberattaque" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full">
            {STATUTS.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Probabilité (1-5)</label>
          <select value={probabilite} onChange={(e) => setProbabilite(e.target.value)} className="w-full">
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Impact (1-5)</label>
          <select value={impact} onChange={(e) => setImpact(e.target.value)} className="w-full">
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
          <p className="text-sm text-encre py-1.5">{niveau ?? '—'}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date d'évaluation</label>
          <input type="date" value={dateEvaluation} onChange={(e) => setDateEvaluation(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Confidentialité</label>
          <select value={niveauConfidentialite} onChange={(e) => setNiveauConfidentialite(e.target.value)} className="w-full">
            {NIVEAUX_CONFIDENTIALITE.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 border border-trait rounded p-3">
        <p className="text-xs font-medium text-sourdine">Fiche de risque (scénario)</p>
        {CHAMPS_SCENARIO.map((c) => (
          <div key={c.cle}>
            <label className="block text-xs font-medium text-sourdine mb-1">{c.libelle}</label>
            <textarea
              value={scenario[c.cle]}
              onChange={(e) => setScenario((prev) => ({ ...prev, [c.cle]: e.target.value }))}
              rows={c.lignes}
              placeholder={c.aide}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {valeursInitiales.id ? (
        <div className="space-y-3 border border-trait rounded p-3">
          <p className="text-xs font-medium text-sourdine">Objets concernés, évaluation et suivi</p>
          <GestionLiensObjetRisque cote="risque" id={valeursInitiales.id} />
          <GestionEvaluationsRisque parent={{ colonne: 'risque_id', id: valeursInitiales.id }} />
          <GestionPlansAction parent={{ colonne: 'risque_id', id: valeursInitiales.id }} />
          <GestionFonctionsCritiques parent={{ table: 'risques_territoire_fonctions_critiques', colonne: 'risque_id', id: valeursInitiales.id }} />
          <GestionMesuresCompensatoires parent={{ colonne: 'risque_id', id: valeursInitiales.id }} />
          <p className="text-xs text-sourdine">
            Les seuils d'action de ce risque se gèrent dans <Link to="/seuils-action" className="lien">Seuils d'action</Link>.
          </p>
        </div>
      ) : (
        <p className="text-xs text-sourdine">
          Les objets liés, l'évaluation, le plan d'action et les fonctions critiques se renseignent après
          l'enregistrement, en modifiant le risque.
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
