import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/ui/Layout'
import PacientesPage from './pages/PacientesPage'
import PatientProfilePage from './pages/PatientProfilePage'
import LoginPage from './pages/LoginPage'
import { supabase } from './lib/supabase'
import ExamenPage from './pages/ExamenPage'
import ExamenDetailPage from './pages/ExamenDetailPage'
import RecetaPage from './pages/RecetaPage'
import ExamenesPage from './pages/ExamenesPage'
import RecetasPage from './pages/RecetasPage'
import VentasPage from './pages/VentasPage'
import VentaFormPage from './pages/VentaFormPage'
import VentaDetailPage from './pages/VentaDetailPage'
import CierreCajaPage from './pages/CierreCajaPage'
import TrabajosPendientesPage from './pages/TrabajosPendientesPage'
import HistorialCajaPage from './pages/HistorialCajaPage'
import BitacoraPage from './pages/BitacoraPage'
import InventarioPage from './pages/InventarioPage'

function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando...</p>
    </div>
  )

  if (!session) return <LoginPage />

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/pacientes" />} />
          <Route path="/pacientes" element={<PacientesPage />} />
          <Route path="/pacientes/:id" element={<PatientProfilePage />} />
          <Route path="/pacientes/:id/examen/:examId" element={<ExamenPage />} />
          <Route path="/pacientes/:id/examen/:examId/detalle" element={<ExamenDetailPage />} />
          <Route path="/pacientes/:id/examen/:examId/receta" element={<RecetaPage />} />
          <Route path="/examenes" element={<ExamenesPage />} />
          <Route path="/recetas" element={<RecetasPage />} />
          <Route path="/ventas" element={<VentasPage />} />
<Route path="/ventas/nueva" element={<VentaFormPage />} />
<Route path="/ventas/nueva/:patientId" element={<VentaFormPage />} />
<Route path="/ventas/cierre-caja" element={<CierreCajaPage />} />
<Route path="/pendientes" element={<TrabajosPendientesPage />} />
<Route path="/ventas/historial-caja" element={<HistorialCajaPage />} />
<Route path="/ventas/:id" element={<VentaDetailPage />} />
<Route path="/bitacora" element={<BitacoraPage />} />
<Route path="/inventario" element={<InventarioPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App