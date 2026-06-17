import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, Calendar, AlertCircle, Clock, Phone, Package } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TrabajosPendientesPage() {
  const navigate = useNavigate()
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => { fetchVentas() }, [])

  async function fetchVentas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ventas')
      .select('*, patients(id, nombres, apellidos, dni, telefono), venta_pagos(monto)')
      .neq('estado', 'anulada')
      .order('fecha', { ascending: true }) // más antiguos primero
      .limit(300)

    if (!error) setVentas(data || [])
    setLoading(false)
  }

  // Saldo pendiente = total - suma de pagos registrados
  function saldoPendiente(v) {
    const pagado = (v.venta_pagos || []).reduce((sum, p) => sum + Number(p.monto), 0)
    return Math.max(0, Number(v.total) - pagado)
  }

  function totalPagado(v) {
    return (v.venta_pagos || []).reduce((sum, p) => sum + Number(p.monto), 0)
  }

  // Trabajos pendientes: ventas (no anuladas) con saldo > 0
  // Esto incluye:
  //  - estado 'pendiente' (sin ningún pago registrado)
  //  - estado 'parcial' (pago parcial, falta saldo)
  const pendientes = ventas.filter(v => saldoPendiente(v) > 0)

  const filtered = pendientes.filter(v => {
    const nombreCompleto = `${v.patients?.nombres || ''} ${v.patients?.apellidos || ''}`.toLowerCase()
    const dni = v.patients?.dni || ''
    return query === '' ||
      nombreCompleto.includes(query.toLowerCase()) ||
      dni.includes(query)
  })

  // Total general por cobrar
  const totalPorCobrar = filtered.reduce((sum, v) => sum + saldoPendiente(v), 0)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock size={20} className="text-amber-600" />
          Trabajos pendientes
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {filtered.length} venta(s) con saldo pendiente
        </p>
      </div>

      {/* Resumen total por cobrar */}
      {!loading && filtered.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-amber-100">
              <AlertCircle size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Total por cobrar</p>
              <p className="text-xs text-amber-600 mt-0.5">Suma de saldos pendientes de todas las ventas</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-amber-700">S/ {totalPorCobrar.toFixed(2)}</span>
        </div>
      )}

      {/* Búsqueda */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por paciente o DNI..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Clock size={32} className="mb-2 opacity-30" />
            <p className="text-sm">
              {query ? 'No se encontraron resultados' : '¡Todo al día! No hay saldos pendientes'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(v => {
              const saldo = saldoPendiente(v)
              const pagado = totalPagado(v)
              const sinPagos = pagado === 0

              return (
                <div
                  key={v.id}
                  onClick={() => navigate(`/ventas/${v.id}`)}
                  className={`px-5 py-4 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                    v.es_pedido_especial ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-amber-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      v.es_pedido_especial ? 'bg-emerald-100' : 'bg-amber-50'
                    }`}>
                      {v.es_pedido_especial
                        ? <Package size={16} className="text-emerald-700" />
                        : <AlertCircle size={16} className="text-amber-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {v.patients?.apellidos}, {v.patients?.nombres}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar size={11} />
                          {format(new Date(v.fecha + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                        </span>
                        {v.patients?.telefono && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone size={11} /> {v.patients.telefono}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          sinPagos ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'
                        }`}>
                          {sinPagos ? 'Sin adelanto' : `Adelanto S/ ${pagado.toFixed(2)}`}
                        </span>
                        {v.es_pedido_especial && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                            Pedido especial
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Total: S/ {Number(v.total).toFixed(2)}</p>
                    <p className="text-base font-bold text-amber-700">S/ {saldo.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">por cobrar</p>
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
