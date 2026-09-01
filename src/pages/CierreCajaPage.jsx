import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Wallet, Lock, CheckCircle, AlertCircle, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const metodoLabel = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

const metodoIcon = {
  efectivo: '💵',
  tarjeta: '💳',
  yape: '📱',
  plin: '📲',
  transferencia: '🏦',
  otro: '💰',
}

export default function CierreCajaPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  const [sedeId, setSedeId] = useState(null)
  const [fecha] = useState(new Date().toISOString().split('T')[0])

  const [totales, setTotales] = useState(null)
  const [cierreExistente, setCierreExistente] = useState(null)
  const [notas, setNotas] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id')
        .eq('id', user.id)
        .single()
      setSedeId(profile?.sede_id || null)

      if (profile?.sede_id) {
        await cargarDatos(profile.sede_id)
      }
    }
    setLoading(false)
  }

  async function cargarDatos(sede) {
    // Verificar si ya existe un cierre para hoy
    const { data: cierre } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('sede_id', sede)
      .eq('fecha', fecha)
      .maybeSingle()

    if (cierre) {
      setCierreExistente(cierre)
      return
    }
    console.log('sede:', sede, 'fecha:', fecha)  // ← agrega aquí
    const { data, error } = await supabase
      .rpc('calcular_totales_dia', { p_sede_id: sede, p_fecha: fecha })
    console.log('data:', data, 'error:', error)  // ← y aquí
    // Calcular totales del día (función SQL)
    const { data, error } = await supabase
      .rpc('calcular_totales_dia', { p_sede_id: sede, p_fecha: fecha })

    if (!error && data && data.length > 0) {
      const t = data[0]
      setTotales({
        efectivo: t.efectivo_centimos / 100,
        tarjeta: t.tarjeta_centimos / 100,
        yape: t.yape_centimos / 100,
        plin: t.plin_centimos / 100,
        transferencia: t.transferencia_centimos / 100,
        otro: t.otro_centimos / 100,
        total: t.total_centimos / 100,
        gastos: t.gastos_centimos / 100,
        efectivoNeto: t.efectivo_neto_centimos / 100,
        cantidad_ventas: t.cantidad_ventas,
        // céntimos para guardar luego
        _centimos: {
          efectivo: t.efectivo_centimos,
          tarjeta: t.tarjeta_centimos,
          yape: t.yape_centimos,
          plin: t.plin_centimos,
          transferencia: t.transferencia_centimos,
          otro: t.otro_centimos,
          total: t.total_centimos,
          gastos: t.gastos_centimos,
          efectivoNeto: t.efectivo_neto_centimos,
        }
      })
    }
  }

  async function handleCerrarCaja() {
    if (!window.confirm(
      `¿Confirmas el cierre de caja de hoy (${format(new Date(fecha + 'T00:00:00'), "dd 'de' MMMM", { locale: es })})?\n\nEsta acción registra el resumen del día y no se puede deshacer fácilmente.`
    )) return

    setClosing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('cierres_caja')
        .insert({
          sede_id: sedeId,
          fecha,
          efectivo_centimos: totales._centimos.efectivo,
          tarjeta_centimos: totales._centimos.tarjeta,
          yape_centimos: totales._centimos.yape,
          plin_centimos: totales._centimos.plin,
          transferencia_centimos: totales._centimos.transferencia,
          otro_centimos: totales._centimos.otro,
          total_centimos: totales._centimos.total,
          gastos_centimos: totales._centimos.gastos,
          efectivo_neto_centimos: totales._centimos.efectivoNeto,
          cantidad_ventas: totales.cantidad_ventas,
          cerrado_por: user.id,
          notas: notas || null,
        })
        .select()
        .single()

      if (error) throw error

      setCierreExistente(data)
      setTotales(null)
    } catch (err) {
      alert('Error al cerrar caja: ' + err.message)
    }
    setClosing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ventas')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Cierre de caja</h1>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Calendar size={12} />
            {format(new Date(fecha + 'T00:00:00'), "EEEE dd 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Ya cerrado */}
      {cierreExistente ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="bg-green-50 px-5 py-4 flex items-center gap-3 border-b border-green-100">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-700">Caja cerrada</p>
              <p className="text-xs text-green-600">
                Cerrada por {format(new Date(cierreExistente.created_at), 'HH:mm', { locale: es })} hrs
              </p>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {Object.entries(metodoLabel).map(([key, label]) => {
              const monto = Number(cierreExistente[key])
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
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
              <span className="text-base font-bold text-gray-800">Total del día</span>
              <span className="text-xl font-bold text-amber-700">S/ {Number(cierreExistente.total).toFixed(2)}</span>
            </div>
            {Number(cierreExistente.gastos) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-500">− Gastos del día</span>
                <span className="text-red-500">− S/ {Number(cierreExistente.gastos).toFixed(2)}</span>
              </div>
            )}
            {Number(cierreExistente.gastos) > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className="text-sm font-semibold text-gray-700">Efectivo neto en caja</span>
                <span className="text-sm font-bold text-amber-700">S/ {Number(cierreExistente.efectivo_neto).toFixed(2)}</span>
              </div>
            )}
            <p className="text-xs text-gray-400 pt-1">
              {cierreExistente.cantidad_ventas} venta(s) registradas
              {cierreExistente.automatico && ' · Cierre automático'}
            </p>
            {cierreExistente.notas && (
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-50 mt-2">
                📝 {cierreExistente.notas}
              </p>
            )}
          </div>
        </div>
      ) : !totales || totales.cantidad_ventas === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center text-center">
          <Wallet size={32} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No hay ventas registradas hoy todavía</p>
          <p className="text-xs text-gray-400 mt-1">El cierre de caja estará disponible cuando haya al menos una venta con pago registrado</p>
        </div>
      ) : (
        <>
          {/* Preview de totales */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Efectivo y pagos esperados — {totales.cantidad_ventas} venta(s)
              </h3>
            </div>
            <div className="p-5 pt-3 space-y-2">
              {Object.entries(metodoLabel).map(([key, label]) => {
                const monto = totales[key]
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
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
                <span className="text-base font-bold text-gray-800">Total del día</span>
                <span className="text-xl font-bold text-amber-700">S/ {totales.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Destacado: efectivo neto en caja (después de gastos) */}
          {totales.efectivo > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-700">Efectivo cobrado</span>
                <span className="text-sm font-medium text-amber-700">S/ {totales.efectivo.toFixed(2)}</span>
              </div>
              {totales.gastos > 0 && (
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-100">
                  <span className="text-sm text-red-500">− Gastos del día</span>
                  <span className="text-sm font-medium text-red-500">− S/ {totales.gastos.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💵</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Efectivo esperado en caja</p>
                    <p className="text-xs text-amber-600 mt-0.5">Verifica este monto contra el dinero físico del cajón</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-700">S/ {totales.efectivoNeto.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Notas del cierre (opcional)
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones, incidencias del día..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Aviso */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-600 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>
              Al cerrar caja se guarda un registro permanente de estos totales. Las ventas del día siguen siendo editables, pero el cierre ya guardado no se actualiza automáticamente.
            </span>
          </div>

          {/* Botón cerrar */}
          <button
            onClick={handleCerrarCaja}
            disabled={closing}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50"
          >
            <Lock size={16} />
            {closing ? 'Cerrando caja...' : 'Cerrar caja del día'}
          </button>
        </>
      )}

    </div>
  )
}
