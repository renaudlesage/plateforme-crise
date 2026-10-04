import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES_TEST = [
  { valeur: 'mensuel_inscription', libelle: "Mensuel — inscription (1er jeudi du mois)" },
  { valeur: 'trimestriel_localisation', libelle: 'Trimestriel — localisation' },
]

export default function BeAlertTests() {
  const { contexteId } = useAuth()
  const {
    lignes: tests,
    chargement,
    erreur,
    creer,
    supprimer,
  } = useTableContexte('be_alert_tests', contexteId, { tri: 'date_test' })

  const [enAjout, setEnAjout] = useState(false)

  const testsTries = [...tests].sort((a, b) => new Date(b.date_test) - new Date(a.date_test))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Tests BE-Alert</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Enregistrer un test</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Journal des tests BE-Alert : mensuel (inscription, 1er jeudi du mois) et trimestriel
        (localisation). 3 modes de diffusion existent par ailleurs : inscription, localisation,
        diffusion de masse — activables au niveau de chaque incident.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireTest
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : testsTries.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun test enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {testsTries.map((t) => (
            <li key={t.id} className="flex items-start justify-between px-4 py-3 bg-surface">
              <div>
                <p className="text-sm font-medium text-encre">
                  <span className="jeton mr-2 text-info">
                    {TYPES_TEST.find((x) => x.valeur === t.type_test)?.libelle ?? t.type_test}
                  </span>
                  {t.date_test}
                </p>
                {t.resultat && <p className="text-xs text-sourdine mt-0.5">{t.resultat}</p>}
              </div>
              <BoutonDiscret
                onClick={() => {
                  if (confirm('Supprimer ce test ?')) supprimer(t.id)
                }}
              >
                Supprimer
              </BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireTest({ onValider, onAnnuler }) {
  const [typeTest, setTypeTest] = useState('mensuel_inscription')
  const [dateTest, setDateTest] = useState(new Date().toISOString().slice(0, 10))
  const [resultat, setResultat] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_test: typeTest,
      date_test: dateTest,
      resultat: resultat.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de test</label>
          <select value={typeTest} onChange={(e) => setTypeTest(e.target.value)} className="w-full">
            {TYPES_TEST.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date du test</label>
          <input required type="date" value={dateTest} onChange={(e) => setDateTest(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Résultat</label>
        <textarea value={resultat} onChange={(e) => setResultat(e.target.value)} rows={2} className="w-full" />
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
