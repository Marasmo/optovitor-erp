import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { dni } = await req.json()

    if (!dni || dni.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, message: 'DNI debe tener 8 dígitos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const tokenApidni  = Deno.env.get('APIDNI_TOKEN')  // token de apidni.com
    const tokenApiperu = Deno.env.get('DNI_TOKEN')      // token de apiperu.dev (fallback)

    // ─────────────────────────────────────────────────────────────
    // 1️⃣  APIDNI.COM — nombre + fecha nacimiento + sexo + dirección
    //     Endpoint correcto: GET /api/v2/dni/{dni}
    // ─────────────────────────────────────────────────────────────
    if (tokenApidni) {
      try {
        const res = await fetch(`http://go.net.pe:3000/api/v2/dni/${dni}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenApidni}`,
          },
          signal: AbortSignal.timeout(8000),
        })

        const data = await res.json()

        // apidni responde: { respuesta, data, codigo } — codigo 1 = éxito
        if (data.codigo === 1 && data.data) {
          const d = data.data

          // Convertir fecha "17-09-1936" o "17/09/1936" → "1936-09-17"
          let fechaISO = null
          if (d.fecha_nacimiento) {
            const partes = d.fecha_nacimiento.split(/[-\/]/)
            if (partes.length === 3) {
              const [dd, mm, yyyy] = partes
              fechaISO = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              fuente: 'apidni',
              data: {
                nombres:          d.nombres          ?? '',
                apellido_paterno: d.apellido_paterno ?? '',
                apellido_materno: d.apellido_materno ?? '',
                nombre_completo:  `${d.apellido_paterno ?? ''} ${d.apellido_materno ?? ''}, ${d.nombres ?? ''}`.trim(),
                fecha_nacimiento: fechaISO,           // "YYYY-MM-DD" listo para <input type="date">
                genero:           d.genero            ?? null, // "M" | "F"
                direccion:        d.direccion         ?? null,
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
        // codigo === 0 → no encontrado / error / límite → cae al fallback
        console.error('apidni.com respuesta no exitosa:', data.respuesta)
      } catch (e) {
        console.error('apidni.com falló:', e.message)
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2️⃣  APIPERU.DEV — fallback, solo nombre y apellidos
    // ─────────────────────────────────────────────────────────────
    if (tokenApiperu) {
      try {
        const res = await fetch('https://apiperu.dev/api/dni', {
          method: 'POST',
          headers: {
            'Accept':        'application/json',
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${tokenApiperu}`,
          },
          body: JSON.stringify({ dni }),
          signal: AbortSignal.timeout(6000),
        })

        const data = await res.json()

        if (data.success && data.data) {
          const d = data.data
          return new Response(
            JSON.stringify({
              success: true,
              fuente: 'apiperu',
              data: {
                nombres:          d.nombres          ?? '',
                apellido_paterno: d.apellido_paterno ?? '',
                apellido_materno: d.apellido_materno ?? '',
                nombre_completo:  d.nombre_completo  ?? '',
                fecha_nacimiento: null,
                genero:           null,
                direccion:        null,
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
      } catch (e) {
        console.error('apiperu.dev falló:', e.message)
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3️⃣  Ninguna API encontró el DNI
    // ─────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: false, message: 'DNI no encontrado en ninguna fuente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
