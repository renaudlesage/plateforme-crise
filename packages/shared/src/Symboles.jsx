import { useState } from 'react'
import { CATEGORIES_SYMBOLES, SYMBOLES, svgSymbole, symboleDe } from './symboles.js'

/**
 * Affiche un symbole de la charte. Le SVG est produit par symboles.js à partir
 * de constantes internes (aucun texte saisi par un utilisateur n'y entre).
 */
export function Symbole({ code, taille = 32, badge = null, style }) {
  const html = svgSymbole(code, { taille, badge })
  if (!html) return null
  return <span style={{ display: 'inline-block', lineHeight: 0, ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Sélecteur : grille de symboles groupés par catégorie, repliable. */
export function PaletteSymboles({ valeur, onChange, titre = 'Symbole', ouvertParDefaut = false, categories = null, sansDefaut = false }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut)
  const courant = symboleDe(valeur)
  return (
    <div>
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {courant && <span style={{ background: '#fff', borderRadius: 6, padding: 2, lineHeight: 0 }}><Symbole code={courant.code} taille={26} /></span>}
          {titre} : {courant ? courant.libelle : 'selon le type'} {ouvert ? '▴' : '▾'}
        </span>
      </button>
      {ouvert && (
        <div className="mt-2 space-y-3">
          {!sansDefaut && (
            <button type="button" className="discret" onClick={() => onChange(null)} style={{ fontSize: 12, padding: '3px 8px' }}>
              Revenir au symbole du type
            </button>
          )}
          {CATEGORIES_SYMBOLES.filter((cat) => !categories || categories.includes(cat.cle)).map((cat) => (
            <div key={cat.cle}>
              <p className="etiquette mb-1">{cat.libelle}</p>
              <div className="flex flex-wrap gap-1.5">
                {SYMBOLES.filter((s) => s.categorie === cat.cle).map((s) => {
                  const actif = s.code === valeur
                  return (
                    <button
                      key={s.code}
                      type="button"
                      title={s.libelle}
                      aria-label={s.libelle}
                      aria-pressed={actif}
                      onClick={() => onChange(s.code)}
                      style={{
                        padding: 4,
                        borderRadius: 8,
                        border: actif ? '2px solid currentColor' : '1px solid rgba(128,128,128,0.4)',
                        background: '#fff',
                        lineHeight: 0,
                      }}
                    >
                      <Symbole code={s.code} taille={34} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-sourdine">
            Charte graphique opérationnelle belge (mémento de gestion de crise). Les symboles marqués « adapté » n'y figurent pas
            et sont dessinés dans le même esprit.
          </p>
        </div>
      )}
    </div>
  )
}

/** Légende repliable : tous les symboles avec leur libellé. */
export function LegendeSymboles({ codes = null }) {
  const [ouvert, setOuvert] = useState(false)
  const liste = codes ? SYMBOLES.filter((s) => codes.includes(s.code)) : SYMBOLES
  return (
    <div className="border border-trait rounded p-3 bg-surface">
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        Légende des symboles {ouvert ? '▴' : '▾'}
      </button>
      {ouvert && (
        <div className="mt-2 space-y-3">
          {CATEGORIES_SYMBOLES.map((cat) => {
            const items = liste.filter((s) => s.categorie === cat.cle)
            if (items.length === 0) return null
            return (
              <div key={cat.cle}>
                <p className="etiquette mb-1">{cat.libelle}</p>
                <ul className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                  {items.map((s) => (
                    <li key={s.code} className="flex items-center gap-2 text-xs text-sourdine">
                      <span style={{ background: '#fff', borderRadius: 6, padding: 2, lineHeight: 0, flexShrink: 0 }}>
                        <Symbole code={s.code} taille={26} />
                      </span>
                      {s.libelle}
                      {s.extension && <span className="jeton">adapté</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
