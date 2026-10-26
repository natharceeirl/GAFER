import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import {
  Canvas,
  Circle,
  Group,
  Rect,
  Line,
  Picture,
  createPicture,
  Skia,
  PaintStyle,
} from '@shopify/react-native-skia';
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
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const escala = useSharedValue(1);
  const [telemetriaVista, setTelemetriaVista] = useState({ x: 0, y: 0, escala: 1 });
  const [estacionSeleccionada, setEstacionSeleccionada] = useState<EstacionPlano | null>(null);

  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: escala.value },
  ]);

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

  // Pre-grabado en GPU del Plano Técnico Arquitectónico (§22.5)
  // Almacenado como SkPicture inmutable: CERO diffing ni reconciliación en Virtual DOM durante Pan/Zoom
  const planoPicture = useMemo(() => {
    if (typeof Skia === 'undefined' || typeof createPicture !== 'function') return null;

    return createPicture((canvas) => {
      // 1. Perímetro de Hormigón Exterior
      const paintPerimetro = Skia.Paint();
      paintPerimetro.setColor(Skia.Color('#e2e8f0'));
      paintPerimetro.setStyle(PaintStyle.Fill);
      canvas.drawRect(Skia.XYWHRect(20, 20, planoAncho - 40, planoAlto - 40), paintPerimetro);

      // 2. Muros Perimetrales
      const paintMuro = Skia.Paint();
      paintMuro.setColor(Skia.Color('#334155'));
      paintMuro.setStyle(PaintStyle.Stroke);
      paintMuro.setStrokeWidth(4);
      paintMuro.setAntiAlias(true);
      canvas.drawLine(20, 20, planoAncho - 20, 20, paintMuro);
      canvas.drawLine(planoAncho - 20, 20, planoAncho - 20, planoAlto - 20, paintMuro);
      canvas.drawLine(planoAncho - 20, planoAlto - 20, 20, planoAlto - 20, paintMuro);
      canvas.drawLine(20, planoAlto - 20, 20, 20, paintMuro);

      // 3. Divisiones de Zonas de Planta
      // Zona A: Silos y Materia Prima (Noroeste)
      const paintZonaA = Skia.Paint();
      paintZonaA.setColor(Skia.Color('#f1f5f9'));
      paintZonaA.setStyle(PaintStyle.Fill);
      canvas.drawRect(Skia.XYWHRect(30, 30, planoAncho * 0.35, planoAlto * 0.4), paintZonaA);

      const paintDivA = Skia.Paint();
      paintDivA.setColor(Skia.Color('#94a3b8'));
      paintDivA.setStyle(PaintStyle.Stroke);
      paintDivA.setStrokeWidth(2);
      paintDivA.setAntiAlias(true);
      canvas.drawLine(30, planoAlto * 0.43, planoAncho * 0.38, planoAlto * 0.43, paintDivA);
      canvas.drawLine(planoAncho * 0.38, 30, planoAncho * 0.38, planoAlto * 0.43, paintDivA);

      // Zona B: Sala de Procesamiento (Noreste)
      const paintZonaB = Skia.Paint();
      paintZonaB.setColor(Skia.Color('#e0f2fe'));
      paintZonaB.setStyle(PaintStyle.Fill);
      canvas.drawRect(Skia.XYWHRect(planoAncho * 0.42, 30, planoAncho * 0.54, planoAlto * 0.45), paintZonaB);

      const paintDivB = Skia.Paint();
      paintDivB.setColor(Skia.Color('#64748b'));
      paintDivB.setStyle(PaintStyle.Stroke);
      paintDivB.setStrokeWidth(2);
      paintDivB.setAntiAlias(true);
      canvas.drawLine(planoAncho * 0.42, planoAlto * 0.48, planoAncho - 30, planoAlto * 0.48, paintDivB);

      // Zona C: Muelle de Carga y Puertas Seccionales (Sureste)
      const paintZonaC = Skia.Paint();
      paintZonaC.setColor(Skia.Color('#fef3c7'));
      paintZonaC.setStyle(PaintStyle.Fill);
      canvas.drawRect(Skia.XYWHRect(planoAncho * 0.55, planoAlto * 0.52, planoAncho * 0.41, planoAlto * 0.42), paintZonaC);

      const paintPuerta = Skia.Paint();
      paintPuerta.setColor(Skia.Color('#f59e0b'));
      paintPuerta.setStyle(PaintStyle.Stroke);
      paintPuerta.setStrokeWidth(5);
      paintPuerta.setAntiAlias(true);
      for (let d = 0; d < 4; d++) {
        canvas.drawLine(
          planoAncho - 22,
          planoAlto * 0.58 + d * 55,
          planoAncho - 22,
          planoAlto * 0.58 + d * 55 + 35,
          paintPuerta,
        );
      }

      // Zona D: Patio de Residuos y Compactador (Suroeste)
      const paintZonaD = Skia.Paint();
      paintZonaD.setColor(Skia.Color('#fee2e2'));
      paintZonaD.setStyle(PaintStyle.Fill);
      canvas.drawRect(Skia.XYWHRect(30, planoAlto * 0.5, planoAncho * 0.32, planoAlto * 0.44), paintZonaD);

      // Cuadrícula técnica de coordenadas
      const paintGrid = Skia.Paint();
      paintGrid.setColor(Skia.Color('rgba(148, 163, 184, 0.25)'));
      paintGrid.setStyle(PaintStyle.Stroke);
      paintGrid.setStrokeWidth(1);

      for (let c = 0; c < 12; c++) {
        canvas.drawLine(c * (planoAncho / 12), 0, c * (planoAncho / 12), planoAlto, paintGrid);
      }
      for (let r = 0; r < 10; r++) {
        canvas.drawLine(0, r * (planoAlto / 10), planoAncho, r * (planoAlto / 10), paintGrid);
      }
    }, Skia.XYWHRect(0, 0, planoAncho, planoAlto));
  }, [planoAncho, planoAlto]);

  // Pre-grabado en GPU del conjunto de Estaciones Cebaderas
  // Pinta las 100/200 estaciones por lote de pinturas pre-instanciadas en memoria nativa
  const estacionesPicture = useMemo(() => {
    if (typeof Skia === 'undefined' || typeof createPicture !== 'function') return null;

    return createPicture((canvas) => {
      const paintIrradiacion = Skia.Paint();
      paintIrradiacion.setColor(Skia.Color('rgba(239, 68, 68, 0.12)'));
      paintIrradiacion.setStyle(PaintStyle.Fill);
      paintIrradiacion.setAntiAlias(true);

      const paintAnilloBlanco = Skia.Paint();
      paintAnilloBlanco.setColor(Skia.Color('#ffffff'));
      paintAnilloBlanco.setStyle(PaintStyle.Fill);
      paintAnilloBlanco.setAntiAlias(true);

      const paintsAura: Record<number, ReturnType<typeof Skia.Paint>> = {};
      const paintsCentro: Record<number, ReturnType<typeof Skia.Paint>> = {};

      for (let lvl = 0; lvl <= 4; lvl++) {
        const conf = CONFIG_NIVELES[lvl as NivelInfestacion];
        const pAura = Skia.Paint();
        pAura.setColor(Skia.Color(conf.hexAura));
        pAura.setStyle(PaintStyle.Fill);
        pAura.setAntiAlias(true);
        paintsAura[lvl] = pAura;

        const pCentro = Skia.Paint();
        pCentro.setColor(Skia.Color(conf.hexCentro));
        pCentro.setStyle(PaintStyle.Fill);
        pCentro.setAntiAlias(true);
        paintsCentro[lvl] = pCentro;
      }

      for (const est of estaciones) {
        if (est.auraIrradiacion) {
          canvas.drawCircle(est.x, est.y, est.radioAura * 1.5, paintIrradiacion);
        }
        canvas.drawCircle(est.x, est.y, est.radioAura, paintsAura[est.nivel]);
        canvas.drawCircle(est.x, est.y, 7, paintAnilloBlanco);
        canvas.drawCircle(est.x, est.y, 4.5, paintsCentro[est.nivel]);
      }
    }, Skia.XYWHRect(0, 0, planoAncho, planoAlto));
  }, [estaciones, planoAncho, planoAlto]);

  const panOffset = useRef({ x: 0, y: 0 });
  const estacionesRef = useRef(estaciones);
  estacionesRef.current = estaciones;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          panOffset.current = {
            x: translateX.value,
            y: translateY.value,
          };
        },
        onPanResponderMove: (_, gestureState) => {
          // Actualización directa en UI thread mediante Reanimated SharedValue
          // CERO re-renders de React, CERO diffing en JS thread
          translateX.value = panOffset.current.x + gestureState.dx;
          translateY.value = panOffset.current.y + gestureState.dy;
        },
        onPanResponderRelease: (_, gestureState) => {
          const finalX = panOffset.current.x + gestureState.dx;
          const finalY = panOffset.current.y + gestureState.dy;
          translateX.value = finalX;
          translateY.value = finalY;
          setTelemetriaVista((prev) => ({ ...prev, x: finalX, y: finalY }));

          // Detección de toque sobre estación considerando pan y zoom
          if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
            const curEscala = escala.value;
            const touchX = (gestureState.x0 - 16 - finalX) / curEscala;
            const touchY = (gestureState.y0 - 270 - finalY) / curEscala;

            const encontrada = estacionesRef.current.find((e) => {
              const dist = Math.hypot(e.x - touchX, e.y - touchY);
              return dist <= 28;
            });

            setEstacionSeleccionada(encontrada ?? null);
          }
        },
      }),
    [translateX, translateY, escala],
  );

  const reiniciarVista = () => {
    translateX.value = 0;
    translateY.value = 0;
    escala.value = 1;
    setTelemetriaVista({ x: 0, y: 0, escala: 1 });
    setEstacionSeleccionada(null);
  };

  const hacerZoom = (factor: number) => {
    const nuevaEscala = Math.max(0.5, Math.min(3.5, escala.value * factor));
    escala.value = nuevaEscala;
    setTelemetriaVista((prev) => ({ ...prev, escala: nuevaEscala }));
  };

  const fpsColor = fps >= 48 ? '#16a34a' : fps >= 35 ? '#d97706' : '#dc2626';
  const totalPrimitivasGpu = estaciones.length * 3 + 32;

  return (
    <View style={styles.contenedor}>
      {/* Panel de Telemetría en Vivo */}
      <View style={styles.panelMetricas}>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>⚡ Rendimiento en Vivo:</Text>
          <Text style={[styles.metricaValor, { color: fpsColor }]}>
            {fps} FPS ({tiempoCuadroMs} ms) — {fps >= 48 ? 'ÓPTIMO' : fps >= 35 ? 'ESTABLE' : 'DEGRADADO'}
          </Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>🏢 Primitivas GPU en Pantalla:</Text>
          <Text style={styles.metricaValor}>
            {totalPrimitivasGpu} geometrías ({cantidadEstaciones} estaciones) {planoPicture ? '⚡ GPU SkPicture' : ''}
          </Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>🔍 Zoom / Desplazamiento:</Text>
          <Text style={styles.metricaValor}>
            {telemetriaVista.escala.toFixed(2)}x (X:{Math.round(telemetriaVista.x)}, Y:{Math.round(telemetriaVista.y)})
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
        <Canvas style={{ width: CANVAS_ANCHO, height: CANVAS_ALTO }} opaque androidWarmup>
          {/* Fondo cuadriculado arquitectónico */}
          <Rect x={0} y={0} width={CANVAS_ANCHO} height={CANVAS_ALTO} color="#f8fafc" />

          <Group transform={transform}>
            {planoPicture && estacionesPicture ? (
              <>
                {/* 1. PLANO Y ESTACIONES PRE-GRABADOS EN GPU (CERO DIFF DE VIRTUAL DOM) */}
                <Picture picture={planoPicture} />
                <Picture picture={estacionesPicture} />

                {/* 2. RESALTE DE ESTACIÓN SELECCIONADA */}
                {estacionSeleccionada && (
                  <Group>
                    {estacionSeleccionada.auraIrradiacion && (
                      <Circle
                        cx={estacionSeleccionada.x}
                        cy={estacionSeleccionada.y}
                        r={(estacionSeleccionada.radioAura + 10) * 1.5}
                        color="rgba(239, 68, 68, 0.2)"
                      />
                    )}
                    <Circle
                      cx={estacionSeleccionada.x}
                      cy={estacionSeleccionada.y}
                      r={estacionSeleccionada.radioAura + 10}
                      color={estacionSeleccionada.colorAura}
                    />
                    <Circle
                      cx={estacionSeleccionada.x}
                      cy={estacionSeleccionada.y}
                      r={9}
                      color="#ffffff"
                    />
                    <Circle
                      cx={estacionSeleccionada.x}
                      cy={estacionSeleccionada.y}
                      r={6}
                      color="#0f172a"
                    />
                  </Group>
                )}
              </>
            ) : (
              /* Fallback declarativo en caso de entorno sin JSI */
              <>
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
                <Rect x={30} y={30} width={planoAncho * 0.35} height={planoAlto * 0.4} color="#f1f5f9" />
                <Line p1={{ x: 30, y: planoAlto * 0.43 }} p2={{ x: planoAncho * 0.38, y: planoAlto * 0.43 }} color="#94a3b8" strokeWidth={2} />
                <Line p1={{ x: planoAncho * 0.38, y: 30 }} p2={{ x: planoAncho * 0.38, y: planoAlto * 0.43 }} color="#94a3b8" strokeWidth={2} />

                <Rect x={planoAncho * 0.42} y={30} width={planoAncho * 0.54} height={planoAlto * 0.45} color="#e0f2fe" />
                <Line p1={{ x: planoAncho * 0.42, y: planoAlto * 0.48 }} p2={{ x: planoAncho - 30, y: planoAlto * 0.48 }} color="#64748b" strokeWidth={2} />

                <Rect x={planoAncho * 0.55} y={planoAlto * 0.52} width={planoAncho * 0.41} height={planoAlto * 0.42} color="#fef3c7" />
                {Array.from({ length: 4 }).map((_, d) => (
                  <Line
                    key={`puerta-${d}`}
                    p1={{ x: planoAncho - 22, y: planoAlto * 0.58 + d * 55 }}
                    p2={{ x: planoAncho - 22, y: planoAlto * 0.58 + d * 55 + 35 }}
                    color="#f59e0b"
                    strokeWidth={5}
                  />
                ))}

                <Rect x={30} y={planoAlto * 0.5} width={planoAncho * 0.32} height={planoAlto * 0.44} color="#fee2e2" />

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

                {estaciones.map((estacion) => {
                  const estaSeleccionada = estacionSeleccionada?.id === estacion.id;

                  return (
                    <Group key={estacion.id}>
                      {estacion.auraIrradiacion && (
                        <Circle
                          cx={estacion.x}
                          cy={estacion.y}
                          r={estacion.radioAura * 1.5}
                          color="rgba(239, 68, 68, 0.12)"
                        />
                      )}
                      <Circle
                        cx={estacion.x}
                        cy={estacion.y}
                        r={estaSeleccionada ? estacion.radioAura + 10 : estacion.radioAura}
                        color={estacion.colorAura}
                      />
                      <Circle
                        cx={estacion.x}
                        cy={estacion.y}
                        r={estaSeleccionada ? 9 : 7}
                        color="#ffffff"
                      />
                      <Circle
                        cx={estacion.x}
                        cy={estacion.y}
                        r={estaSeleccionada ? 6 : 4.5}
                        color={estaSeleccionada ? '#0f172a' : estacion.colorCentro}
                      />
                    </Group>
                  );
                })}
              </>
            )}
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
