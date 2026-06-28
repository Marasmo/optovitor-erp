// src/lib/supabaseDashboard.js
// Cliente separado para el Dashboard Kanban de Óptica Juliaca
import { createClient } from '@supabase/supabase-js'

const DASHBOARD_URL  = 'https://clejkcmkowkzasztouwn.supabase.co/rest/v1/'
const DASHBOARD_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsZWprY21rb3dremFzenRvdXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTc1MzMsImV4cCI6MjA5NTQ5MzUzM30.LzLQL7wGkp8px48YvGdBqDImOU82ep1H07YKwA0qtMY'

export const supabaseDashboard = createClient(DASHBOARD_URL, DASHBOARD_ANON)