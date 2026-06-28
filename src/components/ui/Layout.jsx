// src/components/layout/Layout.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { Users, Stethoscope, FileText, ShoppingCart, Clock, History, Glasses, LogOut, Settings } from 'lucide-react'
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
  const [isAdmin, setIsAdmin]   = useState(false)
  const [usuario, setUsuario]   = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
const tenant = useTenant()
const { colores, nombre, logoLg } = tenant

useEffect(() => {
  document.title = nombre
}, [nombre])

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombres, apellidos, roles(nombre)')
          .eq('id', user.id)
          .single()
        if (profile) {
          setIsAdmin(profile.roles?.nombre === 'admin')
          setUsuario({ nombres: profile.nombres, apellidos: profile.apellidos })
        }
      }
    }
    loadUser()
  }, [])

  async function handleLogout() {
  await supabase.auth.signOut()
}

  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems

  return (
    <div className="flex min-h-screen bg-gray-50">

      <aside className="w-14 lg:w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all">

        <div className="h-1 w-full" style={{ backgroundColor: colores.accent }} />

        <a
          href="/pacientes"
          className="px-2 lg:px-4 py-3 border-b border-gray-200 flex items-center justify-center lg:justify-start hover:bg-gray-50 transition-colors"
        >
          <div className="lg:hidden w-9 h-9 flex items-center justify-center">
            <img src={logoLg} alt={nombre} className="w-full h-full object-contain"
              onError={e => { e.target.style.display = 'none' }} />
          </div>
          <div className="hidden lg:flex items-center justify-center w-full">
            <img src={logoLg} alt={nombre} className="h-12 w-auto object-contain"
              onError={e => { e.target.style.display = 'none' }} />
          </div>
        </a>

        <nav className="flex-1 px-1.5 lg:px-3 py-3 lg:py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100"
              style={({ isActive }) =>
                isActive ? { backgroundColor: colores.navActiveBg, color: colores.navActiveText } : {}
              }
            >
              <Icon size={20} className="lg:size-[18px]" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

      {/* Footer — usuario con menú desplegable */}
        <div className="border-t border-gray-100 px-1.5 lg:px-3 py-3">

          {/* Botón usuario — abre menú */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              title={usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Usuario'}
              className="w-full flex items-center justify-center lg:justify-start gap-2 px-0 lg:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {/* Avatar inicial */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: colores.primary }}
              >
                {usuario?.nombres?.[0] ?? '?'}
              </div>
              {/* Nombre — solo desktop */}
              <div className="hidden lg:flex flex-col items-start flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-700 truncate w-full">
                  {usuario ? `${usuario.nombres} ${usuario.apellidos}` : '...'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {isAdmin ? 'Administrador' : 'Usuario'}
                </span>
              </div>
            </button>

            {/* Menú desplegable */}
            {menuOpen && (
              <>
                {/* Overlay para cerrar al hacer click fuera */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <NavLink
                    to="/configuracion"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} />
                    Configuración
                  </NavLink>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => { setMenuOpen(false); handleLogout() }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="hidden lg:block px-3 pt-2">
            <p className="text-[10px] text-gray-300">
              Powered by <span className="font-semibold text-gray-400">Optovitor</span>
            </p>
          </div>
        </div>

      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>

    </div>
  )
}
