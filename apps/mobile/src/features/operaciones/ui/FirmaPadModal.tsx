import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  PanResponder,
  TextInput,
  Dimensions,
} from 'react-native';
import { Button } from '../../../shared/ui';
import { TOKENS } from '../../../shared/theme/tokens';

interface Punto {
  x: number;
  y: number;
}

interface Trazo {
  puntos: Punto[];
}

export interface ResultadoFirma {
  firmaBase64: string | null;
  responsableNoDisponible: boolean;
  motivoNoDisponible?: string;
}

interface FirmaPadModalProps {
  visible: boolean;
  onCerrar: () => void;
  onGuardar: (resultado: ResultadoFirma) => void;
  nombreContactoInicial?: string;
  cargoContactoInicial?: string;
  responsableNoDisponibleInicial?: boolean;
  motivoNoDisponibleInicial?: string;
}

export const FirmaPadModal: React.FC<FirmaPadModalProps> = ({
  visible,
  onCerrar,
  onGuardar,
  responsableNoDisponibleInicial = false,
  motivoNoDisponibleInicial = '',
}) => {
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [trazoActual, setTrazoActual] = useState<Punto[]>([]);
  const [noDisponible, setNoDisponible] = useState(responsableNoDisponibleInicial);
  const [motivo, setMotivo] = useState(motivoNoDisponibleInicial);

  const trazoActualRef = useRef<Punto[]>([]);
  trazoActualRef.current = trazoActual;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (noDisponible) return;
        const { locationX, locationY } = evt.nativeEvent;
        const puntoInicial = { x: Math.round(locationX), y: Math.round(locationY) };
        setTrazoActual([puntoInicial]);
      },
      onPanResponderMove: (evt) => {
        if (noDisponible) return;
        const { locationX, locationY } = evt.nativeEvent;
        const nuevoPunto = { x: Math.round(locationX), y: Math.round(locationY) };
        setTrazoActual((prev) => [...prev, nuevoPunto]);
      },
      onPanResponderRelease: () => {
        if (noDisponible) return;
        if (trazoActualRef.current.length > 0) {
          setTrazos((prev) => [...prev, { puntos: trazoActualRef.current }]);
          setTrazoActual([]);
        }
      },
    }),
  ).current;

  const limpiarCanvas = () => {
    setTrazos([]);
    setTrazoActual([]);
  };

  const handleGuardar = () => {
    if (noDisponible) {
      onGuardar({
        firmaBase64: null,
        responsableNoDisponible: true,
        motivoNoDisponible: motivo.trim() || 'Responsable del cliente no estuvo disponible durante la visita',
      });
      onCerrar();
      return;
    }

    // Generar representación serializada de la firma (SVG / Data URL en Base64)
    const tieneTrazos = trazos.length > 0 || trazoActual.length > 0;
    const todosTrazos = trazoActual.length > 0 ? [...trazos, { puntos: trazoActual }] : trazos;

    let firmaDataUrl: string | null = null;
    if (tieneTrazos) {
      // Serializar trazos a SVG Data URL Base64 para inmutabilidad y renderizado en PDF
      const svgPaths = todosTrazos
        .map((t) => {
          if (t.puntos.length === 0) return '';
          const d = t.puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return `<path d="${d}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
        })
        .join('');

      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160">${svgPaths}</svg>`;
      const base64Svg = Buffer.from(svgContent).toString('base64');
      firmaDataUrl = `data:image/svg+xml;base64,${base64Svg}`;
    }

    onGuardar({
      firmaBase64: firmaDataUrl,
      responsableNoDisponible: false,
    });
    onCerrar();
  };

  const totalPuntos = trazos.reduce((acc, t) => acc + t.puntos.length, 0) + trazoActual.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.overlay}>
        <View style={styles.modalContenido}>
          <Text style={styles.modalTitulo}>Firma del Responsable del Cliente</Text>
          <Text style={styles.modalSubtitulo}>
            Captura de firma en pantalla sin conexión (§13, C15)
          </Text>

          {/* Opción Responsable no disponible */}
          <TouchableOpacity
            style={[
              styles.tarjetaNoDisponible,
              noDisponible && styles.tarjetaNoDisponibleActiva,
            ]}
            onPress={() => setNoDisponible(!noDisponible)}
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

          {noDisponible ? (
            <View style={styles.contenedorMotivo}>
              <Text style={styles.etiquetaMotivo}>Motivo por el cual no estuvo disponible:</Text>
              <TextInput
                style={styles.inputMotivo}
                placeholder="Ej. Visita realizada fuera de horario administrativo..."
                value={motivo}
                onChangeText={setMotivo}
                multiline
              />
            </View>
          ) : (
            <View style={styles.seccionCanvas}>
              <Text style={styles.instruccionCanvas}>
                Dibuje la firma manuscrita dentro del recuadro con el dedo o lápiz:
              </Text>

              <View style={styles.canvasBorde} {...panResponder.panHandlers}>
                {/* Visualización de trazos simplificada en React Native */}
                {trazos.map((t, idx) => (
                  <View key={`trazo-${idx}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {t.puntos.map((p, pIdx) => (
                      <View
                        key={`pt-${pIdx}`}
                        style={[styles.puntoFirma, { left: p.x - 2, top: p.y - 2 }]}
                      />
                    ))}
                  </View>
                ))}
                {trazoActual.map((p, pIdx) => (
                  <View
                    key={`actual-${pIdx}`}
                    pointerEvents="none"
                    style={[styles.puntoFirma, { left: p.x - 2, top: p.y - 2 }]}
                  />
                ))}

                {totalPuntos === 0 ? (
                  <View style={styles.placeholderLienzo} pointerEvents="none">
                    <Text style={styles.textoPlaceholder}>✍️ Toque y deslice para firmar aquí</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.filaAccionesCanvas}>
                <Text style={styles.contadorTrazos}>
                  {totalPuntos > 0 ? `✓ ${totalPuntos} puntos registrados` : 'Sin trazos'}
                </Text>
                <TouchableOpacity style={styles.botonLimpiar} onPress={limpiarCanvas}>
                  <Text style={styles.textoBotonLimpiar}>🗑️ Borrar y Reintentar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.accionesFila}>
            <Button
              titulo="Cancelar"
              onPress={onCerrar}
              variante="secundario"
              style={{ flex: 1 }}
            />
            <Button
              titulo={noDisponible ? 'Confirmar Ausencia' : 'Confirmar Firma'}
              onPress={handleGuardar}
              variante="primario"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContenido: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
  modalTitulo: {
    fontSize: 14,
    fontWeight: '900',
    color: TOKENS.ink,
    letterSpacing: 0.5,
  },
  modalSubtitulo: {
    fontSize: 11,
    color: TOKENS.inkSoft,
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
  seccionCanvas: {
    gap: 6,
  },
  instruccionCanvas: {
    fontSize: 11,
    color: '#475569',
  },
  canvasBorde: {
    height: 160,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholderLienzo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoPlaceholder: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  puntoFirma: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0f172a',
  },
  filaAccionesCanvas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contadorTrazos: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '700',
  },
  botonLimpiar: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  textoBotonLimpiar: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  accionesFila: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
