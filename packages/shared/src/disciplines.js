/**
 * Code couleur des disciplines (planification d'urgence belge), identique
 * partout : Terrain, CC. D1 rouge, D2 vert, D3 bleu, D4 orange, D5 noir,
 * PC-Ops violet (couleur « commandement » de la charte graphique belge).
 */
export const DISCIPLINES = [
  { valeur: 'd1', court: 'D1', libelle: 'D1 · Secours', couleur: '#dc2626', nomCouleur: 'rouge' },
  { valeur: 'd2', court: 'D2', libelle: 'D2 · Médical, sanitaire et psychosocial', couleur: '#16a34a', nomCouleur: 'vert' },
  { valeur: 'd3', court: 'D3', libelle: 'D3 · Police', couleur: '#2563eb', nomCouleur: 'bleu' },
  { valeur: 'd4', court: 'D4', libelle: 'D4 · Logistique', couleur: '#ea580c', nomCouleur: 'orange' },
  { valeur: 'd5', court: 'D5', libelle: 'D5 · Information', couleur: '#111111', nomCouleur: 'noir' },
  { valeur: 'pcops', court: 'PC-Ops', libelle: 'PC-Ops', couleur: '#8e2a8e', nomCouleur: 'violet' },
]

export function disciplineDe(valeur) {
  return DISCIPLINES.find((d) => d.valeur === valeur) ?? null
}
