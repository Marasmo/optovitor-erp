import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'

const emptyMed = {
  esf: '', cil: '', eje: '', av: '', cerca_av: '',
}

// Sin flechitas: type="text" + inputMode numérico
function NumInput({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={onChange}
      className="w-full border-0 border-b border-gray-300 px-1 py-1.5 text-sm text-center focus:outline-none focus:border-blue-500 bg-transparent"
    />
  )
}

function EsfInput({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="text"
      value={value}
      onChange={onChange}
      className="w-full border-0 border-b border-gray-300 px-1 py-1.5 text-sm text-center focus:outline-none focus:border-blue-500 bg-transparent"
    />
  )
}

function TextInput({ value, onChange, placeholder = '' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full border-0 border-b border-gray-300 px-1 py-1.5 text-sm text-center focus:outline-none focus:border-blue-500 bg-transparent"
    />
  )
}

function EjeInput({ value, onChange, required, error }) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        className={`w-full border-0 border-b px-1 py-1.5 text-sm text-center focus:outline-none bg-transparent pr-4
          ${error ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}
          ${required && !value ? 'border-orange-400' : ''}
        `}
      />
      <span className="absolute right-1 top-1 text-xs text-gray-400 leading-none">°</span>
    </div>
  )
}

export default function ExamenPage() {
  const { id, examId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState({})

  const [fecha, setFecha]             = useState(new Date().toISOString().split('T')[0])
  const [tipoExamen, setTipoExamen]   = useState('completo')
  const [motivoConsulta, setMotivo]   = useState('')
  const [recomendaciones, setRecom]   = useState('')
  const [proximaCita, setProximaCita] = useState('1a')
  const [usoPrescripcion, setUso]     = useState('lejos')

  const [dip, setDip] = useState('')
  const [add, setAdd] = useState('')

  const dipCerca = dip !== '' ? (parseFloat(dip) - 2).toFixed(1) : ''
  const tieneAdd = add !== ''

  const [od, setOd] = useState({ ...emptyMed })
  const [oi, setOi] = useState({ ...emptyMed })

  const setOdField = (f, v) => setOd(p => ({ ...p, [f]: v }))
  const setOiField = (f, v) => setOi(p => ({ ...p, [f]: v }))

  function ejeRequerido(med) {
    const cil = parseFloat(med.cil)
    return med.cil !== '' && !isNaN(cil) && cil !== 0
  }

  useEffect(() => {
    supabase.from('patients').select('*').eq('id', id).single()
      .then(({ data }) => setPatient(data))
    if (examId && examId !== 'nuevo') loadExam()
  }, [id, examId])

  async function loadExam() {
    const { data: exam } = await supabase
      .from('eye_exams')
      .select('*, eye_measurements(*)')
      .eq('id', examId)
      .single()

    if (!exam) return

    setFecha(exam.fecha)
    setTipoExamen(exam.tipo_examen)
    setMotivo(exam.motivo_consulta || '')
    setRecom(exam.recomendaciones  || '')

    try {
      const extras = JSON.parse(exam.observaciones || '{}')
      if (extras.uso)          setUso(extras.uso)
      if (extras.proxima_cita) setProximaCita(extras.proxima_cita)
      if (extras.dip)          setDip(String(extras.dip))
      if (extras.add)          setAdd(String(extras.add))
    } catch {}

    exam.eye_measurements?.forEach(m => {
      const med = {
        esf:      m.ref_esfera   !== null && m.ref_esfera   !== undefined ? String(m.ref_esfera)   : '',
        cil:      m.ref_cilindro !== null && m.ref_cilindro !== undefined ? String(m.ref_cilindro) : '',
        eje:      m.ref_eje      !== null && m.ref_eje      !== undefined ? String(m.ref_eje)      : '',
        av:       m.av_vl        ?? '',
        cerca_av: m.av_vp        ?? '',
      }
      if (m.ojo === 'OD') setOd(med)
      else                setOi(med)
    })

    const addVal = exam.eye_measurements?.find(m => m.ref_adicion !== null)?.ref_adicion
    if (addVal !== null && addVal !== undefined) setAdd(String(addVal))
  }

  function parseNum(v) {
  if (v === '' || v === null || v === undefined) return null
  if (String(v).trim().toUpperCase() === 'CP') return 'CP'
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

  function validate() {
    const errs = {}
    if (ejeRequerido(od) && od.eje === '') errs.od_eje = 'Eje obligatorio cuando hay cilindro'
    if (ejeRequerido(oi) && oi.eje === '') errs.oi_eje = 'Eje obligatorio cuando hay cilindro'
    if (od.eje !== '' && (parseFloat(od.eje) < 0 || parseFloat(od.eje) > 180)) errs.od_eje = 'El eje debe estar entre 0° y 180°'
    if (oi.eje !== '' && (parseFloat(oi.eje) < 0 || parseFloat(oi.eje) > 180)) errs.oi_eje = 'El eje debe estar entre 0° y 180°'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

async function handleSave(estado = 'borrador') {
  if (estado === 'finalizado' && !validate()) return
  setSaving(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('profiles')
      .select('sede_id')
      .eq('id', user.id)
      .single()

    const examPayload = {
      patient_id:      id,
      sede_id:         profile.sede_id,
      optometrista_id: user.id,
      fecha,
      tipo_examen:     tipoExamen,
      motivo_consulta: motivoConsulta,
      recomendaciones,
      observaciones: JSON.stringify({
        uso: usoPrescripcion, dip, add, proxima_cita: proximaCita,
      }),
      estado,
    }

    let examData
    if (examId === 'nuevo') {
      const { data, error } = await supabase.from('eye_exams').insert(examPayload).select().single()
      if (error) throw error
      examData = data
    } else {
      const { data, error } = await supabase.from('eye_exams').update(examPayload).eq('id', examId).select().single()
      if (error) throw error
      examData = data
    }

    for (const [ojo, med] of [['OD', od], ['OI', oi]]) {
      await supabase.from('eye_measurements').upsert({
        exam_id:      examData.id,
        ojo,
        ref_esfera:   med.esf.trim().toUpperCase() === 'CP' ? 'CP' : parseNum(med.esf),
        ref_cilindro: parseNum(med.cil),
        ref_eje:      parseNum(med.eje),
        ref_adicion:  parseNum(add),
        av_vl:        med.av       || null,
        av_vp:        med.cerca_av || null,
        dp_lejos:     parseNum(dip),
        dp_cerca:     dipCerca !== '' ? parseNum(dipCerca) : null,
      }, { onConflict: 'exam_id,ojo' })
    }

    navigate(`/pacientes/${id}`)
  } catch (err) {
    alert('Error al guardar: ' + err.message)
  }
  setSaving(false)
}

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/pacientes/${id}`)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Examen Visual</h1>
          {patient && (
            <p className="text-xs text-gray-400 mt-0.5">
              {patient.nombres} {patient.apellidos}
            </p>
          )}
        </div>
      </div>

      {/* Cabecera */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo de examen</label>
            <select value={tipoExamen} onChange={e => setTipoExamen(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="completo">Completo</option>
              <option value="control">Control</option>
              <option value="lensometria">Lensometría</option>
              <option value="rapido">Rápido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Motivo de consulta</label>
            <input type="text" value={motivoConsulta} onChange={e => setMotivo(e.target.value)}
              placeholder="Primera vez, control..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabla VL */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              V.L. — Visión Lejana
            </span>
            <div className="flex gap-3">
              {['lejos', 'cerca', 'ambos'].map(u => (
                <label key={u} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="uso" value={u}
                    checked={usoPrescripcion === u}
                    onChange={() => setUso(u)}
                    className="accent-blue-600" />
                  <span className="text-xs text-gray-600 capitalize">{u}</span>
                </label>
              ))}
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white text-xs">
                <th className="px-3 py-2 text-left w-12 rounded-tl-lg"></th>
                <th className="px-2 py-2">ESF.</th>
                <th className="px-2 py-2">CIL.</th>
                <th className="px-2 py-2">EJE °</th>
                <th className="px-2 py-2">A.V.</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['OD', od, setOdField, 'od_eje'],
                ['OI', oi, setOiField, 'oi_eje']
              ].map(([ojo, med, set, ejeKey]) => (
                <tr key={ojo} className="border-t border-gray-50">
                  <td className="px-3 py-1.5">
                    <span className={`text-xs font-bold ${ojo === 'OD' ? 'text-blue-700' : 'text-purple-700'}`}>
                      {ojo}
                    </span>
                  </td>
                  <td className="px-1 py-1">
                    <EsfInput value={med.esf} onChange={e => set('esf', e.target.value)} />
                  </td>
                  <td className="px-1 py-1">
                    <NumInput value={med.cil} onChange={e => {
                      set('cil', e.target.value)
                      setErrors(prev => { const n = { ...prev }; delete n[ejeKey]; return n })
                    }} />
                  </td>
                  <td className="px-1 py-1">
                    <EjeInput
                      value={med.eje}
                      onChange={e => {
                        set('eje', e.target.value)
                        setErrors(prev => { const n = { ...prev }; delete n[ejeKey]; return n })
                      }}
                      required={ejeRequerido(med)}
                      error={!!errors[ejeKey]}
                    />
                    {ejeRequerido(med) && med.eje === '' && !errors[ejeKey] && (
                      <p className="text-xs text-orange-500 text-center mt-0.5">requerido</p>
                    )}
                    {errors[ejeKey] && (
                      <p className="text-xs text-red-500 text-center mt-0.5 flex items-center justify-center gap-1">
                        <AlertCircle size={10} /> {errors[ejeKey]}
                      </p>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <TextInput value={med.av} onChange={e => set('av', e.target.value)} placeholder="20/20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* DIP + ADD */}
          <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">DIP Lejos (mm)</label>
              <input
                type="text"
                inputMode="decimal"
                value={dip}
                onChange={e => setDip(e.target.value)}
                placeholder="65"
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dipCerca !== '' && (
                <span className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                  DIP Cerca: <strong>{dipCerca} mm</strong>
                  <span className="text-gray-400 ml-1">(−2mm)</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Adición ADD</label>
              <input
                type="text"
                inputMode="decimal"
                value={add}
                onChange={e => setAdd(e.target.value)}
                placeholder="+1.00"
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {tieneAdd && (
                <span className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg">
                  ↓ Visión cercana activada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Visión Cercana */}
        {tieneAdd && (
          <div className="px-5 pt-3 pb-4 border-t border-purple-100 bg-purple-50/40">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide block mb-3">
              Visión Cercana
            </span>
            <table className="w-full">
              <thead>
                <tr className="bg-purple-600 text-white text-xs">
                  <th className="px-3 py-2 text-left w-12 rounded-tl-lg"></th>
                  <th className="px-2 py-2">ADD</th>
                  <th className="px-2 py-2">DIP Cerca</th>
                  <th className="px-2 py-2">A.V. Cerca</th>
                </tr>
              </thead>
              <tbody>
                {[['OD', od, setOdField], ['OI', oi, setOiField]].map(([ojo, med, set]) => (
                  <tr key={ojo} className="border-t border-purple-100">
                    <td className="px-3 py-1.5">
                      <span className={`text-xs font-bold ${ojo === 'OD' ? 'text-blue-700' : 'text-purple-700'}`}>
                        {ojo}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-sm font-medium text-purple-700">
                      +{parseFloat(add).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-center text-sm font-medium text-gray-700">
                      {dipCerca !== '' ? `${dipCerca} mm` : '—'}
                    </td>
                    <td className="px-1 py-1">
                      <TextInput value={med.cerca_av} onChange={e => set('cerca_av', e.target.value)} placeholder="J1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">
              * DIP cerca = DIP lejos − 2mm · ADD igual para ambos ojos
            </p>
          </div>
        )}
      </div>

      {/* Recomendaciones y próxima cita */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Recomendaciones para la vendedora</label>
          <textarea value={recomendaciones} onChange={e => setRecom(e.target.value)} rows={3}
            placeholder="Ej: recomendar lente antireflex, alto índice por la graduación, etc."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Próxima cita</label>
          <select value={proximaCita} onChange={e => setProximaCita(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">— Sin cita programada —</option>
            <option value="3m">3 meses</option>
            <option value="6m">6 meses</option>
            <option value="1a">1 año</option>
          </select>
        </div>
      </div>

      {/* Errores */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">
            Corrige los errores antes de finalizar: el eje es obligatorio cuando hay cilindro.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pb-8">
        <button onClick={() => navigate(`/pacientes/${id}`)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={() => handleSave('borrador')} disabled={saving}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          Guardar borrador
        </button>
        <button onClick={() => handleSave('finalizado')} disabled={saving}
          className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-black bg-yellow-400 rounded-lg hover:bg-yellow-500 disabled:opacity-50">
          <Save size={15} />
          {saving ? 'Guardando...' : 'Finalizar examen'}
        </button>
      </div>
    </div>
  )
}
