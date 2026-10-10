import { useState } from 'react'

/** Barre d'onglets locale (classes `.onglets` / `button.module` du design system). */
export default function Onglets({ onglets, initial }) {
  const [actif, setActif] = useState(initial ?? onglets[0].cle)
  const courant = onglets.find((o) => o.cle === actif) ?? onglets[0]
  return (
    <>
      <div className="onglets" role="tablist">
        {onglets.map((o) => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={o.cle === courant.cle}
            className={`module ${o.cle === courant.cle ? 'actif' : ''}`.trim()}
            onClick={() => setActif(o.cle)}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      <div className="mt-4">{courant.contenu}</div>
    </>
  )
}
