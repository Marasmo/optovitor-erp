import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingCart, Clock, Receipt, Lock, AlertCircle, Package } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const metodoIcon = {
  efectivo: '💵',
  tarjeta: '💳',
  yape: '📱',
  plin: '📲',
  transferencia: '🏦',
  otro: '💰',
}

// Fecha de "hoy" en zona horaria de Perú (UTC-5). Mismo patrón que
// en VentasPage.jsx / ExamenPage.jsx / VentaFormPage.jsx / CierreCajaPage.jsx.
function fechaHoyPeru() {
  const ahora = new Date()
  const offsetPeru = -5 * 60
  const peruTime = new Date(ahora.getTime() + (offsetPeru - ahora.getTimezoneOffset()) * 60000)
  return peruTime.toISOString().split('T')[0]
}

const metodoLabel = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export default function HistorialCajaPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(fechaHoyPeru())
  const [sedeId, setSedeId] = useState(null)

  const [ventas, setVentas] = useState([])
  const [gastos, setGastos] = useState([])
  const [cierre, setCierre] = useState(null)

  useEffect(() => { init() }, [])
  useEffect(() => { if (sedeId) cargarDia() }, [fecha, sedeId])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id')
        .eq('id', user.id)
        .single()
      setSedeId(profile?.sede_id || null)
    }
  }

  async function cargarDia() {
    setLoading(true)

    const [{ data: v }, { data: g }, { data: c }] = await Promise.all([
      supabase
        .from('ventas')
        .select('*, patients(id, nombres, apellidos, dni, telefono), venta_pagos(monto, estado, metodo_pago)')
        .eq('sede_id', sedeId)
        .eq('fecha', fecha)
        .order('created_at', { ascending: true }),
      supabase
        .from('gastos')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('fecha', fecha)
        .order('created_at', { ascending: true }),
      supabase
        .from('cierres_caja')
        .select('*')
        .eq('sede_id', sedeId)
        .eq('fecha', fecha)
        .maybeSingle(),
    ])

    setVentas(v || [])
    setGastos(g || [])
    setCierre(c)
    setLoading(false)
  }

  // Saldo pendiente de una venta (solo pagos confirmados)
  function saldoPendiente(v) {
    const pagado = (v.venta_pagos || [])
      .filter(p => p.estado === 'confirmado')
      .reduce((sum, p) => sum + Number(p.monto), 0)
    return Math.max(0, Number(v.total) - pagado)
  }

  function totalPagadoConfirmado(v) {
    return (v.venta_pagos || [])
      .filter(p => p.estado === 'confirmado')
      .reduce((sum, p) => sum + Number(p.monto), 0)
  }

  const ventasActivas = ventas.filter(v => v.estado !== 'anulada')
  const ventasAnuladas = ventas.filter(v => v.estado === 'anulada')

  // Columna izquierda: TODAS las ventas del día (activas)
  // Columna derecha: las que quedaron con saldo pendiente (recojos pendientes)
  const pendientesDelDia = ventasActivas.filter(v => saldoPendiente(v) > 0)

  const totalVentasDia = ventasActivas.reduce((sum, v) => sum + Number(v.total), 0)
  const totalCobradoDia = ventasActivas.reduce((sum, v) => sum + totalPagadoConfirmado(v), 0)
  const totalGastosDia = gastos.reduce((sum, g) => sum + Number(g.monto_centimos), 0) / 100

  const cambiarDia = (delta) => {
    // Aritmética de fecha pura, sin pasar por la timezone local del
    // navegador — evita que este cálculo dependa de que el sistema
    // esté configurado exactamente en hora de Perú.
    const [y, m, d] = fecha.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + delta)
    setFecha(dt.toISOString().split('T')[0])
  }

  const esHoy = fecha === fechaHoyPeru()

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ventas')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Historial de caja</h1>
          <p className="text-xs text-gray-400 mt-0.5">Revisión por día — ventas y pendientes</p>
        </div>
      </div>

      {/* Selector de fecha */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
        <button onClick={() => cambiarDia(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800 capitalize">
            {format(new Date(fecha + 'T00:00:00'), "EEEE dd 'de' MMMM yyyy", { locale: es })}
          </p>
          {esHoy && <p className="text-xs text-amber-600">Hoy</p>}
        </div>
        <button
          onClick={() => cambiarDia(1)}
          disabled={esHoy}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Estado del cierre */}
      {cierre ? (
        <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-3 flex items-center gap-3">
          <Lock size={16} className="text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700">
              Caja cerrada {cierre.automatico ? '(automático)' : ''} — Total S/ {Number(cierre.total).toFixed(2)}
            </p>
            {cierre.gastos > 0 && (
              <p className="text-xs text-green-600">
                Efectivo neto (tras gastos): S/ {Number(cierre.efectivo_neto).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      ) : !loading && ventasActivas.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-amber-600" />
          <p className="text-sm text-amber-700">Este día aún no tiene caja cerrada</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          Cargando...
        </div>
      ) : ventasActivas.length === 0 && gastos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center text-center text-gray-400">
          <ShoppingCart size={32} className="mb-2 opacity-30" />
          <p className="text-sm">No hubo movimientos este día</p>
        </div>
      ) : (
        <>
          {/* Resumen rápido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Total vendido</p>
              <p className="text-lg font-bold text-gray-700">S/ {totalVentasDia.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Total cobrado</p>
              <p className="text-lg font-bold text-green-600">S/ {totalCobradoDia.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Gastos del día</p>
              <p className="text-lg font-bold text-red-500">S/ {totalGastosDia.toFixed(2)}</p>
            </div>
          </div>

          {/* Dos columnas: Ventas | Pendientes/Recojos */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Columna izquierda: Ventas del día */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-gray-50">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <ShoppingCart size={14} className="text-amber-600" />
                  Ventas del día ({ventasActivas.length})
                </h3>
              </div>
              {ventasActivas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin ventas este día</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                  {ventasActivas.map(v => {
                    const saldo = saldoPendiente(v)
                    return (
                      <div
                        key={v.id}
                        onClick={() => navigate(`/ventas/${v.id}`)}
                        className={`px-4 py-2.5 cursor-pointer transition-colors ${
                          v.es_pedido_especial ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                            {v.es_pedido_especial && <Package size={12} className="text-emerald-700 shrink-0" />}
                            {v.patients?.apellidos}, {v.patients?.nombres}
                          </p>
                          <span className="text-sm font-semibold text-gray-700 shrink-0">
                            S/ {Number(v.total).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            v.estado === 'pagada' ? 'bg-green-50 text-green-600' :
                            v.estado === 'parcial' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {v.estado}
                          </span>
                          {saldo > 0 && (
                            <span className="text-[10px] text-amber-600">Saldo S/ {saldo.toFixed(2)}</span>
                          )}
                          {v.es_pedido_especial && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                              Pedido especial
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Ventas anuladas, si hubo */}
              {ventasAnuladas.length > 0 && (
                <div className="border-t border-gray-50 px-4 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                    Anuladas ({ventasAnuladas.length})
                  </p>
                  {ventasAnuladas.map(v => (
                    <div key={v.id} onClick={() => navigate(`/ventas/${v.id}`)}
                      className="flex items-center justify-between py-1 cursor-pointer opacity-60 hover:opacity-100">
                      <span className="text-xs text-gray-400 line-through">
                        {v.patients?.apellidos}, {v.patients?.nombres}
                      </span>
                      <span className="text-xs text-gray-400 line-through">S/ {Number(v.total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Columna derecha: Pendientes / Recojos */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-gray-50">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Clock size={14} className="text-amber-600" />
                  Pendientes / Recojos ({pendientesDelDia.length})
                </h3>
              </div>
              {pendientesDelDia.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin saldos pendientes de este día</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                  {pendientesDelDia.map(v => {
                    const saldo = saldoPendiente(v)
                    const pagado = totalPagadoConfirmado(v)
                    return (
                      <div
                        key={v.id}
                        onClick={() => navigate(`/ventas/${v.id}`)}
                        className={`px-4 py-2.5 cursor-pointer transition-colors ${
                          v.es_pedido_especial ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                            {v.es_pedido_especial && <Package size={12} className="text-emerald-700 shrink-0" />}
                            {v.patients?.apellidos}, {v.patients?.nombres}
                          </p>
                          <span className="text-sm font-bold text-amber-700 shrink-0">
                            S/ {saldo.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            Total S/ {Number(v.total).toFixed(2)}
                          </span>
                          {pagado > 0 && (
                            <span className="text-[10px] text-green-600">
                              · Adelanto S/ {pagado.toFixed(2)}
                            </span>
                          )}
                          {v.es_pedido_especial && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                              Pedido especial
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

          {/* Gastos del día */}
          {gastos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-3">
                <Receipt size={14} className="text-gray-400" />
                Gastos del día ({gastos.length})
              </h3>
              <div className="space-y-1.5">
                {gastos.map(g => (
                  <div key={g.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{g.concepto}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{metodoIcon[g.metodo_pago]} {metodoLabel[g.metodo_pago]}</span>
                      <span className="font-medium text-gray-700">S/ {(Number(g.monto_centimos) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-gray-50">
                <span className="text-gray-700">Total gastos</span>
                <span className="text-red-500">S/ {totalGastosDia.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Cierre detallado por método de pago */}
          {cierre && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                Detalle del cierre por método de pago
              </h3>
              <div className="space-y-2">
                {Object.entries(metodoLabel).map(([key, label]) => {
                  const monto = Number(cierre[key])
                  if (monto === 0) return null
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-2">
                        <span>{metodoIcon[key]}</span> {label}
                      </span>
                      <span className="font-medium text-gray-700">S/ {monto.toFixed(2)}</span>
                    </div>
                  )
                })}
                {cierre.notas && (
                  <p className="text-xs text-gray-400 pt-2 border-t border-gray-50 mt-2">📝 {cierre.notas}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
