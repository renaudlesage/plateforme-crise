import { useState } from 'react'
import { Link } from 'react-router-dom'
import { heureMinuteBelge, libelleTypeAvertissement, texteErreur } from '@plateforme-crise/shared'

const STYLE_BANDEAU = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px 12px',
  background: '#b91c1c',
  color: '#fff',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
}
const STYLE_BOUTON = { background: '#fff', color: '#b91c1c', border: 0, borderRadius: 6, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }

/**
 * Bandeau du réveil automatique (C1), visible depuis toutes les pages du CC tant qu'un seuil armé par un avertissement
 * officiel attend son « Vu, je prends ». Un appel d'aide reste affiché au-dessus. Masqué à l'impression et sur
 * l'onglet Avertissements, qui détaille les réveils.
 */
export default function BandeauReveil({ reveils, onAcquitter }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null) // { id, texte } : ne s'affiche que pour le réveil qui l'a provoquée
  const r = reveils[0]
  if (!r) return null
  const autres = reveils.length - 1
  const type = r.alertes_externes ? libelleTypeAvertissement(r.alertes_externes.type_alerte).toLowerCase() : null

  async function acquitter() {
    setEnCours(true)
    setErreur(null)
    const { error } = await onAcquitter(r.id)
    setEnCours(false)
    if (error) setErreur({ id: r.id, texte: texteErreur(error) })
  }

  return (
    <div role="alert" className="no-print" style={STYLE_BANDEAU}>
      <span>
        ⏰ {r.est_exercice ? 'EXERCICE — ' : ''}Réveil : seuil « {r.seuils_action?.libelle ?? 'seuil'} » armé à {heureMinuteBelge(r.arme_le)}
        {type ? ` (avertissement ${r.niveau} ${type})` : ''}
        {r.escalade_le ? ' · suppléants prévenus' : ''}
        {autres > 0 ? ` · ${autres} autre${autres > 1 ? 's' : ''} à acquitter` : ''}
      </span>
      <button type="button" onClick={acquitter} disabled={enCours} style={STYLE_BOUTON}>
        {enCours ? 'Envoi…' : 'Vu, je prends'}
      </button>
      <Link to="/avertissements" style={{ color: '#fff' }}>
        Voir le détail
      </Link>
      {erreur?.id === r.id && <span style={{ fontWeight: 400 }}>{erreur.texte}</span>}
    </div>
  )
}
