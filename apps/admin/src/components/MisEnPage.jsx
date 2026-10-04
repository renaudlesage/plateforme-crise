import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'

const SECTIONS = [
  {
    titre: null,
    liens: [{ to: '/', libelle: 'Tableau de bord' }],
  },
  {
    titre: 'Configuration',
    liens: [{ to: '/configuration', libelle: 'Rôles, niveaux, disciplines' }],
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
    ],
  },
  {
    titre: 'Communication',
    liens: [
      { to: '/alertes-publiques', libelle: 'Alertes publiques' },
      { to: '/canaux-diffusion', libelle: 'Canaux de diffusion' },
      { to: '/soutien-psychologique', libelle: 'Soutien psychologique' },
      { to: '/checklist-d5', libelle: 'Checklist D5' },
    ],
  },
]

export default function MisEnPage() {
  const { utilisateur, contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  const sections =
    contexteActuel?.contextes?.type === 'entite_critique'
      ? [...SECTIONS, { titre: 'Conformité', liens: [{ to: '/conformite-cer', libelle: 'Conformité CER' }] }]
      : SECTIONS

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
        <nav className="plaques">
          {sections.map((section, i) => (
            <div key={i} className="bloc" style={{ marginBottom: 14 }}>
              {section.titre && <h2>{section.titre}</h2>}
              {section.liens.map((lien) => {
                const actif = location.pathname === lien.to
                return (
                  <Link
                    key={lien.to}
                    to={lien.to}
                    className={`plaque-nav${actif ? ' actif' : ''}`}
                  >
                    {lien.libelle}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <main className="travail">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
