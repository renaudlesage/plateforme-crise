/** @type {import('tailwindcss').Config} */
// Config partagée par les 4 applications de plateforme-crise — identique
// partout, par design (socle Eventware 2.0). Ne pas diverger d'une app à
// l'autre : toute extension doit être proposée au design system, pas
// ajoutée localement.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        fond: 'var(--fond)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        encre: 'var(--encre)',
        sourdine: 'var(--sourdine)',
        trait: 'var(--trait)',
        'trait-fort': 'var(--trait-fort)',
        ok: 'var(--etat-ok)',
        veille: 'var(--etat-veille)',
        chaud: 'var(--etat-chaud)',
        info: 'var(--etat-info)',
        froid: 'var(--etat-froid)',
        dom: {
          indigo: 'var(--dom-indigo)', violet: 'var(--dom-violet)',
          sarcelle: 'var(--dom-sarcelle)', grenat: 'var(--dom-grenat)',
          orange: 'var(--dom-orange)', bronze: 'var(--dom-bronze)',
          mousse: 'var(--dom-mousse)', azur: 'var(--dom-azur)',
          prune: 'var(--dom-prune)', ardoise: 'var(--dom-ardoise)',
          tilleul: 'var(--dom-tilleul)', gris: 'var(--dom-gris)',
        },
      },
      fontFamily: {
        sans: 'var(--font-texte)',
        mono: 'var(--font-mono)',
      },
      borderRadius: { DEFAULT: 'var(--rayon)', pilule: 'var(--rayon-pilule)' },
      boxShadow: { DEFAULT: 'var(--ombre)', flottant: 'var(--ombre-flottant)' },
      zIndex: { tete: '30', onglets: '55', flottants: '60', voile: '70' },
    },
  },
  plugins: [],
}
