import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import './firma-canvas.css';

interface FirmaCanvasProps {
  valor: string | null;
  onCambiar: (firma: string | null) => void;
  deshabilitado: boolean;
}

/**
 * Firma digital del responsable del cliente en pantalla (§4, conformidad).
 * El trazo toma el color de tinta del tema al dibujar, igual que el lienzo
 * del Mapa Murino, para que se lea en claro y oscuro.
 */
export function FirmaCanvas({ valor, onCambiar, deshabilitado }: FirmaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = valor;
    }
    // Solo al montar: después el lienzo es la fuente de verdad del trazo en curso.
  }, []);

  function punto(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function empezar(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (deshabilitado) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    ultimo.current = punto(e);
  }

  function mover(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || !ultimo.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const actual = punto(e);
    ctx.strokeStyle = getComputedStyle(e.currentTarget).getPropertyValue('--gf-ink').trim() || '#23241f';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(actual.x, actual.y);
    ctx.stroke();
    ultimo.current = actual;
  }

  function terminar(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    dibujando.current = false;
    ultimo.current = null;
    onCambiar(e.currentTarget.toDataURL('image/png'));
  }

  function borrar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onCambiar(null);
  }

  return (
    <div className="firma">
      <div className="firma__lienzo-marco">
        <canvas
          ref={canvasRef}
          className="firma__lienzo"
          aria-label="Área de firma del responsable del cliente"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
        {!valor ? <span className="firma__guia">Firme aquí con el dedo</span> : null}
        <span className="firma__linea" aria-hidden="true" />
      </div>
      {!deshabilitado ? (
        <button type="button" className="firma__borrar" onClick={borrar} disabled={!valor}>
          Borrar firma
        </button>
      ) : null}
    </div>
  );
}
