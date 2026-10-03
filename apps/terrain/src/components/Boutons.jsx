// Boutons du socle Eventware 2.0 : classes natives de components/bundle.css
// (button, .principal, .discret), pas des utilitaires Tailwind. Rayon,
// bordure et couleurs suivent déjà les deux thèmes via les tokens.
export function BoutonDiscret({ children, className = '', ...props }) {
  return (
    <button {...props} className={`discret ${className}`.trim()}>
      {children}
    </button>
  )
}

export function BoutonPrincipal({ children, className = '', ...props }) {
  return (
    <button {...props} className={`principal ${className}`.trim()}>
      {children}
    </button>
  )
}
