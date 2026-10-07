import { useState } from 'react'
import { DISCIPLINES, disciplineDe } from './disciplines.js'
import { symboleDe } from './symboles.js'
import { Symbole, PaletteSymboles } from './Symboles.jsx'

/**
 * Édition des points terrain et des moyens engagés sur la carte — partagée entre
 * l'app Terrain (écritures via la file hors ligne) et le CC (écritures directes).
 * Les formulaires ne connaissent pas Supabase : ils reçoivent `ecrire(operation)`
 * qui renvoie `{ statut: 'ok' | 'enfile' | 'refus', message? }`
 * (operation = { nature: 'insert'|'update', table, champs, id?, libelle }).
 */

function BoutonPrincipal({ children, className = '', ...props }) {
  return <button {...props} className={`principal ${className}`.trim()}>{children}</button>
}
function BoutonDiscret({ children, className = '', ...props }) {
  return <button {...props} className={`discret ${className}`.trim()}>{children}</button>
}

export const TYPES_OBSERVATION = [
  { valeur: 'danger', libelle: 'Danger', couleur: '#b91c1c', symbole: 'danger_noir' },
  { valeur: 'route_coupee', libelle: 'Route coupée', couleur: '#ea580c', symbole: 'route_barree' },
  { valeur: 'inondation', libelle: 'Inondation', couleur: '#0284c7', symbole: 'danger_eau' },
  { valeur: 'degats', libelle: 'Dégâts', couleur: '#a16207', symbole: 'danger_risque' },
  { valeur: 'victimes', libelle: 'Victimes / personnes en danger', couleur: '#be123c', symbole: 'danger_humain' },
  { valeur: 'besoin', libelle: 'Besoin (aide, matériel)', couleur: '#7c3aed', symbole: 'point_particulier' },
  { valeur: 'point_rassemblement', libelle: 'Point de rassemblement', couleur: '#059669', symbole: 'infra_pr' },
  { valeur: 'acces', libelle: 'Accès / barrage', couleur: '#475569', symbole: 'isolement' },
  { valeur: 'autre', libelle: 'Autre', couleur: '#64748b', symbole: 'point_particulier' },
]

export const STATUTS_MOYEN = {
  en_route: 'En route',
  sur_place: 'Sur place',
  disponible: 'Disponible',
  retire: 'Retiré',
}

/** Position : touché sur la carte (géré par la page) ou position de l'appareil. */
function BoutonMaPosition({ onPosition }) {
  const [recherche, setRecherche] = useState(false)
  const [erreur, setErreur] = useState(null)

  function utiliser() {
    if (!navigator.geolocation) {
      setErreur('Pas de géolocalisation sur cet appareil.')
      return
    }
    setRecherche(true)
    setErreur(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onPosition({ lat: p.coords.latitude, lon: p.coords.longitude, precision_m: p.coords.accuracy })
        setRecherche(false)
      },
      () => {
        setErreur('Position refusée ou indisponible — touchez la carte.')
        setRecherche(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  return (
    <div>
      <BoutonDiscret type="button" onClick={utiliser} disabled={recherche}>
        {recherche ? 'Recherche…' : 'Utiliser ma position'}
      </BoutonDiscret>
      {erreur && <p className="text-xs text-chaud mt-1">{erreur}</p>}
    </div>
  )
}

export function FormulaireObservation({ ecrire, contexteId, incidentId, selection, onPosition, onAnnuler, onEnvoyer, existant = null }) {
  const [type, setType] = useState(existant?.type ?? 'danger')
  const [symbole, setSymbole] = useState(existant ? existant.symbole ?? TYPES_OBSERVATION.find((t) => t.valeur === existant.type)?.symbole ?? null : TYPES_OBSERVATION[0].symbole)
  const [discipline, setDiscipline] = useState(existant?.discipline ?? null)
  const [description, setDescription] = useState(existant?.description ?? '')
  const [enCours, setEnCours] = useState(false)

  async function envoyer(e) {
    e.preventDefault()
    if (!selection) return
    setEnCours(true)
    if (existant) {
      const res = await ecrire({
        nature: 'update',
        table: 'observations_terrain',
        id: existant.id,
        champs: {
          type,
          symbole,
          discipline,
          description: description.trim() || null,
          latitude: selection.lat,
          longitude: selection.lon,
          precision_m: selection.precision_m ?? null,
        },
        libelle: `Point terrain modifié · ${TYPES_OBSERVATION.find((t) => t.valeur === type)?.libelle}`,
      })
      setEnCours(false)
      await onEnvoyer(res, 'Point terrain modifié')
      return
    }
    const res = await ecrire({
      nature: 'insert',
      table: 'observations_terrain',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        type,
        symbole,
        discipline,
        description: description.trim() || null,
        latitude: selection.lat,
        longitude: selection.lon,
        precision_m: selection.precision_m ?? null,
      },
      libelle: `Point terrain · ${TYPES_OBSERVATION.find((t) => t.valeur === type)?.libelle}`,
    })
    setEnCours(false)
    await onEnvoyer(res, 'Point terrain enregistré')
  }

  return (
    <form onSubmit={envoyer} className="mb-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">{existant ? 'Modifier le point terrain' : 'Nouveau point terrain'}</p>
      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value)
          // Le symbole suit le type tant qu'on n'en a pas choisi un autre à la main.
          setSymbole(TYPES_OBSERVATION.find((t) => t.valeur === e.target.value)?.symbole ?? null)
        }}
        className="w-full"
      >
        {TYPES_OBSERVATION.map((t) => (
          <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
        ))}
      </select>
      <PaletteSymboles valeur={symbole} onChange={(code) => setSymbole(code ?? TYPES_OBSERVATION.find((t) => t.valeur === type)?.symbole ?? null)} />
      <div>
        <p className="text-xs text-sourdine mb-1">Discipline concernée (facultatif)</p>
        <ChoixDiscipline valeur={discipline} onChange={setDiscipline} />
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce que vous constatez (facultatif)" className="w-full" />
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}${selection.precision_m ? ` (±${Math.round(selection.precision_m)} m)` : ''}`
          : 'Touchez la carte à l\'endroit voulu (juste en dessous), ou utilisez votre position.'}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!selection || enCours}>
          {enCours ? 'Envoi…' : existant ? 'Enregistrer les modifications' : 'Enregistrer le point'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
      {existant && (
        <div className="border-t border-trait pt-2">
          <BoutonDiscret
            type="button"
            disabled={enCours}
            onClick={async () => {
              setEnCours(true)
              const res = await ecrire({
                nature: 'update',
                table: 'observations_terrain',
                id: existant.id,
                champs: { statut: 'traite' },
                libelle: `Point terrain clos · ${TYPES_OBSERVATION.find((t) => t.valeur === existant.type)?.libelle}`,
              })
              setEnCours(false)
              await onEnvoyer(res, 'Point clos (retiré de la carte)')
            }}
          >
            Clore ce point (traité)
          </BoutonDiscret>
        </div>
      )}
    </form>
  )
}

export function FormulaireLocalisation({ ecrire, element, selection, onPosition, onAnnuler, onEnvoyer }) {
  const [enCours, setEnCours] = useState(false)

  async function envoyer() {
    if (!selection) return
    setEnCours(true)
    const res = await ecrire({
      nature: 'update',
      table: element.table,
      id: element.id,
      champs: { latitude: selection.lat, longitude: selection.lon },
      libelle: `Position · ${element.libelle}`,
    })
    setEnCours(false)
    await onEnvoyer(res, 'Position enregistrée')
  }

  return (
    <div className="mb-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">Localiser : {element.libelle}</p>
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}`
          : 'Placez-vous sur le site et utilisez votre position, ou touchez la carte.'}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal onClick={envoyer} disabled={!selection || enCours}>
          {enCours ? 'Envoi…' : 'Enregistrer la position'}
        </BoutonPrincipal>
        <BoutonDiscret onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </div>
  )
}

/** Pastilles de discipline : un toucher pose, un second toucher retire. */
export function ChoixDiscipline({ valeur, onChange, compact = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DISCIPLINES.map((d) => {
        const actif = valeur === d.valeur
        return (
          <button
            key={d.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(actif ? null : d.valeur)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: compact ? '3px 8px' : '6px 12px',
              fontSize: 13,
              borderRadius: 999,
              border: `2px solid ${d.couleur}`,
              background: actif ? d.couleur : 'transparent',
              color: actif ? '#fff' : 'inherit',
              fontWeight: 600,
            }}
          >
            {d.court}
          </button>
        )
      })}
    </div>
  )
}

/** Flaguer (ou re-flaguer) un point déjà posé dans une discipline. */
export function PointsAFlaguer({ points, onFlaguer, onModifier }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="mt-3 border border-trait rounded p-3 bg-surface">
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)}>
        Points terrain : modifier ou flaguer ({points.length}) {ouvert ? '▴' : '▾'}
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
          {points.map((p) => {
            const t = TYPES_OBSERVATION.find((x) => x.valeur === p.type)
            return (
              <li key={p.id}>
                <p className="text-sm text-encre flex items-center gap-2">
                  <Symbole code={p.symbole ?? t?.symbole ?? 'point_particulier'} taille={22} badge={disciplineDe(p.discipline)?.couleur} />
                  {t?.libelle ?? 'Point terrain'}
                  {p.description && <span className="text-xs text-sourdine"> · {p.description}</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <ChoixDiscipline compact valeur={p.discipline} onChange={(d) => onFlaguer(p, d)} />
                  <BoutonDiscret type="button" onClick={() => onModifier(p)}>Modifier</BoutonDiscret>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Moyens engagés : changer l'état d'un moyen (en route, sur place, disponible, retiré) ou le déplacer. */
export function MoyensEngages({ moyens, onStatut, onDeplacer, onModifier }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="border border-trait rounded p-3 bg-surface">
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        Moyens engagés ({moyens.length}) {ouvert ? '▴' : '▾'}
      </button>
      {ouvert &&
        (moyens.length === 0 ? (
          <p className="text-xs text-sourdine mt-2">Aucun moyen engagé. Utilisez « + Moyen engagé » en haut de la page.</p>
        ) : (
          <ul className="mt-2 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
            {moyens.map((m) => {
              const d = disciplineDe(m.discipline)
              return (
                <li key={m.id}>
                  <p className="text-sm text-encre flex items-center gap-2">
                    <Symbole code={m.symbole} taille={24} badge={d?.couleur} />
                    <span>
                      {m.libelle}
                      <span className="text-xs text-sourdine">
                        {m.effectif != null ? ` · ${m.effectif} pers.` : ''}
                        {d ? ` · ${d.court}` : ''}
                        {m.latitude == null ? ' · sans position' : ''}
                      </span>
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select value={m.statut} onChange={(e) => onStatut(m, e.target.value)} style={{ width: 'auto', fontSize: 13 }} aria-label={`État de ${m.libelle}`}>
                      {Object.entries(STATUTS_MOYEN).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <BoutonDiscret type="button" onClick={() => onModifier(m)}>Modifier</BoutonDiscret>
                    <BoutonDiscret type="button" onClick={() => onDeplacer(m)}>{m.latitude == null ? 'Positionner' : 'Déplacer'}</BoutonDiscret>
                  </div>
                </li>
              )
            })}
          </ul>
        ))}
    </div>
  )
}

export function FormulaireMoyen({ ecrire, contexteId, incidentId, selection, onPosition, onAnnuler, onEnvoyer, existant = null }) {
  const [symbole, setSymbole] = useState(existant?.symbole ?? 'autopompe')
  const [libelle, setLibelle] = useState(existant?.libelle ?? '')
  const [discipline, setDiscipline] = useState(existant ? existant.discipline ?? null : symboleDe('autopompe')?.discipline ?? null)
  const [effectif, setEffectif] = useState(existant?.effectif != null ? String(existant.effectif) : '')
  const [statut, setStatut] = useState(existant?.statut ?? 'sur_place')
  const [remarque, setRemarque] = useState(existant?.remarque ?? '')
  const [enCours, setEnCours] = useState(false)

  async function envoyer(e) {
    e.preventDefault()
    if (!selection || !libelle.trim()) return
    setEnCours(true)
    if (existant) {
      const res = await ecrire({
        nature: 'update',
        table: 'moyens_engages',
        id: existant.id,
        champs: {
          symbole,
          libelle: libelle.trim(),
          discipline,
          effectif: effectif === '' ? null : Math.max(0, Number(effectif) || 0),
          statut,
          remarque: remarque.trim() || null,
          latitude: selection.lat,
          longitude: selection.lon,
          precision_m: selection.precision_m ?? null,
          maj_le: new Date().toISOString(),
        },
        libelle: `Moyen modifié · ${libelle.trim()}`,
      })
      setEnCours(false)
      await onEnvoyer(res, 'Moyen modifié')
      return
    }
    const res = await ecrire({
      nature: 'insert',
      table: 'moyens_engages',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        symbole,
        libelle: libelle.trim(),
        discipline,
        effectif: effectif === '' ? null : Math.max(0, Number(effectif) || 0),
        statut,
        remarque: remarque.trim() || null,
        latitude: selection.lat,
        longitude: selection.lon,
        precision_m: selection.precision_m ?? null,
      },
      libelle: `Moyen engagé · ${libelle.trim()}`,
    })
    setEnCours(false)
    await onEnvoyer(res, 'Moyen engagé enregistré')
  }

  return (
    <form onSubmit={envoyer} className="mb-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">{existant ? 'Modifier le moyen engagé' : 'Nouveau moyen engagé'}</p>
      <PaletteSymboles
        titre="Symbole"
        categories={['moyen', 'poste']}
        valeur={symbole}
        sansDefaut
        onChange={(code) => {
          const choisi = code ?? 'moyen_autre'
          setSymbole(choisi)
          // La discipline suit le symbole (pompiers D1, médical D2…) tant qu'on ne la change pas à la main.
          const d = symboleDe(choisi)?.discipline
          if (d) setDiscipline(d)
        }}
      />
      <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Nom du moyen (ex. P1 Visé, Amb 12)" className="w-full" required />
      <div>
        <p className="text-xs text-sourdine mb-1">Discipline</p>
        <ChoixDiscipline valeur={discipline} onChange={setDiscipline} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min="0" inputMode="numeric" value={effectif} onChange={(e) => setEffectif(e.target.value)} placeholder="Effectif" />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="État">
          {Object.entries(STATUTS_MOYEN).filter(([v]) => v !== 'retire').map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <input value={remarque} onChange={(e) => setRemarque(e.target.value)} placeholder="Remarque (facultatif)" className="w-full" />
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}${selection.precision_m ? ` (±${Math.round(selection.precision_m)} m)` : ''}`
          : "Touchez la carte à l'endroit voulu (juste en dessous), ou utilisez votre position."}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!selection || !libelle.trim() || enCours}>
          {enCours ? 'Envoi…' : existant ? 'Enregistrer les modifications' : 'Enregistrer le moyen'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
      {existant && (
        <div className="border-t border-trait pt-2">
          <BoutonDiscret
            type="button"
            disabled={enCours}
            onClick={async () => {
              setEnCours(true)
              const res = await ecrire({
                nature: 'update',
                table: 'moyens_engages',
                id: existant.id,
                champs: { statut: 'retire', maj_le: new Date().toISOString() },
                libelle: `Moyen retiré · ${existant.libelle}`,
              })
              setEnCours(false)
              await onEnvoyer(res, 'Moyen retiré de la carte')
            }}
          >
            Retirer ce moyen
          </BoutonDiscret>
        </div>
      )}
    </form>
  )
}
