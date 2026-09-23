import { useMemo, useState, type FormEvent } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { Bloque, Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { Button } from '../../../shared/ui/atoms/Button';
import { fechaLocal } from '../../../shared/lib/fecha';
import type { Rol } from '../../auth/model/roles';
import { STOCK_MOCK } from '../model/inventario-mock';
import { estaBajoUmbral, type StockInsumo } from '../model/tipos';
import { puedeRegistrarEntradas, registrarEntrada, validarEntrada, type DatosEntrada } from '../model/entradas';
import './inventario-page.css';

interface InventarioPageProps {
  rol: Rol;
}

/** Inventario (Fase 5): entradas del Administrador, consulta y alertas para el Supervisor (decisión C5). */
export function InventarioPage({ rol }: InventarioPageProps) {
  const [stock, setStock] = useState<StockInsumo[]>(STOCK_MOCK);
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [entrada, setEntrada] = useState<DatosEntrada>({ stockId: '', lote: '', cantidad: '', fecha: fechaLocal(), proveedor: '' });
  const [intentado, setIntentado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const bajos = stock.filter(estaBajoUmbral);
  const filas = useMemo(() => (soloStockBajo ? stock.filter(estaBajoUmbral) : stock), [stock, soloStockBajo]);
  const errores = intentado ? validarEntrada(entrada) : {};
  const elegido = stock.find((s) => s.id === entrada.stockId);
  const puedeRegistrar = puedeRegistrarEntradas(rol);

  function set<K extends keyof DatosEntrada>(campo: K, valor: DatosEntrada[K]) {
    setEntrada((prev) => ({ ...prev, [campo]: valor }));
    setAviso(null);
  }

  function registrar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (Object.keys(validarEntrada(entrada)).length > 0 || !elegido) return;
    setStock((prev) => registrarEntrada(prev, entrada));
    setAviso(`Entrada registrada: ${entrada.cantidad} ${elegido.unidad} de ${elegido.producto}, lote ${entrada.lote.trim().toUpperCase()}.`);
    setEntrada({ stockId: '', lote: '', cantidad: '', fecha: fechaLocal(), proveedor: '' });
    setIntentado(false);
  }

  return (
    <div className="inv-page">
      <TicketHeader
        code={`${bajos.length} bajo umbral`}
        title="Inventario"
        meta={
          puedeRegistrar
            ? 'Entradas de stock del Administrador · descuento automático por servicio cerrado en la app'
            : 'Consulta y alertas · las entradas de stock las registra el Administrador'
        }
      />

      <div className="inv-page__body">
        {bajos.length > 0 ? (
          <p className="inv-alerta" role="status">
            {bajos.length === 1 ? '1 insumo está' : `${bajos.length} insumos están`} en o por debajo del umbral mínimo:{' '}
            {bajos.map((s) => s.producto).join(', ')}.
          </p>
        ) : null}

        {puedeRegistrar ? (
          <form className="inv-entrada" onSubmit={registrar} noValidate>
            {aviso ? (
              <p className="inv-aviso" role="status">
                {aviso}
              </p>
            ) : null}
            <Bloque titulo="Registrar entrada de stock">
              <Campo id="inv-producto" label="Producto" error={errores.stockId} ancho="completo">
                <select {...ariaError('inv-producto', errores.stockId)} value={entrada.stockId} onChange={(e) => set('stockId', e.target.value)}>
                  <option value="">Seleccione el producto…</option>
                  {STOCK_MOCK.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.producto}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="inv-lote" label="Lote" error={errores.lote}>
                <input
                  {...ariaError('inv-lote', errores.lote)}
                  type="text"
                  className="ff-campo__mono"
                  value={entrada.lote}
                  onChange={(e) => set('lote', e.target.value.toUpperCase())}
                  placeholder="L-2600"
                />
              </Campo>
              <Campo id="inv-cantidad" label="Cantidad" error={errores.cantidad}>
                <div className="ff-sufijo">
                  <input
                    {...ariaError('inv-cantidad', errores.cantidad)}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={entrada.cantidad}
                    onChange={(e) => set('cantidad', e.target.value)}
                    placeholder="0"
                  />
                  <span>{elegido?.unidad ?? '—'}</span>
                </div>
              </Campo>
              <Campo id="inv-fecha" label="Fecha de ingreso" error={errores.fecha}>
                <input {...ariaError('inv-fecha', errores.fecha)} type="date" value={entrada.fecha} onChange={(e) => set('fecha', e.target.value)} />
              </Campo>
              <Campo id="inv-proveedor" label="Proveedor" error={errores.proveedor}>
                <input
                  {...ariaError('inv-proveedor', errores.proveedor)}
                  type="text"
                  value={entrada.proveedor}
                  onChange={(e) => set('proveedor', e.target.value)}
                  placeholder="Química Suiza"
                />
              </Campo>
            </Bloque>
            <div className="inv-entrada__acciones">
              <Button type="submit" variant="primary">
                Registrar entrada
              </Button>
            </div>
          </form>
        ) : null}

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
                      {Number(s.cantidadActual.toFixed(2))} {s.unidad}
                    </td>
                    <td>
                      {s.umbralMinimo} {s.unidad}
                    </td>
                    <td>
                      <span className={`inv-estado ${bajo ? 'inv-estado--reponer' : 'inv-estado--ok'}`}>{bajo ? 'Reponer' : 'Ok'}</span>
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
