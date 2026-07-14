// src/pages/PatientProfilePage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, User, Phone, Calendar, Plus, FileText, Trash2, Edit2, Save, X } from 'lucide-react'
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

async function registrarBitacora({ accion, detalle, usuarioId, sedeId }) {
  await supabase.from('bitacora_ventas').insert({
    venta_id: null,
    sede_id: sedeId,
    accion,
    detalle,
    usuario_id: usuarioId,
  })
}

export default function PatientProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient]       = useState(null)
  const [exams, setExams]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [isAdmin, setIsAdmin]       = useState(false)
  const [miSedeId, setMiSedeId]     = useState(null)
  const [miUserId, setMiUserId]     = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [editando, setEditando]     = useState(false)
  const [editForm, setEditForm]     = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [reniecLoading, setReniecLoading] = useState(false)
  const [reniecMsg, setReniecMsg]   = useState('')

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id, roles(nombre)')
        .eq('id', user.id)
        .single()
      setIsAdmin(profile?.roles?.nombre === 'admin')
      setMiSedeId(profile?.sede_id)
      setMiUserId(user.id)
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

  function puedeEliminar(exam) {
    return isAdmin && exam.sede_id === miSedeId
  }

  async function handleGuardarEdicion() {
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          nombres:   editForm.nombres?.trim() || patient.nombres,
          apellidos: editForm.apellidos?.trim() || patient.apellidos,
          dni:       editForm.dni?.trim() || null,
          telefono:  editForm.telefono?.trim() || null,
          fecha_nac: editForm.fecha_nac || null,
          procedencia: editForm.procedencia?.trim() || null,
        })
        .eq('id', id)
      if (error) throw error
      await fetchData()
      setEditando(false)
      setReniecMsg('')
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    }
    setSavingEdit(false)
  }

  async function consultarReniec() {
    const dni = editForm.dni?.trim()
    if (!dni || dni.length !== 8) {
      setReniecMsg('⚠️ Ingresa un DNI válido de 8 dígitos')
      return
    }
    setReniecLoading(true)
    setReniecMsg('')
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('consultar-dni', {
        body: { dni }
      })
      if (fnError) throw fnError
      if (fnData?.success && fnData?.data) {
        const d = fnData.data
        setEditForm(p => ({
          ...p,
          nombres:   d.nombres || p.nombres,
          apellidos: `${d.apellido_paterno} ${d.apellido_materno}`.trim() || p.apellidos,
          fecha_nac: d.fecha_nacimiento || p.fecha_nac,
        }))
        setReniecMsg('✅ Datos actualizados desde RENIEC')
      } else {
        setReniecMsg('⚠️ DNI no encontrado en RENIEC')
      }
    } catch {
      setReniecMsg('❌ Error al consultar RENIEC')
    }
    setReniecLoading(false)
  }

  async function handleDeleteExam(e, exam) {
    e.stopPropagation()
    const tieneReceta = exam.prescriptions?.length > 0
    const mensaje = tieneReceta
      ? '⚠️ Este examen tiene una receta asociada que también será eliminada.\n\n¿Seguro que deseas eliminar este examen?'
      : '¿Seguro que deseas eliminar este examen? Esta acción no se puede deshacer.'
    if (!window.confirm(mensaje)) return
    setDeletingId(exam.id)
    try {
      if (tieneReceta) await supabase.from('prescriptions').delete().eq('exam_id', exam.id)
      await supabase.from('eye_measurements').delete().eq('exam_id', exam.id)
      const { error } = await supabase.from('eye_exams').delete().eq('id', exam.id)
      if (error) throw error
      await registrarBitacora({
        accion: 'eliminar_examen',
        detalle: { exam_id: exam.id, patient_id: id, patient_nombre: `${patient?.nombres} ${patient?.apellidos}`, fecha_examen: exam.fecha, tenia_receta: tieneReceta },
        usuarioId: miUserId,
        sedeId: miSedeId,
      })
      setExams(prev => prev.filter(ex => ex.id !== exam.id))
    } catch (err) {
      alert('Error al eliminar el examen: ' + err.message)
    }
    setDeletingId(null)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando...</div>
  if (!patient) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Paciente no encontrado</div>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/pacientes')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{patient.nombres} {patient.apellidos}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Historia clínica</p>
        </div>
        <button
          onClick={() => {
            setEditForm({
              nombres:   patient.nombres || '',
              apellidos: patient.apellidos || '',
              dni:       patient.dni || '',
              telefono:  patient.telefono || '',
              fecha_nac: patient.fecha_nac || '',
              procedencia: patient.procedencia || '',
            })
            setReniecMsg('')
            setEditando(true)
          }}
          className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 border border-red-600 text-sm font-medium rounded-lg hover:bg-red-700"
        >
          <Edit2 size={15} /> Editar
        </button>
        <button
          onClick={() => navigate(`/pacientes/${id}/examen/nuevo`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> Nuevo examen
        </button>
      </div>

      {/* Datos personales */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos personales</h2>

        {editando ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Nombres</label>
                <input value={editForm.nombres}
                  onChange={e => setEditForm(p => ({ ...p, nombres: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Apellidos</label>
                <input value={editForm.apellidos}
                  onChange={e => setEditForm(p => ({ ...p, apellidos: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">DNI</label>
                <input value={editForm.dni}
                  onChange={e => setEditForm(p => ({ ...p, dni: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Teléfono</label>
                <input value={editForm.telefono}
                  onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Fecha de nacimiento</label>
                <input type="date" value={editForm.fecha_nac}
                  onChange={e => setEditForm(p => ({ ...p, fecha_nac: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Procedencia</label>
                <input value={editForm.procedencia || ''}
                  onChange={e => setEditForm(p => ({ ...p, procedencia: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ciudad de origen..." />
              </div>
            </div>

            {reniecMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${reniecMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {reniecMsg}
              </p>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={consultarReniec}
                disabled={reniecLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {reniecLoading ? '⏳ Consultando...' : '🔄 Actualizar con RENIEC'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setEditando(false); setReniecMsg('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                  <X size={13} /> Cancelar
                </button>
                <button onClick={handleGuardarEdicion} disabled={savingEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Save size={13} /> {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                  <span className="text-gray-400">({format(new Date(patient.fecha_nac + 'T00:00:00'), 'dd/MM/yyyy')})</span>
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
              {patient.procedencia && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User size={14} className="text-gray-400" />
                  📍 {patient.procedencia}
                </div>
              )}
            </div>
            {patient.antecedentes && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Antecedentes</p>
                <p className="text-sm text-gray-600">{patient.antecedentes}</p>
              </div>
            )}
          </>
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
              <div key={exam.id}
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
                      {exam.sede_id !== miSedeId && (
                        <span className="text-xs text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">otra sede</span>
                      )}
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
                  {puedeEliminar(exam) && (
                    <button onClick={(e) => handleDeleteExam(e, exam)} disabled={deletingId === exam.id}
                      title="Eliminar examen"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
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
