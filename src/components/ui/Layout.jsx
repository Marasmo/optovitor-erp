// src/components/layout/Layout.jsx
import { NavLink } from 'react-router-dom'
import { Users, Stethoscope, FileText, ShoppingCart, Clock, History, Glasses } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'

const baseNavItems = [
  { to: '/pacientes',  icon: Users,        label: 'Pacientes'  },
  { to: '/examenes',   icon: Stethoscope,  label: 'Exámenes'   },
  { to: '/recetas',    icon: FileText,      label: 'Recetas'    },
  { to: '/ventas',     icon: ShoppingCart,  label: 'Ventas'     },
  { to: '/pendientes', icon: Clock,         label: 'Pendientes' },
  { to: '/inventario', icon: Glasses,       label: 'Inventario' },
]

const adminNavItems = [
  { to: '/bitacora', icon: History, label: 'Bitácora' },
]

export default function Layout({ children }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const tenant = useTenant()
  const { colores, nombre, logoSm, logoLg } = tenant

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('roles(nombre)')
          .eq('id', user.id)
          .single()
        setIsAdmin(profile?.roles?.nombre === 'admin')
      }
    }
    checkRole()
  }, [])

  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      <aside className="w-14 lg:w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all">

        {/* Franja de color de la sede arriba del logo */}
        <div className="h-1 w-full" style={{ backgroundColor: colores.accent }} />

        {/* Logo */}
        <a
          href="/pacientes"
          className="px-2 lg:px-4 py-3 border-b border-gray-200 flex items-center justify-center lg:justify-start hover:bg-gray-50 transition-colors"
        >
          {/* Compacto: ícono cuadrado */}
          {/* Compacto: logo completo reducido */}
<div className="lg:hidden w-9 h-9 flex items-center justify-center">
  <img
    src={logoLg}
    alt={nombre}
    className="w-full h-full object-contain"
    onError={e => { e.target.style.display = 'none' }}
  />
</div>
          {/* Desktop: logo completo */}
          <div className="hidden lg:flex items-center justify-center w-full">
            <img
              src={logoLg}
              alt={nombre}
              className="h-12 w-auto object-contain"
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
        </a>

        {/* Nav */}
        <nav className="flex-1 px-1.5 lg:px-3 py-3 lg:py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100"
              style={({ isActive }) =>
                isActive
                  ? {
                      backgroundColor: colores.navActiveBg,
                      color: colores.navActiveText,
                    }
                  : {}
              }
            >
              <Icon size={20} className="lg:size-[18px]" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="px-2 lg:px-5 py-3 border-t border-gray-100 hidden lg:block">
          <p className="text-[10px] text-gray-300">Juliaca, Puno — Perú</p>
          <p className="text-[10px] text-gray-300 mt-1 flex items-center gap-1">
            Powered by
            <span className="font-semibold text-gray-400">Optovitor</span>
          </p>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

    </div>
  )
}
