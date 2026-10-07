import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sectionsDuMenu } from '../lib/menu'

export default function TableauDeBord() {
  const { contexteActuel, estSuperAdmin } = useAuth()
  // Une tuile par section du menu (même source), titres sans entrée "racine".
  const sections = sectionsDuMenu({ typeContexte: contexteActuel?.contextes?.type, estSuperAdmin }).filter(
    (s) => s.titre
  )

  return (
    <div>
      <h1 className="text-2xl font-semibold text-encre">Tableau de bord</h1>
      <p className="mt-1.5 text-sm text-sourdine">
        Contexte actif : <strong className="text-sourdine">{contexteActuel?.contextes?.nom}</strong>
        <span className="mx-2 text-sourdine">·</span>
        niveau d'accès : <strong className="text-sourdine">{contexteActuel?.niveau_acces}</strong>
      </p>

      <div className="grille-paves mt-8">
        {sections.map((s) => (
          <div className="pave" key={s.titre}>
            <p className="pave-titre">{s.titre}</p>
            {s.resume && <p className="text-sm text-sourdine mb-2">{s.resume}</p>}
            <ul className="liste-pave">
              {s.liens.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>
                    {l.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
