import { useCallback, useEffect, useState } from 'react'
import { texteErreur } from './erreurs.js'

/**
 * C6 — composants communs au QG et à Terrain (idées reprises de SCRIBE et de Kalisio Crisis ; aucun code repris).
 * Ils reçoivent le client Supabase de l'app : le paquet partagé n'en crée pas.
 */

const RAFRAICHISSEMENT_MS = 30000

function useRafraichi(charger, delai = RAFRAICHISSEMENT_MS) {
  useEffect(() => {
    charger()
    const t = setInterval(() => document.visibilityState === 'visible' && charger(), delai)
    return () => clearInterval(t)
  }, [charger, delai])
}

/**
 * Consignes non lues de l'utilisateur, en tête de page, avec « J'ai lu » (accusé de lecture horodaté).
 * Rien ne s'affiche tant qu'il n'y en a pas, ni si la migration C6 n'est pas appliquée.
 */
export function BandeauConsignes({ supabase, contexteId }) {
  const [consignes, setConsignes] = useState([])
  const [ouverte, setOuverte] = useState(null)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    const { data, error } = await supabase.rpc('mes_consignes', { p_contexte: contexteId, p_non_lues: true })
    if (!error) setConsignes(data ?? [])
  }, [supabase, contexteId])
  useRafraichi(charger)

  if (consignes.length === 0) return null
  const urgente = consignes.some((c) => c.priorite === 'urgente')

  async function lu(c) {
    const { error } = await supabase.rpc('accuser_lecture_consigne', { p_consigne: c.id })
    if (error) setErreur(texteErreur(error))
    else {
      setErreur(null)
      setOuverte(null)
      charger()
    }
  }

  return (
    <div role="alert" style={{ background: urgente ? '#b91c1c' : '#1e3a5f', color: '#fff', padding: '10px 16px', fontSize: 14 }}>
      <p style={{ fontWeight: 600, margin: 0 }}>
        📋 {consignes.length} consigne{consignes.length > 1 ? 's' : ''} à lire
      </p>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
        {consignes.map((c) => (
          <li key={c.id} style={{ marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setOuverte(ouverte === c.id ? null : c.id)}
              style={{ background: 'none', border: 0, color: '#fff', padding: 0, textDecoration: 'underline', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            >
              {c.est_exercice && '[EXERCICE] '}
              {c.priorite === 'urgente' && 'URGENT · '}
              {c.titre}
            </button>
            <span style={{ opacity: 0.8, marginLeft: 6, fontSize: 12 }}>
              {new Date(c.emise_le).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {ouverte === c.id && (
              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 10px', marginTop: 6 }}>
                <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{c.texte}</p>
                <button
                  type="button"
                  onClick={() => lu(c)}
                  style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, border: 0, background: '#fff', color: '#111', fontWeight: 600 }}
                >
                  J’ai lu
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {erreur && <p style={{ margin: '6px 0 0' }}>{erreur}</p>}
    </div>
  )
}

/**
 * Processus d'intervention confiés à l'utilisateur sur un incident : la question de l'étape en cours,
 * une réponse d'un toucher, un commentaire facultatif. Rien ne s'affiche s'il n'y en a aucun.
 */
export function MesProcessus({ supabase, incidentId, utilisateurId }) {
  const [lignes, setLignes] = useState([])
  const [commentaires, setCommentaires] = useState({})
  const [occupe, setOccupe] = useState(null)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    if (!incidentId || !utilisateurId) return
    const { data, error } = await supabase
      .from('processus_participants')
      .select('id, libelle, etape_courante, termine_le, processus_lances!inner(id, titre, etapes, clos_le, incident_id)')
      .eq('user_id', utilisateurId)
      .eq('processus_lances.incident_id', incidentId)
      .is('termine_le', null)
      .is('processus_lances.clos_le', null)
    if (!error) setLignes(data ?? [])
  }, [supabase, incidentId, utilisateurId])
  useRafraichi(charger, 20000)

  if (lignes.length === 0) return null

  async function repondre(pa, reponse) {
    setOccupe(pa.id)
    const { error } = await supabase.rpc('repondre_processus', {
      p_participant: pa.id,
      p_reponse: reponse,
      p_commentaire: commentaires[pa.id]?.trim() || null,
    })
    setOccupe(null)
    if (error) setErreur(texteErreur(error))
    else {
      setErreur(null)
      setCommentaires((c) => ({ ...c, [pa.id]: '' }))
      charger()
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-encre">Processus à suivre</h2>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {lignes.map((pa) => {
        const p = pa.processus_lances
        const etape = p.etapes?.[pa.etape_courante]
        if (!etape) return null
        return (
          <div key={pa.id} className="border border-trait rounded p-3 bg-surface">
            <p className="text-xs text-sourdine">
              {p.titre} · {pa.libelle} · étape {pa.etape_courante + 1}/{p.etapes.length}
            </p>
            <p className="text-encre font-medium my-1">{etape.question}</p>
            <div className="flex flex-wrap gap-2 my-2">
              {etape.reponses.map((r) => (
                <button key={r.libelle} type="button" className="principal" disabled={occupe === pa.id} onClick={() => repondre(pa, r.libelle)}>
                  {r.libelle}
                </button>
              ))}
            </div>
            <input
              value={commentaires[pa.id] ?? ''}
              onChange={(e) => setCommentaires((c) => ({ ...c, [pa.id]: e.target.value }))}
              placeholder="Commentaire (facultatif)"
              aria-label="Commentaire"
              maxLength={1000}
              className="w-full"
            />
          </div>
        )
      })}
    </section>
  )
}
