import { useEffect } from 'react'

const metodoLabel = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export default function VentaPrint({
  sede = {},
  patient = {},
  venta = {},
  items = [],
  pagos = [],
  atendidoPor = {},
}) {
  const fechaFormateada = venta.fecha
    ? new Date(venta.fecha + 'T00:00:00').toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      })
    : '—'

  const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0)
  const saldoPendiente = Math.max(0, Number(venta.total || 0) - totalPagado)

  const totalDescuento = items.reduce((sum, it) => {
    const descuentoCentimos = Number(it.descuento_centimos || 0)
    const cantidad = Number(it.cantidad || 0)
    return sum + (descuentoCentimos * cantidad) / 100
  }, 0)

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
        .t-table  { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 2px; }
        .t-table th, .t-table td { text-align: right; padding: 1px 2px; }
        .t-table th { font-size: 9px; font-weight: bold; border-bottom: 1px solid #000; }
        .t-table td:first-child, .t-table th:first-child { text-align: left; width: 46%; }
        .t-table td:nth-child(2), .t-table th:nth-child(2) { text-align: center; width: 12%; }
        .t-small  { font-size: 9px; }
        .t-footer { font-size: 8px; text-align: center; margin-top: 6px; }
        .t-total-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-top: 4px; }
        .t-pedido-especial { text-align: center; font-weight: bold; font-size: 10px; border: 1px solid #000; padding: 2px; margin: 4px 0; }
        @media print {
          @page { size: 58mm auto; margin: 0; }
          html, body { width: 58mm; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          .ticket-58mm, .ticket-58mm * { visibility: visible; }
          .ticket-58mm { position: absolute; left: 0; top: 0; width: 58mm; height: auto; overflow: visible; border: none; box-shadow: none; padding: 4px 4px; }
          .no-print { display: none !important; }
          .print-ticket-wrapper { height: auto !important; overflow: visible !important; }
        }
      `}</style>

      {/* Encabezado */}
      <div className="t-center">
        <div className="t-title">{sede.nombre || 'ÓPTICA'}</div>
        {sede.direccion && <div className="t-sub">{sede.direccion}</div>}
        {sede.telefono && <div className="t-sub">Tel: {sede.telefono}</div>}
      </div>

      <div className="t-line" />

      <div className="t-center t-bold" style={{ fontSize: 11 }}>NOTA DE VENTA</div>
      <div className="t-row">
        <span>Fecha:</span>
        <span className="t-bold">{fechaFormateada}</span>
      </div>

      <div className="t-line" />

      {/* Datos del cliente */}
      <div className="t-row"><span>Cliente:</span></div>
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

      <div className="t-line" />

      {venta.es_pedido_especial && (
        <div className="t-pedido-especial">★ PEDIDO ESPECIAL ★</div>
      )}

      <div className="t-section">Detalle</div>
      <table className="t-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Cant.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const totalBase = Number(it.precio_unitario) * Number(it.cantidad)
            return (
              <tr key={idx}>
                <td>{it.descripcion}</td>
                <td>{Number(it.cantidad)}</td>
                <td>S/ {totalBase.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="t-line" />

      {totalDescuento > 0 && (
        <div className="t-row t-bold">
          <span>Descuento</span>
          <span>− S/ {totalDescuento.toFixed(2)}</span>
        </div>
      )}

      <div className="t-total-row">
        <span>TOTAL</span>
        <span>S/ {Number(venta.total || 0).toFixed(2)}</span>
      </div>

      {pagos.length > 0 && (
        <>
          <div className="t-line" />
          <div className="t-section">Pagos</div>
          {pagos.map((p, idx) => (
            <div key={idx} className="t-row t-small">
              <span>{metodoLabel[p.metodo_pago] || p.metodo_pago}</span>
              <span>S/ {Number(p.monto).toFixed(2)}</span>
            </div>
          ))}
          <div className="t-row" style={{ marginTop: 2 }}>
            <span className="t-bold">Pagado</span>
            <span className="t-bold">S/ {totalPagado.toFixed(2)}</span>
          </div>
          {saldoPendiente > 0 && (
            <div className="t-row t-bold">
              <span>Saldo pend.</span>
              <span>S/ {saldoPendiente.toFixed(2)}</span>
            </div>
          )}
        </>
      )}

      {atendidoPor.nombres && (
        <>
          <div className="t-line" />
          <div className="t-row t-small">
            <span>Atendido por:</span>
            <span>{atendidoPor.nombres} {atendidoPor.apellidos}</span>
          </div>
        </>
      )}

      <div className="t-line" />
      <div className="t-footer">
        Documento de venta interno.<br/>
        No constituye boleta ni factura.
      </div>
    </div>
  )
}
