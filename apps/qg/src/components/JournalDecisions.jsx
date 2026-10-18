import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { libelleClasseUrgence, texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'
import { LIBELLE_NATURE, etatsJournal, libelleAuteur, liensEntree } from '../lib/journalDecisions'

/** Valeur pour <input type="datetime-local"> : heure locale, à la minute. */
function valeurLocale(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

function dateHeure(iso) {
  return new Date(iso).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Journal des décisions d'un incident : qui a décidé, sur quelle base, jusqu'à quand.
 *
 * C'est un registre en ajout seul (le serveur refuse toute modification ou suppression) : une décision
 * se corrige ou se réexamine par une nouvelle entrée qui renvoie à la précédente. Le compte qui saisit,
 * l'heure d'enregistrement et l'incident sont fixés par le serveur ; seul « qui a décidé » est libre,
 * car la personne qui décide (le bourgmestre, par exemple) n'est pas toujours celle qui écrit.
 */
export default function JournalDecisions({ incidentId, contexteId, aFormaliser = null, onFormaliseTraite = null, onEnregistre = null }) {
  const { contexteActuel } = useAuth()
  const lectureSeule = contexteActuel?.niveau_acces === 'lecture'
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const [entrees, setEntrees] = useState([])
  const [declenchements, setDeclenchements] = useState([])
  const [activations, setActivations] = useState([])
  const [livre, setLivre] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [auteurs, setAuteurs] = useState({})
  const [formulaire, setFormulaire] = useState(null) // { nature, cible?, amorce? }
  const racine = useRef(null)
  const [maintenant, setMaintenant] = useState(Date.now())

  const rafraichir = useCallback(async () => {
    const [j, d, a, l, au] = await Promise.all([
      supabase.from('journal_decisions').select('*').eq('incident_id', incidentId).order('numero_ordre', { ascending: false }),
      supabase.from('declenchements_seuils_action').select('id, horodatage_declenchement, seuils_action(libelle)').eq('incident_id', incidentId),
      supabase.from('activations_plan_nucleaire').select('id, classe_urgence, declenche_le').eq('incident_id', incidentId),
      supabase.from('livre_de_bord').select('id, numero_ordre, message').eq('incident_id', incidentId).order('numero_ordre', { ascending: false }),
      supabase.rpc('journal_decisions_auteurs', { p_incident_id: incidentId }),
    ])
    if (j.error) setErreur(texteErreur(j.error))
    else {
      setErreur(null)
      setEntrees(j.data ?? [])
    }
    setDeclenchements(d.data ?? [])
    setActivations(a.data ?? [])
    setLivre(l.data ?? [])
    // L'auteur est un complément : s'il manque, le journal reste lisible (on n'affiche simplement pas qui a saisi).
    setAuteurs(Object.fromEntries((au.data ?? []).map((x) => [x.user_id, x])))
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
    const t = setInterval(rafraichir, 30000)
    return () => clearInterval(t)
  }, [rafraichir])

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // « Formaliser en décision » depuis le livre de bord : on ouvre le formulaire prérempli, puis on prévient l'appelant
  // pour qu'un second clic sur la même entrée rouvre bien le formulaire.
  useEffect(() => {
    if (!aFormaliser || lectureSeule) return
    setFormulaire({ nature: 'decision', amorce: aFormaliser })
    racine.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    onFormaliseTraite?.()
  }, [aFormaliser]) // eslint-disable-line react-hooks/exhaustive-deps

  // Une décision corrigée est « remplacée » ; une décision avec échéance est « suivie » dès qu'un réexamen la reprend.
  const { parId, remplaceePar, reexaminee, depassees: echeancesDepassees, depasse } = useMemo(
    () => etatsJournal(entrees, maintenant),
    [entrees, maintenant],
  )

  const libelleLien = (e) => liensEntree(e, { declenchements, activations, livre })

  return (
    <div ref={racine}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="font-medium text-encre">Journal des décisions</h2>
        <div className="flex items-center gap-3">
          {entrees.length > 0 && (
            <Link to={`/incidents/${incidentId}/journal-decisions`} className="lien">
              Version imprimable
            </Link>
          )}
          {!lectureSeule && !formulaire && (
            <BoutonPrincipal type="button" onClick={() => setFormulaire({ nature: 'decision' })}>
              Enregistrer une décision
            </BoutonPrincipal>
          )}
        </div>
      </div>
      <p className="text-xs text-sourdine mb-3">
        Qui a décidé, sur quelle base, jusqu'à quand. Registre en ajout seul : une entrée ne se modifie ni ne se supprime ;
        on la corrige ou on la réexamine par une nouvelle entrée, et l'ancienne reste visible.
      </p>

      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}

      {echeancesDepassees.length > 0 && (
        <p role="alert" className="text-sm mb-3 border border-trait rounded p-2" style={{ color: '#b91c1c' }}>
          {echeancesDepassees.length === 1 ? '1 décision a dépassé son échéance sans réexamen' : `${echeancesDepassees.length} décisions ont dépassé leur échéance sans réexamen`}
          {' : '}
          {echeancesDepassees.map((e) => `n° ${e.numero_ordre}`).join(', ')}.
        </p>
      )}

      {formulaire && (
        <FormulaireDecision
          key={`${formulaire.nature}-${formulaire.cible?.id ?? formulaire.amorce?.id ?? 'nouvelle'}`}
          incidentId={incidentId}
          formulaire={formulaire}
          roles={roles}
          declenchements={declenchements}
          activations={activations}
          livre={livre}
          onFini={async () => {
            setFormulaire(null)
            onEnregistre?.()
            await rafraichir()
          }}
          onAnnuler={() => setFormulaire(null)}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : entrees.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucune décision enregistrée pour cet incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {entrees.map((e) => {
            const remplacee = remplaceePar[e.id]
            const cible = e.precedente_id ? parId[e.precedente_id] : null
            const apresCoup = new Date(e.enregistre_le).getTime() - new Date(e.decide_le).getTime() > 5 * 60000
            const depassee = depasse(e)
            return (
              <li key={e.id} className="bg-surface border border-trait rounded p-3" style={remplacee ? { opacity: 0.7 } : undefined}>
                <p className="text-xs text-sourdine">
                  n° {e.numero_ordre} · décidé le {dateHeure(e.decide_le)} par <strong className="text-encre">{e.decide_par}</strong>
                  {e.nature !== 'decision' && (
                    <span className="jeton ml-2">
                      {LIBELLE_NATURE[e.nature]} de n° {cible?.numero_ordre ?? '—'}
                    </span>
                  )}
                  {remplacee && <span className="jeton ml-2">remplacée par n° {remplacee.numero_ordre}</span>}
                  {apresCoup && <span className="jeton ml-2">enregistrée à {dateHeure(e.enregistre_le)}</span>}
                  {auteurs[e.enregistre_par] && <> · saisie par {libelleAuteur(auteurs[e.enregistre_par])}</>}
                </p>
                <p className="text-sm text-encre mt-0.5" style={{ whiteSpace: 'pre-line', textDecoration: remplacee ? 'line-through' : 'none' }}>
                  {e.decision}
                </p>
                <p className="text-xs text-sourdine mt-1" style={{ whiteSpace: 'pre-line' }}>
                  <strong>Base :</strong> {e.base_decision}
                </p>
                {e.motif && (
                  <p className="text-xs text-sourdine mt-0.5" style={{ whiteSpace: 'pre-line' }}>
                    <strong>{e.nature === 'correction' ? 'Motif de la correction' : 'Constat du réexamen'} :</strong> {e.motif}
                  </p>
                )}
                {e.echeance && (
                  <p className="text-xs mt-0.5" style={{ color: depassee ? '#b91c1c' : undefined, fontWeight: depassee ? 600 : undefined }}>
                    échéance : {dateHeure(e.echeance)}
                    {depassee && ' — dépassée, à réexaminer'}
                    {reexaminee.has(e.id) && ' — réexaminée'}
                  </p>
                )}
                {libelleLien(e).length > 0 && <p className="text-xs text-sourdine mt-0.5">liée à : {libelleLien(e).join(' · ')}</p>}
                {!lectureSeule && !formulaire && !remplacee && (
                  <div className="flex gap-2 mt-2">
                    {e.nature !== 'reexamen' && (
                      <BoutonDiscret type="button" onClick={() => setFormulaire({ nature: 'correction', cible: e })}>
                        Corriger
                      </BoutonDiscret>
                    )}
                    <BoutonDiscret type="button" onClick={() => setFormulaire({ nature: 'reexamen', cible: e })}>
                      Réexaminer
                    </BoutonDiscret>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FormulaireDecision({ incidentId, formulaire, roles, declenchements, activations, livre, onFini, onAnnuler }) {
  const { nature, cible, amorce } = formulaire
  // Amorce : entrée du livre de bord à formaliser. On reprend sa décision (à défaut son message), sa justification de
  // prévoyance et son heure : le registre doit dire quand la décision a été prise, pas quand on l'a recopiée.
  const [decision, setDecision] = useState(nature === 'correction' ? cible.decision : amorce ? amorce.decision || amorce.message || '' : '')
  const [base, setBase] = useState(nature === 'correction' ? cible.base_decision : amorce?.justification_prevoyance ?? '')
  const [decidePar, setDecidePar] = useState(cible?.decide_par ?? '')
  const [decideLe, setDecideLe] = useState(valeurLocale(amorce?.horodatage ? new Date(amorce.horodatage) : new Date()))
  const [echeance, setEcheance] = useState('')
  const [motif, setMotif] = useState('')
  const [seuilId, setSeuilId] = useState(nature === 'correction' ? cible.declenchement_seuil_id ?? '' : '')
  const [activationId, setActivationId] = useState(nature === 'correction' ? cible.activation_nucleaire_id ?? '' : '')
  const [livreId, setLivreId] = useState(nature === 'correction' ? cible.livre_de_bord_id ?? '' : amorce?.id ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  const motifRequis = nature !== 'decision'
  const complet = decision.trim() && base.trim() && decidePar.trim() && (!motifRequis || motif.trim())

  async function valider(e) {
    e.preventDefault()
    if (!complet) return
    setEnCours(true)
    setErreur(null)
    // Ni le contexte, ni l'incident d'origine, ni l'auteur de la saisie, ni l'heure d'enregistrement ne sont envoyés : le serveur les fixe.
    const { error } = await supabase.from('journal_decisions').insert({
      incident_id: incidentId,
      nature,
      precedente_id: cible?.id ?? null,
      decision: decision.trim(),
      base_decision: base.trim(),
      decide_par: decidePar.trim(),
      decide_le: new Date(decideLe).toISOString(),
      echeance: echeance ? new Date(echeance).toISOString() : null,
      motif: motifRequis ? motif.trim() : null,
      declenchement_seuil_id: seuilId || null,
      activation_nucleaire_id: activationId || null,
      livre_de_bord_id: livreId || null,
    })
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else await onFini()
  }

  const titre =
    nature === 'decision'
      ? 'Nouvelle décision'
      : nature === 'correction'
        ? `Corriger la décision n° ${cible.numero_ordre} (l'ancienne reste visible, marquée « remplacée »)`
        : `Réexaminer la décision n° ${cible.numero_ordre}`

  return (
    <form onSubmit={valider} className="border border-trait rounded p-3 mb-3 bg-fond space-y-2">
      <p className="text-sm font-medium text-encre">{titre}</p>
      {nature === 'reexamen' && (
        <p className="text-xs text-sourdine">« {cible.decision} »</p>
      )}
      {amorce && (
        <p className="text-xs text-sourdine">
          Prérempli depuis l'entrée n° {amorce.numero_ordre} du livre de bord : relisez, indiquez qui a décidé et sur quelle base, puis enregistrez.
        </p>
      )}

      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1" htmlFor="jd-decision">
          {nature === 'reexamen' ? 'Nouvelle décision (maintenir, lever, modifier…)' : 'Décision'}
        </label>
        <textarea id="jd-decision" value={decision} onChange={(e) => setDecision(e.target.value)} rows={2} className="w-full" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1" htmlFor="jd-base">
          Sur quelle base (informations, avis, plan, seuil franchi…)
        </label>
        <textarea id="jd-base" value={base} onChange={(e) => setBase(e.target.value)} rows={2} className="w-full" required />
      </div>
      {motifRequis && (
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor="jd-motif">
            {nature === 'correction' ? 'Motif de la correction' : 'Constat : qu\'est-il arrivé depuis la décision ?'}
          </label>
          <textarea id="jd-motif" value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className="w-full" required />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor="jd-par">Décidé par (qualité ou nom)</label>
          <input id="jd-par" list="jd-roles" value={decidePar} onChange={(e) => setDecidePar(e.target.value)} className="w-full" required />
          <datalist id="jd-roles">
            {roles.map((r) => (
              <option key={r.id} value={r.libelle} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor="jd-le">Décidé le</label>
          <input id="jd-le" type="datetime-local" value={decideLe} onChange={(e) => setDecideLe(e.target.value)} className="w-full" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor="jd-echeance">Échéance (optionnel)</label>
          <input id="jd-echeance" type="datetime-local" value={echeance} min={decideLe} onChange={(e) => setEcheance(e.target.value)} className="w-full" />
        </div>
      </div>

      {(declenchements.length > 0 || activations.length > 0 || livre.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {declenchements.length > 0 && (
            <select value={seuilId} onChange={(e) => setSeuilId(e.target.value)} className="w-full" aria-label="Seuil d'action lié">
              <option value="">Seuil d'action — aucun</option>
              {declenchements.map((d) => (
                <option key={d.id} value={d.id}>{d.seuils_action?.libelle ?? 'Seuil'} ({dateHeure(d.horodatage_declenchement)})</option>
              ))}
            </select>
          )}
          {activations.length > 0 && (
            <select value={activationId} onChange={(e) => setActivationId(e.target.value)} className="w-full" aria-label="Activation du plan nucléaire liée">
              <option value="">Plan nucléaire — aucun</option>
              {activations.map((a) => (
                <option key={a.id} value={a.id}>{libelleClasseUrgence(a.classe_urgence)} ({dateHeure(a.declenche_le)})</option>
              ))}
            </select>
          )}
          {livre.length > 0 && (
            <select value={livreId} onChange={(e) => setLivreId(e.target.value)} className="w-full" aria-label="Entrée du livre de bord liée">
              <option value="">Livre de bord — aucune</option>
              {livre.map((l) => (
                <option key={l.id} value={l.id}>n° {l.numero_ordre} — {l.message.slice(0, 50)}{l.message.length > 50 ? '…' : ''}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <p className="text-xs text-sourdine">
        Une fois enregistrée, l'entrée ne pourra plus être modifiée ni supprimée. Votre compte et l'heure d'enregistrement sont conservés automatiquement.
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !complet}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler} disabled={enCours}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
