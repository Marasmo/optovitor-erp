import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, Stethoscope, Calendar, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoBadge = {
  borrador:   'bg-yellow-50 text-yellow-700',
  finalizado: 'bg-green-50 text-green-700',
  anulado:    'bg-red-50 text-red-700',
}

const tipoLabel = {
  completo:     'Completo',
  control:      'Control',
  lensometria:  'Lensometría',
  rapido:       'Rápido',
}

export default function ExamenesPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')

  useEffect(() => { fetchExams() }, [])

  async function fetchExams() {
    setLoading(true)
    const { data, error } = await supabase
      .from('eye_exams')
      .select('*, patients(id, nombres, apellidos, dni), prescriptions(id)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (!error) setExams(data || [])
    setLoading(false)
  }

  const filtered = exams.filter(e => {
    const nombreCompleto = `${e.patients?.nombres || ''} ${e.patients?.apellidos || ''}`.toLowerCase()
    const dni = e.patients?.dni || ''
    const matchQuery = query === '' ||
      nombreCompleto.includes(query.toLowerCase()) ||
      dni.includes(query)
    const matchEstado = filtroEstado === '' || e.estado === filtroEstado
    const matchFecha = filtroFecha === '' || e.fecha === filtroFecha
    return matchQuery && matchEstado && matchFecha
  })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Stethoscope size={20} className="text-amber-600" />
          Exámenes
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {filtered.length} de {exams.length} exámenes
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por paciente o DNI..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="finalizado">Finalizado</option>
          <option value="anulado">Anulado</option>
        </select>
        <input
          type="date"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {(query || filtroEstado || filtroFecha) && (
          <button
            onClick={() => { setQuery(''); setFiltroEstado(''); setFiltroFecha('') }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Cargando exámenes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Stethoscope size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No se encontraron exámenes</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(exam => (
              <div
                key={exam.id}
                onClick={() => navigate(`/pacientes/${exam.patients?.id}/examen/${exam.id}/detalle`)}
                className="px-5 py-4 hover:bg-amber-50/50 cursor-pointer transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {exam.patients?.apellidos}, {exam.patients?.nombres}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={11} />
                        {format(new Date(exam.fecha), 'dd MMM yyyy', { locale: es })}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{tipoLabel[exam.tipo_examen] || exam.tipo_examen}</span>
                      {exam.patients?.dni && (
                        <>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">DNI {exam.patients.dni}</span>
                        </>
                      )}
                      {exam.prescriptions?.length > 0 && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          · <FileText size={10} /> Receta
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${estadoBadge[exam.estado]}`}>
                  {exam.estado}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
