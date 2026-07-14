import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Trash2, Calendar, ShoppingCart, Wallet, Plus, X, Ban, Package, Printer } from 'lucide-react'
import VentaPrint from '../components/optica/prescriptions/VentaPrint'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoBadge = {
  pendiente: 'bg-gray-100 text-gray-500',
  parcial:   'bg-amber-50 text-amber-700',
  pagada:    'bg-green-50 text-green-700',
  anulada:   'bg-red-50 text-red-700',
}

const metodoLabel = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

const metodoColor = {
  efectivo: 'bg-green-50 text-green-700',
  tarjeta: 'bg-blue-50 text-blue-700',
  yape: 'bg-purple-50 text-purple-700',
  plin: 'bg-cyan-50 text-cyan-700',
  transferencia: 'bg-indigo-50 text-indigo-700',
  otro: 'bg-gray-100 text-gray-600',
}

export default function VentaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [venta, setVenta] = useState(null)
  const [items, setItems] = useState([])
  const [pagos, setPagos] = useState([])
  const [patient, setPatient] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sede, setSede] = useState(null)
  const [vendedor, setVendedor] = useState(null)

  // Formulario de nuevo pago
  const [showPagoForm, setShowPagoForm] = useState(false)
  const [nuevoMetodo, setNuevoMetodo] = useState('efectivo')
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles(nombre)')
        .eq('id', user.id)
        .single()
      setIsAdmin(profile?.roles?.nombre === 'admin')
    }

    const { data: v } = await supabase
      .from('ventas')
      .select('*, patients(id, nombres, apellidos, dni, telefono)')
      .eq('id', id)
      .single()

    if (v) {
      setVenta(v)
      setPatient(v.patients)

      const [{ data: its }, { data: pgs }, { data: sedeData }, { data: vendedorData }] = await Promise.all([
        supabase.from('venta_items').select('*').eq('venta_id', id).order('created_at'),
        supabase.from('venta_pagos').select('*').eq('venta_id', id).order('created_at'),
        supabase.from('sedes').select('nombre, direccion, telefono').eq('id', v.sede_id).single(),
        supabase.from('profiles').select('nombres, apellidos').eq('id', v.vendedor_id).single(),
      ])
      setItems(its || [])
      setPagos(pgs || [])
      setSede(sedeData || null)
      setVendedor(vendedorData || null)
    }

    setLoading(false)
  }

  // Cuánto falta por pagar (en soles, calculado en el cliente)
  const totalPagado = pagos.filter(p => p.estado === 'confirmado').reduce((sum, p) => sum + Number(p.monto), 0)
  const saldoPendiente = venta ? Math.max(0, Number(venta.total) - totalPagado) : 0

  function abrirFormPago() {
    // Sugerir el saldo pendiente como monto por defecto
    setNuevoMonto(saldoPendiente > 0 ? saldoPendiente.toFixed(2) : '')
    setNuevoMetodo('efectivo')
    setShowPagoForm(true)
  }

async function handleAgregarPago() {
  const monto = parseFloat(nuevoMonto)
  if (isNaN(monto) || monto <= 0) {
    alert('Ingresa un monto válido')
    return
  }

  // Calcular ANTES del await
  const esPrimerPago = pagos.filter(p => p.estado === 'confirmado').length === 0

  setSavingPago(true)
  try {
    const { error } = await supabase.from('venta_pagos').insert({
      venta_id: id,
      metodo_pago: nuevoMetodo,
      monto_centimos: Math.round(monto * 100),
    })
    if (error) throw error

    // Si es el PRIMER pago → crear trabajo en Dashboard Kanban
    if (esPrimerPago && patient) {
      const { data: { user } } = await supabase.auth.getUser()
      // Leer directo de Supabase para evitar estado desactualizado
const { data: ventaFresh } = await supabase
  .from('ventas')
  .select('es_pedido_especial')
  .eq('id', id)
  .single()

const esPedidoEspecial = ventaFresh?.es_pedido_especial === true
      const now = new Date()
      const dia = String(now.getDate()).padStart(2, '0')
      const mes = String(now.getMonth() + 1).padStart(2, '0')
      const año = String(now.getFullYear()).slice(-2)
      const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')
      const trabajoId = `OV-${dia}${mes}${año}-${rand}`

      await supabase.from('trabajos').insert({
        id: trabajoId,
        cliente: `${patient.apellidos}, ${patient.nombres}`,
        estado: esPedidoEspecial ? 'solicitado' : 'produccion',
        tipo: esPedidoEspecial ? 'especial' : 'regular',
        creado_por: user.id,
        venta_id: id,
        activo: true,
        fecha_display: new Date().toLocaleDateString('es-PE'),
      })
    }

    setShowPagoForm(false)
    await fetchData()
  } catch (err) {
    alert('Error al registrar el pago: ' + err.message)
  }
  setSavingPago(false)
}

  async function handleEliminarPago(pagoId) {
    if (!window.confirm('¿Eliminar este pago?')) return
    try {
      const { error } = await supabase.from('venta_pagos').delete().eq('id', pagoId)
      if (error) throw error
      await fetchData()
    } catch (err) {
      alert('Error al eliminar el pago: ' + err.message)
    }
  }

  function handlePrint() {
    window.print()
  }

  async function handleDeleteVenta() {
    if (!window.confirm('¿Seguro que deseas eliminar esta venta? Esta acción no se puede deshacer.')) return
    try {
      await supabase.from('venta_pagos').delete().eq('venta_id', id)
      await supabase.from('venta_items').delete().eq('venta_id', id)
      const { error } = await supabase.from('ventas').delete().eq('id', id)
      if (error) throw error
      navigate('/ventas')
    } catch (err) {
      alert('Error al eliminar la venta: ' + err.message)
    }
  }

  // Cancela la venta y devuelve cualquier adelanto registrado.
  // La función SQL cancelar_venta() marca la venta como 'anulada' y todos
  // sus venta_pagos como 'devuelto' (no se eliminan, quedan en el historial
  // pero ya no cuentan para los totales de caja).
  async function handleCancelarVenta() {
    const mensaje = totalPagado > 0
      ? `Esta venta tiene un adelanto de S/ ${totalPagado.toFixed(2)} registrado.\n\nAl cancelar, este monto se marcará como DEVUELTO al paciente y ya no contará en el cierre de caja.\n\n¿Confirmas la cancelación?`
      : '¿Seguro que deseas cancelar esta venta?'

    if (!window.confirm(mensaje)) return

    try {
      const { error } = await supabase.rpc('cancelar_venta', { p_venta_id: id })
      if (error) throw error
      await fetchData()
    } catch (err) {
      alert('Error al cancelar la venta: ' + err.message)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando venta...
    </div>
  )

  if (!venta) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Venta no encontrada
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ventas')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Detalle de venta</h1>
          {patient && (
            <p className="text-xs text-gray-400 mt-0.5">
              {patient.apellidos}, {patient.nombres}
              {patient.dni && ` · DNI ${patient.dni}`}
            </p>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600"
        >
          <Printer size={15} /> Imprimir
        </button>
        {isAdmin && venta.estado !== 'anulada' && (
          <button
            onClick={handleCancelarVenta}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50"
          >
            <Ban size={15} /> Cancelar venta
          </button>
        )}
        {isAdmin && (
          <button
            onClick={handleDeleteVenta}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={15} /> Eliminar
          </button>
        )}
      </div>

      {/* Info general */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={14} className="text-gray-400" />
              {format(new Date(venta.fecha + 'T00:00:00'), "dd 'de' MMMM yyyy", { locale: es })}
            </div>
            {venta.es_pedido_especial && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-medium">
                <Package size={12} /> Pedido especial
              </span>
            )}
            {venta.notas && (
              <p className="text-sm text-gray-500">{venta.notas}</p>
            )}
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${estadoBadge[venta.estado]}`}>
            {venta.estado}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            Detalle ({items.length})
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-50">
              <th className="text-left px-5 py-2 font-medium">Descripción</th>
              <th className="text-center px-2 py-2 font-medium w-16">Cant.</th>
              <th className="text-right px-2 py-2 font-medium w-32">P. Unit.</th>
              <th className="text-right px-5 py-2 font-medium w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-2.5 text-sm text-gray-700">{it.descripcion}</td>
                <td className="px-2 py-2.5 text-sm text-center text-gray-500">{Number(it.cantidad)}</td>
                <td className="px-2 py-2.5 text-sm text-right text-gray-500">
                  S/ {Number(it.precio_unitario).toFixed(2)}
                  {Number(it.descuento_centimos) > 0 && (
                    <span className="block text-[10px] text-green-600">
                      − S/ {(Number(it.descuento_centimos) / 100).toFixed(2)} dsto.
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-sm text-right font-medium text-gray-700 whitespace-nowrap">S/ {Number(it.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="px-5 py-4 bg-gray-50/60 flex justify-end">
          <div className="flex justify-between w-48 text-base font-bold">
            <span className="text-gray-700">Total</span>
            <span className="text-amber-700">S/ {Number(venta.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Wallet size={14} className="text-gray-400" />
            Pagos ({pagos.length})
          </h3>
          {venta.estado !== 'anulada' && saldoPendiente > 0 && !showPagoForm && (
            <button
              onClick={abrirFormPago}
              className="flex items-center gap-1.5 text-xs text-amber-700 hover:underline"
            >
              <Plus size={13} /> Registrar pago
            </button>
          )}
        </div>

        {pagos.length === 0 && !showPagoForm ? (
          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
            <Wallet size={28} className="mb-2 opacity-30" />
            <p className="text-sm">Sin pagos registrados</p>
            {venta.estado !== 'anulada' && (
              <button
                onClick={abrirFormPago}
                className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 hover:underline"
              >
                <Plus size={13} /> Registrar primer pago
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {pagos.map(p => {
              const devuelto = p.estado === 'devuelto'
              return (
                <div key={p.id} className={`flex items-center justify-between border rounded-xl px-4 py-2.5 ${
                  devuelto ? 'border-gray-100 bg-gray-50' : 'border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      devuelto ? 'bg-gray-100 text-gray-400' : metodoColor[p.metodo_pago]
                    }`}>
                      {metodoLabel[p.metodo_pago]}
                    </span>
                    {devuelto && (
                      <span className="text-xs text-gray-400 italic">Devuelto al paciente</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${devuelto ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      S/ {Number(p.monto).toFixed(2)}
                    </span>
                    {!devuelto && isAdmin && (
                      <button onClick={() => handleEliminarPago(p.id)} className="text-gray-300 hover:text-red-500">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Formulario nuevo pago */}
        {showPagoForm && (
          <div className="mt-3 border border-amber-100 bg-amber-50/40 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Método</label>
                <select
                  value={nuevoMetodo}
                  onChange={e => setNuevoMetodo(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {Object.entries(metodoLabel).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Monto (S/)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={nuevoMonto}
                  onChange={e => setNuevoMonto(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPagoForm(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarPago}
                disabled={savingPago}
                className="px-4 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {savingPago ? 'Guardando...' : 'Guardar pago'}
              </button>
            </div>
          </div>
        )}

        {/* Resumen de saldo */}
        {pagos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-sm">
            <span className="text-gray-400">Total pagado</span>
            <span className="font-medium text-gray-700">S/ {totalPagado.toFixed(2)}</span>
          </div>
        )}
        {saldoPendiente > 0 && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-amber-600">Saldo pendiente</span>
            <span className="font-bold text-amber-700">S/ {saldoPendiente.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Acciones extra */}
      <div className="flex justify-center pb-6 no-print">
        <button
          onClick={() => navigate('/ventas')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ShoppingCart size={15} /> Ver todas las ventas
        </button>
      </div>

      {/* Ticket de impresión — el CSS interno de VentaPrint (@media print)
          oculta el resto de la página y muestra solo el ticket al imprimir.
          En pantalla normal queda colapsado con height:0 + overflow:hidden,
          que es más confiable que position:absolute para @media print. */}
      <div className="print-ticket-wrapper" style={{ height: 0, overflow: 'hidden' }}>
        <VentaPrint
          sede={sede || {}}
          patient={patient || {}}
          venta={venta}
          items={items}
          pagos={pagos.filter(p => p.estado === 'confirmado')}
          atendidoPor={vendedor || {}}
        />
      </div>

    </div>
  )
}
