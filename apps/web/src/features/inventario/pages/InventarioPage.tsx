import { useMemo, useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { STOCK_MOCK } from '../model/inventario-mock';
import { estaBajoUmbral } from '../model/tipos';
import './inventario-page.css';

export function InventarioPage() {
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const filas = useMemo(
    () => (soloStockBajo ? STOCK_MOCK.filter(estaBajoUmbral) : STOCK_MOCK),
    [soloStockBajo],
  );

  const alertas = STOCK_MOCK.filter(estaBajoUmbral).length;

  return (
    <div className="inv-page">
      <TicketHeader
        code={`${alertas} bajo umbral`}
        title="Inventario"
        meta="Descuento automático por servicio ejecutado"
      />

      <div className="inv-page__body">
        <label className="inv-filtro">
          <input type="checkbox" checked={soloStockBajo} onChange={(e) => setSoloStockBajo(e.target.checked)} />
          Solo stock bajo
        </label>

        {filas.length === 0 ? (
          <p className="inv-empty">Ningún insumo por debajo de su umbral mínimo.</p>
        ) : (
          <table className="inv-tabla tabular">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Lote</th>
                <th>Cantidad actual</th>
                <th>Umbral mínimo</th>
                <th>Estado</th>
                <th>Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => {
                const bajo = estaBajoUmbral(s);
                return (
                  <tr key={s.id}>
                    <td>{s.producto}</td>
                    <td className="inv-tabla__mono">{s.lote}</td>
                    <td>
                      {s.cantidadActual} {s.unidad}
                    </td>
                    <td>
                      {s.umbralMinimo} {s.unidad}
                    </td>
                    <td>
                      <span className={`inv-estado ${bajo ? 'inv-estado--reponer' : 'inv-estado--ok'}`}>
                        {bajo ? 'Reponer' : 'Ok'}
                      </span>
                    </td>
                    <td>{s.ultimaActualizacion}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
