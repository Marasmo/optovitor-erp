// src/pages/LoginPage.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTenant } from '../hooks/useTenant'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const tenant = useTenant()
  const { colores, nombre, logoLg } = tenant

  useEffect(() => {
    document.title = nombre
  }, [nombre])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('sede_id, superadmin')
      .eq('id', data.user.id)
      .single()

    console.log('profile:', profile)
    console.log('tenant.sedeId:', tenant.sedeId)
    console.log('superadmin:', profile?.superadmin)
    console.log('sede_id coincide:', profile?.sede_id === tenant.sedeId)

    const sedeEsCorrecta = profile?.superadmin === true || profile?.sede_id === tenant.sedeId

    if (!sedeEsCorrecta) {
      await supabase.auth.signOut()
      setError('No tienes acceso a esta sede')
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colores.primaryLight }}
    >
      <div
        className="fixed top-0 left-0 right-0 h-1"
        style={{ backgroundColor: colores.accent }}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">

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

        <p className="text-center text-[10px] text-gray-300 mt-6">
          Powered by <span className="font-semibold text-gray-400">Optovitor</span>
        </p>
      </div>
    </div>
  )
}
