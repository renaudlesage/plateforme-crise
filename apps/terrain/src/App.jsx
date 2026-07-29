import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RoutePrivee } from './components/RoutePrivee'
import MisEnPageTerrain from './components/MisEnPageTerrain'
import Connexion from './pages/Connexion'
import SelectionContexte from './pages/SelectionContexte'
import Terrain from './pages/Terrain'

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
                <MisEnPageTerrain />
              </RoutePrivee>
            }
          >
            <Route index element={<Terrain />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
