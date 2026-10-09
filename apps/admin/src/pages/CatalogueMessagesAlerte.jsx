import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export const PHASES = [
  { valeur: 'prevision', libelle: 'Prévision' },
  { valeur: 'preparation', libelle: 'Préparation' },
  { valeur: 'actuation', libelle: 'Pendant la crise' },
  { valeur: 'recuperation', libelle: 'Récupération' },
]

export const STATUTS_VALIDATION = [
  { valeur: 'a_valider', libelle: 'À valider' },
  { valeur: 'en_revue', libelle: 'En revue' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]

const sansAccent = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Catalogue national de messages d'alerte inondation (adaptation belge du
 * catalogue Vega Baja, méthode Covello). Référentiel de la plateforme :
 * lisible par tous, modifiable par le super-admin uniquement. Tant qu'un
 * message n'est pas « Validé » par un expert belge, il ne doit pas servir
 * à un usage opérationnel.
 */
export default function CatalogueMessagesAlerte() {
  const { estSuperAdmin } = useAuth()
  const [messages, setMessages] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [phase, setPhase] = useState('')
  const [statut, setStatut] = useState('')
  const [aCompleter, setACompleter] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState(null)

  async function charger() {
    const { data, error } = await supabase
      .from('catalogue_messages_alerte')
      .select('*')
      .order('numero_message_source')
    if (error) setErreur(error.message)
    setMessages(data ?? [])
    setChargement(false)
  }
  useEffect(() => {
    charger()
  }, [])

  const filtres = useMemo(() => {
    const q = sansAccent(recherche).trim()
    return messages.filter((m) => {
      if (phase && m.phase_cycle !== phase) return false
      if (statut && m.statut_validation !== statut) return false
      if (aCompleter && !m.necessite_completion) return false
      if (!q) return true
      const texte = sansAccent([m.message_cle, ...(m.sous_messages ?? []), ...(m.mots_cles ?? []), m.zone_thematique, m.section].join(' '))
      return texte.includes(q)
    })
  }, [messages, phase, statut, aCompleter, recherche])

  const groupes = useMemo(() => {
    const g = []
    for (const m of filtres) {
      const cle = `${m.phase_cycle}|${m.section}`
      let groupe = g.find((x) => x.cle === cle)
      if (!groupe) {
        groupe = { cle, phase: m.phase_cycle, section: m.section, messages: [] }
        g.push(groupe)
      }
      groupe.messages.push(m)
    }
    return g
  }, [filtres])

  const compte = useMemo(() => {
    const c = { a_valider: 0, en_revue: 0, valide: 0, rejete: 0 }
    for (const m of messages) c[m.statut_validation] = (c[m.statut_validation] ?? 0) + 1
    return c
  }, [messages])

  async function changerStatut(m, nouveau, notes) {
    const { data: u } = await supabase.auth.getUser()
    const valide = nouveau === 'valide'
    const { error } = await supabase
      .from('catalogue_messages_alerte')
      .update({
        statut_validation: nouveau,
        notes_validation: notes ?? m.notes_validation,
        valide_par: valide ? u?.user?.id ?? null : null,
        valide_le: valide ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', m.id)
    if (error) setErreur(error.message)
    else charger()
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Catalogue de messages d'alerte — inondation</h1>
      <p className="text-sm text-sourdine mb-2">
        Messages à la population par phase de crise (titre + consignes), traduits et adaptés au contexte belge à partir
        du catalogue Vega Baja (CCE-GVA / Université d'Alicante). Les éléments entre crochets […] sont à compléter par
        l'opérateur au moment de l'envoi. Ces messages sont utilisables depuis le Comité de Coordination (Messages à la population).
      </p>
      <p className="text-sm text-chaud mb-4">
        Adaptation non encore validée par des experts belges (zone de secours, centre de crise) : {compte.valide} message(s) validé(s) sur {messages.length}.
        À ne pas utiliser en situation réelle avant validation.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" onClick={() => setPhase('')} className={`pastille-filtre${phase === '' ? ' actif' : ''}`}>Toutes les phases</button>
        {PHASES.map((p) => (
          <button key={p.valeur} type="button" onClick={() => setPhase(p.valeur)} className={`pastille-filtre${phase === p.valeur ? ' actif' : ''}`}>
            {p.libelle}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (titre, consigne, mot-clé…)"
          className="border border-trait rounded px-2 py-1 text-sm bg-surface min-w-[16rem]"
        />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className="border border-trait rounded px-2 py-1 text-sm bg-surface">
          <option value="">Tous les statuts</option>
          {STATUTS_VALIDATION.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-sourdine">
          <input type="checkbox" checked={aCompleter} onChange={(e) => setACompleter(e.target.checked)} />
          Reconstitués à relire
        </label>
        <span className="text-xs text-sourdine">{filtres.length} message(s)</span>
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="vide">Aucun message ne correspond.</p>
      ) : (
        groupes.map((g) => (
          <section key={g.cle} className="mb-5">
            <h2 className="text-sm font-semibold text-encre mb-1.5">
              {PHASES.find((p) => p.valeur === g.phase)?.libelle} · {g.section}
            </h2>
            <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
              {g.messages.map((m) => (
                <LigneMessage
                  key={m.id}
                  m={m}
                  ouvert={ouvert === m.id}
                  onBascule={() => setOuvert(ouvert === m.id ? null : m.id)}
                  peutValider={estSuperAdmin}
                  onStatut={changerStatut}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

export function JetonValidation({ statut }) {
  const s = STATUTS_VALIDATION.find((x) => x.valeur === statut)
  const classe = statut === 'valide' ? 'text-ok' : statut === 'rejete' ? 'text-chaud' : 'text-sourdine'
  return <span className={`jeton ${classe}`}>{s?.libelle ?? statut}</span>
}

function LigneMessage({ m, ouvert, onBascule, peutValider, onStatut }) {
  const [notes, setNotes] = useState(m.notes_validation ?? '')
  return (
    <li className="bg-surface px-4 py-2.5">
      <button type="button" onClick={onBascule} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-encre">
            <span className="text-xs text-sourdine mr-2">#{m.numero_message_source}</span>
            {m.message_cle}
          </span>
          <span className="flex gap-1.5 shrink-0">
            {m.necessite_completion && <span className="jeton text-chaud">À relire</span>}
            <JetonValidation statut={m.statut_validation} />
          </span>
        </div>
        <div className="text-xs text-sourdine mt-0.5">{m.zone_thematique}</div>
      </button>
      {ouvert && (
        <div className="mt-2 text-sm text-encre space-y-2">
          <ul className="list-disc pl-5 space-y-0.5">
            {(m.sous_messages ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {m.mots_cles?.length > 0 && <p className="text-xs text-sourdine">Mots-clés : {m.mots_cles.join(', ')}</p>}
          {m.info_complementaire && <p className="text-xs text-sourdine">{m.info_complementaire}</p>}
          <p className="text-xs text-sourdine">Source : {m.source_reference}</p>
          {peutValider ? (
            <div className="border-t border-trait pt-2 space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes de validation (expert, date, remarques)"
                className="w-full border border-trait rounded px-2 py-1 text-sm bg-surface"
              />
              <div className="flex flex-wrap gap-2">
                {STATUTS_VALIDATION.map((s) => (
                  <button
                    key={s.valeur}
                    type="button"
                    className={s.valeur === m.statut_validation ? 'principal' : 'discret'}
                    onClick={() => onStatut(m, s.valeur, notes)}
                  >
                    {s.libelle}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            m.notes_validation && <p className="text-xs text-sourdine">Validation : {m.notes_validation}</p>
          )}
        </div>
      )}
    </li>
  )
}
