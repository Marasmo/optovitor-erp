// src/pages/LoginPage.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTenant } from '../hooks/useTenant'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const tenant = useTenant()
  const { colores, nombre, logoLg } = tenant

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colores.primaryLight }}
    >
      {/* Acento decorativo superior */}
      <div
        className="fixed top-0 left-0 right-0 h-1"
        style={{ backgroundColor: colores.accent }}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">

        {/* Logo + nombre sede */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img
              src={logoLg}
              alt={nombre}
              className="h-16 w-auto object-contain"
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-1">Ingresa tus credenciales</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': colores.focusRing }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': colores.focusRing }}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            style={{
              backgroundColor: loading ? colores.primaryHover : colores.primary,
            }}
            onMouseEnter={e => { if (!loading) e.target.style.backgroundColor = colores.primaryHover }}
            onMouseLeave={e => { if (!loading) e.target.style.backgroundColor = colores.primary }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Footer con marca Optovitor */}
        <p className="text-center text-[10px] text-gray-300 mt-6">
          Powered by <span className="font-semibold text-gray-400">Optovitor</span>
        </p>
      </div>
    </div>
  )
}
