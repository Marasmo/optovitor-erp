import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Glasses, Plus, Minus, Save, X, BarChart3 } from 'lucide-react'

const estrellas = { 'OJ-1': '⭐', 'OJ-2': '⭐⭐', 'OJ-3': '⭐⭐⭐', 'OJ-4': '⭐⭐⭐⭐', 'OJ-5': '⭐⭐⭐⭐⭐', 'OJ-6': '⭐⭐⭐⭐⭐⭐' }

const colorCategoria = {
  'OJ-1': 'bg-gray-50 border-gray-200',
  'OJ-2': 'bg-blue-50 border-blue-200',
  'OJ-3': 'bg-green-50 border-green-200',
  'OJ-4': 'bg-amber-50 border-amber-200',
  'OJ-5': 'bg-purple-50 border-purple-200',
  'OJ-6': 'bg-red-50 border-red-200',
}

export default function InventarioPage() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Reposición rápida
  const [showReposicion, setShowReposicion] = useState(false)
  const [reposicion, setReposicion] = useState({})

  useEffect(() => { fetchCategorias() }, [])

  async function fetchCategorias() {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventario_categorias_montura')
      .select('*')
      .eq('activo', true)
      .order('precio')
    if (!error) setCategorias(data || [])
    setLoading(false)
  }

  async function ajustar(id, delta) {
    const cat = categorias.find(c => c.id === id)
    if (!cat) return
    const nueva = Math.max(0, cat.cantidad + delta)
    const { error } = await supabase
      .from('inventario_categorias_montura')
      .update({ cantidad: nueva })
      .eq('id', id)
    if (!error) await fetchCategorias()
  }

  async function saveEdit(id) {
    const nueva = parseInt(editValue, 10)
    if (isNaN(nueva) || nueva < 0) { alert('Ingresa un número válido'); return }
    setSaving(true)
    const { error } = await supabase
      .from('inventario_categorias_montura')
      .update({ cantidad: nueva })
      .eq('id', id)
    if (!error) { setEditingId(null); await fetchCategorias() }
    setSaving(false)
  }

  async function handleReposicion() {
    setSaving(true)
    try {
      for (const [id, valor] of Object.entries(reposicion)) {
        const cantidad = parseInt(valor, 10)
        if (isNaN(cantidad) || cantidad <= 0) continue
        const cat = categorias.find(c => c.id === id)
        if (!cat) continue
        await supabase
          .from('inventario_categorias_montura')
          .update({ cantidad: cat.cantidad + cantidad })
          .eq('id', id)
      }
      setReposicion({})
      setShowReposicion(false)
      await fetchCategorias()
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setSaving(false)
  }

  const totalMonturas = categorias.reduce((s, c) => s + c.cantidad, 0)

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
            {totalMonturas} monturas disponibles en total
          </p>
        </div>
        <button
          onClick={() => setShowReposicion(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
        >
          <Plus size={16} /> Reponer stock
        </button>
      </div>

      {/* Modal reposición */}
      {showReposicion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Reponer stock</h2>
              <button onClick={() => { setShowReposicion(false); setReposicion({}) }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Ingresa cuántas monturas vas a agregar a cada categoría</p>
            <div className="space-y-3">
              {categorias.map(cat => (
                <div key={cat.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{cat.nombre}</p>
                    <p className="text-xs text-gray-400">Stock actual: {cat.cantidad} · S/ {Number(cat.precio).toFixed(0)}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={reposicion[cat.id] || ''}
                    onChange={e => setReposicion(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    placeholder="0"
                    className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowReposicion(false); setReposicion({}) }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
              <button onClick={handleReposicion} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">
                <Save size={15} /> {saving ? 'Guardando...' : 'Guardar reposición'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen visual */}
      {!loading && categorias.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-amber-600" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Distribución de stock</h3>
          </div>
          <div className="space-y-2">
            {categorias.map(cat => {
              const pct = totalMonturas > 0 ? (cat.cantidad / totalMonturas) * 100 : 0
              return (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 shrink-0">{cat.nombre}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-6 text-right">{cat.cantidad}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de categorías */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {categorias.map(cat => {
              const isEditing = editingId === cat.id
              const agotado = cat.cantidad === 0
              const bajo = cat.cantidad > 0 && cat.cantidad <= 5

              return (
                <div key={cat.id} className={`px-5 py-4 flex items-center justify-between gap-4 ${colorCategoria[cat.codigo_qr] || ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                      <Glasses size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{cat.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">S/ {Number(cat.precio).toFixed(0)}</span>
                        <span className="text-xs">{estrellas[cat.codigo_qr]}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{cat.codigo_qr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      agotado ? 'bg-red-100 text-red-600' :
                      bajo ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
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
                        <button onClick={() => saveEdit(cat.id)} disabled={saving}
                          className="text-xs px-2 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                          OK
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => ajustar(cat.id, -1)} disabled={agotado}
                          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30">
                          <Minus size={15} />
                        </button>
                        <span
                          onClick={() => { setEditingId(cat.id); setEditValue(String(cat.cantidad)) }}
                          className="text-lg font-bold text-gray-800 w-10 text-center cursor-pointer hover:text-amber-600"
                          title="Click para editar"
                        >
                          {cat.cantidad}
                        </span>
                        <button onClick={() => ajustar(cat.id, 1)}
                          className="p-1 text-gray-400 hover:text-green-600">
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
