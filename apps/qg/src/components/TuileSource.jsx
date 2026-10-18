import { useRef, useState } from 'react'
import {
  ATTRIBUTS_LIEN_EXTERNE,
  MENTION_CONSTAT,
  estCameraOuWebcam,
  libelleTypeSource,
  libelleVerification,
} from '@plateforme-crise/shared'
import { BoutonDiscret } from './Boutons'

// Lien présenté comme le bouton principal du socle (la classe .principal ne vise que les <button>).
const STYLE_OUVRIR = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '9px 16px',
  border: '1px solid var(--etat-info)',
  background: 'var(--etat-info)',
  color: 'var(--on-teinte)',
  fontSize: 14,
  borderRadius: 'var(--rayon)',
  textDecoration: 'none',
}

/**
 * Une source de situation : un lien sortant (nouvel onglet), l'avertissement éventuel, la dernière vérification
 * partagée (qui a regardé quand), l'épingle personnelle et « Marquer vu ».
 * `lectureSeule` : incident d'exercice, aucune vérification n'est enregistrée.
 */
export default function TuileSource({ source, epinglee, verification, peutVerifier, lectureSeule = false, compact = false, incidentId = null, maintenant, onEpingler, onVu }) {
  const [constatOuvert, setConstatOuvert] = useState(false)
  const [constat, setConstat] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const verrou = useRef(false)
  const vu = libelleVerification(verification, maintenant)
  const locale = !!source.contexte_id

  async function marquer(texte) {
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    const { error } = await onVu(source, { incidentId, constat: texte })
    verrou.current = false
    setEnCours(false)
    if (error) return setErreur(error.message)
    setConstat('')
    setConstatOuvert(false)
  }

  return (
    <article data-source={source.code ?? source.id} className="border border-trait rounded bg-surface p-3 flex flex-col gap-2 min-w-0">
      <h3 className="text-base font-semibold text-encre" style={{ margin: 0 }}>{source.nom}</h3>

      {!compact && (
        <p className="flex flex-wrap gap-1.5" style={{ margin: 0 }}>
          <span className="jeton">{libelleTypeSource(source.type_source)}</span>
          {source.portee && <span className="jeton">{source.portee}</span>}
          {locale && <span className="jeton">Commune</span>}
        </p>
      )}

      {source.note && <p className="text-sm text-sourdine" style={{ margin: 0 }}>{source.note}</p>}
      {source.avertissement && (
        <p role="note" className="text-sm text-chaud" style={{ margin: 0 }}>
          ⚠ {source.avertissement}
        </p>
      )}
      {estCameraOuWebcam(source) && source.responsable_traitement && (
        <p className="text-xs text-sourdine" style={{ margin: 0 }}>
          Flux public ou officiel · responsable : {source.responsable_traitement}
        </p>
      )}
      {!compact && source.controle_note && <p className="text-xs text-sourdine" style={{ margin: 0 }}>{source.controle_note}</p>}

      <p className="text-xs" style={{ margin: 0, color: vu.ancien ? 'var(--sourdine)' : 'var(--etat-ok)' }}>
        {vu.texte}
        {verification?.constat && <span className="text-sourdine"> — {verification.constat}</span>}
      </p>

      <div className="flex flex-wrap gap-2" style={{ marginTop: 'auto' }}>
        <a href={source.url} {...ATTRIBUTS_LIEN_EXTERNE} style={STYLE_OUVRIR}>
          Ouvrir la source
        </a>
        {!compact && (
          <BoutonDiscret type="button" aria-pressed={epinglee} onClick={() => onEpingler(source)}>
            {epinglee ? 'Épinglé' : 'Épingler'}
          </BoutonDiscret>
        )}
        {peutVerifier && !lectureSeule && (
          <>
            <BoutonDiscret type="button" disabled={enCours} onClick={() => marquer(null)}>
              Marquer vu
            </BoutonDiscret>
            <BoutonDiscret type="button" aria-expanded={constatOuvert} onClick={() => setConstatOuvert((o) => !o)}>
              Constat…
            </BoutonDiscret>
          </>
        )}
      </div>

      {constatOuvert && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            marquer(constat)
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-xs text-sourdine">
            Ce que vous avez constaté <span>({MENTION_CONSTAT})</span>
            <input value={constat} maxLength={500} onChange={(e) => setConstat(e.target.value)} className="w-full" style={{ marginTop: 4 }} />
          </label>
          <div className="flex gap-2">
            <BoutonDiscret type="submit" disabled={enCours || !constat.trim()}>
              Marquer vu avec ce constat
            </BoutonDiscret>
          </div>
        </form>
      )}
      {erreur && <p role="alert" className="text-xs text-chaud" style={{ margin: 0 }}>{erreur}</p>}
    </article>
  )
}
