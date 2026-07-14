import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Printer, Save, CheckCircle, Trash2, ShoppingCart } from 'lucide-react'
import PrescriptionPrint from '../components/optica/prescriptions/PrescriptionPrint'

function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export default function RecetaPage() {
  const { id, examId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [patient, setPatient] = useState(null)
  const [exam, setExam] = useState(null)
  const [sede, setSede] = useState(null)
  const [optometrista, setOptometrista] = useState(null)
  const [od, setOd] = useState({})
  const [oi, setOi] = useState({})
  const [extras, setExtras] = useState({})
  const [existingRx, setExistingRx] = useState(null)

  useEffect(() => { fetchData() }, [examId])

  async function fetchData() {
    setLoading(true)

    // Verificar si el usuario actual es admin
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles(nombre)')
        .eq('id', user.id)
        .single()
      setIsAdmin(profile?.roles?.nombre === 'admin')
    }

    const { data: e } = await supabase
      .from('eye_exams')
      .select('*, eye_measurements(*), prescriptions(*)')
      .eq('id', examId)
      .single()

    if (!e) { setLoading(false); return }

    setExam(e)
    setOd(e.eye_measurements?.find(m => m.ojo === 'OD') || {})
    setOi(e.eye_measurements?.find(m => m.ojo === 'OI') || {})
    if (e.prescriptions?.length > 0) setExistingRx(e.prescriptions[0])

    try { setExtras(JSON.parse(e.observaciones || '{}')) } catch {}

    const [{ data: p }, { data: s }, { data: opt }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('sedes').select('*').eq('id', e.sede_id).single(),
      supabase.from('profiles')
        .select('nombres, apellidos')
        .eq('id', e.optometrista_id)
        .single(),
    ])

    setPatient(p)
    setSede(s)
    setOptometrista(opt)
    setLoading(false)
  }

  async function handleSaveAndPrint() {
    setSaving(true)
    try {
      const dip = extras.dip || od?.dp_lejos || ''
      const add = extras.add || od?.ref_adicion || ''
      const tieneAdd = add !== null && add !== undefined && add !== '' && parseFloat(add) !== 0
      const dipCerca = tieneAdd && dip ? (parseFloat(dip) - 2).toFixed(1) : null

      const fechaVence = (() => {
        const base = new Date(exam.fecha + 'T00:00:00')
        const meses = extras.proxima_cita === '3m' ? 3 : extras.proxima_cita === '6m' ? 6 : 12
        base.setMonth(base.getMonth() + meses)
        return base.toISOString().split('T')[0]
      })()

      const payload = {
        exam_id:        exam.id,
        patient_id:     id,
        sede_id:        exam.sede_id,
        emitida_por:    exam.optometrista_id,
        tipo:           'lunas',
        fecha_emision:  exam.fecha,
        fecha_vence:    fechaVence,

        od_esfera:   od?.ref_esfera   ?? null,
        od_cilindro: od?.ref_cilindro ?? null,
        od_eje:      od?.ref_eje      ?? null,
        od_adicion:  parseFloat(add) || null,
        od_av:       od?.av_vl ?? null,

        oi_esfera:   oi?.ref_esfera   ?? null,
        oi_cilindro: oi?.ref_cilindro ?? null,
        oi_eje:      oi?.ref_eje      ?? null,
        oi_adicion:  parseFloat(add) || null,
        oi_av:       oi?.av_vl ?? null,

        dp_lejos: dip ? parseFloat(dip) : null,
        dp_cerca: dipCerca ? parseFloat(dipCerca) : null,

        indicaciones:   exam.recomendaciones || null,
        notas_internas: null,
        estado:         'vigente',
      }

      let rx
      if (existingRx) {
        const { data, error } = await supabase
          .from('prescriptions')
          .update(payload)
          .eq('id', existingRx.id)
          .select()
          .single()
        if (error) throw error
        rx = data
      } else {
        const { data, error } = await supabase
          .from('prescriptions')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        rx = data
      }

      setExistingRx(rx)
      setSaved(true)

      setTimeout(() => window.print(), 300)

    } catch (err) {
      alert('Error al guardar la receta: ' + err.message)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!existingRx) return
    const confirmar = window.confirm(
      '¿Seguro que deseas eliminar esta receta? Esta acción no se puede deshacer.'
    )
    if (!confirmar) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', existingRx.id)
      if (error) throw error

      setExistingRx(null)
      setSaved(false)
    } catch (err) {
      alert('Error al eliminar la receta: ' + err.message)
    }
    setDeleting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando...
    </div>
  )

  if (!exam) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Examen no encontrado
    </div>
  )

  const dip = extras.dip || od?.dp_lejos || ''
  const add = extras.add || od?.ref_adicion || ''

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Header — oculto al imprimir */}
      <div className="flex items-center gap-3 no-print">
        <button onClick={() => navigate(`/pacientes/${id}/examen/${examId}/detalle`)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Generar receta</h1>
          {patient && (
            <p className="text-xs text-gray-400 mt-0.5">
              {patient.nombres} {patient.apellidos}
            </p>
          )}
        </div>

        {/* Botón eliminar — solo admin y solo si existe receta */}
        {isAdmin && existingRx && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={15} />
            {deleting ? 'Eliminando...' : 'Eliminar receta'}
          </button>
        )}

        <button
          onClick={handleSaveAndPrint}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {existingRx
            ? <Printer size={15} />
            : <Save size={15} />
          }
          {saving ? 'Guardando...' : existingRx ? 'Imprimir de nuevo' : 'Guardar e imprimir'}
        </button>

        {/* Crear venta — solo si la receta ya está guardada */}
        {existingRx && (
          <button
            onClick={() => navigate(`/ventas/nueva/${id}?prescriptionId=${existingRx.id}`)}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
          >
            <ShoppingCart size={15} />
            Crear venta
          </button>
        )}
      </div>

      {saved && (
        <div className="no-print bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs text-green-700 flex items-center gap-2">
          <CheckCircle size={14} /> Receta guardada correctamente. Enviando a la impresora...
        </div>
      )}

      {existingRx && !saved && (
        <div className="no-print bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-600">
          📄 Esta receta ya fue generada anteriormente. Puedes volver a imprimirla.
        </div>
      )}

      {/* Vista previa de la receta — esto es lo que se imprime */}
      <div className="flex justify-center py-4 bg-gray-50 rounded-2xl no-print-bg">
        <PrescriptionPrint
          sede={{
            nombre: sede?.nombre,
            direccion: sede?.direccion,
            telefono: sede?.telefono,
          }}
          patient={{
            nombres: patient?.nombres,
            apellidos: patient?.apellidos,
            dni: patient?.dni,
            telefono: patient?.telefono,
            edad: patient?.fecha_nac ? calcularEdad(patient.fecha_nac) : (patient?.edad || null),
          }}
          exam={{ fecha: exam.fecha, tipo_examen: exam.tipo_examen }}
          od={od}
          oi={oi}
          dip={dip}
          add={add}
          recomendaciones={exam.recomendaciones}
          proximaCita={extras.proxima_cita}
          optometrista={optometrista}
        />
      </div>

      <p className="text-xs text-gray-400 text-center no-print">
        Vista previa — el formato real se ajusta al ancho de la impresora térmica de 58mm
      </p>
    </div>
  )
}
