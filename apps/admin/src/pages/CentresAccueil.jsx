import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function CentresAccueil() {
  const { contexteId } = useAuth()
  const {
    lignes: centres,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('centres_accueil', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'nom',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Centres d'accueil</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un centre</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Lieux mobilisables pour l'accueil ou l'hébergement de sinistrés/évacués.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireCentre
          contacts={contacts}
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
      ) : centres.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun centre d'accueil enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow-sm">
          {centres.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-fond p-3">
                <FormulaireCentre
                  contacts={contacts}
                  valeursInitiales={c}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(c.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">{c.nom}</p>
                  <p className="text-xs text-sourdine">
                    {c.type_lieu && <>{c.type_lieu} · </>}
                    {c.adresse}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5 flex flex-wrap gap-x-3">
                    {c.capacite_debout != null && <span>debout : {c.capacite_debout}</span>}
                    {c.capacite_hebergement != null && <span>hébergement nuit : {c.capacite_hebergement}</span>}
                    {c.parking_vehicules_legers != null && <span>parking léger : {c.parking_vehicules_legers}</span>}
                    {c.parking_vehicules_lourds != null && <span>parking lourd : {c.parking_vehicules_lourds}</span>}
                    {c.accessible_poids_lourd != null && (
                      <span>accès PL : {c.accessible_poids_lourd ? 'oui' : 'non'}</span>
                    )}
                    {c.eclairage_exterieur != null && (
                      <span>éclairage : {c.eclairage_exterieur ? 'oui' : 'non'}</span>
                    )}
                  </p>
                  {c.contacts && (
                    <p className="text-xs text-sourdine mt-0.5">
                      contact : {c.contacts.prenom} {c.contacts.nom}
                    </p>
                  )}
                  {c.specificites && (
                    <p className="text-xs text-sourdine mt-0.5 italic">{c.specificites}</p>
                  )}
                  {c.dons_acceptes && (
                    <p className="text-xs text-ok mt-0.5">
                      dons acceptés{c.seuil_ouverture_dons ? ` — ouvert si : ${c.seuil_ouverture_dons}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${c.nom}" ?`)) supprimer(c.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireCentre({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [typeLieu, setTypeLieu] = useState(valeursInitiales.type_lieu ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? '')
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? '')
  const [capaciteDebout, setCapaciteDebout] = useState(valeursInitiales.capacite_debout ?? '')
  const [capaciteHebergement, setCapaciteHebergement] = useState(valeursInitiales.capacite_hebergement ?? '')
  const [largeurVoirie, setLargeurVoirie] = useState(valeursInitiales.largeur_voirie_acces ?? '')
  const [accessiblePL, setAccessiblePL] = useState(valeursInitiales.accessible_poids_lourd ?? false)
  const [parkingLegers, setParkingLegers] = useState(valeursInitiales.parking_vehicules_legers ?? '')
  const [parkingLourds, setParkingLourds] = useState(valeursInitiales.parking_vehicules_lourds ?? '')
  const [eclairage, setEclairage] = useState(valeursInitiales.eclairage_exterieur ?? false)
  const [specificites, setSpecificites] = useState(valeursInitiales.specificites ?? '')
  const [contactId, setContactId] = useState(valeursInitiales.contact_id ?? '')
  const [donsAcceptes, setDonsAcceptes] = useState(valeursInitiales.dons_acceptes ?? false)
  const [seuilOuvertureDons, setSeuilOuvertureDons] = useState(valeursInitiales.seuil_ouverture_dons ?? '')
  const [seuilFermetureDons, setSeuilFermetureDons] = useState(valeursInitiales.seuil_fermeture_dons ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      type_lieu: typeLieu.trim() || null,
      adresse: adresse.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      capacite_debout: capaciteDebout === '' ? null : Number(capaciteDebout),
      capacite_hebergement: capaciteHebergement === '' ? null : Number(capaciteHebergement),
      largeur_voirie_acces: largeurVoirie.trim() || null,
      accessible_poids_lourd: accessiblePL,
      parking_vehicules_legers: parkingLegers === '' ? null : Number(parkingLegers),
      parking_vehicules_lourds: parkingLourds === '' ? null : Number(parkingLourds),
      eclairage_exterieur: eclairage,
      specificites: specificites.trim() || null,
      contact_id: contactId || null,
      dons_acceptes: donsAcceptes,
      seuil_ouverture_dons: seuilOuvertureDons.trim() || null,
      seuil_fermeture_dons: seuilFermetureDons.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Hall omnisports"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de lieu</label>
          <input value={typeLieu} onChange={(e) => setTypeLieu(e.target.value)} placeholder="ex. salle des fêtes" className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Adresse</label>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Latitude</label>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Longitude</label>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Capacité debout <span className="text-sourdine">(1m²/pers)</span>
          </label>
          <input type="number" value={capaciteDebout} onChange={(e) => setCapaciteDebout(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Capacité hébergement nuit <span className="text-sourdine">(1 pers/6m²)</span>
          </label>
          <input type="number" value={capaciteHebergement} onChange={(e) => setCapaciteHebergement(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Largeur voirie d'accès</label>
          <input value={largeurVoirie} onChange={(e) => setLargeurVoirie(e.target.value)} placeholder="ex. 4m" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Parking véhicules légers</label>
          <input type="number" value={parkingLegers} onChange={(e) => setParkingLegers(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Parking véhicules lourds</label>
          <input type="number" value={parkingLourds} onChange={(e) => setParkingLourds(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={accessiblePL} onChange={(e) => setAccessiblePL(e.target.checked)} />
          Accessible poids lourds
        </label>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={eclairage} onChange={(e) => setEclairage(e.target.checked)} />
          Éclairage extérieur
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Contact</label>
        <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full">
          <option value="">—</option>
          {contacts.map((ct) => (
            <option key={ct.id} value={ct.id}>{ct.prenom} {ct.nom}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Spécificités</label>
        <textarea
          value={specificites}
          onChange={(e) => setSpecificites(e.target.value)}
          rows={2}
          className="w-full"
        />
      </div>

      <div className="space-y-2 border border-trait rounded p-3">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={donsAcceptes} onChange={(e) => setDonsAcceptes(e.target.checked)} />
          Flux de dons accepté sur ce centre
        </label>
        {donsAcceptes && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Seuil d'ouverture des dons</label>
              <input value={seuilOuvertureDons} onChange={(e) => setSeuilOuvertureDons(e.target.value)} placeholder="ex. dès 20 sinistrés accueillis" className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Seuil de fermeture/saturation</label>
              <input value={seuilFermetureDons} onChange={(e) => setSeuilFermetureDons(e.target.value)} className="w-full" />
            </div>
          </div>
        )}
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
