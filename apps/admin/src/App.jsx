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
import AlertesPubliques from './pages/AlertesPubliques'
import CanauxDiffusion from './pages/CanauxDiffusion'
import FonctionsCritiques from './pages/FonctionsCritiques'
import SeuilsAction from './pages/SeuilsAction'
import SeuilsMeteoDeclencheurs from './pages/SeuilsMeteoDeclencheurs'
import InfrastructuresCritiques from './pages/InfrastructuresCritiques'
import PopulationNonResidente from './pages/PopulationNonResidente'
import RegistreExpertises from './pages/RegistreExpertises'
import Conventions from './pages/Conventions'
import PlansUrgence from './pages/PlansUrgence'
import PlanUrgenceDetail from './pages/PlanUrgenceDetail'
import Hopitaux from './pages/Hopitaux'
import PlansContinuiteActivite from './pages/PlansContinuiteActivite'
import AnnuaireSoutien from './pages/AnnuaireSoutien'
import EntiteCritique from './pages/EntiteCritique'
import ConformiteLegale from './pages/ConformiteLegale'
import ChecklistD5 from './pages/ChecklistD5'
import CentresCrise from './pages/CentresCrise'
import DirPcOpsAttestes from './pages/DirPcOpsAttestes'
import FichesActionD5 from './pages/FichesActionD5'
import AccordsMedias from './pages/AccordsMedias'
import SirenesZones from './pages/SirenesZones'
import FormationStressAigu from './pages/FormationStressAigu'
import BeAlertTests from './pages/BeAlertTests'
import Comptes from './pages/Comptes'
import Clients from './pages/Clients'
import DefinirMotDePasse from './pages/DefinirMotDePasse'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route
            path="/definir-mot-de-passe"
            element={
              <RoutePrivee exigeContexte={false}>
                <DefinirMotDePasse />
              </RoutePrivee>
            }
          />

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
            <Route path="alertes-publiques" element={<AlertesPubliques />} />
            <Route path="canaux-diffusion" element={<CanauxDiffusion />} />
            <Route path="fonctions-critiques" element={<FonctionsCritiques />} />
            <Route path="seuils-action" element={<SeuilsAction />} />
            <Route path="seuils-meteo" element={<SeuilsMeteoDeclencheurs />} />
            <Route path="infrastructures-critiques" element={<InfrastructuresCritiques />} />
            <Route path="population-non-residente" element={<PopulationNonResidente />} />
            <Route path="registre-expertises" element={<RegistreExpertises />} />
            <Route path="conventions" element={<Conventions />} />
            <Route path="plans-urgence" element={<PlansUrgence />} />
            <Route path="plans-urgence/:id" element={<PlanUrgenceDetail />} />
            <Route path="hopitaux" element={<Hopitaux />} />
            <Route path="continuite-activite" element={<PlansContinuiteActivite />} />
            <Route path="soutien-psychologique" element={<AnnuaireSoutien />} />
            <Route path="conformite-cer" element={<EntiteCritique />} />
            <Route path="conformite-legale" element={<ConformiteLegale />} />
            <Route path="checklist-d5" element={<ChecklistD5 />} />
            <Route path="centres-crise" element={<CentresCrise />} />
            <Route path="dir-pc-ops-attestes" element={<DirPcOpsAttestes />} />
            <Route path="fiches-action-d5" element={<FichesActionD5 />} />
            <Route path="accords-medias" element={<AccordsMedias />} />
            <Route path="sirenes-zones" element={<SirenesZones />} />
            <Route path="formation-stress-aigu" element={<FormationStressAigu />} />
            <Route path="be-alert-tests" element={<BeAlertTests />} />
            <Route path="comptes" element={<Comptes />} />
            <Route path="clients" element={<Clients />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
