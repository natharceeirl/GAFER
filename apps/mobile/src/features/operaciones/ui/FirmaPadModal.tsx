import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  generarSvgFirmaBase64,
  PuntoFirma,
  tieneTrazosValidos,
  TrazoFirma,
} from '../model/firma-svg';
import { TOKENS } from '../../../shared/theme/tokens';

export interface FirmaPadModalProps {
  visible: boolean;
  firmanteNombre: string;
  firmanteCargo: string;
  onCancelar: () => void;
  onConfirmar: (firmaDataUri: string) => void;
}

const ANCHO_LIENZO = 320;
const ALTO_LIENZO = 160;

interface SegmentoTrazo {
  key: string;
  left: number;
  top: number;
  width: number;
  angleDeg: number;
}

function construirSegmentos(trazos: TrazoFirma[]): SegmentoTrazo[] {
  const segmentos: SegmentoTrazo[] = [];
  trazos.forEach((trazo, tIdx) => {
    for (let i = 1; i < trazo.length; i += 1) {
      const a = trazo[i - 1];
      const b = trazo[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) continue;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      segmentos.push({
        key: `${tIdx}-${i}`,
        left: midX - dist / 2,
        top: midY - 1.25,
        width: dist,
        angleDeg,
      });
    }
  });
  return segmentos;
}

function limitarPunto(x: number, y: number): PuntoFirma {
  return {
    x: Math.max(0, Math.min(ANCHO_LIENZO, x)),
    y: Math.max(0, Math.min(ALTO_LIENZO, y)),
  };
}

/**
 * Modal táctil de captura de firma de conformidad en campo.
 * Captura trazos reales vía PanResponder y genera un SVG válido codificado en Base64.
 */
export const FirmaPadModal: React.FC<FirmaPadModalProps> = ({
  visible,
  firmanteNombre,
  firmanteCargo,
  onCancelar,
  onConfirmar,
}) => {
  const [trazos, setTrazos] = useState<TrazoFirma[]>([]);
  const [errorTrazo, setErrorTrazo] = useState<string | null>(null);
  const trazoActivoRef = useRef<TrazoFirma>([]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const punto = limitarPunto(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          trazoActivoRef.current = [punto];
          setErrorTrazo(null);
          setTrazos((prev) => [...prev, [punto]]);
        },
        onPanResponderMove: (evt) => {
          const punto = limitarPunto(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          trazoActivoRef.current = [...trazoActivoRef.current, punto];
          setTrazos((prev) => {
            if (prev.length === 0) return [[punto]];
            const copia = prev.slice(0, -1);
            return [...copia, [...prev[prev.length - 1], punto]];
          });
        },
        onPanResponderRelease: () => {
          trazoActivoRef.current = [];
        },
        onPanResponderTerminate: () => {
          trazoActivoRef.current = [];
        },
      }),
    [],
  );

  const segmentos = useMemo(() => construirSegmentos(trazos), [trazos]);
  const hayFirma = tieneTrazosValidos(trazos);

  const handleLimpiar = () => {
    trazoActivoRef.current = [];
    setTrazos([]);
    setErrorTrazo(null);
  };

  const handleCancelar = () => {
    handleLimpiar();
    onCancelar();
  };

  const handleConfirmar = () => {
    if (!hayFirma) {
      setErrorTrazo('Dibuje la firma del responsable en el recuadro antes de confirmar.');
      return;
    }

    try {
      const firmaDataUri = generarSvgFirmaBase64(trazos, ANCHO_LIENZO, ALTO_LIENZO);
      handleLimpiar();
      onConfirmar(firmaDataUri);
    } catch (err: unknown) {
      setErrorTrazo(
        err instanceof Error ? err.message : 'No se pudo procesar la firma capturada.',
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancelar}>
      <View style={styles.overlay}>
        <View style={styles.tarjeta} testID="modal-firma-pad">
          <Text style={styles.titulo}>Firma de Conformidad del Cliente</Text>
          <Text style={styles.subtitulo}>
            {firmanteNombre} · {firmanteCargo}
          </Text>
          <Text style={styles.instruccion}>
            Firme con el dedo dentro del recuadro blanco para registrar su conformidad:
          </Text>

          <View
            testID="lienzo-firma"
            style={styles.lienzo}
            {...panResponder.panHandlers}
          >
            {segmentos.length === 0 ? (
              <Text style={styles.placeholderLienzo}>Firme aquí</Text>
            ) : (
              segmentos.map((seg) => (
                <View
                  key={seg.key}
                  style={[
                    styles.segmentoTrazo,
                    {
                      left: seg.left,
                      top: seg.top,
                      width: seg.width,
                      transform: [{ rotate: `${seg.angleDeg}deg` }],
                    },
                  ]}
                />
              ))
            )}
          </View>

          {errorTrazo ? (
            <Text testID="error-firma-pad" style={styles.textoError}>
              {errorTrazo}
            </Text>
          ) : null}

          <View style={styles.acciones}>
            <TouchableOpacity
              testID="boton-limpiar-trazo-firma"
              onPress={handleLimpiar}
              style={styles.botonSecundario}
            >
              <Text style={styles.textoSecundario}>Limpiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="boton-cancelar-firma"
              onPress={handleCancelar}
              style={styles.botonSecundario}
            >
              <Text style={styles.textoSecundario}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="boton-confirmar-firma"
              onPress={handleConfirmar}
              style={[styles.botonPrimario, !hayFirma && styles.botonDeshabilitado]}
            >
              <Text style={styles.textoPrimario}>Confirmar Firma</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: TOKENS.panel,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: TOKENS.ruleStrong,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.marca,
    marginBottom: 8,
  },
  instruccion: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    marginBottom: 10,
  },
  lienzo: {
    width: ANCHO_LIENZO,
    height: ALTO_LIENZO,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: TOKENS.ruleStrong,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  placeholderLienzo: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  segmentoTrazo: {
    position: 'absolute',
    height: 2.5,
    backgroundColor: '#0f172a',
    borderRadius: 2,
  },
  textoError: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.rojo,
    marginTop: 8,
  },
  acciones: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  botonSecundario: {
    backgroundColor: TOKENS.panelRaised,
    borderWidth: 1,
    borderColor: TOKENS.ruleStrong,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  textoSecundario: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  botonPrimario: {
    backgroundColor: TOKENS.marca,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  botonDeshabilitado: {
    opacity: 0.55,
  },
  textoPrimario: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
