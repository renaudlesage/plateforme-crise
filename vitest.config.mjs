import { defineConfig } from 'vitest/config'

// Tests unitaires du dépôt (Vitest, seul framework de test, installé au chantier C1).
// Code pur uniquement : le code commun des Edge Functions et le paquet partagé.
export default defineConfig({
  test: {
    include: ['supabase/functions/**/*.test.ts', 'packages/**/*.test.{js,ts}'],
    environment: 'node',
  },
})
