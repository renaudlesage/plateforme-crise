import { useEffect, useState } from 'react'
import { PROVINCES, SEUILS_DEFAUT, SelecteurLocalisation, texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonPrincipal } from '../components/Boutons'

/**
 * Veille météo de la commune : où elle se situe (point des prévisions), dans quelle province (avertissement
 * officiel IRM), et les seuils + consignes décidés à froid. Le CC lit ces réglages ; rien n'est diffusé
 * à la population par la veille elle-même.
 */

const CHAMPS_SEUILS = [
  { cle: 'rafale_vigilance_kmh', libelle: 'Vent — alerte (orange) à partir de', unite: 'km/h de rafales' },
  { cle: 'rafale_critique_kmh', libelle: 'Vent — alarme (rouge) à partir de', unite: 'km/h de rafales' },
  { cle: 'pluie_vigilance_mm', libelle: 'Pluie — alerte (orange) à partir de', unite: 'mm/h' },
  { cle: 'pluie_critique_mm', libelle: 'Pluie — alarme (rouge) à partir de', unite: 'mm/h' },
  { cle: 'temp_max_vigilance', libelle: 'Chaleur — alerte à partir de', unite: '°C' },
  { cle: 'temp_min_vigilance', libelle: 'Froid — alerte en dessous de', unite: '°C' },
]

const CONSIGNES = [
  { cle: 'vent_alerte', libelle: "Vent — consigne à l'alerte", exemple: 'ex. sécuriser le mobilier urbain, prévenir le service technique' },
  { cle: 'vent_alarme', libelle: "Vent — consigne à l'alarme", exemple: 'ex. fermer parcs et cimetières' },
  { cle: 'pluie_alerte', libelle: "Pluie — consigne à l'alerte", exemple: 'ex. contrôler les points bas et les avaloirs' },
  { cle: 'pluie_alarme', libelle: "Pluie — consigne à l'alarme", exemple: "ex. ouvrir les centres d'accueil, surveiller les cours d'eau" },
  { cle: 'chaleur_alerte', libelle: 'Chaleur — consigne', exemple: 'ex. plan canicule : contacter les personnes isolées' },
  { cle: 'froid_alerte', libelle: 'Froid — consigne', exemple: 'ex. plan grand froid : salle chauffée, maraudes' },
  { cle: 'orage_alarme', libelle: 'Orage — consigne', exemple: 'ex. interrompre les activités extérieures' },
]

function Champ({ libelle, aide, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-sourdine mb-1">{libelle}</label>
      {children}
      {aide && <p className="text-xs text-sourdine mt-0.5">{aide}</p>}
    </div>
  )
}

export default function MeteoCommune() {
  const { contexteId } = useAuth()
  const [charge, setCharge] = useState(false)
  const [nom, setNom] = useState('')
  const [lat, setLat] = useState(null)
  const [lon, setLon] = useState(null)
  const [province, setProvince] = useState('')
  const [seuils, setSeuils] = useState({ ...SEUILS_DEFAUT })
  const [seuilsEnregistres, setSeuilsEnregistres] = useState(false)
  const [message, setMessage] = useState(null)
  const [occupe, setOccupe] = useState(null)

  useEffect(() => {
    let vivant = true
    setCharge(false)
    Promise.all([
      supabase.from('contextes').select('nom, latitude, longitude, province').eq('id', contexteId).maybeSingle(),
      supabase.from('meteo_seuils').select('*').eq('contexte_id', contexteId).maybeSingle(),
    ]).then(([c, s]) => {
      if (!vivant) return
      if (c.error || s.error) setMessage({ type: 'erreur', texte: texteErreur(c.error ?? s.error) })
      setNom(c.data?.nom ?? '')
      setLat(c.data?.latitude ?? null)
      setLon(c.data?.longitude ?? null)
      setProvince(c.data?.province ?? '')
      if (s.data) {
        setSeuils({ ...SEUILS_DEFAUT, ...s.data, consignes: s.data.consignes ?? {} })
        setSeuilsEnregistres(true)
      } else {
        setSeuils({ ...SEUILS_DEFAUT })
        setSeuilsEnregistres(false)
      }
      setCharge(true)
    })
    return () => {
      vivant = false
    }
  }, [contexteId])

  async function enregistrerLieu() {
    if ((lat == null) !== (lon == null)) {
      setMessage({ type: 'erreur', texte: 'Renseigne la latitude ET la longitude, ou aucune des deux.' })
      return
    }
    setOccupe('lieu')
    const { error } = await supabase
      .from('contextes')
      .update({ latitude: lat == null ? null : Number(lat), longitude: lon == null ? null : Number(lon), province: province || null })
      .eq('id', contexteId)
    setOccupe(null)
    setMessage(error ? { type: 'erreur', texte: texteErreur(error) } : { type: 'ok', texte: 'Localisation enregistrée.' })
  }

  async function enregistrerSeuils() {
    const n = (v) => (v === '' || v == null ? null : Number(v))
    const s = {
      rafale_vigilance_kmh: n(seuils.rafale_vigilance_kmh),
      rafale_critique_kmh: n(seuils.rafale_critique_kmh),
      pluie_vigilance_mm: n(seuils.pluie_vigilance_mm),
      pluie_critique_mm: n(seuils.pluie_critique_mm),
      temp_max_vigilance: n(seuils.temp_max_vigilance),
      temp_min_vigilance: n(seuils.temp_min_vigilance),
    }
    if (s.rafale_vigilance_kmh != null && s.rafale_critique_kmh != null && s.rafale_critique_kmh <= s.rafale_vigilance_kmh) {
      setMessage({ type: 'erreur', texte: "Vent : le seuil d'alarme doit être supérieur au seuil d'alerte." })
      return
    }
    if (s.pluie_vigilance_mm != null && s.pluie_critique_mm != null && s.pluie_critique_mm <= s.pluie_vigilance_mm) {
      setMessage({ type: 'erreur', texte: "Pluie : le seuil d'alarme doit être supérieur au seuil d'alerte." })
      return
    }
    const consignes = Object.fromEntries(Object.entries(seuils.consignes ?? {}).filter(([, v]) => v && String(v).trim()))
    setOccupe('seuils')
    const { error } = await supabase
      .from('meteo_seuils')
      .upsert({ contexte_id: contexteId, ...s, alerte_orage: !!seuils.alerte_orage, consignes, maj_le: new Date().toISOString() })
    setOccupe(null)
    if (error) setMessage({ type: 'erreur', texte: texteErreur(error) })
    else {
      setSeuilsEnregistres(true)
      setMessage({ type: 'ok', texte: 'Seuils et consignes enregistrés. Le CC les applique à la prochaine actualisation.' })
    }
  }

  if (!charge) return <p className="text-sm text-sourdine">Chargement…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-encre">Météo de la commune{nom ? ` — ${nom}` : ''}</h1>
        <p className="text-sm text-sourdine mt-1">
          Alimente la veille météo du CC : prévisions au point choisi, avertissement officiel IRM de la province, et seuils décidés à froid avec leur consigne.
        </p>
      </div>

      {message && (
        <p role="status" className={`text-sm ${message.type === 'erreur' ? 'text-chaud' : 'text-encre'}`}>{message.texte}</p>
      )}

      <section className="space-y-3">
        <h2 className="font-medium text-encre">1. Où regarder</h2>
        <p className="text-xs text-sourdine">
          Clique sur la carte à l&apos;endroit de référence de la commune (mairie, centre-ville…). Sans position, aucune prévision n&apos;est possible.
        </p>
        <SelecteurLocalisation lat={lat} lon={lon} onChange={(la, lo) => { setLat(la); setLon(lo) }} />
        <div className="max-w-xs">
          <Champ libelle="Province — pour l'avertissement officiel IRM" aide="L'avertissement porte sur toute la province, en plus des seuils ci-dessous qui portent sur le point précis.">
            <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full">
              <option value="">— non renseignée —</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Champ>
        </div>
        <BoutonPrincipal disabled={occupe === 'lieu'} onClick={enregistrerLieu}>
          {occupe === 'lieu' ? 'Enregistrement…' : 'Enregistrer la localisation'}
        </BoutonPrincipal>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-encre">2. Seuils et consignes</h2>
        {!seuilsEnregistres && (
          <p className="text-sm rounded p-2 border border-trait">
            Ces valeurs sont les <strong>points de départ</strong>, pas encore enregistrés pour cette commune. Tant que tu n&apos;enregistres pas, le CC les affiche
            mais ne consigne rien automatiquement dans le livre de bord.
          </p>
        )}
        <p className="text-xs text-sourdine">
          Orange = alerte, rouge = alarme. Le jaune apparaît tout seul à 80 % du seuil d&apos;alerte (signal précoce, sans consigne). Laisse un champ vide pour ne pas surveiller ce critère.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHAMPS_SEUILS.map((c) => (
            <Champ key={c.cle} libelle={`${c.libelle} (${c.unite})`}>
              <input
                type="number"
                step="any"
                value={seuils[c.cle] ?? ''}
                onChange={(e) => setSeuils({ ...seuils, [c.cle]: e.target.value })}
                className="w-full"
              />
            </Champ>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={!!seuils.alerte_orage} onChange={(e) => setSeuils({ ...seuils, alerte_orage: e.target.checked })} />
          Signaler les orages annoncés (rouge) — détectés automatiquement, pas de seuil à régler
        </label>

        <h3 className="font-medium text-encre pt-2">Consignes préparées</h3>
        <p className="text-xs text-sourdine">
          Ce qu&apos;il y a à faire quand le seuil est franchi : décidé maintenant, lu à ce moment-là. Un critère sans consigne s&apos;affiche avec la mention « aucune consigne préparée ».
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONSIGNES.map((c) => (
            <Champ key={c.cle} libelle={c.libelle}>
              <input
                value={seuils.consignes?.[c.cle] ?? ''}
                onChange={(e) => setSeuils({ ...seuils, consignes: { ...(seuils.consignes ?? {}), [c.cle]: e.target.value } })}
                placeholder={c.exemple}
                className="w-full"
              />
            </Champ>
          ))}
        </div>
        <BoutonPrincipal disabled={occupe === 'seuils'} onClick={enregistrerSeuils}>
          {occupe === 'seuils' ? 'Enregistrement…' : 'Enregistrer les seuils et consignes'}
        </BoutonPrincipal>
        <p className="text-xs text-sourdine">
          Les valeurs de départ (rafales 50/70 km/h, pluie 5/15 mm/h, chaleur 30 °C, froid 2 °C) sont des repères repris d&apos;Eventware : elles ne remplacent ni l&apos;avis de l&apos;IRM, ni celui de la zone de secours, ni le plan d&apos;urgence communal. À faire valider par la cellule de sécurité de la commune.
        </p>
      </section>
    </div>
  )
}
