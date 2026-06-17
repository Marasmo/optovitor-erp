import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, User, Phone, Calendar, Plus, FileText, Clock, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

const estadoBadge = {
  borrador:   'bg-yellow-50 text-yellow-700',
  finalizado: 'bg-green-50 text-green-700',
  anulado:    'bg-red-50 text-red-700',
}

export default function PatientProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles(nombre)')
        .eq('id', user.id)
        .single()
      setIsAdmin(profile?.roles?.nombre === 'admin')
    }

    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('eye_exams')
        .select('*, prescriptions(id)')
        .eq('patient_id', id)
        .order('fecha', { ascending: false })
    ])
    setPatient(p)
    setExams(e || [])
    setLoading(false)
  }

  async function handleDeleteExam(e, exam) {
    e.stopPropagation() // evita navegar al detalle al hacer clic en el botón

    const tieneReceta = exam.prescriptions?.length > 0
    const mensaje = tieneReceta
      ? '⚠️ Este examen tiene una receta asociada que también será eliminada.\n\n¿Seguro que deseas eliminar este examen? Esta acción no se puede deshacer.'
      : '¿Seguro que deseas eliminar este examen? Esta acción no se puede deshacer.'

    if (!window.confirm(mensaje)) return

    setDeletingId(exam.id)
    try {
      // Eliminar receta primero si existe (por la FK restrict)
      if (tieneReceta) {
        await supabase.from('prescriptions').delete().eq('exam_id', exam.id)
      }
      // Eliminar mediciones (por si no hay cascade)
      await supabase.from('eye_measurements').delete().eq('exam_id', exam.id)
      // Eliminar el examen
      const { error } = await supabase.from('eye_exams').delete().eq('id', exam.id)
      if (error) throw error

      setExams(prev => prev.filter(ex => ex.id !== exam.id))
    } catch (err) {
      alert('Error al eliminar el examen: ' + err.message)
    }
    setDeletingId(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando...
    </div>
  )

  if (!patient) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Paciente no encontrado
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/pacientes')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">
            {patient.nombres} {patient.apellidos}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Historia clínica</p>
        </div>
        <button
          onClick={() => navigate(`/pacientes/${id}/examen/nuevo`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> Nuevo examen
        </button>
      </div>

      {/* Datos del paciente */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Datos personales
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {patient.dni && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={14} className="text-gray-400" />
              DNI: <span className="font-medium">{patient.dni}</span>
            </div>
          )}
          {patient.fecha_nac && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={14} className="text-gray-400" />
              {calcularEdad(patient.fecha_nac)} años
              <span className="text-gray-400">
                ({format(new Date(patient.fecha_nac), 'dd/MM/yyyy')})
              </span>
            </div>
          )}
          {patient.telefono && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={14} className="text-gray-400" />
              {patient.telefono}
            </div>
          )}
          {patient.sexo && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={14} className="text-gray-400" />
              {patient.sexo === 'M' ? 'Masculino' : patient.sexo === 'F' ? 'Femenino' : 'Otro'}
            </div>
          )}
        </div>

        {/* Antecedentes */}
        {patient.antecedentes && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Antecedentes
            </p>
            <p className="text-sm text-gray-600">{patient.antecedentes}</p>
          </div>
        )}
      </div>

      {/* Historial de exámenes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Historial de exámenes ({exams.length})
        </h2>

        {exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <FileText size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Sin exámenes registrados</p>
            <p className="text-xs mt-1">Crea el primer examen con el botón de arriba</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map(exam => (
              <div
                key={exam.id}
                onClick={() => navigate(`/pacientes/${id}/examen/${exam.id}/detalle`)}
                className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Examen del {format(new Date(exam.fecha), "dd 'de' MMMM yyyy", { locale: es })}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 capitalize">{exam.tipo_examen}</span>
                      {exam.prescriptions?.length > 0 && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          · <FileText size={10} /> Receta emitida
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoBadge[exam.estado]}`}>
                    {exam.estado}
                  </span>
                  {/* Eliminar examen — solo admin */}
                  {isAdmin && (
                    <button
                      onClick={(e) => handleDeleteExam(e, exam)}
                      disabled={deletingId === exam.id}
                      title="Eliminar examen (solo admin)"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
