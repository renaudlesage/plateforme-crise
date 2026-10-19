import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'
import { sectionsDuMenu } from '../lib/menu'

// Gestion des clients et des comptes de la plateforme : console à part, réservée au super-admin.
const URL_PLATEFORME = import.meta.env.VITE_URL_PLATEFORME || null

// Un lien reste actif sur ses sous-pages (/plans-urgence/:id garde "Plans
// d'urgence" allumé), sauf la racine qui ne correspond qu'à elle-même.
function estActif(chemin, to) {
  return to === '/' ? chemin === '/' : chemin === to || chemin.startsWith(to + '/')
}

export default function MisEnPage() {
  const { utilisateur, contexteActuel, estSuperAdmin, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Menu : ~45 entrées en 8 sections. Étalées d'un coup elles occupaient
  // plus de deux écrans de téléphone avant le moindre contenu. Désormais :
  // sections repliées (seule celle de la page courante est ouverte) et,
  // sur mobile, le menu entier replié derrière un bouton.
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [surcharges, setSurcharges] = useState({})

  // Naviguer referme le menu et rend la main à l'ouverture automatique.
  useEffect(() => {
    setMenuOuvert(false)
    setSurcharges({})
  }, [location.pathname])

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  const sections = sectionsDuMenu({ typeContexte: contexteActuel?.contextes?.type })

  const contientActif = (section) => section.liens.some((l) => estActif(location.pathname, l.to))
  const estOuverte = (section) => surcharges[section.titre] ?? contientActif(section)
  const pageCourante = sections.flatMap((s) => s.liens).find((l) => estActif(location.pathname, l.to))

  return (
    <div className="poste">
      <header className="tete">
        <div className="barre-haut">
          <div className="marque compacte">
            <span className="marque-nom">Admin</span>
          </div>
          <button type="button" className="lien" onClick={changerDeContexte}>
            {contexteActuel?.contextes?.nom ?? 'Aucun contexte'}
          </button>
          <div className="pousse" />
          {estSuperAdmin && URL_PLATEFORME && (
            <a className="lien" href={URL_PLATEFORME}>
              Console Plateforme
            </a>
          )}
          <span className="compte">{utilisateur?.email}</span>
          <BasculeTheme />
          <button type="button" className="sortie discret" onClick={deconnexion}>
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="corps">
        <nav className="menu" aria-label="Navigation principale">
          <button
            type="button"
            className="menu-bascule"
            aria-expanded={menuOuvert}
            onClick={() => setMenuOuvert((v) => !v)}
          >
            <span>
              Menu{pageCourante && <small> · {pageCourante.libelle}</small>}
            </span>
            <span aria-hidden="true">{menuOuvert ? '▴' : '▾'}</span>
          </button>

          <div className={`menu-corps${menuOuvert ? '' : ' ferme'}`}>
            {sections.map((section, i) =>
              section.titre === null ? (
                <div key={i} className="menu-groupe-liens menu-groupe-haut">
                  {section.liens.map((lien) => (
                    <Link
                      key={lien.to}
                      to={lien.to}
                      className={`plaque-nav${estActif(location.pathname, lien.to) ? ' actif' : ''}`}
                    >
                      {lien.libelle}
                    </Link>
                  ))}
                </div>
              ) : (
                <div key={i} className="menu-groupe">
                  <button
                    type="button"
                    className="menu-groupe-titre"
                    aria-expanded={estOuverte(section)}
                    onClick={() => setSurcharges((o) => ({ ...o, [section.titre]: !estOuverte(section) }))}
                  >
                    <span>{section.titre}</span>
                    <span aria-hidden="true">
                      <span className="menu-groupe-nb">{section.liens.length}</span> {estOuverte(section) ? '▴' : '▾'}
                    </span>
                  </button>
                  {estOuverte(section) && (
                    <div className="menu-groupe-liens">
                      {section.liens.map((lien) => (
                        <Link
                          key={lien.to}
                          to={lien.to}
                          className={`plaque-nav${estActif(location.pathname, lien.to) ? ' actif' : ''}`}
                        >
                          {lien.libelle}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </nav>

        <main className="travail">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
