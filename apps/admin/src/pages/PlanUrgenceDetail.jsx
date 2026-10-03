import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const CATEGORIES_FICHE = [
  { valeur: 'administrative', libelle: 'Partie administrative' },
  { valeur: 'procedure', libelle: 'Fiches de procédure (P1-P9)' },
  { valeur: 'information', libelle: 'Fiches information (I1-I2)' },
]

const MODES_TRAITEMENT = [
  { valeur: 'pgui_suffisant', libelle: 'PGUI suffisant' },
  { valeur: 'fiche_specifique_requise', libelle: 'Fiche spécifique requise' },
  { valeur: 'ppui_requis', libelle: 'PPUI requis' },
]

export default function PlanUrgenceDetail() {
  const { id } = useParams()
  const { contexteId } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const chargerPlan = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase.from('plans_urgence').select('*').eq('id', id).maybeSingle()
    if (error) setErreur(error.message)
    else setPlan(data)
    setChargement(false)
  }, [id])

  useEffect(() => {
    chargerPlan()
  }, [chargerPlan])

  if (chargement) return <p className="text-sm text-sourdine">Chargement…</p>
  if (!plan) {
    return (
      <p className="vide border border-dashed border-trait text-center p-6">
        Plan introuvable. <Link to="/plans-urgence" className="text-info underline">Retour à la liste</Link>
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <Link to="/plans-urgence" className="text-xs text-sourdine underline">← Plans d'urgence</Link>
          <h1 className="text-xl font-semibold text-encre mt-1">
            {plan.type_plan} — version {plan.version}
          </h1>
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      <div className="mb-6">
        <SectionFichesPlan planId={plan.id} />
      </div>

      <div>
        <SectionRisquesIdentifies planId={plan.id} contexteId={contexteId} />
      </div>
    </div>
  )
}

function SectionFichesPlan({ planId }) {
  const [fiches, setFiches] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('fiches_plan')
      .select('*')
      .eq('plan_id', planId)
      .order('ordre')
    if (error) setErreur(error.message)
    else setFiches(data ?? [])
    setChargement(false)
  }, [planId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('fiches_plan').insert({ ...valeurs, plan_id: planId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idFiche, valeurs) {
    const { error } = await supabase.from('fiches_plan').update(valeurs).eq('id', idFiche)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function supprimer(idFiche) {
    const { error } = await supabase.from('fiches_plan').delete().eq('id', idFiche)
    if (!error) await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Fiches du plan</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une fiche</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Classement du Guide de l'éditeur (NCCN) : partie administrative, fiches de procédure P1-P9,
        fiches information I1-I2 — un code par fiche (ex. "P3.2", "I1.3").
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireFiche
            prioriteParDefaut={fiches.length + 1}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : fiches.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune fiche créée.</p>
      ) : (
        CATEGORIES_FICHE.map((cat) => {
          const fichesCat = fiches.filter((f) => f.categorie === cat.valeur)
          if (fichesCat.length === 0) return null
          return (
            <div key={cat.valeur} className="mb-4">
              <p className="etiquette mb-1.5">{cat.libelle}</p>
              <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
                {fichesCat.map((f) =>
                  ligneEnEdition === f.id ? (
                    <li key={f.id} className="p-3 bg-fond">
                      <FormulaireFiche
                        valeursInitiales={f}
                        onAnnuler={() => setLigneEnEdition(null)}
                        onValider={async (valeurs) => {
                          const { error } = await modifier(f.id, valeurs)
                          if (!error) setLigneEnEdition(null)
                          return { error }
                        }}
                      />
                    </li>
                  ) : (
                    <li key={f.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-encre">
                            <span className="jeton text-info mr-2">{f.code_fiche}</span>
                            {f.titre}
                            {f.format_type && <span className="text-xs text-sourdine ml-2">({f.format_type})</span>}
                          </p>
                          {f.contenu?.texte && (
                            <p className="text-xs text-sourdine mt-1 whitespace-pre-wrap">{f.contenu.texte}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-3">
                          <BoutonDiscret onClick={() => setLigneEnEdition(f.id)}>Modifier</BoutonDiscret>
                          <BoutonDiscret
                            onClick={() => {
                              if (confirm(`Supprimer la fiche "${f.code_fiche}" ?`)) supprimer(f.id)
                            }}
                          >
                            Supprimer
                          </BoutonDiscret>
                        </div>
                      </div>
                    </li>
                  )
                )}
              </ul>
            </div>
          )
        })
      )}
    </div>
  )
}

function FormulaireFiche({ valeursInitiales = {}, prioriteParDefaut = 1, onValider, onAnnuler }) {
  const [codeFiche, setCodeFiche] = useState(valeursInitiales.code_fiche ?? '')
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? 'procedure')
  const [titre, setTitre] = useState(valeursInitiales.titre ?? '')
  const [formatType, setFormatType] = useState(valeursInitiales.format_type ?? '')
  const [ordre, setOrdre] = useState(valeursInitiales.ordre ?? prioriteParDefaut)
  const [texte, setTexte] = useState(valeursInitiales.contenu?.texte ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      code_fiche: codeFiche.trim(),
      categorie,
      titre: titre.trim(),
      format_type: formatType.trim() || null,
      ordre: Number(ordre),
      contenu: texte.trim() ? { texte: texte.trim() } : null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code</label>
          <input required value={codeFiche} onChange={(e) => setCodeFiche(e.target.value)} placeholder="ex. P3.2" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full">
            {CATEGORIES_FICHE.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Ordre</label>
          <input type="number" min="1" value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
        <input required value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Type de format</label>
        <input
          value={formatType}
          onChange={(e) => setFormatType(e.target.value)}
          placeholder="ex. organigramme, lien_portail_dynamique, modele_message"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Contenu</label>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} className="w-full" />
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

function SectionRisquesIdentifies({ planId, contexteId }) {
  const { lignes: objetsRisque } = useTableContexte('objets_a_risque', contexteId, { tri: 'identification' })
  const [risques, setRisques] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('risques_identifies_pgui')
      .select('*, objets_a_risque(id, identification)')
      .eq('plan_id', planId)
      .order('created_at')
    if (error) setErreur(error.message)
    else setRisques(data ?? [])
    setChargement(false)
  }, [planId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('risques_identifies_pgui').insert({ ...valeurs, plan_id: planId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idRisque, valeurs) {
    const { error } = await supabase.from('risques_identifies_pgui').update(valeurs).eq('id', idRisque)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function supprimer(idRisque) {
    const { error } = await supabase.from('risques_identifies_pgui').delete().eq('id', idRisque)
    if (!error) await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Risques identifiés — triage</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un risque</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Chapitre administratif 3B : un simple classement du risque vers son mode de traitement, avant
        renvoi éventuel vers une fiche à risque détaillée (analyse complète de type PPUI).
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireRisqueIdentifie
            objetsRisque={objetsRisque}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : risques.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun risque trié pour ce plan.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {risques.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="p-3 bg-fond">
                <FormulaireRisqueIdentifie
                  objetsRisque={objetsRisque}
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
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {r.risque}
                      <span
                        className={`jeton ml-2 ${
                          r.mode_traitement === 'ppui_requis'
                            ? 'text-chaud'
                            : r.mode_traitement === 'fiche_specifique_requise'
                            ? 'text-veille'
                            : 'text-sourdine'
                        }`}
                      >
                        {MODES_TRAITEMENT.find((m) => m.valeur === r.mode_traitement)?.libelle ?? r.mode_traitement}
                      </span>
                    </p>
                    {r.objets_a_risque?.identification && (
                      <p className="text-xs text-sourdine mt-0.5">→ fiche détaillée : {r.objets_a_risque.identification}</p>
                    )}
                    {r.commentaire && <p className="text-xs text-sourdine mt-0.5">{r.commentaire}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm(`Supprimer le risque "${r.risque}" ?`)) supprimer(r.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireRisqueIdentifie({ objetsRisque, valeursInitiales = {}, onValider, onAnnuler }) {
  const [risque, setRisque] = useState(valeursInitiales.risque ?? '')
  const [modeTraitement, setModeTraitement] = useState(valeursInitiales.mode_traitement ?? 'pgui_suffisant')
  const [objetRisqueId, setObjetRisqueId] = useState(valeursInitiales.objet_risque_id ?? '')
  const [commentaire, setCommentaire] = useState(valeursInitiales.commentaire ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      risque: risque.trim(),
      mode_traitement: modeTraitement,
      objet_risque_id: objetRisqueId || null,
      commentaire: commentaire.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Risque</label>
        <input required value={risque} onChange={(e) => setRisque(e.target.value)} placeholder="ex. Inondation de la vallée" className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Mode de traitement</label>
          <select value={modeTraitement} onChange={(e) => setModeTraitement(e.target.value)} className="w-full">
            {MODES_TRAITEMENT.map((m) => (
              <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Fiche à risque détaillée liée</label>
          <select value={objetRisqueId} onChange={(e) => setObjetRisqueId(e.target.value)} className="w-full">
            <option value="">—</option>
            {objetsRisque.map((o) => (
              <option key={o.id} value={o.id}>{o.identification}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Commentaire</label>
        <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className="w-full" />
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
