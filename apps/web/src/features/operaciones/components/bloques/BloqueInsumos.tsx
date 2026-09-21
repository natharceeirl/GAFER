import type { InsumoAplicado } from '../../model/tipos';
import { Button } from '../../../../shared/ui/atoms/Button';

interface BloqueInsumosProps {
  insumos: InsumoAplicado[];
  onCambiar: (insumos: InsumoAplicado[]) => void;
}

function crearId() {
  return `i-${Math.random().toString(36).slice(2, 9)}`;
}

const INSUMO_VACIO: Omit<InsumoAplicado, 'id'> = {
  producto: '',
  lote: '',
  vencimiento: '',
  registroDigesa: '',
  cantidad: '',
  concentracion: '',
  unidad: '',
  zonas: '',
};

export function BloqueInsumos({ insumos, onCambiar }: BloqueInsumosProps) {
  function actualizarFila(id: string, campo: keyof InsumoAplicado, valor: string) {
    onCambiar(insumos.map((fila) => (fila.id === id ? { ...fila, [campo]: valor } : fila)));
  }

  function agregarFila() {
    onCambiar([...insumos, { id: crearId(), ...INSUMO_VACIO }]);
  }

  function quitarFila(id: string) {
    onCambiar(insumos.filter((fila) => fila.id !== id));
  }

  return (
    <div className="bloque-insumos">
      {insumos.length === 0 ? <p className="bloque-lista__vacio">Sin insumos aplicados todavía.</p> : null}
      {insumos.map((fila) => (
        <fieldset className="bloque-insumos__fila" key={fila.id}>
          <legend>Insumo</legend>
          <input
            aria-label="Producto"
            placeholder="Producto (ej. Cipermetrina 25%)"
            value={fila.producto}
            onChange={(event) => actualizarFila(fila.id, 'producto', event.target.value)}
          />
          <div className="bloque-insumos__grid">
            <input
              aria-label="Lote"
              placeholder="Lote"
              value={fila.lote}
              onChange={(event) => actualizarFila(fila.id, 'lote', event.target.value)}
            />
            <input
              aria-label="Vencimiento"
              type="date"
              value={fila.vencimiento}
              onChange={(event) => actualizarFila(fila.id, 'vencimiento', event.target.value)}
            />
            <input
              aria-label="N° registro DIGESA"
              placeholder="N.° DIGESA"
              value={fila.registroDigesa}
              onChange={(event) => actualizarFila(fila.id, 'registroDigesa', event.target.value)}
            />
          </div>
          <div className="bloque-insumos__grid">
            <input
              aria-label="Cantidad"
              className="tabular"
              inputMode="decimal"
              placeholder="Cantidad"
              value={fila.cantidad}
              onChange={(event) => actualizarFila(fila.id, 'cantidad', event.target.value)}
            />
            <input
              aria-label="Concentración"
              placeholder="Concentración"
              value={fila.concentracion}
              onChange={(event) => actualizarFila(fila.id, 'concentracion', event.target.value)}
            />
            <input
              aria-label="Unidad"
              placeholder="Unidad (ml, L, g...)"
              value={fila.unidad}
              onChange={(event) => actualizarFila(fila.id, 'unidad', event.target.value)}
            />
          </div>
          <input
            aria-label="Zonas de aplicación"
            placeholder="Zonas de aplicación"
            value={fila.zonas}
            onChange={(event) => actualizarFila(fila.id, 'zonas', event.target.value)}
          />
          <button
            type="button"
            className="bloque-lista__quitar"
            onClick={() => quitarFila(fila.id)}
            aria-label={`Quitar insumo ${fila.producto || ''}`}
          >
            Quitar insumo
          </button>
        </fieldset>
      ))}
      <Button type="button" variant="secondary" onClick={agregarFila}>
        + Agregar insumo
      </Button>
    </div>
  );
}
