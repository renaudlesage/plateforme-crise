import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export const CATEGORIES_MODELE = [
  { valeur: 'prevention', libelle: 'Prévention' },
  { valeur: 'vigilance', libelle: 'Vigilance' },
  { valeur: 'alerte', libelle: 'Alerte' },
  { valeur: 'confinement', libelle: 'Confinement' },
  { valeur: 'evacuation', libelle: 'Évacuation' },
  { valeur: 'fin_alerte', libelle: "Fin d'alerte" },
  { valeur: 'autre', libelle: 'Autre' },
]

const NIVEAUX = [
  { valeur: 'info', libelle: 'Information' },
  { valeur: 'vigilance', libelle: 'Vigilance' },
  { valeur: 'urgence', libelle: 'Urgence' },
]

export default function ModelesMessagesPopulation() {
  const { contexteId } = useAuth()
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useTableContexte(
    'modeles_messages_population',
    contexteId,
    { tri: 'titre' }
  )
  const [enAjout, setEnAjout] = useState(false)
  const [enEdition, setEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Messages à la population</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Nouveau modèle</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Messages préparés à l'avance (volet préventif). En crise, le QG les reprend en un clic pour
        publier une alerte liée à l'incident ; ici, ils servent aussi à pré-remplir une alerte
        publique.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <Formulaire
          onAnnuler={() => setEnAjout(false)}
          onValider={async (v) => {
            const { error } = await creer(v)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun modèle. Préparez par exemple : vigilance orages, confinement, évacuation, fin d'alerte.
        </p>
      ) : (
        <ul className="space-y-2">
          {lignes.map((m) =>
            enEdition === m.id ? (
              <li key={m.id} className="bg-fond rounded p-3 border border-trait">
                <Formulaire
                  valeursInitiales={m}
                  onAnnuler={() => setEnEdition(null)}
                  onValider={async (v) => {
                    const { error } = await modifier(m.id, v)
                    if (!error) setEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className="bg-surface border border-trait rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {m.titre}
                      <span className="jeton ml-2 text-sourdine">
                        {CATEGORIES_MODELE.find((c) => c.valeur === m.categorie)?.libelle}
                      </span>
                      <span className="jeton ml-1 text-sourdine">
                        {NIVEAUX.find((n) => n.valeur === m.niveau_alerte)?.libelle}
                      </span>
                      {!m.actif && <span className="ml-2 text-xs text-sourdine">(désactivé)</span>}
                    </p>
                    <p className="text-sm text-sourdine mt-1">{m.message}</p>
                    {m.consignes && <p className="text-xs text-sourdine mt-1">consignes : {m.consignes}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setEnEdition(m.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm('Supprimer ce modèle ?')) supprimer(m.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function Formulaire({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [titre, setTitre] = useState(valeursInitiales.titre ?? '')
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? 'alerte')
  const [niveau, setNiveau] = useState(valeursInitiales.niveau_alerte ?? 'info')
  const [message, setMessage] = useState(valeursInitiales.message ?? '')
  const [consignes, setConsignes] = useState(valeursInitiales.consignes ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      titre: titre.trim(),
      categorie,
      niveau_alerte: niveau,
      message: message.trim(),
      consignes: consignes.trim() || null,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3 mb-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre du modèle</label>
        <input required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Confinement — risque chimique" className="w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full">
            {CATEGORIES_MODELE.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau par défaut</label>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full">
            {NIVEAUX.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Message au public</label>
        <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Consignes</label>
        <textarea rows={2} value={consignes} onChange={(e) => setConsignes(e.target.value)} className="w-full" />
      </div>
      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Proposé dans les listes (QG et alertes)
      </label>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
