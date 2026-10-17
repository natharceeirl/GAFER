import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Canvas, Circle, Group, Rect, Line } from '@shopify/react-native-skia';
import { TOKENS } from '../../../shared/theme/tokens';

const { width: PANTALLA_ANCHO } = Dimensions.get('window');
const CANVAS_ALTO = 420;
const CANVAS_ANCHO = PANTALLA_ANCHO - 32;

export type NivelInfestacion = 0 | 1 | 2 | 3 | 4;

export interface EstacionPlano {
  id: string;
  codigo: string;
  numero: number;
  x: number;
  y: number;
  nivel: NivelInfestacion;
  zona: string;
  tipoCebo: string;
  consumoPorcentaje: number;
  colorAura: string;
  radioAura: number;
  colorCentro: string;
  auraIrradiacion: boolean;
}

const CONFIG_NIVELES: Record<
  NivelInfestacion,
  { label: string; radio: number; hexCentro: string; hexAura: string }
> = {
  0: { label: 'Inactivo (0%)', radio: 14, hexCentro: '#16a34a', hexAura: 'rgba(34, 197, 94, 0.22)' },
  1: { label: 'Leve (1-25%)', radio: 20, hexCentro: '#ca8a04', hexAura: 'rgba(234, 179, 8, 0.28)' },
  2: { label: 'Moderado (26-50%)', radio: 26, hexCentro: '#ea580c', hexAura: 'rgba(249, 115, 22, 0.32)' },
  3: { label: 'Alto (51-100%)', radio: 34, hexCentro: '#dc2626', hexAura: 'rgba(239, 68, 68, 0.38)' },
  4: { label: 'Crítico (Captura)', radio: 46, hexCentro: '#7e22ce', hexAura: 'rgba(147, 51, 234, 0.44)' },
};

function generarEstacionesPlanta(
  cantidad: number,
  anchoBase: number,
  altoBase: number,
): EstacionPlano[] {
  const estaciones: EstacionPlano[] = [];
  const zonas = [
    { nombre: 'Perímetro Exterior Sur', minY: altoBase * 0.85, maxY: altoBase * 0.95, minX: 40, maxX: anchoBase - 40, pesoNivel: [0.6, 0.3, 0.1, 0, 0] },
    { nombre: 'Muelle de Carga (Puertas 1-4)', minY: altoBase * 0.55, maxY: altoBase * 0.8, minX: anchoBase * 0.6, maxX: anchoBase - 50, pesoNivel: [0.1, 0.2, 0.4, 0.2, 0.1] },
    { nombre: 'Patio de Residuos / Compactador', minY: altoBase * 0.1, maxY: altoBase * 0.4, minX: 40, maxX: anchoBase * 0.35, pesoNivel: [0.05, 0.1, 0.25, 0.4, 0.2] },
    { nombre: 'Almacén de Granos y Silos', minY: altoBase * 0.1, maxY: altoBase * 0.45, minX: anchoBase * 0.4, maxX: anchoBase - 50, pesoNivel: [0.2, 0.4, 0.25, 0.15, 0] },
    { nombre: 'Sala de Procesamiento y Pasillos', minY: altoBase * 0.45, maxY: altoBase * 0.75, minX: anchoBase * 0.15, maxX: anchoBase * 0.55, pesoNivel: [0.7, 0.2, 0.1, 0, 0] },
  ];

  for (let i = 1; i <= cantidad; i++) {
    const zonaIdx = (i - 1) % zonas.length;
    const zona = zonas[zonaIdx];

    const x = zona.minX + Math.random() * (zona.maxX - zona.minX);
    const y = zona.minY + Math.random() * (zona.maxY - zona.minY);

    // Determinar nivel según peso de la zona
    const rand = Math.random();
    let acumulado = 0;
    let nivel: NivelInfestacion = 0;
    for (let n = 0; n < zona.pesoNivel.length; n++) {
      acumulado += zona.pesoNivel[n];
      if (rand <= acumulado) {
        nivel = n as NivelInfestacion;
        break;
      }
    }

    const conf = CONFIG_NIVELES[nivel];
    const tieneIrradiacion = nivel === 4 || (nivel === 3 && Math.random() > 0.4);

    estaciones.push({
      id: `estacion-${i}`,
      codigo: `E-${i < 10 ? '0' : ''}${i}`,
      numero: i,
      x,
      y,
      nivel,
      zona: zona.nombre,
      tipoCebo: nivel >= 3 ? 'Bloque Brodifacoum 20g' : 'Bloque Bromadiolona 20g',
      consumoPorcentaje: nivel === 0 ? 0 : nivel === 1 ? 15 : nivel === 2 ? 40 : nivel === 3 ? 75 : 100,
      colorAura: conf.hexAura,
      radioAura: conf.radio,
      colorCentro: conf.hexCentro,
      auraIrradiacion: tieneIrradiacion,
    });
  }

  return estaciones;
}

export const SpikePlanoSkiaSeccion: React.FC = () => {
  const [cantidadEstaciones, setCantidadEstaciones] = useState<number>(100);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [escala, setEscala] = useState(1);
  const [estacionSeleccionada, setEstacionSeleccionada] = useState<EstacionPlano | null>(null);

  // Telemetría en vivo de cuadros por segundo (FPS) en el hilo nativo de UI
  const [fps, setFps] = useState(60);
  const [tiempoCuadroMs, setTiempoCuadroMs] = useState(16.6);

  useEffect(() => {
    let animId: number;
    let frameCount = 0;
    let ultimoTiempo = performance.now();

    const loop = (tiempoActual: number) => {
      frameCount++;
      const delta = tiempoActual - ultimoTiempo;
      if (delta >= 500) {
        const fpsCalc = Math.round((frameCount * 1000) / delta);
        setFps(fpsCalc);
        setTiempoCuadroMs(Number((delta / frameCount).toFixed(1)));
        frameCount = 0;
        ultimoTiempo = tiempoActual;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const planoAncho = CANVAS_ANCHO * 1.8;
  const planoAlto = CANVAS_ALTO * 1.8;

  const estaciones = useMemo(
    () => generarEstacionesPlanta(cantidadEstaciones, planoAncho, planoAlto),
    [cantidadEstaciones, planoAncho, planoAlto],
  );

  const panOffset = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          panOffset.current = { x: translateX, y: translateY };
        },
        onPanResponderMove: (_, gestureState) => {
          setTranslateX(panOffset.current.x + gestureState.dx);
          setTranslateY(panOffset.current.y + gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          // Detección de toque sobre estación considerando pan y zoom
          if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
            const touchX = (gestureState.x0 - 16 - translateX) / escala;
            const touchY = (gestureState.y0 - 270 - translateY) / escala;

            const encontrada = estaciones.find((e) => {
              const dist = Math.hypot(e.x - touchX, e.y - touchY);
              return dist <= 28;
            });

            setEstacionSeleccionada(encontrada ?? null);
          }
        },
      }),
    [translateX, translateY, escala, estaciones],
  );

  const reiniciarVista = () => {
    setTranslateX(0);
    setTranslateY(0);
    setEscala(1);
    setEstacionSeleccionada(null);
  };

  const hacerZoom = (factor: number) => {
    setEscala((prev) => Math.max(0.5, Math.min(3.5, prev * factor)));
  };

  const fpsColor = fps >= 55 ? '#16a34a' : fps >= 40 ? '#d97706' : '#dc2626';
  const totalPrimitivasGpu = estaciones.length * 3 + 32;

  return (
    <View style={styles.contenedor}>
      {/* Panel de Telemetría en Vivo */}
      <View style={styles.panelMetricas}>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>⚡ Rendimiento en Vivo:</Text>
          <Text style={[styles.metricaValor, { color: fpsColor }]}>
            {fps} FPS ({tiempoCuadroMs} ms) — {fps >= 55 ? 'ÓPTIMO' : 'DEGRADADO'}
          </Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>🏢 Primitivas GPU en Pantalla:</Text>
          <Text style={styles.metricaValor}>
            {totalPrimitivasGpu} geometrías ({cantidadEstaciones} estaciones)
          </Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>🔍 Zoom / Desplazamiento:</Text>
          <Text style={styles.metricaValor}>
            {escala.toFixed(2)}x (X:{Math.round(translateX)}, Y:{Math.round(translateY)})
          </Text>
        </View>
      </View>

      {/* Selector de Estrés (§22.5 y §22.8) */}
      <View style={styles.selectorEstresFila}>
        <Text style={styles.selectorEtiqueta}>Carga (§22.5):</Text>
        {[50, 100, 150, 200].map((cant) => (
          <TouchableOpacity
            key={`cant-${cant}`}
            style={[
              styles.botonSelector,
              cantidadEstaciones === cant && styles.botonSelectorActivo,
            ]}
            onPress={() => setCantidadEstaciones(cant)}
          >
            <Text
              style={[
                styles.textoSelector,
                cantidadEstaciones === cant && styles.textoSelectorActivo,
              ]}
            >
              {cant} {cant === 100 ? '★' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Barra de Controles de Navegación */}
      <View style={styles.barraControles}>
        <TouchableOpacity style={styles.botonControl} onPress={() => hacerZoom(1.25)}>
          <Text style={styles.controlTexto}>Zoom +</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonControl} onPress={() => hacerZoom(0.8)}>
          <Text style={styles.controlTexto}>Zoom -</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonControl} onPress={reiniciarVista}>
          <Text style={styles.controlTexto}>Centrar</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Skia con Plano Arquitectónico y Estaciones */}
      <View style={styles.canvasContenedor} {...panResponder.panHandlers}>
        <Canvas style={{ width: CANVAS_ANCHO, height: CANVAS_ALTO }}>
          {/* Fondo cuadriculado arquitectónico */}
          <Rect x={0} y={0} width={CANVAS_ANCHO} height={CANVAS_ALTO} color="#f8fafc" />

          <Group transform={[{ translateX }, { translateY }, { scale: escala }]}>
            {/* 1. PLANO TÉCNICO ARQUITECTÓNICO DE PLANTA INDUSTRIAL */}
            {/* Perímetro de Hormigón Exterior */}
            <Rect
              x={20}
              y={20}
              width={planoAncho - 40}
              height={planoAlto - 40}
              color="#e2e8f0"
            />
            {/* Muros Perimetrales */}
            <Line p1={{ x: 20, y: 20 }} p2={{ x: planoAncho - 20, y: 20 }} color="#334155" strokeWidth={4} />
            <Line p1={{ x: planoAncho - 20, y: 20 }} p2={{ x: planoAncho - 20, y: planoAlto - 20 }} color="#334155" strokeWidth={4} />
            <Line p1={{ x: planoAncho - 20, y: planoAlto - 20 }} p2={{ x: 20, y: planoAlto - 20 }} color="#334155" strokeWidth={4} />
            <Line p1={{ x: 20, y: planoAlto - 20 }} p2={{ x: 20, y: 20 }} color="#334155" strokeWidth={4} />

            {/* Divisiones de Zonas de Planta */}
            {/* Zona A: Silos y Materia Prima (Noroeste) */}
            <Rect x={30} y={30} width={planoAncho * 0.35} height={planoAlto * 0.4} color="#f1f5f9" />
            <Line p1={{ x: 30, y: planoAlto * 0.43 }} p2={{ x: planoAncho * 0.38, y: planoAlto * 0.43 }} color="#94a3b8" strokeWidth={2} />
            <Line p1={{ x: planoAncho * 0.38, y: 30 }} p2={{ x: planoAncho * 0.38, y: planoAlto * 0.43 }} color="#94a3b8" strokeWidth={2} />

            {/* Zona B: Sala de Procesamiento (Noreste) */}
            <Rect x={planoAncho * 0.42} y={30} width={planoAncho * 0.54} height={planoAlto * 0.45} color="#e0f2fe" />
            <Line p1={{ x: planoAncho * 0.42, y: planoAlto * 0.48 }} p2={{ x: planoAncho - 30, y: planoAlto * 0.48 }} color="#64748b" strokeWidth={2} />

            {/* Zona C: Muelle de Carga y Puertas Seccionales (Sureste) */}
            <Rect x={planoAncho * 0.55} y={planoAlto * 0.52} width={planoAncho * 0.41} height={planoAlto * 0.42} color="#fef3c7" />
            {/* Puertas de Muelle 1 a 4 */}
            {Array.from({ length: 4 }).map((_, d) => (
              <Line
                key={`puerta-${d}`}
                p1={{ x: planoAncho - 22, y: planoAlto * 0.58 + d * 55 }}
                p2={{ x: planoAncho - 22, y: planoAlto * 0.58 + d * 55 + 35 }}
                color="#f59e0b"
                strokeWidth={5}
              />
            ))}

            {/* Zona D: Patio de Residuos y Compactador (Suroeste) */}
            <Rect x={30} y={planoAlto * 0.5} width={planoAncho * 0.32} height={planoAlto * 0.44} color="#fee2e2" />

            {/* Cuadrícula técnica de coordenadas */}
            {Array.from({ length: 12 }).map((_, c) => (
              <Line
                key={`grid-x-${c}`}
                p1={{ x: c * (planoAncho / 12), y: 0 }}
                p2={{ x: c * (planoAncho / 12), y: planoAlto }}
                color="rgba(148, 163, 184, 0.25)"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: 10 }).map((_, r) => (
              <Line
                key={`grid-y-${r}`}
                p1={{ x: 0, y: r * (planoAlto / 10) }}
                p2={{ x: planoAncho, y: r * (planoAlto / 10) }}
                color="rgba(148, 163, 184, 0.25)"
                strokeWidth={1}
              />
            ))}

            {/* 2. RENDERIZADO ACELERADO POR GPU DE ESTACIONES CEBADERAS */}
            {estaciones.map((estacion) => {
              const estaSeleccionada = estacionSeleccionada?.id === estacion.id;

              return (
                <Group key={estacion.id}>
                  {/* Irradiación amplia para estaciones con foco crítico (§21.5) */}
                  {estacion.auraIrradiacion && (
                    <Circle
                      cx={estacion.x}
                      cy={estacion.y}
                      r={estacion.radioAura * 1.5}
                      color="rgba(239, 68, 68, 0.12)"
                    />
                  )}

                  {/* Aura concéntrica según Nivel de Actividad (0 a 4) */}
                  <Circle
                    cx={estacion.x}
                    cy={estacion.y}
                    r={estaSeleccionada ? estacion.radioAura + 10 : estacion.radioAura}
                    color={estacion.colorAura}
                  />

                  {/* Anillo de contraste técnico */}
                  <Circle
                    cx={estacion.x}
                    cy={estacion.y}
                    r={estaSeleccionada ? 9 : 7}
                    color="#ffffff"
                  />

                  {/* Núcleo sólido de la estación */}
                  <Circle
                    cx={estacion.x}
                    cy={estacion.y}
                    r={estaSeleccionada ? 6 : 4.5}
                    color={estaSeleccionada ? '#0f172a' : estacion.colorCentro}
                  />
                </Group>
              );
            })}
          </Group>
        </Canvas>
      </View>

      {/* Ficha Técnica de la Estación Seleccionada */}
      {estacionSeleccionada ? (
        <View style={styles.tarjetaSeleccion}>
          <View style={styles.tarjetaHeader}>
            <Text style={styles.tarjetaTitulo}>
              📍 Estación {estacionSeleccionada.codigo} — {estacionSeleccionada.zona}
            </Text>
            <TouchableOpacity onPress={() => setEstacionSeleccionada(null)}>
              <Text style={styles.tarjetaCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.tarjetaDetalle}>
            Actividad: <Text style={{ fontWeight: '800' }}>{CONFIG_NIVELES[estacionSeleccionada.nivel].label}</Text> | Consumo: {estacionSeleccionada.consumoPorcentaje}%
          </Text>
          <Text style={styles.tarjetaDetalle}>
            Cebo activo: {estacionSeleccionada.tipoCebo}
          </Text>
        </View>
      ) : (
        <Text style={styles.instruccionesPie}>
          👆 Desliza el dedo para Pan, usa Zoom o toca los botones de carga para estresar la GPU de tu teléfono.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  panelMetricas: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  metricaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  metricaEtiqueta: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    fontWeight: '600',
  },
  metricaValor: {
    fontSize: 11,
    color: TOKENS.ink,
    fontWeight: '700',
  },
  selectorEstresFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  selectorEtiqueta: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  botonSelector: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  botonSelectorActivo: {
    backgroundColor: TOKENS.marca,
    borderColor: TOKENS.marca,
  },
  textoSelector: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  textoSelectorActivo: {
    color: '#ffffff',
  },
  barraControles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  botonControl: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 6,
    borderRadius: TOKENS.radiusSm,
    alignItems: 'center',
  },
  controlTexto: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  canvasContenedor: {
    width: CANVAS_ANCHO,
    height: CANVAS_ALTO,
    borderRadius: TOKENS.radiusSm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  tarjetaSeleccion: {
    backgroundColor: '#ffffff',
    borderColor: TOKENS.marca,
    borderWidth: 1.5,
    borderRadius: TOKENS.radiusSm,
    padding: 10,
    marginTop: 8,
  },
  tarjetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tarjetaTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  tarjetaCerrar: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    paddingHorizontal: 4,
  },
  tarjetaDetalle: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    lineHeight: 16,
  },
  instruccionesPie: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
