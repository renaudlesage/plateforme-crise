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

const TYPES_MODIFICATION = [
  { valeur: 'manuel', libelle: 'Manuel' },
  { valeur: 'plan', libelle: 'Plan' },
  { valeur: 'annexe', libelle: 'Annexe' },
]

const STATUTS_PROPOSITION = [
  { valeur: 'soumis', libelle: 'Soumis' },
  { valeur: 'en_revision', libelle: 'En révision' },
  { valeur: 'approuve', libelle: 'Approuvé' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]

const SCENARIOS_RISQUE_RS = [
  { valeur: 'thermique', libelle: 'Thermique' },
  { valeur: 'surpression', libelle: 'Surpression' },
  { valeur: 'toxique', libelle: 'Toxique' },
  { valeur: 'ecotoxique', libelle: 'Écotoxique' },
]

const TYPES_ZONE_RS = [
  { valeur: 'zdi', libelle: 'ZDI — zone des dangers d\'intervention' },
  { valeur: 'zr', libelle: 'ZR — zone des risques' },
  { valeur: 'zv', libelle: 'ZV — zone de vigilance' },
]

const METHODES_DELIMITATION_RS = [
  { valeur: 'simulation', libelle: 'Simulation' },
  { valeur: 'distance_conventionnelle', libelle: 'Distance conventionnelle' },
  { valeur: 'pas_de_delimitation', libelle: 'Pas de délimitation' },
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

      <div className="mb-6">
        <SectionPropositionsModification planId={plan.id} contexteId={contexteId} />
      </div>

      <div className="mb-6">
        <SectionRisquesIdentifies planId={plan.id} contexteId={contexteId} />
      </div>

      <div>
        <SectionEntreprisesSeveso planId={plan.id} contexteId={contexteId} />
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

function SectionPropositionsModification({ planId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [fiches, setFiches] = useState([])
  const [propositions, setPropositions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [reviseurParProposition, setReviseurParProposition] = useState({})

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const [fichesRes, propRes] = await Promise.all([
      supabase.from('fiches_plan').select('id, code_fiche, titre').eq('plan_id', planId).order('ordre'),
      supabase
        .from('propositions_modification_plan')
        .select('*, fiches_plan(id, code_fiche, titre), proposant:contacts!propositions_modification_plan_proposant_contact_id_fkey(id, nom, prenom), reviseur:contacts!propositions_modification_plan_revise_par_contact_id_fkey(id, nom, prenom)')
        .eq('plan_id', planId)
        .order('date_soumission', { ascending: false }),
    ])
    if (fichesRes.error) setErreur(fichesRes.error.message)
    else setFiches(fichesRes.data ?? [])
    if (propRes.error) setErreur(propRes.error.message)
    else setPropositions(propRes.data ?? [])
    setChargement(false)
  }, [planId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('propositions_modification_plan').insert({ ...valeurs, plan_id: planId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function changerStatut(proposition, statut) {
    const { error } = await supabase
      .from('propositions_modification_plan')
      .update({
        statut,
        date_revision: new Date().toISOString(),
        revise_par_contact_id: reviseurParProposition[proposition.id] || null,
      })
      .eq('id', proposition.id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Propositions de modification</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Proposer une modification</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Circuit d'approbation digitalisé (texte actuel vs proposé + justification) — remplace le
        formulaire envoyé par email décrit dans le guide PUH.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireProposition
            fiches={fiches}
            contacts={contacts}
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
      ) : propositions.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune proposition en cours.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {propositions.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-encre">
                    {TYPES_MODIFICATION.find((t) => t.valeur === p.type_modification)?.libelle ?? p.type_modification}
                    {p.fiches_plan?.code_fiche && <span className="text-xs text-sourdine ml-2">→ {p.fiches_plan.code_fiche} {p.fiches_plan.titre}</span>}
                    {p.page_reference && <span className="text-xs text-sourdine ml-2">({p.page_reference})</span>}
                    <span
                      className={`jeton ml-2 ${
                        p.statut === 'approuve' ? 'text-chaud' : p.statut === 'rejete' ? 'text-sourdine' : 'text-info'
                      }`}
                    >
                      {STATUTS_PROPOSITION.find((s) => s.valeur === p.statut)?.libelle ?? p.statut}
                    </span>
                  </p>
                  {p.texte_actuel && <p className="text-xs text-sourdine mt-1"><strong>Actuel :</strong> {p.texte_actuel}</p>}
                  <p className="text-xs text-sourdine mt-0.5"><strong>Proposé :</strong> {p.texte_propose}</p>
                  <p className="text-xs text-sourdine mt-0.5"><strong>Justification :</strong> {p.justification}</p>
                  <p className="text-xs text-sourdine mt-1">
                    Soumis le {new Date(p.date_soumission).toLocaleDateString('fr-BE')}
                    {p.proposant && <> par {p.proposant.prenom} {p.proposant.nom}</>}
                    {p.date_revision && (
                      <>
                        {' · '}révisé le {new Date(p.date_revision).toLocaleDateString('fr-BE')}
                        {p.reviseur && <> par {p.reviseur.prenom} {p.reviseur.nom}</>}
                      </>
                    )}
                  </p>
                  {p.commentaire_revision && <p className="text-xs text-sourdine mt-0.5">commentaire : {p.commentaire_revision}</p>}
                </div>
                {(p.statut === 'soumis' || p.statut === 'en_revision') && (
                  <div className="flex-shrink-0 text-right">
                    <select
                      value={reviseurParProposition[p.id] ?? ''}
                      onChange={(e) => setReviseurParProposition((r) => ({ ...r, [p.id]: e.target.value }))}
                      className="block mb-1.5 text-xs"
                    >
                      <option value="">Révisé par —</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      {p.statut === 'soumis' && (
                        <BoutonDiscret onClick={() => changerStatut(p, 'en_revision')}>En révision</BoutonDiscret>
                      )}
                      <BoutonPrincipal onClick={() => changerStatut(p, 'approuve')}>Approuver</BoutonPrincipal>
                      <BoutonDiscret onClick={() => changerStatut(p, 'rejete')}>Rejeter</BoutonDiscret>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireProposition({ fiches, contacts, onValider, onAnnuler }) {
  const [typeModification, setTypeModification] = useState('plan')
  const [ficheId, setFicheId] = useState('')
  const [pageReference, setPageReference] = useState('')
  const [texteActuel, setTexteActuel] = useState('')
  const [textePropose, setTextePropose] = useState('')
  const [justification, setJustification] = useState('')
  const [proposantContactId, setProposantContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_modification: typeModification,
      fiche_id: ficheId || null,
      page_reference: pageReference.trim() || null,
      texte_actuel: texteActuel.trim() || null,
      texte_propose: textePropose.trim(),
      justification: justification.trim(),
      proposant_contact_id: proposantContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de modification</label>
          <select value={typeModification} onChange={(e) => setTypeModification(e.target.value)} className="w-full">
            {TYPES_MODIFICATION.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Fiche concernée</label>
          <select value={ficheId} onChange={(e) => setFicheId(e.target.value)} className="w-full">
            <option value="">—</option>
            {fiches.map((f) => (
              <option key={f.id} value={f.id}>{f.code_fiche} — {f.titre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Page / référence</label>
          <input value={pageReference} onChange={(e) => setPageReference(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Texte actuel</label>
        <textarea value={texteActuel} onChange={(e) => setTexteActuel(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Texte proposé</label>
        <textarea required value={textePropose} onChange={(e) => setTextePropose(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Justification</label>
        <textarea required value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Proposé par</label>
        <select value={proposantContactId} onChange={(e) => setProposantContactId(e.target.value)} className="w-full sm:w-64">
          <option value="">—</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
          ))}
        </select>
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Envoi…' : 'Soumettre'}
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

function SectionEntreprisesSeveso({ planId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [entreprises, setEntreprises] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [entrepriseDepliee, setEntrepriseDepliee] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('ppui_seveso_entreprises')
      .select('*, responsable:contacts!ppui_seveso_entreprises_responsable_contact_id_fkey(id, nom, prenom)')
      .eq('plan_id', planId)
      .order('nom_entreprise')
    if (error) setErreur(error.message)
    else setEntreprises(data ?? [])
    setChargement(false)
  }, [planId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('ppui_seveso_entreprises').insert({ ...valeurs, plan_id: planId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idEntreprise, valeurs) {
    const { error } = await supabase.from('ppui_seveso_entreprises').update(valeurs).eq('id', idEntreprise)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function supprimer(idEntreprise) {
    const { error } = await supabase.from('ppui_seveso_entreprises').delete().eq('id', idEntreprise)
    if (!error) await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Entreprises Seveso (PPUI)</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une entreprise</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Établissements Seveso seuil haut couverts par ce plan, avec leurs scénarios de risque et,
        pour chacun, les zones d'effet (ZDI/ZR/ZV) calculées.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireEntrepriseSeveso
            contacts={contacts}
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
      ) : entreprises.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune entreprise Seveso enregistrée pour ce plan.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {entreprises.map((ent) =>
            ligneEnEdition === ent.id ? (
              <li key={ent.id} className="p-3 bg-fond">
                <FormulaireEntrepriseSeveso
                  contacts={contacts}
                  valeursInitiales={ent}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(ent.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={ent.id} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {ent.nom_entreprise}
                      {ent.systeme_enregistrement_personnel && (
                        <span className="jeton ml-2 text-info">enregistrement du personnel</span>
                      )}
                    </p>
                    <p className="text-xs text-sourdine mt-0.5">{ent.adresse}</p>
                    {ent.scenarios_risque?.length > 0 && (
                      <p className="text-xs text-sourdine mt-0.5">
                        scénarios :{' '}
                        {ent.scenarios_risque
                          .map((s) => SCENARIOS_RISQUE_RS.find((sc) => sc.valeur === s)?.libelle ?? s)
                          .join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-sourdine mt-0.5">
                      {ent.numero_permanence && <>permanence : {ent.numero_permanence} · </>}
                      {ent.responsable && <>responsable : {ent.responsable.prenom} {ent.responsable.nom} · </>}
                      {ent.nb_personnes_max_site != null && <>max sur site : {ent.nb_personnes_max_site}</>}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setEntrepriseDepliee(entrepriseDepliee === ent.id ? null : ent.id)}>
                      {entrepriseDepliee === ent.id ? 'Masquer les zones' : 'Zones d\'effet'}
                    </BoutonDiscret>
                    <BoutonDiscret onClick={() => setLigneEnEdition(ent.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm(`Supprimer "${ent.nom_entreprise}" ?`)) supprimer(ent.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
                {entrepriseDepliee === ent.id && (
                  <div className="mt-3 border-t border-trait pt-3">
                    <SectionZonesEffetRS entrepriseId={ent.id} />
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireEntrepriseSeveso({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [nomEntreprise, setNomEntreprise] = useState(valeursInitiales.nom_entreprise ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [numeroPermanence, setNumeroPermanence] = useState(valeursInitiales.numero_permanence ?? '')
  const [responsableContactId, setResponsableContactId] = useState(valeursInitiales.responsable_contact_id ?? '')
  const [responsableCcComContactId, setResponsableCcComContactId] = useState(
    valeursInitiales.responsable_cc_com_contact_id ?? ''
  )
  const [scenariosRisque, setScenariosRisque] = useState(valeursInitiales.scenarios_risque ?? [])
  const [nbPersonnesMaxSite, setNbPersonnesMaxSite] = useState(valeursInitiales.nb_personnes_max_site ?? '')
  const [systemeEnregistrement, setSystemeEnregistrement] = useState(
    valeursInitiales.systeme_enregistrement_personnel ?? false
  )
  const [rayonDescriptionKm, setRayonDescriptionKm] = useState(
    valeursInitiales.rayon_description_environnement_km ?? 2
  )
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function basculerScenario(s) {
    setScenariosRisque((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom_entreprise: nomEntreprise.trim(),
      adresse: adresse.trim(),
      numero_permanence: numeroPermanence.trim() || null,
      responsable_contact_id: responsableContactId || null,
      responsable_cc_com_contact_id: responsableCcComContactId || null,
      scenarios_risque: scenariosRisque,
      nb_personnes_max_site: nbPersonnesMaxSite === '' ? null : Number(nbPersonnesMaxSite),
      systeme_enregistrement_personnel: systemeEnregistrement,
      rayon_description_environnement_km: rayonDescriptionKm === '' ? null : Number(rayonDescriptionKm),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Entreprise</label>
          <input required value={nomEntreprise} onChange={(e) => setNomEntreprise(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Numéro de permanence</label>
          <input value={numeroPermanence} onChange={(e) => setNumeroPermanence(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Adresse</label>
        <input required value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-2">Scénarios de risque</label>
        <div className="flex flex-wrap gap-4">
          {SCENARIOS_RISQUE_RS.map((s) => (
            <label key={s.valeur} className="flex items-center gap-2 text-sm text-sourdine">
              <input type="checkbox" checked={scenariosRisque.includes(s.valeur)} onChange={() => basculerScenario(s.valeur)} />
              {s.libelle}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Responsable (contact Cellule de sécurité)</label>
          <select value={responsableContactId} onChange={(e) => setResponsableContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Responsable (contact communal — CC.com)</label>
          <select value={responsableCcComContactId} onChange={(e) => setResponsableCcComContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nb maximum de personnes sur site</label>
          <input type="number" min="0" value={nbPersonnesMaxSite} onChange={(e) => setNbPersonnesMaxSite(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Rayon de description de l'environnement (km)</label>
          <input type="number" step="0.1" min="0" value={rayonDescriptionKm} onChange={(e) => setRayonDescriptionKm(e.target.value)} className="w-full" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={systemeEnregistrement} onChange={(e) => setSystemeEnregistrement(e.target.checked)} />
        Système d'enregistrement du personnel présent sur site
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

function SectionZonesEffetRS({ entrepriseId }) {
  const [zones, setZones] = useState([])
  const [reference, setReference] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const [zonesRes, refRes] = await Promise.all([
      supabase.from('zones_effet_rs').select('*').eq('entreprise_id', entrepriseId).order('scenario'),
      supabase.from('referentiel_distances_conventionnelles').select('*'),
    ])
    if (zonesRes.error) setErreur(zonesRes.error.message)
    else setZones(zonesRes.data ?? [])
    setReference(refRes.data ?? [])
    setChargement(false)
  }, [entrepriseId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('zones_effet_rs').insert({ ...valeurs, entreprise_id: entrepriseId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idZone, valeurs) {
    const { error } = await supabase.from('zones_effet_rs').update(valeurs).eq('id', idZone)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function supprimer(idZone) {
    const { error } = await supabase.from('zones_effet_rs').delete().eq('id', idZone)
    if (!error) await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="etiquette">Zones d'effet (ZDI / ZR / ZV)</p>
        {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter une zone</BoutonDiscret>}
      </div>

      {reference.length > 0 && (
        <p className="text-xs text-sourdine mt-1 mb-2">
          Distances conventionnelles (AM 20 juin 2008) :{' '}
          {reference
            .map((r) => `${r.type_accident} — ZV ${r.distance_zv_m ?? '—'} m / ZR ${r.distance_zr_m ?? '—'} m`)
            .join(' · ')}
        </p>
      )}

      {erreur && <p className="text-xs text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-2 bg-surface">
          <FormulaireZoneEffetRS
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
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : zones.length === 0 && !enAjout ? (
        <p className="text-xs text-sourdine">Aucune zone d'effet calculée pour cette entreprise.</p>
      ) : (
        <ul className="space-y-1.5">
          {zones.map((z) =>
            ligneEnEdition === z.id ? (
              <li key={z.id} className="border border-trait rounded p-3 bg-surface">
                <FormulaireZoneEffetRS
                  valeursInitiales={z}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(z.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={z.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-surface text-xs">
                <span>
                  <span className="jeton mr-2">{TYPES_ZONE_RS.find((t) => t.valeur === z.type_zone)?.libelle ?? z.type_zone}</span>
                  {z.scenario}
                  {z.distance_m != null && <> · {z.distance_m} m</>}
                  {' · '}
                  {METHODES_DELIMITATION_RS.find((m) => m.valeur === z.methode_delimitation)?.libelle ?? z.methode_delimitation}
                  {z.date_calcul && <> · calculé le {z.date_calcul}</>}
                </span>
                <span className="flex gap-1.5">
                  <BoutonDiscret onClick={() => setLigneEnEdition(z.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret onClick={() => supprimer(z.id)}>Supprimer</BoutonDiscret>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireZoneEffetRS({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [scenario, setScenario] = useState(valeursInitiales.scenario ?? '')
  const [typeZone, setTypeZone] = useState(valeursInitiales.type_zone ?? 'zdi')
  const [methodeDelimitation, setMethodeDelimitation] = useState(valeursInitiales.methode_delimitation ?? 'simulation')
  const [distanceM, setDistanceM] = useState(valeursInitiales.distance_m ?? '')
  const [centreLatitude, setCentreLatitude] = useState(valeursInitiales.centre_latitude ?? '')
  const [centreLongitude, setCentreLongitude] = useState(valeursInitiales.centre_longitude ?? '')
  const [conditionsMeteo, setConditionsMeteo] = useState(valeursInitiales.conditions_meteo ?? '')
  const [dateCalcul, setDateCalcul] = useState(valeursInitiales.date_calcul ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      scenario: scenario.trim(),
      type_zone: typeZone,
      methode_delimitation: methodeDelimitation,
      distance_m: distanceM === '' ? null : Number(distanceM),
      centre_latitude: centreLatitude === '' ? null : Number(centreLatitude),
      centre_longitude: centreLongitude === '' ? null : Number(centreLongitude),
      conditions_meteo: conditionsMeteo.trim() || null,
      date_calcul: dateCalcul || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input required placeholder="Scénario" value={scenario} onChange={(e) => setScenario(e.target.value)} className="text-xs" />
        <select value={typeZone} onChange={(e) => setTypeZone(e.target.value)} className="text-xs">
          {TYPES_ZONE_RS.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
        <select value={methodeDelimitation} onChange={(e) => setMethodeDelimitation(e.target.value)} className="text-xs">
          {METHODES_DELIMITATION_RS.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input type="number" step="0.1" placeholder="Distance (m)" value={distanceM} onChange={(e) => setDistanceM(e.target.value)} className="text-xs" />
        <input placeholder="Latitude centre" value={centreLatitude} onChange={(e) => setCentreLatitude(e.target.value)} className="text-xs" />
        <input placeholder="Longitude centre" value={centreLongitude} onChange={(e) => setCentreLongitude(e.target.value)} className="text-xs" />
        <input type="date" value={dateCalcul} onChange={(e) => setDateCalcul(e.target.value)} className="text-xs" />
      </div>
      <input placeholder="Conditions météo lors du calcul" value={conditionsMeteo} onChange={(e) => setConditionsMeteo(e.target.value)} className="w-full text-xs" />
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit" disabled={enCours}>Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
