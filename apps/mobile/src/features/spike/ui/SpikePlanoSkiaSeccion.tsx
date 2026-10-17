import React, { useState, useMemo, useRef } from 'react';
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
const CANVAS_ALTO = 440;
const CANVAS_ANCHO = PANTALLA_ANCHO - 32;

interface EstacionPunto {
  id: string;
  numero: number;
  x: number;
  y: number;
  colorAura: string;
  colorCentro: string;
}

function generar100Estaciones(ancho: number, alto: number): EstacionPunto[] {
  const puntos: EstacionPunto[] = [];
  const filas = 10;
  const columnas = 10;
  const pasoX = (ancho - 60) / (columnas - 1);
  const pasoY = (alto - 60) / (filas - 1);

  let num = 1;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      // Distribución en grilla con leve dispersión aleatoria
      const jitterX = (Math.random() - 0.5) * (pasoX * 0.35);
      const jitterY = (Math.random() - 0.5) * (pasoY * 0.35);
      const x = Math.max(30, Math.min(ancho - 30, 30 + c * pasoX + jitterX));
      const y = Math.max(30, Math.min(alto - 30, 30 + f * pasoY + jitterY));

      const tipo = num % 5 === 0 ? 'ROJO' : num % 3 === 0 ? 'AMARILLO' : 'VERDE';
      const colorAura =
        tipo === 'ROJO'
          ? 'rgba(239, 68, 68, 0.28)'
          : tipo === 'AMARILLO'
          ? 'rgba(245, 158, 11, 0.28)'
          : 'rgba(34, 197, 94, 0.25)';

      const colorCentro =
        tipo === 'ROJO' ? '#dc2626' : tipo === 'AMARILLO' ? '#d97706' : '#16a34a';

      puntos.push({
        id: `estacion-${num}`,
        numero: num,
        x,
        y,
        colorAura,
        colorCentro,
      });
      num++;
    }
  }

  return puntos;
}

export const SpikePlanoSkiaSeccion: React.FC = () => {
  const [semilla, setSemilla] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [escala, setEscala] = useState(1);
  const [estacionSeleccionada, setEstacionSeleccionada] = useState<EstacionPunto | null>(null);

  const estaciones = useMemo(
    () => generar100Estaciones(CANVAS_ANCHO * 1.5, CANVAS_ALTO * 1.5),
    [semilla],
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
          // Si fue un toque rápido sin arrastre, detectar estación seleccionada
          if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
            const touchX = (gestureState.x0 - 16 - translateX) / escala;
            const touchY = (gestureState.y0 - 240 - translateY) / escala;

            const encontrada = estaciones.find((e) => {
              const dist = Math.hypot(e.x - touchX, e.y - touchY);
              return dist <= 24;
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
    setEscala((prev) => Math.max(0.6, Math.min(3.0, prev * factor)));
  };

  return (
    <View style={styles.contenedor}>
      {/* Panel de métricas e instrucciones */}
      <View style={styles.panelMetricas}>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>⚡ Estaciones renderizadas:</Text>
          <Text style={styles.metricaValor}>100 / 100 (Acelerado por GPU Skia)</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>🔍 Zoom / Escala:</Text>
          <Text style={styles.metricaValor}>{escala.toFixed(2)}x</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>📍 Selección actual:</Text>
          <Text style={[styles.metricaValor, styles.resaltado]}>
            {estacionSeleccionada ? `Estación #${estacionSeleccionada.numero}` : 'Toca un punto'}
          </Text>
        </View>
      </View>

      {/* Controles de prueba */}
      <View style={styles.barraControles}>
        <TouchableOpacity style={styles.botonControl} onPress={() => hacerZoom(1.2)}>
          <Text style={styles.controlTexto}>Zoom +</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonControl} onPress={() => hacerZoom(0.8)}>
          <Text style={styles.controlTexto}>Zoom -</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonControl} onPress={reiniciarVista}>
          <Text style={styles.controlTexto}>Centrar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botonControl, styles.botonRegenerar]}
          onPress={() => setSemilla((s) => s + 1)}
        >
          <Text style={styles.controlTexto}>🎲 Reubicar 100</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Skia con 100 estaciones cebaderas y auras concéntricas */}
      <View style={styles.canvasContenedor} {...panResponder.panHandlers}>
        <Canvas style={{ width: CANVAS_ANCHO, height: CANVAS_ALTO }}>
          {/* Fondo cuadriculado simulando plano arquitectónico */}
          <Rect x={0} y={0} width={CANVAS_ANCHO} height={CANVAS_ALTO} color="#f1f5f9" />

          <Group
            transform={[
              { translateX },
              { translateY },
              { scale: escala },
            ]}
          >
            {/* Líneas guía del plano técnico */}
            {Array.from({ length: 8 }).map((_, i) => (
              <Line
                key={`line-h-${i}`}
                p1={{ x: 0, y: i * 80 }}
                p2={{ x: CANVAS_ANCHO * 1.5, y: i * 80 }}
                color="#e2e8f0"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <Line
                key={`line-v-${i}`}
                p1={{ x: i * 80, y: 0 }}
                p2={{ x: i * 80, y: CANVAS_ALTO * 1.5 }}
                color="#e2e8f0"
                strokeWidth={1}
              />
            ))}

            {/* Renderizado de las 100 estaciones con doble aura y centro */}
            {estaciones.map((estacion) => {
              const estaSeleccionada = estacionSeleccionada?.id === estacion.id;

              return (
                <Group key={estacion.id}>
                  {/* Aura externa de calor/cobertura */}
                  <Circle
                    cx={estacion.x}
                    cy={estacion.y}
                    r={estaSeleccionada ? 26 : 18}
                    color={estacion.colorAura}
                  />

                  {/* Halo de contraste */}
                  <Circle
                    cx={estacion.x}
                    cy={estacion.y}
                    r={8}
                    color="#ffffff"
                  />

                  {/* Núcleo de la estación cebadera */}
                  <Circle
                    cx={estacion.x}
                    cy={estacion.y}
                    r={estaSeleccionada ? 7 : 5}
                    color={estaSeleccionada ? '#000000' : estacion.colorCentro}
                  />
                </Group>
              );
            })}
          </Group>
        </Canvas>
      </View>

      <Text style={styles.instruccionesPie}>
        👆 Arrastra con el dedo para desplazarte (Pan) y usa Zoom para medir los FPS en vivo en tu
        Redmi Note 9.
      </Text>
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
    padding: 12,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  metricaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricaEtiqueta: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    fontWeight: '600',
  },
  metricaValor: {
    fontSize: 12,
    color: TOKENS.ink,
    fontWeight: '700',
  },
  resaltado: {
    color: TOKENS.marca,
  },
  barraControles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  botonControl: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: TOKENS.radiusSm,
    alignItems: 'center',
  },
  botonRegenerar: {
    backgroundColor: TOKENS.marca,
    flex: 1.4,
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
  instruccionesPie: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
