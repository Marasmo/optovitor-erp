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

// -0.5 → "-0.50" · -1 → "-1.00" · +1.25 → "+1.25"
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

// Fila OD u OI: ESF | CIL | EJE | A.V.
function OjoRow({ label, color, esf, cil, eje, av }) {
  const esfF = formatDiopt(esf)
  const cilF = formatDiopt(cil)
  const ejeF = formatEje(eje)

  return (
    <tr className="border-t border-gray-50">
      <td className="py-2.5 pr-4">
        <span className={`text-xs font-bold ${color}`}>{label}</span>
      </td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
        {esfF ?? '—'}
      </td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
        {cilF ?? '—'}
      </td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
        {ejeF ?? '—'}
      </td>
      <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
        {av || '—'}
      </td>
    </tr>
  )
}

export default function ExamenDetailPage() {
  const { id, examId } = useParams()
  const navigate = useNavigate()
  const [exam, setExam]       = useState(null)
  const [patient, setPatient] = useState(null)
  const [od, setOd]           = useState(null)
  const [oi, setOi]           = useState(null)
  const [extras, setExtras]   = useState({})
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [prescriptionId, setPrescriptionId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchData() }, [examId])

  async function fetchData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id, roles(nombre)')
        .eq('id', user.id)
        .single()

      const rol = profile?.roles?.nombre
      setCanEdit(rol === 'admin' || rol === 'optometrista')
      setIsAdmin(rol === 'admin')
    }

    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('eye_exams')
        .select('*, eye_measurements(*), prescriptions(id)')
        .eq('id', examId)
        .single(),
      supabase.from('patients')
        .select('*')
        .eq('id', id)
        .single()
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

  async function handleDeletePrescription() {
    if (!prescriptionId) return
    const confirmar = window.confirm(
      '¿Seguro que deseas eliminar la receta de este examen? Esta acción no se puede deshacer.'
    )
    if (!confirmar) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', prescriptionId)
      if (error) throw error

      setPrescriptionId(null)
    } catch (err) {
      alert('Error al eliminar la receta: ' + err.message)
    }
    setDeleting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando examen...
    </div>
  )

  if (!exam) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Examen no encontrado
    </div>
  )

  const add = extras.add || od?.ref_adicion || null
  const dip = extras.dip || od?.dp_lejos || null

  const tieneAdd = add !== null && add !== undefined && add !== '' && parseFloat(add) !== 0
  const dipCerca = tieneAdd && dip ? (parseFloat(dip) - 2).toFixed(1) : null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/pacientes/${id}`)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Detalle del examen</h1>
          {patient && (
            <p className="text-xs text-gray-400 mt-0.5">
              {patient.nombres} {patient.apellidos}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && exam.estado !== 'anulado' && (
            <button
              onClick={() => navigate(`/pacientes/${id}/examen/${examId}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Edit size={15} /> Editar
            </button>
          )}

          {/* Eliminar receta — solo admin y solo si existe */}
          {isAdmin && prescriptionId && (
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

      {/* Aviso solo lectura */}
      {!canEdit && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-600 flex items-center gap-2">
          📄 Vista de solo lectura — este documento no puede modificarse
        </div>
      )}

      {/* Aviso receta eliminada */}
      {isAdmin && exam.estado === 'finalizado' && !prescriptionId && (
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

        {exam.estado === 'borrador' && canEdit && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
            ⚠️ Este examen está en borrador. Finalízalo para poder generar la receta.
          </div>
        )}
      </div>

      {/* ── TABLA DE GRADUACIÓN ── */}
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
              <OjoRow
                label="OD"
                color="text-blue-700"
                esf={od?.ref_esfera}
                cil={od?.ref_cilindro}
                eje={od?.ref_eje}
                av={od?.av_vl}
              />
              <OjoRow
                label="OI"
                color="text-purple-700"
                esf={oi?.ref_esfera}
                cil={oi?.ref_cilindro}
                eje={oi?.ref_eje}
                av={oi?.av_vl}
              />
            </tbody>
          </table>

          {/* DIP + ADD */}
          {(dip || tieneAdd) && (
            <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap gap-6">
              {dip && (
                <div className="text-sm text-gray-600">
                  DIP: <span className="font-bold text-gray-800">{dip} mm</span>
                </div>
              )}
              {tieneAdd && (
                <div className="text-sm text-gray-600">
                  ADD: <span className="font-bold text-purple-700">{formatDiopt(add)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── VISIÓN CERCANA — solo si hay ADD ── */}
        {tieneAdd && (
          <div className="px-5 pt-3 pb-4 border-t border-purple-100 bg-purple-50/40">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide block mb-3">
              Visión Cercana
            </span>
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
                <tr className="border-t border-purple-100">
                  <td className="py-2.5 pl-3 pr-2">
                    <span className="text-xs font-bold text-blue-700">OD</span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-sm font-medium text-purple-700">
                    {formatDiopt(add)}
                  </td>
                  {dipCerca && (
                    <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
                      {dipCerca} mm
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
                    {od?.av_vp || '—'}
                  </td>
                </tr>
                <tr className="border-t border-purple-100">
                  <td className="py-2.5 pl-3 pr-2">
                    <span className="text-xs font-bold text-purple-700">OI</span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-sm font-medium text-purple-700">
                    {formatDiopt(add)}
                  </td>
                  {dipCerca && (
                    <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
                      {dipCerca} mm
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-center text-sm font-medium text-gray-700">
                    {oi?.av_vp || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
            {dipCerca && (
              <p className="text-xs text-gray-400 mt-2">
                * DIP cerca = DIP lejos − 2mm
              </p>
            )}
          </div>
        )}
      </div>

      {/* Recomendaciones y próxima cita */}
      {(exam.recomendaciones || extras.proxima_cita) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 grid grid-cols-2 gap-6">
          {exam.recomendaciones && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recomendaciones para la vendedora
              </p>
              <p className="text-sm text-gray-700">{exam.recomendaciones}</p>
            </div>
          )}
          {extras.proxima_cita && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Próxima cita
              </p>
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
