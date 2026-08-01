// src/hooks/useTenant.js
// Detecta la sede activa segun el hostname completo.
// Uso: const tenant = useTenant()

const TENANTS = {
  opticajuliaca: {
    id: 'opticajuliaca',
    sedeId: '826381bf-84d5-4709-b67f-6332026ec5d5',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL_JULIACA,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_JULIACA,
    nombre: 'Optica Juliaca',
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
  sunvision: {
    id: 'sunvision',
    sedeId: '433c439e-45c0-4e2c-8eef-9e2540199a87',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL_SUNVISION,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_SUNVISION,
    nombre: 'Sun & Vision Optica',
    colores: {
      primary:        '#1E4FA3',
      primaryHover:   '#1a4491',
      primaryLight:   '#EEF3FB',
      primaryText:    '#1E4FA3',
      accent:         '#F5A800',
      accentHover:    '#d99500',
      accentLight:    '#FFF8E6',
      accentText:     '#92600a',
      focusRing:      '#1E4FA3',
      navActiveBg:    '#EEF3FB',
      navActiveText:  '#1E4FA3',
    },
    logoSm: '/sunvision-icon.png',
    logoLg: '/sunvision-logo.png',
    favicon: '/sunvision-favicon.ico',
  },
  sanjosejuliaca: {
    id: 'sanjosejuliaca',
    sedeId: '39f73c33-c909-4d26-98fa-9281b2ee2849',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL_SANJOSE,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_SANJOSE,
    nombre: 'Centro Optico San Jose',
    colores: {
      primary:        '#393185',
      primaryHover:   '#322B75',
      primaryLight:   '#F3F2F7',
      primaryText:    '#393185',
      accent:         '#E32124',
      accentHover:    '#C71D1F',
      accentLight:    '#FDEFEF',
      accentText:     '#9E1719',
      focusRing:      '#393185',
      navActiveBg:    '#F3F2F7',
      navActiveText:  '#393185',
    },
    logoSm: '/logosanjose-icon.png',
    logoLg: '/logosanjose.png',
    favicon: '/logosanjose.png',
  },
  demo: {
    id: 'demo',
    sedeId: '11111111-1111-1111-1111-111111111111',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL_DEMO,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_DEMO,
    nombre: 'Optovitor Demo',
    colores: {
      primary:        '#0EA5A4',
      primaryHover:   '#0B8988',
      primaryLight:   '#ECFDFA',
      primaryText:    '#0EA5A4',
      accent:         '#6366F1',
      accentHover:    '#4F52D9',
      accentLight:    '#EEF0FF',
      accentText:     '#3730A3',
      focusRing:      '#0EA5A4',
      navActiveBg:    '#ECFDFA',
      navActiveText:  '#0B8988',
    },
    logoSm: '/optovitor-icon.png',
    logoLg: '/optovitor-logo.png',
    favicon: '/optovitor-favicon.ico',
  },
}

const HOSTNAME_MAP = {
  'optovitor.netlify.app': 'opticajuliaca',
  'sunvision.netlify.app': 'sunvision',
  'optovitorsanjose.netlify.app': 'sanjosejuliaca',
  'demooptovitor.netlify.app': 'demo',
  'demo.optovitor.pe': 'demo',
}

function detectTenantId() {
  const hostname = window.location.hostname
  return HOSTNAME_MAP[hostname] ?? 'opticajuliaca'
}

export function useTenant() {
  const id = detectTenantId()
  return TENANTS[id] ?? TENANTS['opticajuliaca']
}

export function applyTenantTheme(tenant) {
  const root = document.documentElement
  Object.entries(tenant.colores).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value)
  })
}