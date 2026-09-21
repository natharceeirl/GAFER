import { useEffect, useRef, useState } from 'react';
import type { ConformidadCliente } from '../../model/tipos';
import { Button } from '../../../../shared/ui/atoms/Button';

interface BloqueFirmaProps {
  conformidad: ConformidadCliente;
  onCambiar: (conformidad: ConformidadCliente) => void;
}

/**
 * Firma digital real sobre <canvas> — la interacción de cierre del
 * ticket. El nombre del firmante es texto libre porque puede cambiar
 * en cada visita, según la especificación.
 */
export function BloqueFirma({ conformidad, onCambiar }: BloqueFirmaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(Boolean(conformidad.firmaDataUrl));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    // canvas 2D no resuelve custom properties CSS: se lee el valor computado.
    const inkToken = getComputedStyle(canvas).getPropertyValue('--gf-ink').trim();
    ctx.strokeStyle = inkToken || '#23241f';
  }, []);

  function posicion(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function iniciarTrazo(event: React.PointerEvent<HTMLCanvasElement>) {
    if (conformidad.responsableNoDisponible) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    dibujando.current = true;
    const { x, y } = posicion(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function continuarTrazo(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = posicion(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setTieneTrazo(true);
  }

  function terminarTrazo() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onCambiar({ ...conformidad, firmaDataUrl: canvas.toDataURL('image/png') });
    }
  }

  function limpiarFirma() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
    onCambiar({ ...conformidad, firmaDataUrl: null });
  }

  return (
    <div className="bloque-firma">
      <label className="bloque-firma__toggle">
        <input
          type="checkbox"
          checked={conformidad.responsableNoDisponible}
          onChange={(event) =>
            onCambiar({ ...conformidad, responsableNoDisponible: event.target.checked })
          }
        />
        Responsable no disponible al momento del servicio
      </label>

      <canvas
        ref={canvasRef}
        className={`bloque-firma__lienzo ${conformidad.responsableNoDisponible ? 'bloque-firma__lienzo--deshabilitado' : ''}`}
        width={480}
        height={160}
        role="img"
        aria-label={tieneTrazo ? 'Firma capturada' : 'Área para firmar con el dedo o stylus'}
        onPointerDown={iniciarTrazo}
        onPointerMove={continuarTrazo}
        onPointerUp={terminarTrazo}
        onPointerLeave={terminarTrazo}
      />
      <Button type="button" variant="secondary" onClick={limpiarFirma} disabled={!tieneTrazo}>
        Limpiar firma
      </Button>

      <div className="bloque-insumos__grid">
        <input
          aria-label="Nombre completo del firmante"
          placeholder="Nombre completo del firmante"
          value={conformidad.nombreCompleto}
          disabled={conformidad.responsableNoDisponible}
          onChange={(event) => onCambiar({ ...conformidad, nombreCompleto: event.target.value })}
        />
        <input
          aria-label="Cargo del firmante"
          placeholder="Cargo"
          value={conformidad.cargo}
          disabled={conformidad.responsableNoDisponible}
          onChange={(event) => onCambiar({ ...conformidad, cargo: event.target.value })}
        />
      </div>
    </div>
  );
}
