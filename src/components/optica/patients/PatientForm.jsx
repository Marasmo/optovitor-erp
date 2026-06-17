import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Search, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

const schema = z.object({
  sede_id:      z.string().uuid('Selecciona una sede'),
  nombres:      z.string().min(2, 'Mínimo 2 caracteres'),
  apellidos:    z.string().min(2, 'Mínimo 2 caracteres'),
  dni:          z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos').optional().or(z.literal('')),
  fecha_nac:    z.string().optional().or(z.literal('')),
  sexo:         z.enum(['M','F','otro']).optional().or(z.literal('')),
  telefono:     z.string().optional(),
  email:        z.string().email('Email inválido').optional().or(z.literal('')),
  direccion:    z.string().optional(),
  ocupacion:    z.string().optional(),
  antecedentes: z.string().optional(),
  medicamentos: z.string().optional(),
  alergias:     z.string().optional(),
  motivo:       z.string().optional(),
})

const Field = ({ label, error, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
)
const Input = ({ className='', ...props }) => (
  <input className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} {...props} />
)
const Select = ({ children, ...props }) => (
  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" {...props}>
    {children}
  </select>
)
const Textarea = ({ ...props }) => (
  <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" {...props} />
)

export default function PatientForm({ sedes, onSubmit, onCancel, defaultValues }) {
  const [dniStatus, setDniStatus] = useState(null)
  const [dniMsg, setDniMsg] = useState('')

  // Sede por defecto: "Óptica Juliaca" si existe, si no la primera de la lista
  const sedeDefault = sedes.find(s => s.nombre === 'Óptica Juliaca')?.id || sedes[0]?.id || ''

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || { sede_id: sedeDefault }
  })

  // Si las sedes cargan después del primer render, asignar la sede por defecto
  useEffect(() => {
    if (!defaultValues && sedeDefault) {
      setValue('sede_id', sedeDefault)
    }
  }, [sedeDefault])

  const dniValue = watch('dni')

  async function consultarDNI() {
    if (!dniValue || dniValue.length !== 8) return
    setDniStatus('loading')
    setDniMsg('')
    try {
      const { data: existente } = await supabase
        .from('patients')
        .select('nombres,apellidos,fecha_nac,sexo,telefono,direccion,ocupacion')
        .eq('dni', dniValue)
        .eq('activo', true)
        .maybeSingle()

      if (existente) {
        setValue('nombres',   existente.nombres,   { shouldValidate: true })
        setValue('apellidos', existente.apellidos, { shouldValidate: true })
        if (existente.fecha_nac) setValue('fecha_nac', existente.fecha_nac)
        if (existente.sexo)      setValue('sexo',      existente.sexo)
        if (existente.telefono)  setValue('telefono',  existente.telefono)
        if (existente.direccion) setValue('direccion', existente.direccion)
        if (existente.ocupacion) setValue('ocupacion', existente.ocupacion)
        setDniStatus('found')
        setDniMsg('📋 Paciente encontrado en el sistema — datos cargados')
        return
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke('consultar-dni', {
        body: { dni: dniValue }
      })
      if (fnError) throw fnError

      if (fnData?.success && fnData?.data) {
        const d = fnData.data
        setValue('nombres',   d.nombres, { shouldValidate: true })
        setValue('apellidos', `${d.apellido_paterno} ${d.apellido_materno}`, { shouldValidate: true })

        if (d.fecha_nacimiento) setValue('fecha_nac', d.fecha_nacimiento)
        if (d.genero)           setValue('sexo', d.genero)
        if (d.direccion)        setValue('direccion', d.direccion)

        const esDatoParcial = fnData.fuente === 'apiperu'
        setDniStatus('found')
        setDniMsg(esDatoParcial
          ? '⚠️ Solo nombre disponible — completa los demás datos manualmente'
          : `✅ ${d.nombre_completo} — datos cargados`
        )
      } else {
        setDniStatus('notfound')
        setDniMsg('DNI no encontrado — ingresa los datos manualmente')
      }
    } catch {
      setDniStatus('error')
      setDniMsg('Error de conexión — ingresa los datos manualmente')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Identificación</h3>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="DNI" error={errors.dni?.message}>
              <Input {...register('dni')} placeholder="12345678" maxLength={8}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), consultarDNI())} />
            </Field>
          </div>
          <button type="button" onClick={consultarDNI}
            disabled={dniStatus === 'loading' || !dniValue || dniValue.length !== 8}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 mb-0.5">
            {dniStatus === 'loading' ? <Loader size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </button>
        </div>
        {dniMsg && (
          <div className={`flex items-center gap-2 mt-2 text-xs px-3 py-2 rounded-lg ${dniStatus === 'found' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {dniStatus === 'found' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {dniMsg}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Datos personales</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombres *" error={errors.nombres?.message}>
            <Input {...register('nombres')} placeholder="Se autocompleta con el DNI" />
          </Field>
          <Field label="Apellidos *" error={errors.apellidos?.message}>
            <Input {...register('apellidos')} placeholder="Se autocompleta con el DNI" />
          </Field>
          <Field label="Fecha de nacimiento (opcional)">
            <Input {...register('fecha_nac')} type="date" />
          </Field>
          <Field label="Sexo (opcional)">
            <Select {...register('sexo')}>
              <option value="">— Seleccionar —</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="otro">Otro</option>
            </Select>
          </Field>
          <Field label="Teléfono">
            <Input {...register('telefono')} placeholder="951234567" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input {...register('email')} type="email" placeholder="correo@ejemplo.com" />
          </Field>
          <Field label="Sede *" error={errors.sede_id?.message}>
            <Select {...register('sede_id')}>
              <option value="">— Seleccionar sede —</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Ocupación">
            <Input {...register('ocupacion')} placeholder="Docente, comerciante..." />
          </Field>
          <Field label="Dirección">
            <Input {...register('direccion')} placeholder="Jr. Lima 123, Juliaca" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">Antecedentes médicos</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Antecedentes (diabetes, HTA, etc.)">
            <Textarea {...register('antecedentes')} placeholder="Diabetes tipo 2..." />
          </Field>
          <Field label="Medicamentos actuales">
            <Textarea {...register('medicamentos')} placeholder="Metformina 500mg..." />
          </Field>
          <Field label="Alergias">
            <Input {...register('alergias')} placeholder="Penicilina, látex..." />
          </Field>
          <Field label="Motivo de consulta habitual">
            <Input {...register('motivo')} placeholder="Control anual..." />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? 'Guardando...' : defaultValues ? 'Actualizar' : 'Registrar paciente'}
        </button>
      </div>
    </form>
  )
}
