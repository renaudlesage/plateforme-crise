import { useState } from 'react'

/**
 * Bloc replié par défaut : le titre et une phrase d'aide restent visibles, le contenu s'ouvre à la demande.
 * Sert à garder l'écran court en crise sans rien supprimer.
 */
export default function Repliable({ titre, aide, ouvertParDefaut = false, children }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut)
  return (
    <div className="mb-6">
      <button
        type="button"
        className="discret"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>
          <span className="font-medium">{titre}</span>
          {aide && !ouvert && <span className="block text-xs text-sourdine font-normal">{aide}</span>}
        </span>
        <span aria-hidden="true">{ouvert ? '▴' : '▾'}</span>
      </button>
      {ouvert && <div className="mt-4">{children}</div>}
    </div>
  )
}
