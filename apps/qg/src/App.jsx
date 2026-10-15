import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RoutePrivee } from './components/RoutePrivee'
import MisEnPageQG from './components/MisEnPageQG'
import Connexion from './pages/Connexion'
import SelectionContexte from './pages/SelectionContexte'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import SignalementsCitoyens from './pages/SignalementsCitoyens'
import Carte from './pages/Carte'
import VueAutorite from './pages/VueAutorite'
import { useAuth } from './context/AuthContext'

// Un accès en lecture seule (bourgmestre, autorité) arrive directement sur la vue autorité ; les autres, sur la liste des incidents.
function AccueilSelonAcces() {
  const { contexteActuel } = useAuth()
  return contexteActuel?.niveau_acces === 'lecture' ? <Navigate to="/autorite" replace /> : <Incidents />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route
            path="/selection-contexte"
            element={
              <RoutePrivee exigeContexte={false}>
                <SelectionContexte />
              </RoutePrivee>
            }
          />

          <Route
            path="/"
            element={
              <RoutePrivee>
                <MisEnPageQG />
              </RoutePrivee>
            }
          >
            <Route index element={<AccueilSelonAcces />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="autorite" element={<VueAutorite />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="signalements-citoyens" element={<SignalementsCitoyens />} />
            <Route path="carte" element={<Carte />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
