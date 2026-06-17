import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Search, Plus, Trash2, Save, User, Eye, Sparkles, Tag, Package } from 'lucide-react'

// Formatea céntimos a "S/ 123.45"
function formatSoles(centimos) {
  return `S/ ${(centimos / 100).toFixed(2)}`
}

// Calcula subtotal/igv/total de una línea (replica la función SQL en JS
// para mostrar el preview en vivo antes de guardar)
function calcularLinea(precioUnitarioCentimos, cantidad, tipoAfectacion) {
  const total = Math.round(precioUnitarioCentimos * cantidad)
  if (tipoAfectacion === '10') {
    const subtotal = Math.round((total * 100) / 118)
    const igv = total - subtotal
    return { subtotal, igv, total }
  }
  return { subtotal: total, igv: 0, total }
}

// Convierte un input de soles (string, ej "45.50") a céntimos enteros
// Todos los roles pueden editar el precio unitario libremente.
// Además existe el botón "Descuento" para aplicar un monto fijo en soles.
function puedeEditarPrecio(role) {
  return true
}

function solesToCentimos(value) {
  const n = parseFloat(value)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

// ─────────────────────────────────────────────────────────────────────────
// Lógica del cotizador de Óptica Juliaca:
// La serie de precio depende del CILINDRO (no de la esfera).
//   |cilindro| <= 2.00         -> Serie 1
//   2.00 < |cilindro| <= 4.00  -> Serie 2
//   4.00 < |cilindro| <= 6.00  -> Serie 3
//   |cilindro| > 6.00 o |esfera| > 6.00 -> Requiere fabricación (sin precio fijo)
//
// El precio de cada producto "luna" en el catálogo trae en su `descripcion`
// los 3 precios (Serie 1/2/3) en formato:
//   "... Serie 1 (Cil. ≤ 2.00). Serie 2 (2.25–4.00): S/110. Serie 3 (4.25–6.00): S/130."
// La función parsearPreciosSeries() extrae esos 3 valores de la descripción.
// ─────────────────────────────────────────────────────────────────────────

function calcularSerie(esfera, cilindro) {
  const magEsfera = Math.abs(parseFloat(esfera) || 0)
  const magCilindro = Math.abs(parseFloat(cilindro) || 0)

  if (magEsfera > 6.00 || magCilindro > 6.00) {
    return { serie: null, label: 'Requiere fabricación (fuera de rango > 6.00)' }
  }
  if (magCilindro <= 2.00) {
    return { serie: 1, label: 'Serie 1 (Cil. ≤ 2.00)' }
  }
  if (magCilindro <= 4.00) {
    return { serie: 2, label: 'Serie 2 (Cil. 2.25 a 4.00)' }
  }
  return { serie: 3, label: 'Serie 3 (Cil. 4.25 a 6.00)' }
}

// Extrae los precios de Serie 1/2/3 desde la descripción del producto.
// Serie 1 = precio_sugerido (ya está en la columna numérica).
// Serie 2 y 3 se parsean de la descripción con regex.
function parsearPreciosSeries(producto) {
  const serie1 = producto.precio_sugerido
  const desc = producto.descripcion || ''

  const m2 = desc.match(/Serie 2[^:]*:\s*S\/\s*([\d.]+)/i)
  const m3 = desc.match(/Serie 3[^:]*:\s*S\/\s*([\d.]+)/i)

  return {
    1: serie1,
    2: m2 ? parseFloat(m2[1]) : serie1,
    3: m3 ? parseFloat(m3[1]) : serie1,
  }
}

export default function VentaFormPage() {
  const navigate = useNavigate()
  const { patientId } = useParams() // si viene desde el perfil del paciente
  const [searchParams] = useSearchParams()
  const prescriptionId = searchParams.get('prescriptionId')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  // Receta vinculada (si viene de "Crear venta" desde una receta)
  const [prescription, setPrescription] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id, roles(nombre)')
        .eq('id', user.id)
        .single()
      setSedeId(profile?.sede_id || null)
      setUserRole(profile?.roles?.nombre || null)
    }

    const { data: prods } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('categoria')
      .order('nombre')
    setProductos(prods || [])

    if (patientId) {
      const { data: p } = await supabase
        .from('patients')
        .select('id, nombres, apellidos, dni, telefono')
        .eq('id', patientId)
        .single()
      if (p) setPatient(p)
    }

    if (prescriptionId) {
      const { data: rx } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('id', prescriptionId)
        .single()
      if (rx) setPrescription(rx)
    }

    setLoading(false)
  }

  async function searchPatients(q) {
    setPatientQuery(q)
    if (q.length < 2) { setPatientResults([]); return }
    const { data } = await supabase
      .from('patients')
      .select('id, nombres, apellidos, dni, telefono')
      .or(`nombres.ilike.%${q}%,apellidos.ilike.%${q}%,dni.ilike.%${q}%`)
      .eq('activo', true)
      .limit(8)
    setPatientResults(data || [])
  }

  function selectPatient(p) {
    setPatient(p)
    setShowPatientSearch(false)
    setPatientResults([])
    setPatientQuery('')
    // Si no venimos de una receta específica (?prescriptionId=...),
    // buscar automáticamente la receta vigente más reciente del paciente
    // para activar las sugerencias de lunas.
    if (!prescriptionId) {
      cargarUltimaReceta(p.id)
    }
  }

  async function cargarUltimaReceta(pacienteId) {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', pacienteId)
      .eq('estado', 'vigente')
      .order('fecha_emision', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      setPrescription(data)
    } else {
      setPrescription(null)
    }
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
  }

  function updateItem(tempId, field, value) {
    setItems(prev => prev.map(it => it.tempId === tempId ? { ...it, [field]: value } : it))
  }

  function removeItem(tempId) {
    setItems(prev => prev.filter(it => it.tempId !== tempId))
  }

  // ── Sugerencias de lunas según la receta (si hay) ──
  const sugerenciasLunas = useMemo(() => {
    if (!prescription) return null

    const lunas = productos.filter(p => p.categoria === 'luna')
    if (lunas.length === 0) return null

    const od = calcularSerie(prescription.od_esfera, prescription.od_cilindro)
    const oi = calcularSerie(prescription.oi_esfera, prescription.oi_cilindro)

    return { od, oi, lunas }
  }, [prescription, productos])

  // Agrega una luna sugerida: una línea por OD y otra por OI, con el
  // precio de la Serie que corresponda a cada ojo.
  function addLunaSugerida(producto) {
    const precios = parsearPreciosSeries(producto)
    const { od, oi } = sugerenciasLunas

    const nuevos = []
    if (od.serie) {
      nuevos.push({
        tempId: crypto.randomUUID(),
        producto_id: producto.id,
        descripcion: `${producto.nombre} — OD (${od.label})`,
        cantidad: 1,
        precio_unitario: precios[od.serie].toFixed(2),
        tipo_afectacion_igv: producto.tipo_afectacion_igv,
        unidad_medida: producto.unidad_medida,
      })
    }
    if (oi.serie) {
      nuevos.push({
        tempId: crypto.randomUUID(),
        producto_id: producto.id,
        descripcion: `${producto.nombre} — OI (${oi.label})`,
        cantidad: 1,
        precio_unitario: precios[oi.serie].toFixed(2),
        tipo_afectacion_igv: producto.tipo_afectacion_igv,
        unidad_medida: producto.unidad_medida,
      })
    }

    if (nuevos.length === 0) {
      alert('La graduación de este paciente excede el rango de stock (>6.00) y requiere fabricación especial. Agrega el ítem manualmente con el precio acordado.')
      return
    }

    setItems(prev => [...prev, ...nuevos])
  }

  // Totales calculados en vivo (céntimos)
  const totales = useMemo(() => {
    const descuentoGlobalCentimos = solesToCentimos(descuentoGlobal || '0')
    let subtotal = 0, igv = 0, total = 0

    items.forEach((it, idx) => {
      const isLast = idx === items.length - 1
      const cantidad = parseFloat(it.cantidad) || 0
      let precioCentimos = solesToCentimos(it.precio_unitario)

      if (isLast && cantidad > 0) {
        // Resta el descuento global del precio unitario de la última línea
        // (se reparte sobre el total de esa línea: total_linea - descuento)
        const totalLineaBase = Math.round(precioCentimos * cantidad)
        const totalLineaConDescuento = Math.max(0, totalLineaBase - descuentoGlobalCentimos)
        precioCentimos = Math.round(totalLineaConDescuento / cantidad)
      }

      const r = calcularLinea(precioCentimos, cantidad, it.tipo_afectacion_igv)
      subtotal += r.subtotal
      igv += r.igv
      total += r.total
    })

    return { subtotal, igv, total, descuentoGlobalCentimos }
  }, [items, descuentoGlobal])

  const productosFiltrados = productos.filter(p =>
    productQuery === '' || p.nombre.toLowerCase().includes(productQuery.toLowerCase())
  )

  async function handleGuardar() {
    if (!patient) {
      alert('Selecciona un paciente/cliente')
      return
    }
    if (items.length === 0) {
      alert('Agrega al menos un producto o servicio')
      return
    }
    for (const it of items) {
      if (!it.descripcion.trim()) {
        alert('Todos los ítems deben tener una descripción')
        return
      }
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          sede_id: sedeId,
          patient_id: patient.id,
          prescription_id: prescription?.id || null,
          vendedor_id: user.id,
          fecha: new Date().toISOString().split('T')[0],
          subtotal_centimos: 0,
          igv_centimos: 0,
          total_centimos: 0,
          notas: notas || null,
          es_pedido_especial: esPedidoEspecial,
        })
        .select()
        .single()

      if (ventaError) throw ventaError

      // precio_unitario_centimos guarda el precio BASE / de catálogo
      // (sin descuento). El descuento GLOBAL de la venta se aplica
      // únicamente sobre la ÚLTIMA línea, guardado en su
      // descuento_centimos (por unidad). Los triggers de la base de
      // datos calculan subtotal/igv/total sobre
      // (precio_unitario - descuento) * cantidad.
      const descuentoGlobalCentimos = solesToCentimos(descuentoGlobal || '0')

      const itemsPayload = items.map((it, idx) => {
        const precioBase = solesToCentimos(it.precio_unitario)
        const cantidad = parseFloat(it.cantidad) || 1
        const isLast = idx === items.length - 1

        // El descuento se guarda como monto POR UNIDAD para que
        // (precio_unitario - descuento) * cantidad reste el total correcto.
        const descuentoPorUnidad = (isLast && cantidad > 0)
          ? Math.round(descuentoGlobalCentimos / cantidad)
          : 0

        return {
          venta_id: venta.id,
          producto_id: it.producto_id,
          descripcion: it.descripcion.trim(),
          cantidad,
          precio_unitario_centimos: precioBase,
          descuento_centimos: descuentoPorUnidad,
          tipo_afectacion_igv: it.tipo_afectacion_igv,
          unidad_medida: it.unidad_medida,
        }
      })

      const { error: itemsError } = await supabase
        .from('venta_items')
        .insert(itemsPayload)

      if (itemsError) throw itemsError

      navigate(`/ventas/${venta.id}`)
    } catch (err) {
      alert('Error al guardar la venta: ' + err.message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando...
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5 pb-32">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Nueva venta</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {prescription ? 'Vinculada a receta del paciente' : 'Nota de venta interna'}
          </p>
        </div>
      </div>

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
                <p className="text-sm font-medium text-gray-800">
                  {patient.apellidos}, {patient.nombres}
                </p>
                {patient.dni && <p className="text-xs text-gray-400">DNI: {patient.dni}</p>}
              </div>
            </div>
            {!prescriptionId && (
              <button
                onClick={() => setShowPatientSearch(true)}
                className="text-xs text-amber-700 hover:underline"
              >
                Cambiar
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={patientQuery}
                onChange={e => searchPatients(e.target.value)}
                placeholder="Buscar paciente por nombre o DNI..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                autoFocus
              />
            </div>
            {patientResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                {patientResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="px-4 py-2.5 hover:bg-amber-50 cursor-pointer text-sm"
                  >
                    <span className="font-medium text-gray-800">{p.apellidos}, {p.nombres}</span>
                    {p.dni && <span className="text-xs text-gray-400 ml-2">DNI: {p.dni}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sugerencias de lunas según receta */}
      {sugerenciasLunas && (
        <div className="bg-amber-50/60 rounded-2xl border border-amber-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-amber-600" />
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Lunas sugeridas según receta
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {prescription?.fecha_emision && (
                <span className="text-[10px] text-gray-400">
                  Receta del {new Date(prescription.fecha_emision + 'T00:00:00').toLocaleDateString('es-PE')}
                </span>
              )}
              {/* Solo permitir ocultar si la receta se autodetectó (no vino fija por URL) */}
              {!prescriptionId && (
                <button
                  onClick={() => setPrescription(null)}
                  className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                >
                  Ocultar
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
            <span className="flex items-center gap-1">
              <Eye size={12} className="text-blue-600" /> OD: {sugerenciasLunas.od.label}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} className="text-purple-600" /> OI: {sugerenciasLunas.oi.label}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {sugerenciasLunas.lunas.map(luna => {
              const precios = parsearPreciosSeries(luna)
              const { od, oi } = sugerenciasLunas
              const precioOD = od.serie ? precios[od.serie] : null
              const precioOI = oi.serie ? precios[oi.serie] : null
              const total = (precioOD || 0) + (precioOI || 0)
              const fueraDeRango = !od.serie && !oi.serie

              return (
                <button
                  key={luna.id}
                  onClick={() => addLunaSugerida(luna)}
                  disabled={fueraDeRango}
                  className="text-left bg-white border border-amber-100 rounded-xl px-3 py-2.5 hover:border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="text-sm font-medium text-gray-800">{luna.nombre}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {precioOD !== null && `OD S/${precioOD.toFixed(2)}`}
                      {precioOD !== null && precioOI !== null && ' + '}
                      {precioOI !== null && `OI S/${precioOI.toFixed(2)}`}
                      {fueraDeRango && 'Requiere fabricación'}
                    </span>
                    {!fueraDeRango && (
                      <span className="text-sm font-bold text-amber-700">
                        S/ {total.toFixed(2)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Click para agregar OD y OI como líneas separadas (precio editable según descuento)
          </p>
        </div>
      )}

      {/* Catálogo de productos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Agregar producto o servicio</h3>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={productQuery}
            onChange={e => setProductQuery(e.target.value)}
            placeholder="Buscar en el catálogo..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {productQuery && (
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-3 max-h-56 overflow-y-auto">
            {productosFiltrados.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
            ) : (
              productosFiltrados.map(p => (
                <div
                  key={p.id}
                  onClick={() => addProducto(p)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.categoria}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    S/ {p.precio_sugerido.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <button
          onClick={addItemLibre}
          className="flex items-center gap-2 text-xs text-amber-700 hover:underline"
        >
          <Plus size={14} /> Agregar ítem manual (no está en el catálogo)
        </button>
      </div>

      {/* Items de la venta */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Detalle de la venta ({items.length})
        </h3>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Agrega productos o servicios desde el catálogo arriba
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(it => {
              const editable = puedeEditarPrecio(userRole)
              const precioCentimos = solesToCentimos(it.precio_unitario)
              const cantidad = parseFloat(it.cantidad) || 0
              const r = calcularLinea(precioCentimos, cantidad, it.tipo_afectacion_igv)

              return (
                <div key={it.tempId} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <input
                      value={it.descripcion}
                      onChange={e => updateItem(it.tempId, 'descripcion', e.target.value)}
                      placeholder="Descripción del producto/servicio"
                      className="flex-1 text-sm border-0 border-b border-gray-200 px-1 py-1 focus:outline-none focus:border-amber-400 bg-transparent font-medium"
                    />
                    <button
                      onClick={() => removeItem(it.tempId)}
                      className="p-1 text-gray-300 hover:text-red-500 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Cantidad</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={it.cantidad}
                        onChange={e => updateItem(it.tempId, 'cantidad', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">
                        Precio unit. (S/) {!editable && '🔒'}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={it.precio_unitario}
                        onChange={e => updateItem(it.tempId, 'precio_unitario', e.target.value)}
                        readOnly={!editable}
                        className={`w-full text-sm border rounded-lg px-2 py-1.5 text-center focus:outline-none ${
                          editable
                            ? 'border-gray-200 focus:ring-2 focus:ring-amber-400'
                            : 'border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Total línea</label>
                      <div className="text-sm font-semibold text-gray-700 text-center py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                        {formatSoles(r.total)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pedido especial */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <button
          onClick={() => setEsPedidoEspecial(prev => !prev)}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
            esPedidoEspecial
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-white border-gray-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              esPedidoEspecial ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              <Package size={16} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-medium ${esPedidoEspecial ? 'text-emerald-800' : 'text-gray-700'}`}>
                Pedido especial
              </p>
              <p className="text-xs text-gray-400">
                Lunas que requieren fabricación o pedido fuera de stock
              </p>
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
            esPedidoEspecial ? 'bg-emerald-600 justify-end' : 'bg-gray-200 justify-start'
          }`}>
            <div className="w-5 h-5 bg-white rounded-full shadow" />
          </div>
        </button>
      </div>

      {/* Notas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Notas (opcional)
        </label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Observaciones internas sobre esta venta..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>

      {/* Barra de totales fija */}
      <div className="fixed bottom-0 left-14 lg:left-56 right-0 bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-sm">
            {showDescuentoGlobal ? (
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-green-600" />
                <span className="text-gray-500">Descuento:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={descuentoGlobal}
                  onChange={e => setDescuentoGlobal(e.target.value)}
                  placeholder="0.00"
                  className="w-20 text-sm border border-green-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-green-300"
                />
                <button
                  onClick={() => { setShowDescuentoGlobal(false); setDescuentoGlobal('') }}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDescuentoGlobal(true)}
                className="flex items-center gap-1.5 text-xs text-green-700 hover:underline"
              >
                <Tag size={13} /> Aplicar descuento
              </button>
            )}
            <div>
              <span className="text-gray-400">Total: </span>
              <span className="font-bold text-lg text-amber-700">{formatSoles(totales.total)}</span>
            </div>
          </div>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar venta'}
          </button>
        </div>
      </div>

    </div>
  )
}
