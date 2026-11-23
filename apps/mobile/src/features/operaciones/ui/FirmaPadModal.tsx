import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
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

export interface ResultadoFirma {
  firmaBase64: string | null;
  responsableNoDisponible: boolean;
  motivoNoDisponible?: string;
}

export interface FirmaPadModalProps {
  visible: boolean;
  // API FormularioCampoScreen (captura simple de firma SVG Base64)
  firmanteNombre?: string;
  firmanteCargo?: string;
  onCancelar?: () => void;
  onConfirmar?: (firmaDataUri: string) => void;
  // API FormularioDrtScreen (con opción de responsable no disponible)
  onCerrar?: () => void;
  onGuardar?: (resultado: ResultadoFirma) => void | Promise<void>;
  nombreContactoInicial?: string;
  cargoContactoInicial?: string;
  responsableNoDisponibleInicial?: boolean;
  motivoNoDisponibleInicial?: string;
  /** Permite alternar "Responsable no disponible" dentro del modal. Por defecto true cuando se usa `onGuardar`. */
  permitirNoDisponible?: boolean;
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
 * Modal táctil unificado de captura de firma de conformidad en campo (§13, GAF-34/GAF-36).
 * Soporta tanto la interfaz directa (`onConfirmar`/`onCancelar` de FormularioCampoScreen)
 * como la interfaz con opción de ausencia (`onGuardar`/`onCerrar` de FormularioDrtScreen).
 * Serializa trazos reales a `data:image/svg+xml;base64,...` sin usar el global Node `Buffer`.
 */
export const FirmaPadModal: React.FC<FirmaPadModalProps> = ({
  visible,
  firmanteNombre,
  firmanteCargo,
  onCancelar,
  onConfirmar,
  onCerrar,
  onGuardar,
  nombreContactoInicial,
  cargoContactoInicial,
  responsableNoDisponibleInicial = false,
  motivoNoDisponibleInicial = '',
  permitirNoDisponible,
}) => {
  const mostrarOpcionNoDisponible = permitirNoDisponible ?? Boolean(onGuardar);

  const [trazos, setTrazos] = useState<TrazoFirma[]>([]);
  const [errorTrazo, setErrorTrazo] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState<boolean>(
    mostrarOpcionNoDisponible ? responsableNoDisponibleInicial : false,
  );
  const [motivo, setMotivo] = useState<string>(motivoNoDisponibleInicial);

  const trazoActivoRef = useRef<TrazoFirma>([]);
  const noDisponibleRef = useRef<boolean>(noDisponible);
  noDisponibleRef.current = mostrarOpcionNoDisponible ? noDisponible : false;

  // Resincronizar estado local al abrir el modal o cuando cambian las props iniciales (F4)
  useEffect(() => {
    if (visible) {
      setNoDisponible(mostrarOpcionNoDisponible ? responsableNoDisponibleInicial : false);
      setMotivo(motivoNoDisponibleInicial);
      trazoActivoRef.current = [];
      setTrazos([]);
      setErrorTrazo(null);
    }
  }, [
    visible,
    mostrarOpcionNoDisponible,
    responsableNoDisponibleInicial,
    motivoNoDisponibleInicial,
  ]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !noDisponibleRef.current,
        onMoveShouldSetPanResponder: () => !noDisponibleRef.current,
        onPanResponderGrant: (evt) => {
          if (noDisponibleRef.current) return;
          const punto = limitarPunto(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          trazoActivoRef.current = [punto];
          setErrorTrazo(null);
          setTrazos((prev) => [...prev, [punto]]);
        },
        onPanResponderMove: (evt) => {
          if (noDisponibleRef.current) return;
          const punto = limitarPunto(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          trazoActivoRef.current = [...trazoActivoRef.current, punto];
          setTrazos((prev) => {
            if (prev.length === 0) return [[punto]];
            const copia = prev.slice(0, -1);
            return [...copia, [...prev[prev.length - 1], punto]];
          });
        },
        onPanResponderRelease: () => {
          if (noDisponibleRef.current) return;
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

  const cerrarModal = () => {
    if (onCerrar) {
      onCerrar();
    } else if (onCancelar) {
      onCancelar();
    }
  };

  const handleLimpiar = () => {
    trazoActivoRef.current = [];
    setTrazos([]);
    setErrorTrazo(null);
  };

  const handleCancelar = () => {
    handleLimpiar();
    cerrarModal();
  };

  const handleToggleNoDisponible = () => {
    setErrorTrazo(null);
    setNoDisponible((prev) => !prev);
  };

  const handleConfirmar = async () => {
    if (mostrarOpcionNoDisponible && noDisponible) {
      await onGuardar?.({
        firmaBase64: null,
        responsableNoDisponible: true,
        motivoNoDisponible:
          motivo.trim() || 'Responsable del cliente no estuvo disponible durante la visita',
      });
      handleLimpiar();
      cerrarModal();
      return;
    }

    if (!hayFirma) {
      setErrorTrazo('Dibuje la firma del responsable en el recuadro antes de confirmar.');
      return;
    }

    try {
      const firmaDataUri = generarSvgFirmaBase64(trazos, ANCHO_LIENZO, ALTO_LIENZO);
      if (onGuardar) {
        await onGuardar({
          firmaBase64: firmaDataUri,
          responsableNoDisponible: false,
        });
        handleLimpiar();
        cerrarModal();
      } else if (onConfirmar) {
        handleLimpiar();
        onConfirmar(firmaDataUri);
      }
    } catch (err: unknown) {
      setErrorTrazo(
        err instanceof Error ? err.message : 'No se pudo procesar la firma capturada.',
      );
    }
  };

  const nombreMostrado = firmanteNombre ?? nombreContactoInicial ?? '';
  const cargoMostrado = firmanteCargo ?? cargoContactoInicial ?? '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancelar}>
      <View style={styles.overlay}>
        <View style={styles.tarjeta} testID="modal-firma-pad">
          <Text style={styles.titulo}>Firma de Conformidad del Cliente</Text>
          {nombreMostrado || cargoMostrado ? (
            <Text style={styles.subtitulo}>
              {[nombreMostrado, cargoMostrado].filter(Boolean).join(' · ')}
            </Text>
          ) : (
            <Text style={styles.subtituloSecundario}>
              Captura de firma en pantalla sin conexión (§13, C15)
            </Text>
          )}

          {mostrarOpcionNoDisponible ? (
            <TouchableOpacity
              testID="toggle-modal-responsable-no-disponible"
              style={[
                styles.tarjetaNoDisponible,
                noDisponible && styles.tarjetaNoDisponibleActiva,
              ]}
              onPress={handleToggleNoDisponible}
            >
              <View style={styles.checkbox}>
                <Text style={styles.checkboxTexto}>{noDisponible ? '✓' : ''}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.textoNoDisponible}>
                  El responsable del cliente no estuvo disponible
                </Text>
                <Text style={styles.subtextoNoDisponible}>
                  Marque esta opción si no hubo personal administrativo para firmar.
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {mostrarOpcionNoDisponible && noDisponible ? (
            <View style={styles.contenedorMotivo}>
              <Text style={styles.etiquetaMotivo}>Motivo por el cual no estuvo disponible:</Text>
              <TextInput
                testID="input-modal-motivo-no-disponible"
                style={styles.inputMotivo}
                placeholder="Ej. Visita realizada fuera de horario administrativo..."
                value={motivo}
                onChangeText={setMotivo}
                multiline
              />
            </View>
          ) : (
            <View>
              <Text style={styles.instruccion}>
                Firme con el dedo dentro del recuadro blanco para registrar su conformidad:
              </Text>

              <View testID="lienzo-firma" style={styles.lienzo} {...panResponder.panHandlers}>
                {segmentos.length === 0 ? (
                  <Text style={styles.placeholderLienzo}>Firme aquí</Text>
                ) : (
                  segmentos.map((seg) => (
                    <View
                      key={seg.key}
                      pointerEvents="none"
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
            </View>
          )}

          {errorTrazo ? (
            <Text testID="error-firma-pad" style={styles.textoError}>
              {errorTrazo}
            </Text>
          ) : null}

          <View style={styles.acciones}>
            {!(mostrarOpcionNoDisponible && noDisponible) ? (
              <TouchableOpacity
                testID="boton-limpiar-trazo-firma"
                onPress={handleLimpiar}
                style={styles.botonSecundario}
              >
                <Text style={styles.textoSecundario}>Limpiar</Text>
              </TouchableOpacity>
            ) : null}

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
              style={[
                styles.botonPrimario,
                !(mostrarOpcionNoDisponible && noDisponible) && !hayFirma && styles.botonDeshabilitado,
              ]}
            >
              <Text style={styles.textoPrimario}>
                {mostrarOpcionNoDisponible && noDisponible
                  ? 'Confirmar Ausencia'
                  : 'Confirmar Firma'}
              </Text>
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
    maxWidth: 380,
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
  subtituloSecundario: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    marginBottom: 8,
  },
  tarjetaNoDisponible: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  tarjetaNoDisponibleActiva: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#64748b',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxTexto: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
  },
  textoNoDisponible: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  subtextoNoDisponible: {
    fontSize: 10,
    color: '#64748b',
  },
  contenedorMotivo: {
    gap: 4,
    marginBottom: 6,
  },
  etiquetaMotivo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  inputMotivo: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: 'top',
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
