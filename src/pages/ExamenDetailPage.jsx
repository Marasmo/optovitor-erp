// src/pages/ExamenDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Edit, FileText, Calendar, User, Clock, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoBadge = {
  borrador:   'bg-yellow-50 text-yellow-700 border border-yellow-200',
  finalizado: 'bg-green-50 text-green-700 border border-green-200',
  anulado:    'bg-red-50 text-red-700 border border-red-200',
}

const proximaCitaLabel = {
  '3m': '3 meses',
  '6m': '6 meses',
  '1a': '1 año',
}

function formatDiopt(value) {
  if (value === null || value === undefined || value === '') return null
  const n = parseFloat(value)
  if (isNaN(n)) return null
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

function formatEje(value) {
  if (value === null || value === undefined || value === '') return null
  return `${value}°`
}

function OjoRow({ label, color, esf, cil, eje, av }) {
  return (
    <tr className="border-t border-gray-50">
      <td className="py-2.5 pr-4">
        <span className={`text-xs font-bold ${color}`}>{label}</span>
      </td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">{formatDiopt(esf) ?? '—'}</td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">{formatDiopt(cil) ?? '—'}</td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">{formatEje(eje) ?? '—'}</td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">{av || '—'}</td>
    </tr>
  )
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

export default function ExamenDetailPage() {
  const { id, examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam]             = useState(null)
  const [patient, setPatient]       = useState(null)
  const [od, setOd]                 = useState(null)
  const [oi, setOi]                 = useState(null)
  const [extras, setExtras]         = useState({})
  const [loading, setLoading]       = useState(true)
  const [canEdit, setCanEdit]       = useState(false)
  const [isAdmin, setIsAdmin]       = useState(false)
  const [miSedeId, setMiSedeId]     = useState(null)
  const [miUserId, setMiUserId]     = useState(null)
  const [prescriptionId, setPrescriptionId] = useState(null)
  const [deleting, setDeleting]     = useState(false)

  useEffect(() => { fetchData() }, [examId])

  async function fetchData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id, role_id, roles(nombre)')
        .eq('id', user.id)
        .single()

      const rol = profile?.roles?.nombre
      setCanEdit(rol === 'admin' || rol === 'optometrista')
      setIsAdmin(rol === 'admin')
      setMiSedeId(profile?.sede_id)
      setMiUserId(user.id)
    }

    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('eye_exams')
        .select('*, eye_measurements(*), prescriptions(id)')
        .eq('id', examId)
        .single(),
      supabase.from('patients').select('*').eq('id', id).single()
    ])

    if (e) {
      setExam(e)
      setOd(e.eye_measurements?.find(m => m.ojo === 'OD') || null)
      setOi(e.eye_measurements?.find(m => m.ojo === 'OI') || null)
      try { setExtras(JSON.parse(e.observaciones || '{}')) } catch {}
      if (e.prescriptions?.length > 0) setPrescriptionId(e.prescriptions[0].id)
    }
    if (p) setPatient(p)
    setLoading(false)
  }

  // Admin puede eliminar receta solo si el examen es de su sede
  function puedeEliminarReceta() {
    return isAdmin && exam?.sede_id === miSedeId
  }

  async function handleDeletePrescription() {
    if (!prescriptionId) return
    if (!window.confirm('¿Seguro que deseas eliminar la receta de este examen? Esta acción no se puede deshacer.')) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', prescriptionId)
      if (error) throw error

      // Registrar en bitácora
      await registrarBitacora({
        accion: 'eliminar_receta',
        detalle: {
          prescription_id: prescriptionId,
          exam_id: examId,
          patient_id: id,
          patient_nombre: `${patient?.nombres} ${patient?.apellidos}`,
          fecha_examen: exam?.fecha,
        },
        usuarioId: miUserId,
        sedeId: miSedeId,
      })

      setPrescriptionId(null)
    } catch (err) {
      alert('Error al eliminar la receta: ' + err.message)
    }
    setDeleting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando examen...</div>
  )
  if (!exam) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Examen no encontrado</div>
  )

  const add = extras.add || od?.ref_adicion || null
  const dip = extras.dip || od?.dp_lejos || null
  const tieneAdd = add !== null && add !== undefined && add !== '' && parseFloat(add) !== 0
  const dipCerca = tieneAdd && dip ? (parseFloat(dip) - 2).toFixed(1) : null

  // ¿El examen es de otra sede? Mostrar aviso
  const esDeOtraSede = exam.sede_id !== miSedeId

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/pacientes/${id}`)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Detalle del examen</h1>
          {patient && (
            <p className="text-xs text-gray-400 mt-0.5">{patient.nombres} {patient.apellidos}</p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Editar: solo si puede editar Y el examen es de su sede */}
          {canEdit && exam.estado !== 'anulado' && !esDeOtraSede && (
            <button
              onClick={() => navigate(`/pacientes/${id}/examen/${examId}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Edit size={15} /> Editar
            </button>
          )}

          {/* Eliminar receta — solo admin de la misma sede */}
          {puedeEliminarReceta() && prescriptionId && (
            <button
              onClick={handleDeletePrescription}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {deleting ? 'Eliminando...' : 'Eliminar receta'}
            </button>
          )}

          {exam.estado === 'finalizado' && (
            <button
              onClick={() => navigate(`/pacientes/${id}/examen/${examId}/receta`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <FileText size={15} />
              {prescriptionId ? 'Ver / Imprimir receta' : 'Generar receta'}
            </button>
          )}
        </div>
      </div>

      {/* Aviso examen de otra sede */}
      {esDeOtraSede && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 text-xs text-purple-600 flex items-center gap-2">
          👁️ Este examen pertenece a otra sede — solo lectura, no puede modificarse desde aquí
        </div>
      )}

      {!canEdit && !esDeOtraSede && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-600 flex items-center gap-2">
          📄 Vista de solo lectura — este documento no puede modificarse
        </div>
      )}

      {isAdmin && exam.estado === 'finalizado' && !prescriptionId && !esDeOtraSede && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-600 flex items-center gap-2">
          ⚠️ Este examen no tiene receta generada (o fue eliminada).
        </div>
      )}

      {/* Info general */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={14} className="text-gray-400" />
              {format(new Date(exam.fecha), "dd 'de' MMMM yyyy", { locale: es })}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock size={14} className="text-gray-400" />
              <span className="capitalize">{exam.tipo_examen}</span>
            </div>
            {exam.motivo_consulta && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={14} className="text-gray-400" />
                {exam.motivo_consulta}
              </div>
            )}
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${estadoBadge[exam.estado]}`}>
            {exam.estado}
          </span>
        </div>
        {exam.estado === 'borrador' && canEdit && !esDeOtraSede && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
            ⚠️ Este examen está en borrador. Finalízalo para poder generar la receta.
          </div>
        )}
      </div>

      {/* Tabla de graduación */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Graduación — Visión Lejana
            </span>
            {extras.uso && (
              <span className="text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full capitalize">
                Uso: {extras.uso}
              </span>
            )}
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white text-xs">
                <th className="py-2 pl-3 pr-2 text-left rounded-tl-lg w-12"></th>
                <th className="py-2 px-3">ESF.</th>
                <th className="py-2 px-3">CIL.</th>
                <th className="py-2 px-3">EJE</th>
                <th className="py-2 px-3 rounded-tr-lg">A.V.</th>
              </tr>
            </thead>
            <tbody>
              <OjoRow label="OD" color="text-blue-700" esf={od?.ref_esfera} cil={od?.ref_cilindro} eje={od?.ref_eje} av={od?.av_vl} />
              <OjoRow label="OI" color="text-purple-700" esf={oi?.ref_esfera} cil={oi?.ref_cilindro} eje={oi?.ref_eje} av={oi?.av_vl} />
            </tbody>
          </table>
          {(dip || tieneAdd) && (
            <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap gap-6">
              {dip && <div className="text-sm text-gray-600">DIP: <span className="font-bold text-gray-800">{dip} mm</span></div>}
              {tieneAdd && <div className="text-sm text-gray-600">ADD: <span className="font-bold text-purple-700">{formatDiopt(add)}</span></div>}
            </div>
          )}
        </div>

        {tieneAdd && (
          <div className="px-5 pt-3 pb-4 border-t border-purple-100 bg-purple-50/40">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide block mb-3">Visión Cercana</span>
            <table className="w-full">
              <thead>
                <tr className="bg-purple-600 text-white text-xs">
                  <th className="py-2 pl-3 pr-2 text-left rounded-tl-lg w-12"></th>
                  <th className="py-2 px-3">ADD</th>
                  {dipCerca && <th className="py-2 px-3">DIP Cerca</th>}
                  <th className="py-2 px-3 rounded-tr-lg">A.V. Cerca</th>
                </tr>
              </thead>
              <tbody>
                {[{ label: 'OD', color: 'text-blue-700', av: od?.av_vp }, { label: 'OI', color: 'text-purple-700', av: oi?.av_vp }].map(({ label, color, av }) => (
                  <tr key={label} className="border-t border-purple-100">
                    <td className="py-2.5 pl-3 pr-2"><span className={`text-xs font-bold ${color}`}>{label}</span></td>
                    <td className="py-2.5 px-3 text-center text-sm font-medium text-purple-700">{formatDiopt(add)}</td>
                    {dipCerca && <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">{dipCerca} mm</td>}
                    <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">{av || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dipCerca && <p className="text-xs text-gray-400 mt-2">* DIP cerca = DIP lejos − 2mm</p>}
          </div>
        )}
      </div>

      {(exam.recomendaciones || extras.proxima_cita) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 grid grid-cols-2 gap-6">
          {exam.recomendaciones && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recomendaciones para la vendedora</p>
              <p className="text-sm text-gray-700">{exam.recomendaciones}</p>
            </div>
          )}
          {extras.proxima_cita && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Próxima cita</p>
              <p className="text-sm font-medium text-blue-700">
                {proximaCitaLabel[extras.proxima_cita] || extras.proxima_cita}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
