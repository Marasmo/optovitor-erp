import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, History, ShoppingCart, Wallet, X, Ban, Trash2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const accionConfig = {
  venta_creada:    { label: 'Venta creada',    icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
  pago_registrado: { label: 'Pago registrado', icon: Wallet,       color: 'bg-green-50 text-green-600' },
  pago_eliminado:  { label: 'Pago eliminado',  icon: X,            color: 'bg-red-50 text-red-500' },
  venta_cancelada: { label: 'Venta cancelada', icon: Ban,          color: 'bg-amber-50 text-amber-600' },
  venta_eliminada: { label: 'Venta eliminada', icon: Trash2,       color: 'bg-red-50 text-red-600' },
}

const metodoLabel = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export default function BitacoraPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState([])
  const [usuarios, setUsuarios] = useState({})

  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)

    const { data, error } = await supabase
      .from('bitacora_ventas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (!error) setRegistros(data || [])

    // Cargar nombres de usuarios involucrados
    const ids = [...new Set((data || []).map(r => r.usuario_id).filter(Boolean))]
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nombres, apellidos')
        .in('id', ids)

      const map = {}
      ;(profiles || []).forEach(p => {
        map[p.id] = `${p.nombres || ''} ${p.apellidos || ''}`.trim() || 'Usuario'
      })
      setUsuarios(map)
    }

    setLoading(false)
  }

  const filtered = registros.filter(r => {
    const matchAccion = filtroAccion === '' || r.accion === filtroAccion
    const matchUsuario = filtroUsuario === '' || r.usuario_id === filtroUsuario
    const matchFecha = filtroFecha === '' || r.created_at.startsWith(filtroFecha)
    return matchAccion && matchUsuario && matchFecha
  })

  // Lista de usuarios para el filtro (solo los que aparecen en la bitácora)
  const usuariosFiltro = Object.entries(usuarios).sort((a, b) => a[1].localeCompare(b[1]))

  function renderDetalle(r) {
    const d = r.detalle || {}
    switch (r.accion) {
      case 'venta_creada':
        return `Cliente: ${d.paciente || '—'}`
      case 'pago_registrado':
        return `${d.paciente || '—'} · ${metodoLabel[d.metodo_pago] || d.metodo_pago} · S/ ${Number(d.monto).toFixed(2)}`
      case 'pago_eliminado':
        return `${d.paciente || '—'} · ${metodoLabel[d.metodo_pago] || d.metodo_pago} · S/ ${Number(d.monto).toFixed(2)}`
      case 'venta_cancelada':
        return `${d.paciente || '—'} · Total S/ ${Number(d.total).toFixed(2)}`
      case 'venta_eliminada':
        return `Total S/ ${Number(d.total).toFixed(2)} · Fecha venta ${d.fecha_venta}`
      default:
        return JSON.stringify(d)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ventas')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <History size={20} className="text-amber-600" />
            Bitácora de actividad
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filtered.length} de {registros.length} registros — solo ventas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <select
          value={filtroAccion}
          onChange={e => setFiltroAccion(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white flex-1"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(accionConfig).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={filtroUsuario}
          onChange={e => setFiltroUsuario(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white flex-1"
        >
          <option value="">Todos los usuarios</option>
          {usuariosFiltro.map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
        <input
          type="date"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {(filtroAccion || filtroUsuario || filtroFecha) && (
          <button
            onClick={() => { setFiltroAccion(''); setFiltroUsuario(''); setFiltroFecha('') }}
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
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <History size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Sin registros</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(r => {
              const cfg = accionConfig[r.accion] || { label: r.accion, icon: History, color: 'bg-gray-100 text-gray-500' }
              const Icon = cfg.icon
              return (
                <div
                  key={r.id}
                  onClick={() => r.venta_id && navigate(`/ventas/${r.venta_id}`)}
                  className={`px-5 py-3 flex items-center gap-3 ${r.venta_id ? 'hover:bg-amber-50/50 cursor-pointer' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{cfg.label}</span>
                      <span className="text-xs text-gray-400">
                        {usuarios[r.usuario_id] || 'Sistema'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{renderDetalle(r)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <Calendar size={10} />
                      {format(new Date(r.created_at), 'dd MMM', { locale: es })}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(r.created_at), 'HH:mm', { locale: es })}
                    </p>
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
