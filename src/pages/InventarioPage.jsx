import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Glasses, Plus, Minus, QrCode, Save, X } from 'lucide-react'

export default function InventarioPage() {
  const [muebles, setMuebles] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [sedeId, setSedeId] = useState(null)

  // Edición rápida de cantidad
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  // Nuevo mueble
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoDescripcion, setNuevoDescripcion] = useState('')
  const [nuevoCantidad, setNuevoCantidad] = useState('')
  const [saving, setSaving] = useState(false)

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
      setIsAdmin(profile?.roles?.nombre === 'admin')
      setSedeId(profile?.sede_id || null)
    }

    await fetchMuebles()
    setLoading(false)
  }

  async function fetchMuebles() {
    const { data, error } = await supabase
      .from('muebles_monturas')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    if (!error) setMuebles(data || [])
  }

  function startEdit(m) {
    setEditingId(m.id)
    setEditValue(String(m.cantidad_total))
  }

  async function saveCantidad(id) {
    const nueva = parseInt(editValue, 10)
    if (isNaN(nueva) || nueva < 0) {
      alert('Ingresa un número válido (0 o mayor)')
      return
    }
    try {
      const { error } = await supabase
        .from('muebles_monturas')
        .update({ cantidad_total: nueva })
        .eq('id', id)
      if (error) throw error
      setEditingId(null)
      await fetchMuebles()
    } catch (err) {
      alert('Error al actualizar: ' + err.message)
    }
  }

  async function ajustar(id, delta) {
    const m = muebles.find(x => x.id === id)
    if (!m) return
    const nueva = Math.max(0, m.cantidad_total + delta)
    try {
      const { error } = await supabase
        .from('muebles_monturas')
        .update({ cantidad_total: nueva })
        .eq('id', id)
      if (error) throw error
      await fetchMuebles()
    } catch (err) {
      alert('Error al actualizar: ' + err.message)
    }
  }

  async function crearMueble() {
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) {
      alert('Código y nombre son obligatorios')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('muebles_monturas')
        .insert({
          sede_id: sedeId,
          codigo_qr: nuevoCodigo.trim().toUpperCase(),
          nombre: nuevoNombre.trim(),
          descripcion: nuevoDescripcion.trim() || null,
          cantidad_total: parseInt(nuevoCantidad, 10) || 0,
        })
      if (error) throw error
      setShowNuevo(false)
      setNuevoCodigo(''); setNuevoNombre(''); setNuevoDescripcion(''); setNuevoCantidad('')
      await fetchMuebles()
    } catch (err) {
      alert('Error al crear mueble: ' + err.message)
    }
    setSaving(false)
  }

  const filtered = muebles.filter(m => {
    const texto = `${m.nombre} ${m.codigo_qr} ${m.descripcion || ''}`.toLowerCase()
    return query === '' || texto.includes(query.toLowerCase())
  })

  const totalMonturas = muebles.reduce((sum, m) => sum + m.cantidad_total, 0)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Glasses size={20} className="text-amber-600" />
            Inventario de monturas
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {muebles.length} muebles · {totalMonturas} monturas en total
          </p>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
        >
          <Plus size={16} /> Nuevo mueble
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o código..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      </div>

      {/* Formulario nuevo mueble */}
      {showNuevo && (
        <div className="bg-amber-50/60 rounded-2xl border border-amber-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-700">Nuevo mueble</h3>
            <button onClick={() => setShowNuevo(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Código QR / Barras</label>
              <input
                value={nuevoCodigo}
                onChange={e => setNuevoCodigo(e.target.value)}
                placeholder="Ej. OJ03123456"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Nombre</label>
              <input
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Ej. Mueble 3"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Cantidad inicial</label>
              <input
                type="number"
                value={nuevoCantidad}
                onChange={e => setNuevoCantidad(e.target.value)}
                placeholder="0"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Descripción (opcional)</label>
              <input
                value={nuevoDescripcion}
                onChange={e => setNuevoDescripcion(e.target.value)}
                placeholder="Ej. Monturas de sol"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <button
            onClick={crearMueble}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? 'Guardando...' : 'Guardar mueble'}
          </button>
        </div>
      )}

      {/* Lista de muebles */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Cargando inventario...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Glasses size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No se encontraron muebles</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(m => {
              const isEditing = editingId === m.id
              const agotado = m.cantidad_total === 0
              const bajo = m.cantidad_total > 0 && m.cantidad_total <= 5

              return (
                <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                      <Glasses size={18} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <QrCode size={11} /> {m.codigo_qr}
                        </span>
                        {m.descripcion && <span>· {m.descripcion}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      agotado ? 'bg-red-50 text-red-600' :
                      bajo ? 'bg-amber-50 text-amber-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {agotado ? 'Agotado' : bajo ? 'Stock bajo' : 'Disponible'}
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                          className="w-16 text-sm border border-amber-300 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          onClick={() => saveCantidad(m.id)}
                          className="text-xs px-2 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => ajustar(m.id, -1)}
                          disabled={m.cantidad_total === 0}
                          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus size={15} />
                        </button>
                        <span
                          onClick={() => startEdit(m)}
                          className="text-sm font-bold text-gray-700 w-10 text-center cursor-pointer hover:text-amber-600"
                          title="Click para editar"
                        >
                          {m.cantidad_total}
                        </span>
                        <button
                          onClick={() => ajustar(m.id, 1)}
                          className="p-1 text-gray-400 hover:text-green-600"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
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
