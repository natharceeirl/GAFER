import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../../../shared/ui/atoms/Button';
import type { Estacion } from '@gafer/contracts';
import type { EstacionConEstado, Punto } from '../model/aura';
import { dentroDelPoligono } from '../model/geometria';
import './terreno-canvas.css';

const RADIO_VERTICE = 5;
const RADIO_ESTACION = 10;
const RADIO_AURA = 17;
const RADIO_IRRADIACION = 100;
const TAMANO_CUADRICULA = 32;

/**
 * El <canvas> no hereda variables CSS solo: hay que leerlas del DOM en
 * el momento de dibujar. Así la cuadrícula, el trazo y las estaciones
 * cambian solos entre modo claro/oscuro, igual que el resto de la UI.
 */
function leerPaleta(el: HTMLElement) {
  const estilo = getComputedStyle(el);
  const leer = (token: string) => estilo.getPropertyValue(token).trim();
  return {
    ink: leer('--gf-ink'),
    panelRaised: leer('--gf-panel-raised'),
    rule: leer('--gf-rule'),
    ruleStrong: leer('--gf-rule-strong'),
    verde: leer('--gf-verde'),
    amarillo: leer('--gf-amarillo'),
    naranja: leer('--gf-naranja'),
    rojo: leer('--gf-rojo'),
    info: leer('--gf-info'),
  };
}

function colorIcono(paleta: ReturnType<typeof leerPaleta>, color: Estacion['colorIcono']) {
  return color === 'VERDE' ? paleta.verde : paleta.rojo;
}

/** Dibuja el contorno del ícono en la forma que marca el tipo de estación — spec §5.2. */
function trazarFormaEstacion(ctx: CanvasRenderingContext2D, x: number, y: number, radio: number, tipo: Estacion['tipoEstacion']) {
  ctx.beginPath();
  if (tipo === 'CEBO_RATICIDA') {
    ctx.arc(x, y, radio, 0, Math.PI * 2);
  } else {
    ctx.rect(x - radio, y - radio, radio * 2, radio * 2);
  }
}

function colorAura(paleta: ReturnType<typeof leerPaleta>, color: Estacion['colorAura']): string | null {
  switch (color) {
    case 'VERDE':
      return paleta.verde;
    case 'AMARILLO':
      return paleta.amarillo;
    case 'NARANJA':
      return paleta.naranja;
    case 'ROJO':
      return paleta.rojo;
    default:
      return null;
  }
}

/** El mismo color con alfa 0, para que el degradé no pase por tonos grises. */
function transparente(color: string): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  return hex ? `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, 0)` : 'transparent';
}

/**
 * Intensidad del halo irradiado según el nivel de aura — a mayor
 * severidad, mayor opacidad, para que la mancha de calor "pese" más
 * en el plano (spec §5.4: "el área entre ellas también se colorea con
 * la intensidad correspondiente").
 */
function intensidadAura(color: Estacion['colorAura']): number {
  switch (color) {
    case 'VERDE':
      return 0.16;
    case 'AMARILLO':
      return 0.22;
    case 'NARANJA':
      return 0.3;
    case 'ROJO':
      return 0.4;
    default:
      return 0;
  }
}

/** Imanta un punto a la intersección de cuadrícula más cercana. */
function imantarAGrilla(punto: Punto): Punto {
  return {
    x: Math.round(punto.x / TAMANO_CUADRICULA) * TAMANO_CUADRICULA,
    y: Math.round(punto.y / TAMANO_CUADRICULA) * TAMANO_CUADRICULA,
  };
}

interface TerrenoCanvasProps {
  puntos: Punto[];
  cerrado: boolean;
  estaciones: EstacionConEstado[];
  seleccionadaId: string | null;
  onAgregarPunto: (punto: Punto) => void;
  onCerrarTerreno: () => void;
  onDeshacerPunto: () => void;
  onReabrirTerreno: () => void;
  onLimpiarPlano: () => void;
  onColocar: (id: string, punto: Punto | null) => void;
  onSeleccionar: (id: string) => void;
  /** Mapa de una visita ya registrada: solo se consultan las estaciones. */
  soloLectura?: boolean;
  /** Estaciones que el técnico movió en la visita mirada, con su lugar anterior. */
  reubicaciones?: Array<{ id: string; desde: Punto }>;
  /** Estaciones instaladas en la visita mirada. */
  nuevas?: string[];
}

/**
 * Lienzo de UN plano: traza su terreno punto por punto y después ubica
 * sus estaciones. Terreno y estaciones son estado del padre
 * (MapaMurinoPage) — el lienzo no guarda nada propio salvo el cursor
 * (puramente visual), porque cada plano necesita conservar su propio
 * terreno al cambiar de pestaña (spec §5.5, "hasta 20 planos por
 * proyecto").
 */
export function TerrenoCanvas({
  puntos,
  cerrado,
  estaciones,
  seleccionadaId,
  onAgregarPunto,
  onCerrarTerreno,
  onDeshacerPunto,
  onReabrirTerreno,
  onLimpiarPlano,
  onColocar,
  onSeleccionar,
  soloLectura = false,
  reubicaciones = [],
  nuevas = [],
}: TerrenoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<Punto | null>(null);

  const colocadas = estaciones.filter((e): e is EstacionConEstado & { posicion: Punto } => e.posicion !== null);
  const siguienteEstacion = estaciones.find((e) => e.posicion === null) ?? null;
  const todasColocadas = colocadas.length === estaciones.length;

  const dibujar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const paleta = leerPaleta(canvas);

    // cuadrícula — apenas visible, es referencia, no protagonista. El
    // color sale de --gf-rule (ya resuelve claro/oscuro); la opacidad
    // baja es lo que la mantiene discreta en los dos modos.
    ctx.strokeStyle = paleta.rule;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    for (let x = TAMANO_CUADRICULA; x < width; x += TAMANO_CUADRICULA) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = TAMANO_CUADRICULA; y < height; y += TAMANO_CUADRICULA) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (puntos.length === 0) return;

    // relleno del terreno, solo una vez cerrado
    if (cerrado) {
      ctx.beginPath();
      ctx.moveTo(puntos[0].x, puntos[0].y);
      puntos.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = paleta.verde;
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // mapa de calor — irradiación del aura entre estaciones próximas
    // (spec §5.4). Cada estación con aura activa aporta un halo radial
    // que se desvanece con la distancia; donde dos halos se superponen
    // el color se intensifica, así el área ENTRE dos estaciones cercanas
    // también queda coloreada. Cada halo se desvanece hacia su propio
    // color transparente: mezclar hacia negro transparente, o sumar con
    // "lighter", oscurece los focos cuando se juntan varias auras. Una
    // estación sin aura (SIN_COLOR) no aporta nada. Va recortado al
    // polígono para no pintar fuera del terreno.
    if (cerrado) {
      const conAura = colocadas.filter((c) => c.estacion.colorAura !== 'SIN_COLOR');
      if (conAura.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(puntos[0].x, puntos[0].y);
        puntos.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.clip();
        conAura.forEach(({ estacion, posicion }) => {
          const color = colorAura(paleta, estacion.colorAura);
          if (!color) return;
          const gradiente = ctx.createRadialGradient(posicion.x, posicion.y, 0, posicion.x, posicion.y, RADIO_IRRADIACION);
          gradiente.addColorStop(0, color);
          gradiente.addColorStop(1, transparente(color));
          ctx.globalAlpha = intensidadAura(estacion.colorAura);
          ctx.fillStyle = gradiente;
          ctx.beginPath();
          ctx.arc(posicion.x, posicion.y, RADIO_IRRADIACION, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // trazo del terreno
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    puntos.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    if (cerrado) {
      ctx.closePath();
    } else if (cursor) {
      // línea de goma hasta el cursor — muestra el próximo tramo antes de fijarlo
      ctx.lineTo(cursor.x, cursor.y);
    }
    ctx.strokeStyle = paleta.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash(cerrado ? [] : [6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // vértices del terreno
    puntos.forEach((p, i) => {
      const esPrimero = i === 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, esPrimero && !cerrado ? RADIO_VERTICE + 2 : RADIO_VERTICE, 0, Math.PI * 2);
      ctx.fillStyle = cerrado ? paleta.verde : esPrimero ? paleta.naranja : paleta.ink;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = paleta.panelRaised;
      ctx.stroke();
    });

    // reubicaciones de la visita: contorno punteado donde estaba y flecha hasta donde quedó
    reubicaciones.forEach(({ id, desde }) => {
      const destino = colocadas.find((c) => c.estacion.id === id);
      if (!destino) return;
      const { x, y } = destino.posicion;
      const angulo = Math.atan2(y - desde.y, x - desde.x);
      const fin = {
        x: x - Math.cos(angulo) * (RADIO_AURA + 2),
        y: y - Math.sin(angulo) * (RADIO_AURA + 2),
      };
      ctx.strokeStyle = paleta.info;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      trazarFormaEstacion(ctx, desde.x, desde.y, RADIO_ESTACION, destino.estacion.tipoEstacion);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(desde.x + Math.cos(angulo) * RADIO_ESTACION, desde.y + Math.sin(angulo) * RADIO_ESTACION);
      ctx.lineTo(fin.x, fin.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(fin.x, fin.y);
      ctx.lineTo(fin.x - Math.cos(angulo - 0.45) * 8, fin.y - Math.sin(angulo - 0.45) * 8);
      ctx.lineTo(fin.x - Math.cos(angulo + 0.45) * 8, fin.y - Math.sin(angulo + 0.45) * 8);
      ctx.closePath();
      ctx.fillStyle = paleta.info;
      ctx.fill();
    });

    // estaciones colocadas — halo individual de aura (capa 2, spec §5.2) + ícono (última visita) + número
    colocadas.forEach(({ estacion, posicion }) => {
      const { x, y } = posicion;
      const colorDeAura = colorAura(paleta, estacion.colorAura);
      if (colorDeAura) {
        ctx.beginPath();
        ctx.arc(x, y, RADIO_AURA, 0, Math.PI * 2);
        ctx.fillStyle = colorDeAura;
        ctx.globalAlpha = 0.28;
        ctx.shadowColor = colorDeAura;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      trazarFormaEstacion(ctx, x, y, RADIO_ESTACION, estacion.tipoEstacion);
      ctx.fillStyle = paleta.panelRaised;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = colorIcono(paleta, estacion.colorIcono);
      ctx.stroke();

      ctx.fillStyle = paleta.ink;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(estacion.numero), x, y + 1);

      if (nuevas.includes(estacion.id)) {
        ctx.beginPath();
        ctx.arc(x, y, RADIO_AURA + 3, 0, Math.PI * 2);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = paleta.info;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (estacion.id === seleccionadaId) {
        ctx.beginPath();
        ctx.arc(x, y, RADIO_ESTACION + 5, 0, Math.PI * 2);
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = paleta.ink;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // fantasma de la próxima estación a colocar, siguiendo el cursor
    if (cerrado && !todasColocadas && siguienteEstacion && cursor && dentroDelPoligono(cursor, puntos)) {
      trazarFormaEstacion(ctx, cursor.x, cursor.y, RADIO_ESTACION, siguienteEstacion.estacion.tipoEstacion);
      ctx.fillStyle = paleta.ink;
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = paleta.ruleStrong;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [puntos, cerrado, cursor, colocadas, todasColocadas, siguienteEstacion, seleccionadaId, reubicaciones, nuevas]);

  useEffect(() => {
    dibujar();
    const onCambio = () => dibujar();
    window.addEventListener('resize', onCambio);
    const mediaOscuro = window.matchMedia('(prefers-color-scheme: dark)');
    mediaOscuro.addEventListener('change', onCambio);
    // El botón de tema cambia data-theme en <html> sin tocar la preferencia del sistema.
    const observador = new MutationObserver(onCambio);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      window.removeEventListener('resize', onCambio);
      mediaOscuro.removeEventListener('change', onCambio);
      observador.disconnect();
    };
  }, [dibujar]);

  function posicionDesdeEvento(e: ReactPointerEvent<HTMLCanvasElement>): Punto {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function manejarClic(e: ReactPointerEvent<HTMLCanvasElement>) {
    const punto = posicionDesdeEvento(e);

    // modo estaciones — el terreno ya está cerrado
    if (cerrado) {
      // Un clic sobre una estación ya colocada la selecciona para ver su
      // historial (§5.6); las estaciones son fijas, no se reubican.
      const tocada = colocadas.find((e2) => Math.hypot(punto.x - e2.posicion.x, punto.y - e2.posicion.y) <= RADIO_AURA);
      if (tocada) {
        onSeleccionar(tocada.estacion.id);
        return;
      }
      if (soloLectura) return;

      // si no tocó ninguna existente, coloca la próxima en la lista.
      // Las estaciones NO se imantan: una trampa va donde hay actividad
      // real, no donde caiga la cuadrícula.
      if (!siguienteEstacion) return;
      if (!dentroDelPoligono(punto, puntos)) return;
      onColocar(siguienteEstacion.estacion.id, punto);
      return;
    }

    // modo trazar terreno — cada vértice se imanta a la grilla, para un
    // trazo prolijo tipo plano técnico en vez de a mano alzada.
    if (puntos.length >= 3) {
      // la cercanía al primer punto se mide sobre el clic crudo, no el
      // imantado: si se compararan dos puntos ya imantados, un clic que
      // cae justo al borde entre dos celdas puede saltar a la vecina y
      // nunca "tocar" al primero — con esto, medio cuadro de tolerancia
      // alrededor del primer vértice siempre cierra.
      const primero = puntos[0];
      const distancia = Math.hypot(punto.x - primero.x, punto.y - primero.y);
      if (distancia <= TAMANO_CUADRICULA / 2) {
        onCerrarTerreno();
        setCursor(null);
        return;
      }
    }
    onAgregarPunto(imantarAGrilla(punto));
  }

  function manejarMovimiento(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (soloLectura) return;
    const punto = posicionDesdeEvento(e);
    setCursor(cerrado ? punto : imantarAGrilla(punto));
  }

  function deshacer() {
    if (colocadas.length > 0) {
      onColocar(colocadas[colocadas.length - 1].estacion.id, null);
      return;
    }
    if (cerrado) {
      onReabrirTerreno();
      return;
    }
    onDeshacerPunto();
  }

  const etiquetaDeshacer = colocadas.length > 0 ? 'Deshacer estación' : cerrado ? 'Reabrir terreno' : 'Deshacer punto';

  return (
    <div className="terreno-canvas">
      <div className="terreno-canvas__stage">
        <canvas
          ref={canvasRef}
          className={soloLectura ? 'terreno-canvas__lienzo terreno-canvas__lienzo--lectura' : 'terreno-canvas__lienzo'}
          onPointerDown={manejarClic}
          onPointerMove={manejarMovimiento}
          onPointerLeave={() => setCursor(null)}
        />
        {puntos.length === 0 ? (
          <p className="terreno-canvas__vacio">Haga clic en el lienzo para marcar el primer punto del terreno</p>
        ) : null}
        {!soloLectura && cerrado && !todasColocadas ? (
          <div className="terreno-canvas__aviso" aria-hidden="true">
            Estación N.° {siguienteEstacion?.estacion.numero}: haga clic dentro del terreno para ubicarla, o en una estación ya ubicada para
            ver su historial
          </div>
        ) : null}
        {soloLectura ? null : todasColocadas && !seleccionadaId ? (
          <div className="terreno-canvas__sello" aria-hidden="true">
            {estaciones.length}/{estaciones.length} ESTACIONES UBICADAS
          </div>
        ) : cerrado && !seleccionadaId ? (
          <div className="terreno-canvas__sello" aria-hidden="true">
            TERRENO DEFINIDO
          </div>
        ) : null}
      </div>

      {soloLectura ? null : (
        <div className="terreno-canvas__barra">
          <span className="terreno-canvas__conteo tabular">
            {puntos.length} {puntos.length === 1 ? 'punto' : 'puntos'}
            {cerrado
              ? ` · cerrado · ${colocadas.length}/${estaciones.length} estaciones`
              : puntos.length >= 3
                ? ' · haga clic en el primer punto para cerrar'
                : ''}
          </span>
          <div className="terreno-canvas__botones">
            <Button type="button" variant="secondary" onClick={deshacer} disabled={puntos.length === 0 && colocadas.length === 0}>
              {etiquetaDeshacer}
            </Button>
            <Button type="button" variant="secondary" onClick={onLimpiarPlano} disabled={puntos.length === 0}>
              Limpiar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
