/**
 * Profils de terrain : le rôle que l'on tient sur place décide de l'écran d'accueil et de ce que l'on peut décider.
 * `discipline` fait le lien avec les moyens engagés (D1 secours, D2 médical, D3 police, D4 logistique, D5 information).
 * Le profil se règle sur chaque rôle dans Admin (Configuration → Rôles).
 */
export const PROFILS_TERRAIN = [
  { valeur: 'pc_ops', libelle: 'Dir PC-Ops', court: 'Commandement', discipline: 'pcops' },
  { valeur: 'si', libelle: 'Dir-Si (D1 secours)', court: 'Dir-Si', discipline: 'd1' },
  { valeur: 'med', libelle: 'Dir-Med (D2 médical)', court: 'Dir-Med', discipline: 'd2' },
  { valeur: 'pol', libelle: 'Dir-Pol (D3 police)', court: 'Dir-Pol', discipline: 'd3' },
  { valeur: 'log', libelle: 'Dir-Log (D4 logistique)', court: 'Dir-Log', discipline: 'd4' },
  { valeur: 'info', libelle: 'Dir-Info (D5 information)', court: 'Dir-Info', discipline: 'd5' },
]

export const profilDe = (valeur) => PROFILS_TERRAIN.find((p) => p.valeur === valeur) ?? null

/** Qui établit ou lève les zones d'intervention (décision de Ren : le périmètre relève du Dir-Si ; le Dir PC-Ops, qui commande le poste, le garde). */
const PROFILS_ZONAGE = ['si', 'pc_ops']
export const peutModifierZonage = (profil) => PROFILS_ZONAGE.includes(profil)

/** Destinataires possibles d'un « je demande » (null = Dir PC-Ops). */
export const DESTINATAIRES_DEMANDE = PROFILS_TERRAIN.map((p) => ({ valeur: p.valeur, libelle: p.libelle }))
