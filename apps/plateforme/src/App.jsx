import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RoutePrivee } from './components/RoutePrivee'
import MisEnPage from './components/MisEnPage'
import Connexion from './pages/Connexion'
import DefinirMotDePasse from './pages/DefinirMotDePasse'
import Supervision from './pages/Supervision'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Utilisateurs from './pages/Utilisateurs'
import Referentiels from './pages/Referentiels'
import Journal from './pages/Journal'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route
            path="/definir-mot-de-passe"
            element={
              <RoutePrivee superAdminRequis={false}>
                <DefinirMotDePasse />
              </RoutePrivee>
            }
          />

          <Route
            path="/"
            element={
              <RoutePrivee>
                <MisEnPage />
              </RoutePrivee>
            }
          >
            <Route index element={<Supervision />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="utilisateurs" element={<Utilisateurs />} />
            <Route path="referentiels" element={<Referentiels />} />
            <Route path="journal" element={<Journal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
