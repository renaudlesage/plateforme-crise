import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'

const SECTIONS = [
  {
    titre: null,
    liens: [
      { to: '/', libelle: 'Tableau de bord' },
      { to: '/carte', libelle: 'Carte' },
    ],
  },
  {
    titre: 'Configuration',
    liens: [
      { to: '/configuration', libelle: 'Rôles, niveaux, disciplines' },
      { to: '/comptes', libelle: 'Comptes' },
    ],
  },
  {
    titre: 'Plan légal',
    liens: [
      { to: '/plans-urgence', libelle: "Plans d'urgence (PGUI/PPUI)" },
      { to: '/hopitaux', libelle: 'Hôpitaux (PUH)' },
    ],
  },
  {
    titre: 'Référentiels',
    liens: [
      { to: '/annuaire', libelle: 'Annuaire' },
      { to: '/risques', libelle: 'Objets à risque' },
      { to: '/ressources', libelle: 'Ressources' },
      { to: '/conventions', libelle: 'Conventions' },
      { to: '/sites-qg', libelle: 'Sites QG' },
      { to: '/centres-accueil', libelle: "Centres d'accueil" },
      { to: '/canaux-radio', libelle: 'Canaux radio' },
      { to: '/plans-reference', libelle: 'Plans de référence' },
      { to: '/centres-crise', libelle: 'Centres de crise' },
      { to: '/dir-pc-ops-attestes', libelle: 'Dir PC-Ops attestés' },
    ],
  },
  {
    titre: 'Gouvernance',
    liens: [
      { to: '/instances-coordination', libelle: 'Instances' },
      { to: '/checklists', libelle: 'Checklists' },
      { to: '/exercices', libelle: 'Exercices' },
      { to: '/conformite-legale', libelle: 'Conformité légale (AR 2019)' },
      { to: '/formation-stress-aigu', libelle: 'Facteur humain — stress aigu' },
    ],
  },
  {
    titre: 'Anticipation',
    liens: [
      { to: '/fonctions-critiques', libelle: 'Fonctions critiques' },
      { to: '/infrastructures-critiques', libelle: 'Infrastructures critiques' },
      { to: '/population-non-residente', libelle: 'Population non résidente' },
      { to: '/seuils-action', libelle: "Seuils d'action" },
      { to: '/seuils-meteo', libelle: 'Seuils météo' },
      { to: '/registre-expertises', libelle: "Registre d'expertises" },
      { to: '/continuite-activite', libelle: "Continuité d'activité (BCM)" },
      { to: '/resilience-territoriale', libelle: 'Résilience territoriale' },
    ],
  },
  {
    titre: 'Communication',
    liens: [
      { to: '/alertes-publiques', libelle: 'Alertes publiques' },
      { to: '/canaux-diffusion', libelle: 'Canaux de diffusion' },
      { to: '/soutien-psychologique', libelle: 'Soutien psychologique' },
      { to: '/checklist-d5', libelle: 'Checklist D5' },
      { to: '/be-alert-tests', libelle: 'Tests BE-Alert' },
      { to: '/fiches-action-d5', libelle: 'Fiches d\'action D5' },
      { to: '/accords-medias', libelle: 'Accords-cadres médias' },
      { to: '/sources-externes-alertes', libelle: "Sources externes d'alertes" },
    ],
  },
]

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

  let sections =
    contexteActuel?.contextes?.type === 'entite_critique'
      ? [...SECTIONS, { titre: 'Conformité', liens: [{ to: '/conformite-cer', libelle: 'Conformité CER' }] }]
      : SECTIONS

  if (estSuperAdmin) {
    sections = [{ titre: 'Plateforme', liens: [{ to: '/clients', libelle: 'Clients' }] }, ...sections]
  }

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
