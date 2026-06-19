// src/hooks/useTenant.js
// Detecta la sede activa según el subdominio del hostname.
// Uso: const tenant = useTenant()
// tenant.id        → 'opticajuliaca' | 'sunvision'
// tenant.nombre    → nombre visible
// tenant.colores   → objeto con tokens de color
// tenant.logoSm    → ruta al ícono pequeño (sidebar colapsado)
// tenant.logoLg    → ruta al logo completo (sidebar expandido)

const TENANTS = {
  sunvision: {
    id: 'sunvision',
    nombre: 'Sun & Vision Óptica',
    colores: {
      // Primario: azul del logo
      primary:        '#1E4FA3',
      primaryHover:   '#1a4491',
      primaryLight:   '#EEF3FB',
      primaryText:    '#1E4FA3',
      // Acento: amarillo/dorado del sol
      accent:         '#F5A800',
      accentHover:    '#d99500',
      accentLight:    '#FFF8E6',
      accentText:     '#92600a',
      // Ring de focus en inputs
      focusRing:      '#1E4FA3',
      // Active nav item
      navActiveBg:    '#EEF3FB',
      navActiveText:  '#1E4FA3',
    },
    logoSm: '/sunvision-icon.png',   // pon aquí el ícono cuadrado del sol
    logoLg: '/sunvision-logo.png',   // logo completo Sun & Vision
    favicon: '/sunvision-favicon.ico',
  },
  opticajuliaca: {
    id: 'opticajuliaca',
    nombre: 'Óptica Juliaca',
    colores: {
      primary:        '#E31E24',
      primaryHover:   '#c41a1f',
      primaryLight:   '#FEF2F2',
      primaryText:    '#E31E24',
      accent:         '#F5A623',
      accentHover:    '#d9911a',
      accentLight:    '#FFF8ED',
      accentText:     '#92600a',
      focusRing:      '#E31E24',
      navActiveBg:    '#FFF8ED',
      navActiveText:  '#b45309',
    },
    logoSm: '/glasses-icon.png',
    logoLg: '/logo-optica-juliaca.png',
    favicon: '/favicon.ico',
  },
}

function detectTenantId() {
  const hostname = window.location.hostname // ej: "sunvision.netlify.app"
  if (hostname.startsWith('sunvision')) return 'sunvision'
  // fallback: cualquier otro hostname → Óptica Juliaca
  return 'opticajuliaca'
}

// Hook — sin dependencias externas, sin estado reactivo necesario
// (el hostname no cambia durante la sesión)
export function useTenant() {
  const id = detectTenantId()
  return TENANTS[id] ?? TENANTS['opticajuliaca']
}

// Utilidad para inyectar variables CSS en <html> (llamar una vez en main.jsx o App.jsx)
export function applyTenantTheme(tenant) {
  const root = document.documentElement
  Object.entries(tenant.colores).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value)
  })
}
