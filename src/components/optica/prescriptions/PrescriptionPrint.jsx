import { useEffect, useRef } from 'react'

function formatDiopt(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = parseFloat(value)
  if (isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

function formatEje(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${value}°`
}

const proximaCitaLabel = {
  '3m': '3 meses',
  '6m': '6 meses',
  '1a': '1 año',
}

export default function PrescriptionPrint({
  sede = {},
  patient = {},
  exam = {},
  od = {},
  oi = {},
  dip = '',
  add = '',
  recomendaciones = '',
  proximaCita = '',
  optometrista = {},
}) {
  const tieneAdd = add !== null && add !== undefined && add !== '' && parseFloat(add) !== 0
  const dipCerca = tieneAdd && dip ? (parseFloat(dip) - 2).toFixed(1) : null

  const fechaFormateada = exam.fecha
    ? new Date(exam.fecha + 'T00:00:00').toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      })
    : '—'

  return (
    <div className="ticket-58mm">
      <style>{`
        .ticket-58mm {
          width: 58mm;
          margin: 0 auto;
          background: #fff;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          line-height: 1.4;
          color: #000;
          padding: 8px 6px;
          box-sizing: border-box;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .ticket-58mm * { box-sizing: border-box; }
        .t-center { text-align: center; }
        .t-bold   { font-weight: bold; }
        .t-line   { border-top: 1px dashed #000; margin: 4px 0; }
        .t-title  { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
        .t-sub    { font-size: 9px; }
        .t-section { font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 6px 0 2px; border-bottom: 1px solid #000; padding-bottom: 1px; }
        .t-row    { display: flex; justify-content: space-between; font-size: 10px; }
        .t-table  { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 2px; }
        .t-table th, .t-table td { text-align: center; padding: 1px 2px; }
        .t-table th { font-size: 9px; font-weight: bold; border-bottom: 1px solid #000; }
        .t-table td:first-child, .t-table th:first-child { text-align: left; font-weight: bold; width: 18%; }
        .t-small  { font-size: 9px; }
        .t-rec    { font-size: 9px; margin-top: 2px; word-wrap: break-word; }
        .t-footer { font-size: 8px; text-align: center; margin-top: 6px; }
        .t-firma  { margin-top: 16px; text-align: center; }
        .t-firma-line { border-top: 1px solid #000; width: 80%; margin: 0 auto 2px; }
        /* FUERA del @media print — solo en pantalla */
.preview-scale {
  transform: scale(1.8);
}

/* DENTRO del @media print */
@media print {
  .preview-scale {
    transform: none !important;
    margin-bottom: 0 !important;
    overflow: visible !important;
  }
  .ticket-58mm {
    transform: none !important;
    width: 58mm !important;
  }
  @page { size: 58mm auto; margin: 0; }
  html, body { width: 58mm; margin: 0; padding: 0; }
  body * { visibility: hidden; }
  .ticket-58mm, .ticket-58mm * { visibility: visible; }
  .ticket-58mm { position: absolute; left: 0; top: 0; width: 58mm; border: none; box-shadow: none; padding: 4px 4px; }
  .no-print { display: none !important; }
}
      `}</style>

      {/* Encabezado */}
      <div className="t-center">
        <div className="t-title">{sede.nombre || 'ÓPTICA'}</div>
        {sede.direccion && <div className="t-sub">{sede.direccion}</div>}
        {sede.telefono && <div className="t-sub">Tel: {sede.telefono}</div>}
      </div>

      <div className="t-line" />

      <div className="t-center t-bold" style={{ fontSize: 11 }}>RECETA OPTOMÉTRICA</div>
      <div className="t-row">
        <span>Fecha:</span>
        <span className="t-bold">{fechaFormateada}</span>
      </div>

      <div className="t-line" />

      {/* Datos del paciente */}
      <div className="t-row"><span>Paciente:</span></div>
      <div className="t-bold" style={{ fontSize: 11 }}>
        {patient.nombres} {patient.apellidos}
      </div>
      {patient.dni && (
        <div className="t-row t-small">
          <span>DNI:</span>
          <span>{patient.dni}</span>
        </div>
      )}
      {patient.telefono && (
        <div className="t-row t-small">
          <span>Tel:</span>
          <span>{patient.telefono}</span>
        </div>
      )}
      {patient.edad && (
        <div className="t-row t-small">
          <span>Edad:</span>
          <span>{patient.edad} años</span>
        </div>
      )}

      <div className="t-line" />

      {/* Visión lejana */}
      <div className="t-section">Visión Lejana</div>
      <table className="t-table">
        <thead>
          <tr><th></th><th>ESF</th><th>CIL</th><th>EJE</th><th>A.V.</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>OD</td>
            <td>{formatDiopt(od.ref_esfera)}</td>
            <td>{formatDiopt(od.ref_cilindro)}</td>
            <td>{formatEje(od.ref_eje)}</td>
            <td>{od.av_vl || '—'}</td>
          </tr>
          <tr>
            <td>OI</td>
            <td>{formatDiopt(oi.ref_esfera)}</td>
            <td>{formatDiopt(oi.ref_cilindro)}</td>
            <td>{formatEje(oi.ref_eje)}</td>
            <td>{oi.av_vl || '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Visión cercana */}
      {tieneAdd && (
        <>
          <div className="t-section">Visión Cercana</div>
          <table className="t-table">
            <thead>
              <tr>
                <th></th><th>ESF</th><th>CIL</th><th>EJE</th>
                {dipCerca && <th>DIP</th>}
                <th>A.V.</th>
              </tr>
            </thead>
            <tbody>
              {[{ label: 'OD', med: od }, { label: 'OI', med: oi }].map(({ label, med }) => {
                const esfCerca = (med?.ref_esfera !== null && med?.ref_esfera !== undefined)
                  ? parseFloat(med.ref_esfera) + parseFloat(add)
                  : parseFloat(add)
                return (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{formatDiopt(esfCerca)}</td>
                    <td>{formatDiopt(med?.ref_cilindro)}</td>
                    <td>{formatEje(med?.ref_eje)}</td>
                    {dipCerca && <td>{dipCerca}</td>}
                    <td>{med?.av_vp || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {dip && (
        <div className="t-row" style={{ marginTop: 4 }}>
          <span>DIP:</span>
          <span className="t-bold">{dip} mm</span>
        </div>
      )}

      {recomendaciones && (
        <>
          <div className="t-line" />
          <div className="t-section">Recomendaciones</div>
          <div className="t-rec">{recomendaciones}</div>
        </>
      )}

      {proximaCita && (
        <div className="t-row" style={{ marginTop: 4 }}>
          <span>Próx. control:</span>
          <span className="t-bold">{proximaCitaLabel[proximaCita] || proximaCita}</span>
        </div>
      )}

      <div className="t-firma">
        <div className="t-firma-line" />
        <div className="t-small">
          {optometrista.nombres ? `${optometrista.nombres} ${optometrista.apellidos}` : 'Optometrista'}
        </div>
      </div>

      <div className="t-line" />
      <div className="t-footer">
        Receta válida según norma vigente.<br/>
        No constituye diagnóstico médico.
      </div>
    </div>
  )
}
