  import { useState, useEffect } from 'react'
  import { supabase } from '../lib/supabase'

  export function usePatients() {
    const [patients, setPatients] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const [total, setTotal] = useState(0)
    useEffect(() => { fetchPatients() }, [])

    async function fetchPatients() {
  setLoading(true)
  const [{ data, error }, { count }] = await Promise.all([
    supabase
      .from('patients')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)
  ])
  if (error) setError(error.message)
  else {
    setPatients(data)
    setTotal(count ?? 0)
  }
  setLoading(false)
}

    async function createPatient(formData) {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('patients')
        .insert({ ...formData, created_by: user.id })
        .select()
        .single()
      if (error) throw error
      setPatients(prev => [data, ...prev])
      return data
    }

    async function updatePatient(id, formData) {
      const { data, error } = await supabase
        .from('patients')
        .update(formData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      setPatients(prev => prev.map(p => p.id === id ? data : p))
      return data
    }

async function searchPatients(query) {
  const q = query.trim()

  // DNI exacto
  if (/^\d{8}$/.test(q)) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('activo', true)
      .eq('dni', q)
      .order('apellidos')
    if (error) throw error
    setPatients(data)
    return
  }

  // Full-text search con índice GIN
  const tsQuery = q.trim().split(/\s+/).filter(Boolean).join(' & ')
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('activo', true)
    .textSearch('search_vector', tsQuery, { config: 'simple' })
    .limit(100)
  if (error) throw error
  setPatients(data)
}

    return { patients, loading, error, total, fetchPatients, createPatient, updatePatient, searchPatients }
  }