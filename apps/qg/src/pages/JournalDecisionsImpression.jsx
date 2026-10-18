import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { LIBELLE_NATURE, etatsJournal, libelleAuteur, liensEntree } from '../lib/journalDecisions'

const dateHeure = (iso) => new Date(iso).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
const dateHeureLongue = (iso) => new Date(iso).toLocaleString('fr-BE', { dateStyle: 'long', timeStyle: 'short' })

/**
 * Journal des décisions d'un incident, mis en page pour être imprimé ou enregistré en PDF (pièce pour une enquête
 * post-crise). Ordre chronologique d'enregistrement ; rien n'est caché : une décision corrigée reste lisible et
 * dit par quoi elle a été remplacée. L'extrait porte la date et le compte qui l'ont établi.
 */
export default function JournalDecisionsImpression() {
  const { id } = useParams()
  const { utilisateur, contexteActuel } = useAuth()
  const [incident, setIncident] = useState(null)
  const [entrees, setEntrees] = useState(null)
  const [liens, setLiens] = useState({ declenchements: [], activations: [], livre: [] })
  const [auteurs, setAuteurs] = useState({})
  const [erreur, setErreur] = useState(null)
  const [etabliLe] = useState(() => new Date().toISOString())

  useEffect(() => {
    let annule = false
    async function charger() {
      const [inc, j, d, a, l, au] = await Promise.all([
        supabase.from('incidents').select('id, nom, type_evenement, statut, date_debut, est_exercice').eq('id', id).single(),
        supabase.from('journal_decisions').select('*').eq('incident_id', id).order('numero_ordre', { ascending: true }),
        supabase.from('declenchements_seuils_action').select('id, horodatage_declenchement, seuils_action(libelle)').eq('incident_id', id),
        supabase.from('activations_plan_nucleaire').select('id, classe_urgence, declenche_le').eq('incident_id', id),
        supabase.from('livre_de_bord').select('id, numero_ordre').eq('incident_id', id),
        supabase.rpc('journal_decisions_auteurs', { p_incident_id: id }),
      ])
      if (annule) return
      const premiere = inc.error || j.error
      if (premiere) {
        setErreur(texteErreur(premiere))
        return
      }
      setIncident(inc.data)
      setEntrees(j.data ?? [])
      setLiens({ declenchements: d.data ?? [], activations: a.data ?? [], livre: l.data ?? [] })
      setAuteurs(Object.fromEntries((au.data ?? []).map((x) => [x.user_id, x])))
    }
    charger()
    return () => {
      annule = true
    }
  }, [id])

  const etats = useMemo(() => etatsJournal(entrees ?? [], new Date(etabliLe).getTime()), [entrees, etabliLe])

  if (erreur) return <p role="alert" className="text-sm text-chaud">{erreur}</p>
  if (!incident || !entrees) return <p className="text-sm text-sourdine">Chargement…</p>

  const { parId, remplaceePar, reexaminee, depasse } = etats
  const reexamenDe = (e) => entrees.find((x) => x.nature === 'reexamen' && x.precedente_id === e.id)

  return (
    <div className="journal-impression">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-4">
        <Link to={`/incidents/${incident.id}?onglet=journal`} className="lien">← Retour à l'incident</Link>
        <button type="button" className="principal" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button>
      </div>

      <header className="mb-4" style={{ borderBottom: '2px solid currentColor', paddingBottom: 8 }}>
        <p className="text-xs text-sourdine">{contexteActuel?.contextes?.nom ?? ''}</p>
        <h1 className="text-lg font-semibold text-encre">Journal des décisions — {incident.nom}</h1>
        <p className="text-sm text-sourdine">
          {incident.type_evenement && <>{incident.type_evenement} · </>}
          {incident.date_debut && <>début le {dateHeure(incident.date_debut)} · </>}
          {entrees.length} entrée{entrees.length > 1 ? 's' : ''}
        </p>
        {incident.est_exercice && (
          <p className="text-sm font-semibold mt-1" style={{ color: '#b45309' }}>EXERCICE — ce journal ne rend compte d'aucune décision réelle.</p>
        )}
        <p className="text-xs text-sourdine mt-1">
          Extrait établi le {dateHeureLongue(etabliLe)}{utilisateur?.email ? ` par ${utilisateur.email}` : ''}. Registre en ajout seul : aucune entrée n'a pu être modifiée
          ni supprimée ; une décision corrigée ou réexaminée reste lisible et renvoie à l'entrée qui l'a reprise.
        </p>
      </header>

      {entrees.length === 0 ? (
        <p className="text-sm text-sourdine">Aucune décision enregistrée pour cet incident.</p>
      ) : (
        <ol className="space-y-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {entrees.map((e) => {
            const remplacee = remplaceePar[e.id]
            const cible = e.precedente_id ? parId[e.precedente_id] : null
            const reex = reexamenDe(e)
            const apresCoup = new Date(e.enregistre_le).getTime() - new Date(e.decide_le).getTime() > 5 * 60000
            const lies = liensEntree(e, liens)
            const auteur = libelleAuteur(auteurs[e.enregistre_par])
            return (
              <li key={e.id} className="border border-trait rounded p-3" style={{ breakInside: 'avoid' }}>
                <p className="text-sm font-semibold text-encre">
                  n° {e.numero_ordre} — {LIBELLE_NATURE[e.nature]}
                  {e.nature !== 'decision' && <> de la décision n° {cible?.numero_ordre ?? '—'}</>}
                  {remplacee && <span className="font-normal"> · remplacée par la décision n° {remplacee.numero_ordre}</span>}
                  {reex && <span className="font-normal"> · réexaminée par l'entrée n° {reex.numero_ordre}</span>}
                </p>
                <p className="text-sm text-encre mt-1" style={{ whiteSpace: 'pre-line' }}>{e.decision}</p>
                <dl className="text-xs mt-2" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 10, rowGap: 2 }}>
                  <dt className="text-sourdine">Décidé par</dt>
                  <dd>{e.decide_par}, le {dateHeure(e.decide_le)}</dd>
                  <dt className="text-sourdine">Sur la base de</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{e.base_decision}</dd>
                  {e.motif && (
                    <>
                      <dt className="text-sourdine">{e.nature === 'correction' ? 'Motif de la correction' : 'Constat du réexamen'}</dt>
                      <dd style={{ whiteSpace: 'pre-line' }}>{e.motif}</dd>
                    </>
                  )}
                  {e.echeance && (
                    <>
                      <dt className="text-sourdine">Échéance</dt>
                      <dd>
                        {dateHeure(e.echeance)}
                        {depasse(e) && <strong> — dépassée à la date de l'extrait, sans réexamen</strong>}
                        {reex && ' — réexaminée'}
                        {remplacee && ' — décision remplacée'}
                      </dd>
                    </>
                  )}
                  {lies.length > 0 && (
                    <>
                      <dt className="text-sourdine">Liée à</dt>
                      <dd>{lies.join(' · ')}</dd>
                    </>
                  )}
                  <dt className="text-sourdine">Enregistrée</dt>
                  <dd>
                    le {dateHeure(e.enregistre_le)}
                    {auteur && <> par {auteur}</>}
                    {apresCoup && <strong> — après coup</strong>}
                  </dd>
                </dl>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
