import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RoutePrivee } from './components/RoutePrivee'
import MisEnPageQG from './components/MisEnPageQG'
import Connexion from './pages/Connexion'
import SelectionContexte from './pages/SelectionContexte'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'

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
            <Route index element={<Incidents />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
