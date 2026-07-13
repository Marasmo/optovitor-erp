import { createClient } from '@supabase/supabase-js'
import { useTenant } from '../hooks/useTenant'

// Usa el mismo tenant detectado en useTenant.js — una sola fuente de verdad
function createTenantClient() {
  const tenant = useTenant()
  return createClient(tenant.supabaseUrl, tenant.supabaseKey)
}

export const supabase = createTenantClient()