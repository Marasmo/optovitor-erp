import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, ShoppingCart, Calendar, Plus, Wallet, Receipt, X, History, Package, Download, BarChart2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'

const estadoBadge = {
  pendiente: 'bg-gray-100 text-gray-500',
  parcial:   'bg-amber-50 text-amber-700',
  pagada:    'bg-green-50 text-green-700',
  anulada:   'bg-red-50 text-red-700',
}

const metodoLabel = {
  efectivo:      'Efectivo',
  tarjeta:       'Tarjeta',
  yape:          'Yape',
  plin:          'Plin',
  transferencia: 'Transferencia',
  otro:          'Otro',
}

const ahora = new Date()
const offsetPeru = -5 * 60
const peruTime = new Date(ahora.getTime() + (offsetPeru - ahora.getTimezoneOffset()) * 60000)
const hoy = peruTime.toISOString().split('T')[0]
const mesActual = hoy.slice(0, 7)

export default function VentasPage() {
  const navigate = useNavigate()
  const [ventas, setVentas]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [query, setQuery]             = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [isAdmin, setIsAdmin]         = useState(false)
  const [sedeId, setSedeId]           = useState(null)

  // Filtros de fecha
  const [modoFecha, setModoFecha]     = useState('dia') // 'dia' | 'mes' | 'rango'
  const [filtroDia, setFiltroDia]     = useState(hoy)
  const [filtroMes, setFiltroMes]     = useState(mesActual)
  const [filtroDesde, setFiltroDesde] = useState(hoy)
  const [filtroHasta, setFiltroHasta] = useState(hoy)

  // Gastos del día
  const [gastosHoy, setGastosHoy]         = useState([])
  const [showGastoForm, setShowGastoForm] = useState(false)
  const [nuevoConcepto, setNuevoConcepto] = useState('')
  const [nuevoMonto, setNuevoMonto]       = useState('')
  const [nuevoMetodo, setNuevoMetodo]     = useState('efectivo')
  const [savingGasto, setSavingGasto]     = useState(false)

  useEffect(() => { init() }, [])
  useEffect(() => { fetchVentas() }, [modoFecha, filtroDia, filtroMes, filtroDesde, filtroHasta])

  async function init() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id, roles(nombre)')
        .eq('id', user.id)
        .single()
      setIsAdmin(profile?.roles?.nombre === 'admin')
      setSedeId(profile?.sede_id || null)
    }
    await fetchVentas()
    setLoading(false)
  }

  function getFechaFiltro() {
    if (modoFecha === 'dia') return { desde: filtroDia, hasta: filtroDia }
    if (modoFecha === 'mes') return { desde: `${filtroMes}-01`, hasta: `${filtroMes}-31` }
    return { desde: filtroDesde, hasta: filtroHasta }
  }

  async function fetchVentas() {
    const { desde, hasta } = getFechaFiltro()
    const { data, error } = await supabase
      .from('ventas')
      .select('*, patients(id, nombres, apellidos, dni, telefono)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (!error) setVentas(data || [])

    // Gastos de hoy
    const { data: gastosData } = await supabase
      .from('gastos')
      .select('*')
      .eq('fecha', hoy)
      .order('created_at', { ascending: false })
    setGastosHoy(gastosData || [])
  }

  async function handleAgregarGasto() {
    const monto = parseFloat(nuevoMonto)
    if (!nuevoConcepto.trim()) { alert('Ingresa el concepto del gasto'); return }
    if (isNaN(monto) || monto <= 0) { alert('Ingresa un monto válido'); return }

    setSavingGasto(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('gastos').insert({
        sede_id:        sedeId,
        fecha: hoy,
        concepto:       nuevoConcepto.trim(),
        monto_centimos: Math.round(monto * 100),
        metodo_pago:    nuevoMetodo,
        registrado_por: user.id,
      })
      if (error) throw error
      setNuevoConcepto('')
      setNuevoMonto('')
      setNuevoMetodo('efectivo')
      setShowGastoForm(false)
      await fetchVentas()
    } catch (err) {
      alert('Error al registrar el gasto: ' + err.message)
    }
    setSavingGasto(false)
  }

  async function handleEliminarGasto(gastoId) {
    if (!window.confirm('¿Eliminar este gasto?')) return
    try {
      const { error } = await supabase.from('gastos').delete().eq('id', gastoId)
      if (error) throw error
      await fetchVentas()
    } catch (err) {
      alert('Error al eliminar el gasto: ' + err.message)
    }
  }

  function exportarExcel() {
    const datos = filtered.map(v => ({
      'Fecha':        v.fecha,
      'Paciente':     `${v.patients?.apellidos || ''}, ${v.patients?.nombres || ''}`,
      'DNI':          v.patients?.dni || '',
      'Teléfono':     v.patients?.telefono || '',
      'Total (S/)':   Number(v.total).toFixed(2),
      'Estado':       v.estado,
      'Tipo':         v.es_pedido_especial ? 'Pedido especial' : 'Regular',
    }))

    const resumen = [{
      'Fecha':       '',
      'Paciente':    '',
      'DNI':         '',
      'Teléfono':    '',
      'Total (S/)':  '',
      'Estado':      '',
      'Tipo':        '',
    }, {
      'Fecha':       'RESUMEN',
      'Paciente':    `Total ventas: ${filtered.length}`,
      'DNI':         '',
      'Teléfono':    '',
      'Total (S/)':  totalVentas.toFixed(2),
      'Estado':      `Pagadas: ${filtered.filter(v => v.estado === 'pagada').length}`,
      'Tipo':        `Especiales: ${filtered.filter(v => v.es_pedido_especial).length}`,
    }]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet([...datos, ...resumen])
    ws['!cols'] = [{wch:12},{wch:30},{wch:10},{wch:12},{wch:12},{wch:10},{wch:16}]
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

    const { desde, hasta } = getFechaFiltro()
    const nombre = desde === hasta
      ? `ventas-${desde}.xlsx`
      : `ventas-${desde}-al-${hasta}.xlsx`
    XLSX.writeFile(wb, nombre)
  }

  const filtered = ventas.filter(v => {
    const nombreCompleto = `${v.patients?.nombres || ''} ${v.patients?.apellidos || ''}`.toLowerCase()
    const dni = v.patients?.dni || ''
    const matchQuery  = query === '' || nombreCompleto.includes(query.toLowerCase()) || dni.includes(query)
    const matchEstado = filtroEstado === '' || v.estado === filtroEstado
    return matchQuery && matchEstado
  })

  const totalVentas   = filtered.reduce((s, v) => s + Number(v.total || 0), 0)
  const totalPagadas  = filtered.filter(v => v.estado === 'pagada').reduce((s, v) => s + Number(v.total || 0), 0)
const totalGastosHoy = gastosHoy.reduce((sum, g) => sum + Number(g.monto_centimos), 0) / 100

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-amber-600" />
            Ventas
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} ventas · S/ {totalVentas.toFixed(2)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => navigate('/ventas/historial-caja')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <History size={16} /> Historial de caja
            </button>
          )}
          {isAdmin && (
            <button onClick={() => navigate('/ventas/cierre-caja')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-200 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50">
              <Wallet size={16} /> Cerrar caja
            </button>
          )}
          <button onClick={() => navigate('/ventas/nueva')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">
            <Plus size={16} /> Nueva venta
          </button>
        </div>
      </div>

      {/* Panel de fechas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} className="text-amber-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Filtrar por fecha</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { id: 'dia', label: '📅 Por día' },
            { id: 'mes', label: '📆 Por mes' },
            { id: 'rango', label: '📊 Rango' },
          ].map(op => (
            <button key={op.id} onClick={() => setModoFecha(op.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                modoFecha === op.id
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
              }`}>
              {op.label}
            </button>
          ))}
        </div>

        {modoFecha === 'dia' && (
          <input type="date" value={filtroDia} onChange={e => setFiltroDia(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        )}
        {modoFecha === 'mes' && (
          <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        )}
        {modoFecha === 'rango' && (
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Desde</label>
              <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Hasta</label>
              <input type="date" value={filtroHasta} min={filtroDesde} onChange={e => setFiltroHasta(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        )}

        {/* Resumen rápido */}
        {filtered.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400">Total ventas</p>
              <p className="text-sm font-bold text-gray-800">S/ {totalVentas.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Solo pagadas</p>
              <p className="text-sm font-bold text-green-700">S/ {totalPagadas.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">N° ventas</p>
              <p className="text-sm font-bold text-amber-700">{filtered.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Gastos de hoy */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Receipt size={14} className="text-gray-400" />
            Gastos de hoy
          </h3>
          {!showGastoForm && (
            <button onClick={() => setShowGastoForm(true)}
              className="flex items-center gap-1.5 text-xs text-amber-700 hover:underline">
              <Plus size={13} /> Agregar gasto
            </button>
          )}
        </div>

        {gastosHoy.length === 0 && !showGastoForm ? (
          <p className="text-sm text-gray-400 py-3">Sin gastos registrados hoy</p>
        ) : (
          <div className="space-y-1.5 mt-2">
            {gastosHoy.map(g => (
              <div key={g.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600">{g.concepto}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 capitalize">{metodoLabel[g.metodo_pago]}</span>
                  <span className="font-medium text-gray-700">S/ {(Number(g.monto_centimos) / 100).toFixed(2)}</span>
                  <button onClick={() => handleEliminarGasto(g.id)} className="text-gray-300 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showGastoForm && (
          <div className="mt-3 border border-amber-100 bg-amber-50/40 rounded-xl p-4">
            <div className="mb-3">
              <label className="block text-[10px] text-gray-500 mb-1">Concepto</label>
              <input type="text" value={nuevoConcepto} onChange={e => setNuevoConcepto(e.target.value)}
                placeholder="Ej. Delivery, almuerzo, encomienda..."
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Monto (S/)</label>
                <input type="text" inputMode="decimal" value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Sale de</label>
                <select value={nuevoMetodo} onChange={e => setNuevoMetodo(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {Object.entries(metodoLabel).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowGastoForm(false); setNuevoConcepto(''); setNuevoMonto('') }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
              <button onClick={handleAgregarGasto} disabled={savingGasto}
                className="px-4 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {savingGasto ? 'Guardando...' : 'Guardar gasto'}
              </button>
            </div>
          </div>
        )}

        {gastosHoy.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-sm">
            <span className="text-gray-400">Total gastos de hoy</span>
            <span className="font-medium text-gray-700">S/ {totalGastosHoy.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por paciente o DNI..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagada">Pagada</option>
          <option value="anulada">Anulada</option>
        </select>
        {(query || filtroEstado) && (
          <button onClick={() => { setQuery(''); setFiltroEstado('') }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap">
            Limpiar
          </button>
        )}
        {/* Botón exportar Excel */}
        {filtered.length > 0 && (
          <button onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 whitespace-nowrap">
            <Download size={15} /> Exportar Excel
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando ventas...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <ShoppingCart size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No se encontraron ventas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(v => (
              <div key={v.id} onClick={() => navigate(`/ventas/${v.id}`)}
                className={`px-5 py-4 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                  v.es_pedido_especial ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-amber-50/50'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    v.es_pedido_especial ? 'bg-emerald-100' : 'bg-amber-50'
                  }`}>
                    {v.es_pedido_especial
                      ? <Package size={16} className="text-emerald-700" />
                      : <ShoppingCart size={16} className="text-amber-600" />
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
                      {v.es_pedido_especial && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                          Pedido especial
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-gray-700">S/ {Number(v.total).toFixed(2)}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estadoBadge[v.estado]}`}>
                    {v.estado}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
