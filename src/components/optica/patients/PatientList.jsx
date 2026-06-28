import { useState, useRef } from 'react'
import { Search, UserPlus, User, Phone, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'


function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export default function PatientList({ patients, loading, onSearch, onNew, onSelect, total }) {
  const [query, setQuery] = useState('')
  const debounceRef = useRef(null)

  function handleSearch(e) {
    const q = e.target.value
    setQuery(q)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (q.length === 0) {
      onSearch('')
      return
    }

    if (q.length < 3) return  // no buscar hasta 3 caracteres

    debounceRef.current = setTimeout(() => {
      onSearch(q)
    }, 350)  // espera 350ms después de la última tecla
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pacientes</h2>
          <p className="text-sm text-gray-400">{total ?? patients.length} registrados</p>
        </div>
        <button onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <UserPlus size={16} /> Nuevo paciente
        </button>
      </div>
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={handleSearch}
            placeholder="Buscar por nombre, apellido o DNI..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando pacientes...</div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <User size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No se encontraron pacientes</p>
          </div>
        ) : (
          patients.map(p => (
            <div key={p.id} onClick={() => onSelect(p)}
              className="px-6 py-4 hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{p.apellidos}, {p.nombres}</p>
                  <div className="flex items-center gap-4 mt-1">
                    {p.dni && <span className="text-xs text-gray-400">DNI: {p.dni}</span>}
                    {p.fecha_nac && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={12} />{calcularEdad(p.fecha_nac)} años
                      </span>
                    )}
                    {p.telefono && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone size={12} />{p.telefono}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-300">
                  {format(new Date(p.created_at), 'dd MMM yyyy', { locale: es })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}