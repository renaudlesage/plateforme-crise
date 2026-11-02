import { useCallback, useEffect, useState } from 'react'
import {
  DISCIPLINES, GRAVITES_PIEGE, PIEGES_COMMUNE, libelleHeureScenario, libellePiege, texteErreur,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const CANAUX = [
  { valeur: 'telephone', libelle: 'Téléphone' },
  { valeur: 'radio', libelle: 'Radio' },
  { valeur: 'mail', libelle: 'Courriel' },
  { valeur: 'be_alert', libelle: 'BE-Alert' },
  { valeur: 'terrain', libelle: 'Terrain' },
  { valeur: 'media', libelle: 'Médias' },
  { valeur: 'citoyen', libelle: 'Citoyen' },
  { valeur: 'autre', libelle: 'Autre' },
]
const CIBLES = [...DISCIPLINES.map((d) => ({ valeur: d.valeur, libelle: d.court })), { valeur: 'bourgmestre', libelle: 'Bourgmestre' }]

/**
 * Trames d'exercice (briefing 03, partie C) : scénarios réutilisables à partir desquels le QG génère un
 * exercice. Les trames de la plateforme (fiches REX et nucléaires) sont lisibles par toutes les communes et
 * modifiables par le super-admin ; une commune crée ses propres trames. Les pièges de la commune (défauts de
 * préparation détectés) sont affichés en tête : ce sont eux qu'une trame peut exploiter.
 */
export default function TramesExercice() {
  const { contexteId, estSuperAdmin } = useAuth()
  const [trames, setTrames] = useState([])
  const [risques, setRisques] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [edition, setEdition] = useState(null) // trame en édition, ou {} pour une nouvelle

  const charger = useCallback(async () => {
    if (!contexteId) return
    const [t, r] = await Promise.all([
      supabase.from('exercice_trames').select('*').or(`contexte_id.is.null,contexte_id.eq.${contexteId}`).order('ordre').order('titre'),
      supabase.from('risques_territoire').select('id, code, titre').eq('contexte_id', contexteId).order('titre'),
    ])
    if (t.error) setErreur(texteErreur(t.error))
    else {
      setErreur(null)
      setTrames(t.data ?? [])
    }
    setRisques(r.data ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  async function enregistrer({ plateforme, ...valeurs }, id) {
    const r = id
      ? await supabase.from('exercice_trames').update(valeurs).eq('id', id).select('id')
      : await supabase.from('exercice_trames').insert({ ...valeurs, contexte_id: plateforme ? null : contexteId }).select('id')
    if (r.error) return { error: r.error }
    if (!r.data?.length) return { error: { message: 'Modification refusée : vos droits ne le permettent pas.' } }
    setEdition(null)
    await charger()
    return {}
  }

  async function supprimer(t) {
    if (!confirm(`Supprimer la trame « ${t.titre} » ? Les exercices déjà générés ne changent pas.`)) return
    const { error } = await supabase.from('exercice_trames').delete().eq('id', t.id)
    if (error) setErreur(texteErreur(error))
    else charger()
  }

  const modifiable = (t) => (t.contexte_id ? true : estSuperAdmin)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Trames d'exercice</h1>
        {!edition && <BoutonPrincipal onClick={() => setEdition({})}>Nouvelle trame</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Une trame enchaîne des stimuli horodatés (heure de scénario) et des objectifs. Le QG en génère un exercice
        (Exercices › Depuis une trame) en y ajoutant les pièges détectés ci-dessous.
      </p>

      <PiegesCommune contexteId={contexteId} />

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {edition && (
        <FormulaireTrame
          trame={edition}
          risques={risques}
          peutPlateforme={estSuperAdmin && !edition.id}
          onAnnuler={() => setEdition(null)}
          onValider={(v) => enregistrer(v, edition.id)}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : trames.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune trame.</p>
      ) : (
        <ul className="space-y-2">
          {trames.map((t) => (
            <li key={t.id} className="bg-surface border border-trait rounded p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-encre">
                    {t.titre}
                    <span className="jeton ml-2 font-mono">{t.code}</span>
                    <span className={`jeton ml-2 ${t.contexte_id ? 'text-ok' : 'text-info'}`}>{t.contexte_id ? 'commune' : 'plateforme'}</span>
                    {!t.actif && <span className="jeton ml-2 text-sourdine">inactive</span>}
                  </p>
                  <p className="text-xs text-sourdine">
                    {t.stimuli.length} stimulus · {t.objectifs.length} objectif(s)
                    {t.risque && ` · risque ${t.risque}`}
                    {t.pieges_couverts.length > 0 && ` · pièges : ${t.pieges_couverts.map(libellePiege).join(', ')}`}
                  </p>
                  {t.source && <p className="text-xs text-sourdine mt-0.5">Source : {t.source}</p>}
                </div>
                {modifiable(t) && !edition && (
                  <div className="flex gap-2 shrink-0">
                    <BoutonDiscret onClick={() => setEdition(t)}>Modifier</BoutonDiscret>
                    <BoutonDiscret onClick={() => supprimer(t)}>Supprimer</BoutonDiscret>
                  </div>
                )}
              </div>
              <details className="mt-2">
                <summary className="text-xs text-sourdine cursor-pointer">Voir les stimuli</summary>
                <ol className="text-sm mt-1 space-y-1">
                  {[...t.stimuli].sort((a, b) => a.heure_scenario_min - b.heure_scenario_min).map((s, i) => (
                    <li key={i}>
                      <span className="font-mono text-xs text-sourdine mr-2">{libelleHeureScenario(s.heure_scenario_min)}</span>
                      {s.emetteur && <strong>{s.emetteur} : </strong>}
                      {s.texte}
                      {s.piege && <span className="jeton ml-2 text-veille">{libellePiege(s.piege)}</span>}
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Défauts de préparation de la commune, regroupés par type : chacun peut devenir un piège d'exercice. */
function PiegesCommune({ contexteId }) {
  const [pieges, setPieges] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (!contexteId) return
    supabase.rpc('pieges_commune', { p_contexte: contexteId }).then(({ data, error }) => {
      if (error) setErreur(texteErreur(error))
      else setPieges(data ?? [])
    })
  }, [contexteId])

  if (erreur) return <p className="text-sm text-chaud mb-4">{erreur}</p>
  if (!pieges) return null
  const parCode = PIEGES_COMMUNE.map((p) => ({ ...p, lignes: pieges.filter((x) => x.code === p.code) })).filter((p) => p.lignes.length)

  return (
    <section className="border border-trait rounded p-3 mb-4 bg-surface">
      <h2 className="font-medium text-encre mb-1">Pièges de la commune ({pieges.length})</h2>
      {parCode.length === 0 ? (
        <p className="text-sm text-sourdine">Aucun défaut de préparation détecté.</p>
      ) : (
        <ul className="text-sm space-y-1">
          {parCode.map((p) => (
            <li key={p.code}>
              <span className={`jeton mr-2 ${GRAVITES_PIEGE[p.lignes[0].gravite]?.classe ?? ''}`}>{p.lignes[0].gravite}</span>
              {p.libelle} : {p.lignes.length}
              <span className="text-xs text-sourdine"> — {p.lignes.slice(0, 3).map((l) => l.titre).join(' ; ')}{p.lignes.length > 3 ? '…' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const stimulusVide = () => ({ heure_scenario_min: 0, canal: 'telephone', emetteur: '', discipline_cible: '', texte: '', note_animateur: '', piege: '', objectif: '' })

function FormulaireTrame({ trame, risques, peutPlateforme, onValider, onAnnuler }) {
  const [code, setCode] = useState(trame.code ?? '')
  const [titre, setTitre] = useState(trame.titre ?? '')
  const [risqueId, setRisqueId] = useState(trame.risque_territoire_id ?? '')
  const [risque, setRisque] = useState(trame.risque ?? '')
  const [source, setSource] = useState(trame.source ?? '')
  const [ordre, setOrdre] = useState(trame.ordre ?? 100)
  const [actif, setActif] = useState(trame.actif ?? true)
  const [plateforme, setPlateforme] = useState(false)
  const [pieges, setPieges] = useState(trame.pieges_couverts ?? [])
  const [objectifs, setObjectifs] = useState(trame.objectifs ?? [])
  const [stimuli, setStimuli] = useState(trame.stimuli?.length ? trame.stimuli : [stimulusVide()])
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const communale = trame.id ? !!trame.contexte_id : !plateforme

  const majObjectif = (i, cle, v) => setObjectifs((l) => l.map((o, j) => (j === i ? { ...o, [cle]: v } : o)))
  const majStimulus = (i, cle, v) => setStimuli((l) => l.map((s, j) => (j === i ? { ...s, [cle]: v } : s)))

  async function soumettre(e) {
    e.preventDefault()
    const propre = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined))
    setEnCours(true)
    const { error } = await onValider({
      code: code.trim().toUpperCase(),
      titre: titre.trim(),
      risque: risque.trim() || null,
      risque_territoire_id: communale ? risqueId || null : null,
      source: source.trim() || null,
      ordre: Number(ordre) || 100,
      actif,
      pieges_couverts: pieges,
      objectifs: objectifs.map(propre),
      stimuli: stimuli.map((s) => propre({ ...s, heure_scenario_min: Number(s.heure_scenario_min) || 0 })),
      ...(trame.id ? {} : { plateforme }),
    })
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code</label>
          <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="ORAGES-COMMUNE" className="w-full font-mono" />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
          <input required value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" />
        </div>
        {communale ? (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-sourdine mb-1">Risque du territoire lié</label>
            <select value={risqueId} onChange={(e) => setRisqueId(e.target.value)} className="w-full">
              <option value="">—</option>
              {risques.map((r) => (
                <option key={r.id} value={r.id}>{r.titre}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-sourdine mb-1">Code du risque visé (fiche)</label>
            <input value={risque} onChange={(e) => setRisque(e.target.value)} placeholder="STARTER-REX-2026-ORAGES" className="w-full font-mono" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Ordre</label>
          <input type="number" value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full" />
        </div>
        <label className="flex items-end gap-2 text-sm text-sourdine pb-1">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> Active
        </label>
        <div className="sm:col-span-4">
          <label className="block text-xs font-medium text-sourdine mb-1">Source (fiche, REX)</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} className="w-full" />
        </div>
        {peutPlateforme && (
          <label className="sm:col-span-4 flex items-center gap-2 text-sm text-sourdine">
            <input type="checkbox" checked={plateforme} onChange={(e) => setPlateforme(e.target.checked)} />
            Trame de la plateforme (visible par toutes les communes)
          </label>
        )}
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-sourdine mb-1">Pièges que la trame exploite</legend>
        <div className="flex flex-wrap gap-3">
          {PIEGES_COMMUNE.map((p) => (
            <label key={p.code} className="flex items-center gap-1.5 text-sm text-sourdine">
              <input
                type="checkbox"
                checked={pieges.includes(p.code)}
                onChange={(e) => setPieges((l) => (e.target.checked ? [...l, p.code] : l.filter((x) => x !== p.code)))}
              />
              {p.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-sourdine mb-1">Objectifs</legend>
        {objectifs.map((o, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <input value={o.code ?? ''} onChange={(e) => majObjectif(i, 'code', e.target.value)} placeholder="O1" className="font-mono" />
            <input required value={o.intitule ?? ''} onChange={(e) => majObjectif(i, 'intitule', e.target.value)} placeholder="Intitulé" className="sm:col-span-3" />
            <select value={o.discipline ?? ''} onChange={(e) => majObjectif(i, 'discipline', e.target.value)}>
              <option value="">discipline —</option>
              {CIBLES.map((c) => (
                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
              ))}
            </select>
            <BoutonDiscret type="button" onClick={() => setObjectifs((l) => l.filter((_, j) => j !== i))}>Retirer</BoutonDiscret>
          </div>
        ))}
        <BoutonDiscret type="button" onClick={() => setObjectifs((l) => [...l, { code: `O${l.length + 1}`, intitule: '', discipline: '' }])}>
          Ajouter un objectif
        </BoutonDiscret>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-sourdine mb-1">Stimuli (heure en minutes depuis le début du scénario)</legend>
        {stimuli.map((s, i) => (
          <div key={i} className="border border-trait rounded p-2 bg-surface grid grid-cols-2 sm:grid-cols-6 gap-2">
            <input type="number" min="0" value={s.heure_scenario_min} onChange={(e) => majStimulus(i, 'heure_scenario_min', e.target.value)} title="Minutes" />
            <select value={s.canal ?? 'autre'} onChange={(e) => majStimulus(i, 'canal', e.target.value)}>
              {CANAUX.map((c) => (
                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
              ))}
            </select>
            <input value={s.emetteur ?? ''} onChange={(e) => majStimulus(i, 'emetteur', e.target.value)} placeholder="Émetteur" />
            <select value={s.discipline_cible ?? ''} onChange={(e) => majStimulus(i, 'discipline_cible', e.target.value)}>
              <option value="">cible —</option>
              {CIBLES.map((c) => (
                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
              ))}
            </select>
            <select value={s.piege ?? ''} onChange={(e) => majStimulus(i, 'piege', e.target.value)}>
              <option value="">piège —</option>
              {PIEGES_COMMUNE.map((p) => (
                <option key={p.code} value={p.code}>{p.libelle}</option>
              ))}
            </select>
            <select value={s.objectif ?? ''} onChange={(e) => majStimulus(i, 'objectif', e.target.value)}>
              <option value="">objectif —</option>
              {objectifs.filter((o) => o.code).map((o) => (
                <option key={o.code} value={o.code}>{o.code}</option>
              ))}
            </select>
            <textarea required rows={2} value={s.texte ?? ''} onChange={(e) => majStimulus(i, 'texte', e.target.value)} placeholder="Texte du stimulus" className="col-span-2 sm:col-span-4" />
            <textarea rows={2} value={s.note_animateur ?? ''} onChange={(e) => majStimulus(i, 'note_animateur', e.target.value)} placeholder="Note à l'animateur" className="col-span-2 sm:col-span-2" />
            <div className="col-span-2 sm:col-span-6">
              <BoutonDiscret type="button" onClick={() => setStimuli((l) => l.filter((_, j) => j !== i))}>Retirer ce stimulus</BoutonDiscret>
            </div>
          </div>
        ))}
        <BoutonDiscret type="button" onClick={() => setStimuli((l) => [...l, stimulusVide()])}>Ajouter un stimulus</BoutonDiscret>
      </fieldset>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
