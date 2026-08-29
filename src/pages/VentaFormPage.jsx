import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Search, Plus, Trash2, Save, User, Eye, Sparkles, Tag, Package, ShoppingCart } from 'lucide-react'

function formatSoles(centimos) {
  return `S/ ${(centimos / 100).toFixed(2)}`
}

function calcularLinea(precioUnitarioCentimos, cantidad, tipoAfectacion) {
  const total = Math.round(precioUnitarioCentimos * cantidad)
  if (tipoAfectacion === '10') {
    const subtotal = Math.round((total * 100) / 118)
    const igv = total - subtotal
    return { subtotal, igv, total }
  }
  return { subtotal: total, igv: 0, total }
}

function puedeEditarPrecio(role) { return true }

function solesToCentimos(value) {
  const n = parseFloat(value)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

function calcularSerie(esfera, cilindro) {
  const magEsfera = Math.abs(parseFloat(esfera) || 0)
  const magCilindro = Math.abs(parseFloat(cilindro) || 0)
  if (magEsfera > 6.00 || magCilindro > 6.00) return { serie: null, label: 'Requiere fabricación (fuera de rango > 6.00)' }
  if (magCilindro <= 2.00) return { serie: 1, label: 'Serie 1 (Cil. ≤ 2.00)' }
  if (magCilindro <= 4.00) return { serie: 2, label: 'Serie 2 (Cil. 2.25 a 4.00)' }
  return { serie: 3, label: 'Serie 3 (Cil. 4.25 a 6.00)' }
}

function parsearPreciosSeries(producto) {
  const serie1 = producto.precio_sugerido
  const desc = producto.descripcion || ''
  const m2 = desc.match(/Serie 2[^:]*:\s*S\/\s*([\d.]+)/i)
  const m3 = desc.match(/Serie 3[^:]*:\s*S\/\s*([\d.]+)/i)
  return { 1: serie1, 2: m2 ? parseFloat(m2[1]) : serie1, 3: m3 ? parseFloat(m3[1]) : serie1 }
}

function LunaSugeridaCard({ luna, sugerenciasLunas, onAdd, variant }) {
  const precios = parsearPreciosSeries(luna)
  const { od, oi } = sugerenciasLunas
  const precioOD = od.serie ? precios[od.serie] : null
  const precioOI = oi.serie ? precios[oi.serie] : null
  const total = (precioOD || 0) + (precioOI || 0)
  const fueraDeRango = !od.serie && !oi.serie
  const nombreMostrado = variant === 'premium' ? luna.nombre.replace(/ Premium$/i, '') : luna.nombre
  const cardClass = variant === 'premium'
    ? 'text-left rounded-xl px-3 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full'
    : 'text-left bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 hover:border-orange-400 hover:bg-orange-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full'
  const cardStyle = variant === 'premium' ? { backgroundColor: '#FCE9A8', border: '1.5px solid #D4A017' } : undefined

  return (
    <button onClick={() => onAdd(luna)} disabled={fueraDeRango} className={cardClass} style={cardStyle}
      onMouseEnter={e => { if (variant === 'premium' && !fueraDeRango) { e.currentTarget.style.borderColor = '#B8860B'; e.currentTarget.style.backgroundColor = '#F9DE85' } }}
      onMouseLeave={e => { if (variant === 'premium') { e.currentTarget.style.borderColor = '#D4A017'; e.currentTarget.style.backgroundColor = '#FCE9A8' } }}
    >
      <p className="text-sm font-medium text-gray-800">{nombreMostrado}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">
          {precioOD !== null && `OD S/${precioOD.toFixed(2)}`}
          {precioOD !== null && precioOI !== null && ' + '}
          {precioOI !== null && `OI S/${precioOI.toFixed(2)}`}
          {fueraDeRango && 'Requiere fabricación'}
        </span>
        {!fueraDeRango && (
          <span className="text-sm font-bold" style={variant === 'premium' ? { color: '#92600a' } : { color: '#c2410c' }}>
            S/ {total.toFixed(2)}
          </span>
        )}
      </div>
    </button>
  )
}

export default function VentaFormPage() {
  const navigate = useNavigate()
  const { patientId } = useParams()
  const [searchParams] = useSearchParams()
  const prescriptionId = searchParams.get('prescriptionId')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const [patient, setPatient] = useState(null)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [showPatientSearch, setShowPatientSearch] = useState(!patientId)

  const [productos, setProductos] = useState([])
  const [productQuery, setProductQuery] = useState('')

  const [items, setItems] = useState([])
  const [notas, setNotas] = useState('')
  const [sedeId, setSedeId] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [esPedidoEspecial, setEsPedidoEspecial] = useState(false)
  const [descuentoGlobal, setDescuentoGlobal] = useState('')
  const [showDescuentoGlobal, setShowDescuentoGlobal] = useState(false)
  const [prescription, setPrescription] = useState(null)
  const [qrInput, setQrInput] = useState('')
  const [qrError, setQrError] = useState('')

  useEffect(() => { init() }, [])

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  async function handleQrScan(codigo) {
    const codigoLimpio = codigo.trim().toUpperCase()
    if (!codigoLimpio) return

    // Buscar en inventario por código QR
    const { data: inv, error } = await supabase
      .from('inventario_categorias_montura')
      .select('*, productos(*)')
      .eq('codigo_qr', codigoLimpio)
      .eq('activo', true)
      .maybeSingle()

    if (error || !inv) {
      setQrError(`Código "${codigoLimpio}" no encontrado`)
      setTimeout(() => setQrError(''), 3000)
      setQrInput('')
      return
    }

    if (inv.cantidad <= 0) {
      setQrError(`Sin stock: ${inv.nombre}`)
      setTimeout(() => setQrError(''), 3000)
      setQrInput('')
      return
    }

    // Agregar al carrito
    const producto = inv.productos
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      producto_id: producto.id,
      descripcion: inv.nombre,
      cantidad: 1,
      precio_unitario: Number(inv.precio).toFixed(2),
      tipo_afectacion_igv: producto.tipo_afectacion_igv || '10',
      unidad_medida: producto.unidad_medida || 'NIU',
    }])
    setQrInput('')
    setQrError('')
    showToast(`✅ ${inv.nombre} — S/ ${Number(inv.precio).toFixed(2)}`)
  }

  async function init() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('sede_id, roles(nombre)').eq('id', user.id).single()
      setSedeId(profile?.sede_id || null)
      setUserRole(profile?.roles?.nombre || null)
    }
    const { data: prods } = await supabase
      .from('productos').select('*').eq('activo', true).order('categoria').order('nombre')
    setProductos(prods || [])
    if (patientId) {
      const { data: p } = await supabase
        .from('patients').select('id, nombres, apellidos, dni, telefono').eq('id', patientId).single()
      if (p) setPatient(p)
    }
    if (prescriptionId) {
      const { data: rx } = await supabase
        .from('prescriptions').select('*').eq('id', prescriptionId).single()
      if (rx) setPrescription(rx)
    }
    setLoading(false)
  }

  async function searchPatients(q) {
    setPatientQuery(q)
    if (q.length < 2) { setPatientResults([]); return }
    const { data } = await supabase
      .from('patients').select('id, nombres, apellidos, dni, telefono')
      .or(`nombres.ilike.%${q}%,apellidos.ilike.%${q}%,dni.ilike.%${q}%`)
      .eq('activo', true).limit(8)
    setPatientResults(data || [])
  }

  function selectPatient(p) {
    setPatient(p)
    setShowPatientSearch(false)
    setPatientResults([])
    setPatientQuery('')
    if (!prescriptionId) cargarUltimaReceta(p.id)
  }

  async function cargarUltimaReceta(pacienteId) {
    const { data, error } = await supabase
      .from('prescriptions').select('*').eq('patient_id', pacienteId)
      .eq('estado', 'vigente').order('fecha_emision', { ascending: false }).limit(1).maybeSingle()
    if (!error && data) setPrescription(data)
    else setPrescription(null)
  }

  function addProducto(producto, precioOverride = null, descripcionExtra = '') {
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      producto_id: producto.id,
      descripcion: producto.nombre + (descripcionExtra ? ` (${descripcionExtra})` : ''),
      cantidad: 1,
      precio_unitario: (precioOverride ?? producto.precio_sugerido).toFixed(2),
      tipo_afectacion_igv: producto.tipo_afectacion_igv,
      unidad_medida: producto.unidad_medida,
    }])
    setProductQuery('')
    showToast(`✅ ${producto.nombre} agregado`)
  }

  function addItemLibre() {
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      producto_id: null,
      descripcion: '',
      cantidad: 1,
      precio_unitario: '0.00',
      tipo_afectacion_igv: '10',
      unidad_medida: 'NIU',
    }])
    showToast('✅ Ítem manual agregado — completa el detalle en el carrito')
  }

  function updateItem(tempId, field, value) {
    setItems(prev => prev.map(it => it.tempId === tempId ? { ...it, [field]: value } : it))
  }

  function removeItem(tempId) {
    setItems(prev => prev.filter(it => it.tempId !== tempId))
  }

  const sugerenciasLunas = useMemo(() => {
    if (!prescription) return null
    const lunas = productos.filter(p => p.categoria === 'luna')
    if (lunas.length === 0) return null
    const od = calcularSerie(prescription.od_esfera, prescription.od_cilindro)
    const oi = calcularSerie(prescription.oi_esfera, prescription.oi_cilindro)
    return { od, oi, lunas }
  }, [prescription, productos])

  const lunasPremium = useMemo(() => sugerenciasLunas?.lunas.filter(l => l.nombre.toLowerCase().includes('premium')) || [], [sugerenciasLunas])
  const lunasEstandar = useMemo(() => sugerenciasLunas?.lunas.filter(l => !l.nombre.toLowerCase().includes('premium')) || [], [sugerenciasLunas])

  function addLunaSugerida(producto) {
    const precios = parsearPreciosSeries(producto)
    const { od, oi } = sugerenciasLunas
    const nuevos = []
    if (od.serie) nuevos.push({
      tempId: crypto.randomUUID(), producto_id: producto.id,
      descripcion: `${producto.nombre} — OD ${od.label.split('(')[0].trim()}`,
      cantidad: 1, precio_unitario: precios[od.serie].toFixed(2),
      tipo_afectacion_igv: producto.tipo_afectacion_igv, unidad_medida: producto.unidad_medida,
    })
    if (oi.serie) nuevos.push({
      tempId: crypto.randomUUID(), producto_id: producto.id,
      descripcion: `${producto.nombre} — OI ${oi.label.split('(')[0].trim()}`,
      cantidad: 1, precio_unitario: precios[oi.serie].toFixed(2),
      tipo_afectacion_igv: producto.tipo_afectacion_igv, unidad_medida: producto.unidad_medida,
    })
    if (nuevos.length === 0) {
      alert('La graduación excede el rango de stock (>6.00) y requiere fabricación especial.')
      return
    }
    setItems(prev => [...prev, ...nuevos])
    showToast(`✅ ${producto.nombre} agregada — OD y OI en el carrito`)
  }

  const totales = useMemo(() => {
    const descuentoGlobalCentimos = solesToCentimos(descuentoGlobal || '0')
    let subtotal = 0, igv = 0, total = 0
    items.forEach((it, idx) => {
      const isLast = idx === items.length - 1
      const cantidad = parseFloat(it.cantidad) || 0
      let precioCentimos = solesToCentimos(it.precio_unitario)
      if (isLast && cantidad > 0) {
        const totalLineaBase = Math.round(precioCentimos * cantidad)
        const totalLineaConDescuento = Math.max(0, totalLineaBase - descuentoGlobalCentimos)
        precioCentimos = Math.round(totalLineaConDescuento / cantidad)
      }
      const r = calcularLinea(precioCentimos, cantidad, it.tipo_afectacion_igv)
      subtotal += r.subtotal; igv += r.igv; total += r.total
    })
    return { subtotal, igv, total, descuentoGlobalCentimos }
  }, [items, descuentoGlobal])

  const productosFiltrados = productos.filter(p =>
    productQuery === '' || p.nombre.toLowerCase().includes(productQuery.toLowerCase())
  )

  async function handleGuardar() {
    if (!patient) { alert('Selecciona un paciente/cliente'); return }
    if (items.length === 0) { alert('Agrega al menos un producto o servicio'); return }
    for (const it of items) {
      if (!it.descripcion.trim()) { alert('Todos los ítems deben tener una descripción'); return }
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: venta, error: ventaError } = await supabase
        .from('ventas').insert({
          sede_id: sedeId, patient_id: patient.id,
          prescription_id: prescription?.id || null, vendedor_id: user.id,
          fecha: new Date().toISOString().split('T')[0],
          subtotal_centimos: 0, igv_centimos: 0, total_centimos: 0,
          notas: notas || null, es_pedido_especial: esPedidoEspecial,
        }).select().single()
      if (ventaError) throw ventaError

      const descuentoGlobalCentimos = solesToCentimos(descuentoGlobal || '0')
      const itemsPayload = items.map((it, idx) => {
        const precioBase = solesToCentimos(it.precio_unitario)
        const cantidad = parseFloat(it.cantidad) || 1
        const isLast = idx === items.length - 1
        const descuentoPorUnidad = (isLast && cantidad > 0) ? Math.round(descuentoGlobalCentimos / cantidad) : 0
        return {
          venta_id: venta.id, producto_id: it.producto_id,
          descripcion: it.descripcion.trim(), cantidad,
          precio_unitario_centimos: precioBase, descuento_centimos: descuentoPorUnidad,
          tipo_afectacion_igv: it.tipo_afectacion_igv, unidad_medida: it.unidad_medida,
        }
      })
      const { error: itemsError } = await supabase.from('venta_items').insert(itemsPayload)
      if (itemsError) throw itemsError
      navigate(`/ventas/${venta.id}`)
    } catch (err) {
      alert('Error al guardar la venta: ' + err.message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando...</div>
  )

  return (
    <div className="h-screen flex flex-col">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Nueva venta</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {prescription ? 'Vinculada a receta del paciente' : 'Nota de venta interna'}
          </p>
        </div>
      </div>

      {/* Layout dos columnas */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── COLUMNA IZQUIERDA — formulario scrolleable ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Cliente */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cliente</h3>
            {patient && !showPatientSearch ? (
              <div className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                    <User size={16} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{patient.apellidos}, {patient.nombres}</p>
                    {patient.dni && <p className="text-xs text-gray-400">DNI: {patient.dni}</p>}
                  </div>
                </div>
                {!prescriptionId && (
                  <button onClick={() => setShowPatientSearch(true)} className="text-xs text-amber-700 hover:underline">Cambiar</button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={patientQuery} onChange={e => searchPatients(e.target.value)}
                    placeholder="Buscar paciente por nombre o DNI..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus />
                </div>
                {patientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                    {patientResults.map(p => (
                      <div key={p.id} onClick={() => selectPatient(p)}
                        className="px-4 py-2.5 hover:bg-amber-50 cursor-pointer text-sm">
                        <span className="font-medium text-gray-800">{p.apellidos}, {p.nombres}</span>
                        {p.dni && <span className="text-xs text-gray-400 ml-2">DNI: {p.dni}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sugerencias de lunas */}
          {sugerenciasLunas && (
            <div className="bg-amber-50/60 rounded-2xl border border-amber-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-amber-600" />
                  <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Lunas sugeridas según receta</h3>
                </div>
                <div className="flex items-center gap-2">
                  {prescription?.fecha_emision && (
                    <span className="text-[10px] text-gray-400">
                      Receta del {new Date(prescription.fecha_emision + 'T00:00:00').toLocaleDateString('es-PE')}
                    </span>
                  )}
                  {!prescriptionId && (
                    <button onClick={() => setPrescription(null)} className="text-[10px] text-gray-400 hover:text-gray-600 underline">Ocultar</button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-4">
                <span className="flex items-center gap-1"><Eye size={12} className="text-blue-600" /> OD: {sugerenciasLunas.od.label}</span>
                <span className="flex items-center gap-1"><Eye size={12} className="text-purple-600" /> OI: {sugerenciasLunas.oi.label}</span>
              </div>

              {lunasPremium.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#92600a' }}>Premium ⭐⭐⭐⭐⭐</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {lunasPremium.map(luna => (
                      <LunaSugeridaCard key={luna.id} luna={luna} sugerenciasLunas={sugerenciasLunas} onAdd={addLunaSugerida} variant="premium" />
                    ))}
                  </div>
                </div>
              )}
              {lunasEstandar.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2 text-orange-600">Estándar ⭐</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {lunasEstandar.map(luna => (
                      <LunaSugeridaCard key={luna.id} luna={luna} sugerenciasLunas={sugerenciasLunas} onAdd={addLunaSugerida} variant="estandar" />
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-3">Click para agregar OD y OI — aparecerán en el carrito de la derecha</p>
            </div>
          )}

          {/* Catálogo */}
          <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-2 bg-amber-500 text-white px-3 py-1.5 rounded-lg">
                <Plus size={14} />
                <span className="text-xs font-bold uppercase tracking-wide">Agregar producto o servicio</span>
              </div>
            </div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={productQuery} onChange={e => setProductQuery(e.target.value)}
                placeholder="Buscar en el catálogo..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            {productQuery && (
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-3 max-h-56 overflow-y-auto">
                {productosFiltrados.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
                ) : (
                  productosFiltrados.map(p => (
                    <div key={p.id} onClick={() => addProducto(p)}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-800">{p.nombre}</p>
                        <p className="text-xs text-gray-400 capitalize">{p.categoria}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-600">S/ {p.precio_sugerido.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Botón ítem manual — prominente con borde punteado */}
            <button onClick={addItemLibre}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-amber-300 text-amber-700 text-sm font-medium rounded-xl hover:bg-amber-50 hover:border-amber-500 transition-colors">
              <Plus size={18} /> Agregar ítem manual (artículo, servicio u otro)
            </button>
          </div>

          {/* Pedido especial */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <button onClick={() => setEsPedidoEspecial(prev => !prev)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
                esPedidoEspecial ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:border-emerald-200'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${esPedidoEspecial ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Package size={16} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${esPedidoEspecial ? 'text-emerald-800' : 'text-gray-700'}`}>Pedido especial</p>
                  <p className="text-xs text-gray-400">Lunas que requieren fabricación o pedido fuera de stock</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${esPedidoEspecial ? 'bg-emerald-600 justify-end' : 'bg-gray-200 justify-start'}`}>
                <div className="w-5 h-5 bg-white rounded-full shadow" />
              </div>
            </button>
          </div>

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Observaciones internas sobre esta venta..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

        </div>

        {/* ── COLUMNA DERECHA — carrito fijo ── */}
        <div className="w-80 shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col">

          {/* Header carrito */}
          <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center gap-2">
            <ShoppingCart size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-gray-800">Carrito</span>
            {items.length > 0 && (
              <span className="ml-auto text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                {items.length}
              </span>
            )}
          </div>

          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <ShoppingCart size={28} className="mb-2 opacity-30" />
                <p className="text-xs text-center">El carrito está vacío.<br/>Agrega productos desde la izquierda.</p>
              </div>
            ) : (
              items.map(it => {
                const precioCentimos = solesToCentimos(it.precio_unitario)
                const cantidad = parseFloat(it.cantidad) || 0
                const r = calcularLinea(precioCentimos, cantidad, it.tipo_afectacion_igv)
                return (
                  <div key={it.tempId} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <input value={it.descripcion}
                        onChange={e => updateItem(it.tempId, 'descripcion', e.target.value)}
                        placeholder="Descripción..."
                        className="flex-1 text-xs border-0 border-b border-gray-200 px-1 py-0.5 focus:outline-none focus:border-amber-400 bg-transparent font-medium text-gray-800" />
                      <button onClick={() => removeItem(it.tempId)} className="p-0.5 text-gray-300 hover:text-red-500 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[9px] text-gray-400 mb-0.5">Cant.</label>
                        <input type="text" inputMode="decimal" value={it.cantidad}
                          onChange={e => updateItem(it.tempId, 'cantidad', e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[9px] text-gray-400 mb-0.5">Precio (S/)</label>
                        <input type="text" inputMode="decimal" value={it.precio_unitario}
                          onChange={e => updateItem(it.tempId, 'precio_unitario', e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                      <div className="flex-1 text-right">
                        <label className="block text-[9px] text-gray-400 mb-0.5">Total</label>
                        <div className="text-xs font-bold text-amber-700 py-1">{formatSoles(r.total)}</div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer carrito — totales y guardar */}
          <div className="p-4 bg-white border-t border-gray-100 space-y-3">

            {/* Descuento */}
            {showDescuentoGlobal ? (
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-green-600 shrink-0" />
                <input type="text" inputMode="decimal" autoFocus
                  value={descuentoGlobal} onChange={e => setDescuentoGlobal(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 text-sm border border-green-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-green-300" />
                <span className="text-xs text-gray-400">soles</span>
                <button onClick={() => { setShowDescuentoGlobal(false); setDescuentoGlobal('') }}
                  className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ) : (
              <button onClick={() => setShowDescuentoGlobal(true)}
                className="flex items-center gap-1.5 text-xs text-green-700 hover:underline">
                <Tag size={13} /> Aplicar descuento
              </button>
            )}

            {/* Total */}
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-sm text-gray-600 font-medium">Total</span>
              <span className="text-xl font-bold text-amber-700">{formatSoles(totales.total)}</span>
            </div>

            {/* Botón guardar */}
            <button onClick={handleGuardar} disabled={saving || items.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar venta'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
