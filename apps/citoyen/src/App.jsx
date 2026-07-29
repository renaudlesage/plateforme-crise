import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Accueil from './pages/Accueil'
import Benevole from './pages/Benevole'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/benevole" element={<Benevole />} />
      </Routes>
    </BrowserRouter>
  )
}
