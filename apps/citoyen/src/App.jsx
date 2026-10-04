import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Accueil from './pages/Accueil'
import Benevole from './pages/Benevole'
import PlanUrgence from './pages/PlanUrgence'
import Soutien from './pages/Soutien'
import Risques from './pages/Risques'
import Signaler from './pages/Signaler'

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
      </Routes>
    </BrowserRouter>
  )
}
