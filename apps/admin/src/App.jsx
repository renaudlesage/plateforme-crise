import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RoutePrivee } from './components/RoutePrivee'
import MisEnPage from './components/MisEnPage'
import Connexion from './pages/Connexion'
import SelectionContexte from './pages/SelectionContexte'
import TableauDeBord from './pages/TableauDeBord'
import Configuration from './pages/Configuration'
import Contacts from './pages/Contacts'
import ObjetsARisque from './pages/ObjetsARisque'
import Ressources from './pages/Ressources'
import SitesQG from './pages/SitesQG'
import CentresAccueil from './pages/CentresAccueil'
import CanauxRadio from './pages/CanauxRadio'
import PlansReference from './pages/PlansReference'
import InstancesCoordination from './pages/InstancesCoordination'
import ChecklistTemplates from './pages/ChecklistTemplates'
import Exercices from './pages/Exercices'

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
                <MisEnPage />
              </RoutePrivee>
            }
          >
            <Route index element={<TableauDeBord />} />
            <Route path="configuration" element={<Configuration />} />
            <Route path="annuaire" element={<Contacts />} />
            <Route path="risques" element={<ObjetsARisque />} />
            <Route path="ressources" element={<Ressources />} />
            <Route path="sites-qg" element={<SitesQG />} />
            <Route path="centres-accueil" element={<CentresAccueil />} />
            <Route path="canaux-radio" element={<CanauxRadio />} />
            <Route path="plans-reference" element={<PlansReference />} />
            <Route path="instances-coordination" element={<InstancesCoordination />} />
            <Route path="checklists" element={<ChecklistTemplates />} />
            <Route path="exercices" element={<Exercices />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
