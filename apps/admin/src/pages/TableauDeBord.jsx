import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sectionsDuMenu } from '../lib/menu'

const CLE_GUIDE = 'crisiware.admin.guide-masque'
const ETAPES_DEMARRAGE = [
  { to: '/configuration', titre: 'Rôles et niveaux', aide: "Qui fait quoi, et les niveaux d'escalade de votre commune." },
  { to: '/annuaire', titre: 'Annuaire', aide: 'Les personnes à joindre en crise, avec leurs coordonnées.' },
  { to: '/plans-urgence', titre: "Plan d'urgence", aide: 'Votre PGUI/PPUI : le cadre légal que la plateforme suit.' },
  { to: '/seuils-action', titre: "Seuils d'action", aide: 'Les déclencheurs qui préparent une décision à confirmer.' },
  { to: '/modeles-messages', titre: 'Messages à la population', aide: 'Des modèles prêts avant la crise, pour ne pas écrire dans l\'urgence.' },
]

/** Cinq étapes pour une première mise en route ; masquable, mémorisé sur l'appareil. */
function ParOuCommencer() {
  const [masque, setMasque] = useState(() => {
    try { return localStorage.getItem(CLE_GUIDE) === '1' } catch { return false }
  })
  function changer(v) {
    setMasque(v)
    try { localStorage.setItem(CLE_GUIDE, v ? '1' : '0') } catch { /* sans stockage : on garde l'état en mémoire */ }
  }
  if (masque) {
    return (
      <p className="mt-6 text-sm">
        <button type="button" className="lien" onClick={() => changer(false)}>Afficher « Par où commencer ? »</button>
      </p>
    )
  }
  return (
    <section className="pave mt-6" aria-label="Par où commencer ?">
      <div className="flex items-center justify-between mb-2">
        <p className="pave-titre" style={{ margin: 0 }}>Par où commencer ?</p>
        <button type="button" className="lien" onClick={() => changer(true)}>Masquer</button>
      </div>
      <ol className="text-sm" style={{ listStyle: 'decimal', paddingLeft: 20 }}>
        {ETAPES_DEMARRAGE.map((e) => (
          <li key={e.to} className="mb-1.5">
            <Link to={e.to} className="font-medium">{e.titre}</Link>
            <span className="text-sourdine"> — {e.aide}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function TableauDeBord() {
  const { contexteActuel } = useAuth()
  // Une tuile par section du menu (même source), titres sans entrée "racine".
  const sections = sectionsDuMenu({ typeContexte: contexteActuel?.contextes?.type }).filter(
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

      <ParOuCommencer />

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
