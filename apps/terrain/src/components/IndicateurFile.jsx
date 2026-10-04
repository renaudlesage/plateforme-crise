import { useEffect, useState } from 'react'
import { fileEcritures } from '../lib/fileEcritures'
import { BoutonDiscret } from './Boutons'

/**
 * Visibilité de la file d'écritures hors ligne (packages/shared/src/fileEcritures.js).
 * Le principe du socle Eventware : une écriture mise en file doit se
 * voir, pas disparaître silencieusement derrière un "c'est fait".
 */
export default function IndicateurFile() {
  const [file, setFile] = useState(() => fileEcritures.lireFile())

  useEffect(() => fileEcritures.surChangement(setFile), [])

  const enAttente = file.filter((o) => !o.definitif)
  const refusees = file.filter((o) => o.definitif)

  if (file.length === 0) return null

  return (
    <div className="jeton-file">
      {enAttente.length > 0 && (
        <span className="jeton text-veille" title="En attente d'envoi, dès que le réseau revient">
          {enAttente.length} en attente d'envoi
        </span>
      )}
      {refusees.map((o) => (
        <div key={o.cle} className="flex items-center gap-2 mt-1">
          <span className="jeton text-chaud">{o.libelle ?? o.table}</span>
          <span className="text-xs text-sourdine">{o.message}</span>
          <BoutonDiscret onClick={() => fileEcritures.retirer(o.cle)}>Ignorer</BoutonDiscret>
        </div>
      ))}
    </div>
  )
}
