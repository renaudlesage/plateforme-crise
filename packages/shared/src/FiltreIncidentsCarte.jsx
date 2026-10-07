/**
 * Choix des incidents affichés sur une carte. Une carte n'est pas propre à
 * un incident : en cas de catastrophe on veut tout voir d'un coup, en cas
 * d'incidents isolés on ne veut voir que celui dont on s'occupe. Le parent
 * garde la liste des ids cochés ; les couches « incident » (position, zones
 * d'intervention, points terrain, signalements rattachés) suivent ce choix.
 *
 * @param {Array<{id:string, nom:string, geolocalise?:boolean}>} incidents
 * @param {string[]} selectionnes - ids cochés
 * @param {(ids: string[]) => void} onChange
 */
export default function FiltreIncidentsCarte({ incidents, selectionnes, onChange }) {
  if (incidents.length === 0) return null

  const coche = new Set(selectionnes)
  const basculer = (id) => {
    const suivant = new Set(coche)
    if (suivant.has(id)) suivant.delete(id)
    else suivant.add(id)
    onChange([...suivant])
  }

  return (
    <div className="border border-trait rounded p-3 bg-surface mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="etiquette">
          Incidents affichés ({selectionnes.length}/{incidents.length})
        </p>
        {incidents.length > 1 && (
          <div className="flex gap-2">
            <button type="button" className="discret" onClick={() => onChange(incidents.map((i) => i.id))}>
              Tous
            </button>
            <button type="button" className="discret" onClick={() => onChange([])}>
              Aucun
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {incidents.map((i) => (
          <label key={i.id} className="flex items-center gap-1.5 text-sm text-encre">
            <input type="checkbox" checked={coche.has(i.id)} onChange={() => basculer(i.id)} />
            {i.nom}
            {i.geolocalise === false && <span className="text-xs text-sourdine">(sans position)</span>}
          </label>
        ))}
      </div>
    </div>
  )
}
