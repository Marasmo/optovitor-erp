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
    sedeId: '433c439e-45c0-4e2c-8eef-9e2540199a87',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL_SUNVISION,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_SUNVISION,
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
    sedeId: '826381bf-84d5-4709-b67f-6332026ec5d5',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL_JULIACA,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_JULIACA,
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
  'sanjosejuliaca.netlify.app': {
  sedeId: '39f73c33-c909-4d26-98fa-9281b2ee2849',
  supabaseUrl: 'https://yuusjxrwjuudcbchgdeu.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXNqeHJ3anV1ZGNiY2hnZGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODcwNDIsImV4cCI6MjA5ODY2MzA0Mn0.PPgDCxRPUoqetrXjT4r5m3lgLHIiazpqsi6Y2_agGhw',
  colors: { primary: '#393185', secondary: '#E32124' },
  logo: '/logosanjose.png',
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
