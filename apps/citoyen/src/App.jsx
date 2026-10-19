import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Accueil from './pages/Accueil'
import Benevole from './pages/Benevole'
import PlanUrgence from './pages/PlanUrgence'
import Soutien from './pages/Soutien'
import Risques from './pages/Risques'
import Signaler from './pages/Signaler'
import { AccueilBenevole, SuiviBenevole, EntraidePublique, ProposerMoyen } from './pages/Entraide'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/benevole" element={<Benevole />} />
        <Route path="/plan-urgence" element={<PlanUrgence />} />
        <Route path="/soutien" element={<Soutien />} />
        <Route path="/risques" element={<Risques />} />
        <Route path="/signaler" element={<Signaler />} />
        <Route path="/entraide" element={<EntraidePublique />} />
        <Route path="/entraide/accueil" element={<AccueilBenevole />} />
        <Route path="/entraide/suivi" element={<SuiviBenevole />} />
        <Route path="/ressource" element={<ProposerMoyen />} />
      </Routes>
    </BrowserRouter>
  )
}
