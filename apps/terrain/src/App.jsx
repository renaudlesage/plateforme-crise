import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RoutePrivee } from './components/RoutePrivee'
import MisEnPageTerrain from './components/MisEnPageTerrain'
import Connexion from './pages/Connexion'
import SelectionContexte from './pages/SelectionContexte'
import Terrain from './pages/Terrain'
import Carte from './pages/Carte'
import { fileEcritures } from './lib/fileEcritures'

export default function App() {
  // Démarre une fois les déclencheurs de rejeu (retour réseau, premier
  // plan, filet d'intervalle) — voir packages/shared/src/fileEcritures.js.
  useEffect(() => {
    fileEcritures.demarrer()
    return () => fileEcritures.arreter()
  }, [])

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
            <Route path="carte" element={<Carte />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
