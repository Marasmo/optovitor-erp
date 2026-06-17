import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, FileText, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoBadge = {
  vigente: 'bg-green-50 text-green-700',
  vencida: 'bg-amber-50 text-amber-700',
  anulada: 'bg-red-50 text-red-700',
  usada:   'bg-gray-100 text-gray-500',
}

const estadoIcon = {
  vigente: CheckCircle2,
  vencida: AlertTriangle,
  anulada: AlertTriangle,
  usada:   CheckCircle2,
}

// -0.5 → "-0.50" · -1 → "-1.00" · +1.25 → "+1.25"
function formatDiopt(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = parseFloat(value)
  if (isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

export default function RecetasPage() {
  const navigate = useNavigate()
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => { fetchRecetas() }, [])

  async function fetchRecetas() {
    setLoading(true)

    // Calcular vencidas dinámicamente al traer los datos
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, patients(id, nombres, apellidos, dni), eye_exams(id)')
      .order('fecha_emision', { ascending: false })
      .limit(200)

    if (!error) setRecetas(data || [])
    setLoading(false)
  }

  function estadoReal(rx) {
    if (rx.estado === 'anulada' || rx.estado === 'usada') return rx.estado
    if (rx.fecha_vence && new Date(rx.fecha_vence) < new Date()) return 'vencida'
    return 'vigente'
  }

  const filtered = recetas.filter(rx => {
    const nombreCompleto = `${rx.patients?.nombres || ''} ${rx.patients?.apellidos || ''}`.toLowerCase()
    const dni = rx.patients?.dni || ''
    const matchQuery = query === '' ||
      nombreCompleto.includes(query.toLowerCase()) ||
      dni.includes(query)
    const matchEstado = filtroEstado === '' || estadoReal(rx) === filtroEstado
    return matchQuery && matchEstado
  })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText size={20} className="text-amber-600" />
          Recetas
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {filtered.length} de {recetas.length} recetas emitidas
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
          <option value="vigente">Vigente</option>
          <option value="vencida">Vencida</option>
          <option value="anulada">Anulada</option>
          <option value="usada">Usada</option>
        </select>
        {(query || filtroEstado) && (
          <button
            onClick={() => { setQuery(''); setFiltroEstado('') }}
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
            Cargando recetas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <FileText size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No se encontraron recetas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(rx => {
              const estado = estadoReal(rx)
              const Icon = estadoIcon[estado]
              return (
                <div
                  key={rx.id}
                  onClick={() => navigate(`/pacientes/${rx.patients?.id}/examen/${rx.eye_exams?.id}/receta`)}
                  className="px-5 py-4 hover:bg-amber-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {rx.patients?.apellidos}, {rx.patients?.nombres}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar size={11} />
                            Emitida {format(new Date(rx.fecha_emision + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                          </span>
                          {rx.fecha_vence && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">
                                Vence {format(new Date(rx.fecha_vence + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                              </span>
                            </>
                          )}
                          {rx.patients?.dni && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">DNI {rx.patients.dni}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${estadoBadge[estado]}`}>
                      <Icon size={11} />
                      {estado}
                    </span>
                  </div>

                  {/* Resumen de graduación */}
                  <div className="mt-2 pl-12 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      <span className="font-semibold text-blue-700">OD</span>{' '}
                      {formatDiopt(rx.od_esfera)} / {formatDiopt(rx.od_cilindro)}
                      {rx.od_eje ? ` × ${rx.od_eje}°` : ''}
                    </span>
                    <span>
                      <span className="font-semibold text-purple-700">OI</span>{' '}
                      {formatDiopt(rx.oi_esfera)} / {formatDiopt(rx.oi_cilindro)}
                      {rx.oi_eje ? ` × ${rx.oi_eje}°` : ''}
                    </span>
                    {rx.od_adicion && (
                      <span className="text-gray-400">
                        ADD {formatDiopt(rx.od_adicion)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
