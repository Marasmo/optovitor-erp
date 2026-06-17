import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePatients } from '../hooks/usePatients'
import PatientList from '../components/optica/patients/PatientList'
import PatientForm from '../components/optica/patients/PatientForm'
import { X } from 'lucide-react'

// Convierte campos opcionales vacíos ('') a null antes de enviar a Supabase.
// Necesario porque columnas con CHECK constraint (ej. sexo) o tipo DATE
// no aceptan '' — solo NULL o un valor válido.
function limpiarFormData(formData) {
  const camposOpcionales = ['sexo', 'fecha_nac', 'dni', 'email', 'telefono', 'direccion', 'ocupacion', 'antecedentes', 'medicamentos', 'alergias', 'motivo']
  const limpio = { ...formData }
  for (const campo of camposOpcionales) {
    if (limpio[campo] === '') {
      limpio[campo] = null
    }
  }
  return limpio
}

export default function PacientesPage() {
  const navigate = useNavigate()
  const { patients, loading, createPatient, searchPatients, fetchPatients } = usePatients()
  const [sedes, setSedes] = useState([])
  const [modal, setModal] = useState(false)

  useEffect(() => {
    supabase.from('sedes').select('*').eq('activo', true).then(({ data }) => {
      if (data) setSedes(data)
    })
  }, [])

  async function handleCreate(formData) {
    await createPatient(limpiarFormData(formData))
    setModal(false)
  }

  function handleSearch(q) {
    if (q === '') fetchPatients()
    else searchPatients(q)
  }

  return (
    <div className="h-screen flex flex-col">
      <PatientList
        patients={patients}
        loading={loading}
        onSearch={handleSearch}
        onNew={() => setModal(true)}
        onSelect={(patient) => navigate(`/pacientes/${patient.id}`)}
      />

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Nuevo paciente</h2>
              <button onClick={() => setModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <PatientForm
                sedes={sedes}
                onSubmit={handleCreate}
                onCancel={() => setModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
