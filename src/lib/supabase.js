import { createClient } from '@supabase/supabase-js'
import { useTenant } from '../hooks/useTenant'

// Detecta el tenant y crea el cliente Supabase correspondiente
function createTenantClient() {
  const hostname = window.location.hostname
  const isSunVision = hostname.startsWith('sunvision')

  const url = isSunVision
    ? 'https://oqnzkyeetglbuyjetcvp.supabase.co'
    : 'https://clejkcmkowkzasztouwn.supabase.co'

  const key = isSunVision
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xbnpreWVldGdsYnV5amV0Y3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Mjg2NTYsImV4cCI6MjA5NjQwNDY1Nn0.kFIg8kEySlDTKMIUHSlhMoIUXPBA_srUi0_ScHq8OMc'
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsZWprY21rb3dremFzenRvdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTc1MzMsImV4cCI6MjA5NTQ5MzUzM30.LzLQL7wGkp8px48YvGdBqDImOU82ep1H07YKwA0qtMY'

  return createClient(url, key)
}

export const supabase = createTenantClient()