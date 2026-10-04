import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LIBELLES_RISQUE = {
  inondation: 'Inondation',
  nucleaire: 'Risque nucléaire',
  penurie_electrique: 'Pénurie électrique',
  attentat_terroriste: 'Attentat terroriste',
}

export default function Risques() {
  const [fiches, setFiches] = useState([])
  const [procedure, setProcedure] = useState(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('fiches_risques_citoyen').select('*').order('code_risque'),
      supabase.from('procedure_mise_a_labri').select('*').eq('code', 'standard_3_etapes').maybeSingle(),
    ]).then(([f, p]) => {
      setFiches(f.data ?? [])
      setProcedure(p.data ?? null)
      setChargement(false)
    })
  }, [])

  return (
    <div className="participant">
      <div className="bandeau">
        <Link to="/" className="lien">← retour</Link>
      </div>

      <h1 className="text-lg font-semibold text-encre mb-1">S'informer sur les risques</h1>
      <p className="text-sm text-sourdine mb-5">
        Conseils officiels du Centre de Crise National par type de risque, et la procédure de
        mise à l'abri à suivre en cas d'alerte.
      </p>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : (
        <div className="space-y-5">
          {procedure && (
            <div className="border border-trait rounded p-3 bg-fond">
              <p className="text-sm font-medium text-encre mb-2">Mise à l'abri</p>
              <ol className="list-decimal list-inside text-sm text-sourdine space-y-1">
                {(procedure.etapes ?? []).map((e) => (
                  <li key={e.ordre}>{LIBELLES_ETAPE[e.action] ?? e.action}</li>
                ))}
              </ol>
              {procedure.consigne_complementaire && (
                <p className="text-xs text-sourdine mt-2">{procedure.consigne_complementaire}</p>
              )}
            </div>
          )}

          {fiches.map((f) => (
            <div key={f.id} className="border border-trait rounded p-3 bg-fond">
              <p className="text-sm font-medium text-encre mb-2">
                {LIBELLES_RISQUE[f.code_risque] ?? f.titre}
              </p>
              <ul className="list-disc list-inside text-sm text-sourdine space-y-1">
                {(f.conseils ?? []).map((c) => (
                  <li key={c.ordre}>{c.texte}</li>
                ))}
              </ul>
              {f.site_reference_url && (
                <a href={f.site_reference_url} target="_blank" rel="noreferrer" className="lien text-xs mt-2 inline-block">
                  En savoir plus
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const LIBELLES_ETAPE = {
  fermer_portes_fenetres: 'Fermez portes et fenêtres',
  couper_ventilation_chauffage_climatisation: 'Coupez ventilation, chauffage et climatisation',
  fermer_arrivee_air_cheminee: "Fermez l'arrivée d'air de la cheminée",
}
