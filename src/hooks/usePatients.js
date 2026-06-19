  import { useState, useEffect } from 'react'
  import { supabase } from '../lib/supabase'

  export function usePatients() {
    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => { fetchPatients() }, [])

    async function fetchPatients() {
      setLoading(true)
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false })
      if (error) setError(error.message)
      else setPatients(data)
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
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('activo', true)
        .or(`nombres.ilike.%${query}%,apellidos.ilike.%${query}%,dni.ilike.%${query}%`)
        .order('apellidos')
      if (error) throw error
      setPatients(data)
    }

    return { patients, loading, error, fetchPatients, createPatient, updatePatient, searchPatients }
  }