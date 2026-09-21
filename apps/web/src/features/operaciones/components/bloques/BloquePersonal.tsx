import type { Interviniente } from '../../model/tipos';
import { Button } from '../../../../shared/ui/atoms/Button';

interface BloquePersonalProps {
  personal: Interviniente[];
  onCambiar: (personal: Interviniente[]) => void;
}

function crearId() {
  return `p-${Math.random().toString(36).slice(2, 9)}`;
}

export function BloquePersonal({ personal, onCambiar }: BloquePersonalProps) {
  function actualizarFila(id: string, campo: keyof Interviniente, valor: string) {
    onCambiar(personal.map((fila) => (fila.id === id ? { ...fila, [campo]: valor } : fila)));
  }

  function agregarFila() {
    onCambiar([...personal, { id: crearId(), nombre: '', cargo: '', dni: '' }]);
  }

  function quitarFila(id: string) {
    onCambiar(personal.filter((fila) => fila.id !== id));
  }

  return (
    <div className="bloque-lista">
      {personal.length === 0 ? (
        <p className="bloque-lista__vacio">Sin personal registrado todavía.</p>
      ) : null}
      {personal.map((fila) => (
        <div className="bloque-lista__fila" key={fila.id}>
          <input
            aria-label="Nombre completo"
            placeholder="Nombre completo"
            value={fila.nombre}
            onChange={(event) => actualizarFila(fila.id, 'nombre', event.target.value)}
          />
          <input
            aria-label="Cargo"
            placeholder="Cargo"
            value={fila.cargo}
            onChange={(event) => actualizarFila(fila.id, 'cargo', event.target.value)}
          />
          <input
            aria-label="DNI"
            placeholder="DNI"
            value={fila.dni}
            onChange={(event) => actualizarFila(fila.id, 'dni', event.target.value)}
          />
          <button
            type="button"
            className="bloque-lista__quitar"
            onClick={() => quitarFila(fila.id)}
            aria-label={`Quitar a ${fila.nombre || 'esta persona'}`}
          >
            Quitar
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={agregarFila}>
        + Agregar persona
      </Button>
    </div>
  );
}
