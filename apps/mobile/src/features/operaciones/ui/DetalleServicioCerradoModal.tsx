import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ResumenServicioTecnico } from '@gafer/contracts';
import { MobileApiClient } from '../../../shared/api/api-client';
import { Button, AlertBanner } from '../../../shared/ui';
import {
  etiquetaEstadoInspeccion,
  etiquetaTipoServicio,
  extraerResumenSnapshot,
  formatearHorarioServicio,
} from '../model/formato-servicio';

const MAX_MOTIVO_CORRECCION = 500;
const MIN_MOTIVO_CORRECCION = 5;

export interface DetalleServicioCerradoModalProps {
  visible: boolean;
  servicio: ResumenServicioTecnico | null;
  token?: string;
  abrirConCorreccion?: boolean;
  onCerrar: () => void;
  onCorreccionEnviada?: (inspeccionId: string) => void;
}

export const DetalleServicioCerradoModal: React.FC<DetalleServicioCerradoModalProps> = ({
  visible,
  servicio,
  token,
  abrirConCorreccion = false,
  onCerrar,
  onCorreccionEnviada,
}) => {
  const [mostrarFormularioCorreccion, setMostrarFormularioCorreccion] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setMostrarFormularioCorreccion(
        Boolean(abrirConCorreccion && servicio?.puedeSolicitarCorreccion),
      );
      setMotivo('');
      setMensajeExito(null);
    }
  }, [visible, abrirConCorreccion, servicio?.id, servicio?.puedeSolicitarCorreccion]);

  if (!servicio) return null;

  const apiClient = new MobileApiClient();
  const snapshotVista = extraerResumenSnapshot(servicio.snapshotCatalogos);
  const tieneContenidoSnapshot =
    snapshotVista.insumos.length > 0 ||
    snapshotVista.equipos.length > 0 ||
    snapshotVista.estaciones.length > 0;
  const etiquetaEstado = etiquetaEstadoInspeccion(servicio.estado);

  const handleSolicitarCorreccion = async () => {
    const motivoLimpio = motivo.trim();
    if (motivoLimpio.length < MIN_MOTIVO_CORRECCION) {
      Alert.alert(
        'Motivo insuficiente',
        `Por favor describa con detalle qué dato requiere ser corregido (mínimo ${MIN_MOTIVO_CORRECCION} caracteres).`,
      );
      return;
    }

    if (motivoLimpio.length > MAX_MOTIVO_CORRECCION) {
      Alert.alert(
        'Motivo demasiado largo',
        `El motivo de la corrección no puede exceder los ${MAX_MOTIVO_CORRECCION} caracteres.`,
      );
      return;
    }

    try {
      setEnviando(true);
      const res = await apiClient.solicitarCorreccion(servicio.id, motivoLimpio, token);
      setMensajeExito(res.mensaje);
      setMotivo('');
      setMostrarFormularioCorreccion(false);
      Alert.alert(
        'Solicitud Registrada',
        'Su pedido de corrección fue enviado a supervisión y ha quedado registrado en la bitácora de auditoría.',
      );
      if (onCorreccionEnviada) {
        onCorreccionEnviada(servicio.id);
      }
    } catch (err: any) {
      Alert.alert(
        'Error al solicitar',
        err?.message || 'No se pudo enviar la solicitud de corrección. Verifique su conexión.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleCerrar = () => {
    setMostrarFormularioCorreccion(false);
    setMotivo('');
    setMensajeExito(null);
    onCerrar();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCerrar}>
      <SafeAreaView style={styles.safeArea}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View style={styles.headerTexto}>
            <Text style={styles.titulo}>Reporte de Servicio</Text>
            <Text style={styles.subtitulo}>{servicio.codigoInspeccion}</Text>
          </View>
          <TouchableOpacity
            testID="boton-cerrar-modal-detalle"
            onPress={handleCerrar}
            style={styles.botonCerrarModal}
          >
            <Text style={styles.textoBotonCerrarModal}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.contenido} contentContainerStyle={styles.scrollContent}>
          {/* Badge de solo lectura */}
          <View style={styles.badgeSoloLecturaContenedor}>
            <View style={styles.badgeSoloLectura}>
              <Text style={styles.badgeTexto}>🔒 SERVICIO {etiquetaEstado} — SOLO LECTURA</Text>
            </View>
            <Text style={styles.explicacionInmutable}>
              {servicio.estado === 'CERRADO'
                ? 'Este documento fue firmado y cerrado en campo. Cumpliendo la normativa sanitaria y el acuerdo de GAFER, no se permite su modificación directa.'
                : 'Este registro se encuentra en modo consulta de solo lectura.'}
            </Text>
          </View>

          {mensajeExito ? (
            <AlertBanner
              tipo="info"
              mensaje={`Solicitud registrada: ${mensajeExito}`}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          {/* Tarjeta de Datos Generales */}
          <View style={styles.tarjeta}>
            <Text style={styles.seccionTitulo}>1. Datos Generales de la Atención</Text>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Cliente / Razón Social:</Text>
              <Text style={styles.valor}>{servicio.clienteRazonSocial || 'No especificado'}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Sede / Dirección:</Text>
              <Text style={styles.valor}>{servicio.sedeNombre || 'No especificado'}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Tipo de Servicio:</Text>
              <Text style={styles.valor}>{etiquetaTipoServicio(servicio.servicioTipo)}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Fecha de Ejecución:</Text>
              <Text style={styles.valor}>{servicio.fechaEjecucion}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Horario:</Text>
              <Text style={styles.valor}>
                {formatearHorarioServicio(servicio.horaInicio, servicio.horaFin)}
              </Text>
            </View>
          </View>

          {/* Tarjeta de Personal Técnico */}
          <View style={styles.tarjeta}>
            <Text style={styles.seccionTitulo}>2. Personal Técnico Participante</Text>
            {servicio.tecnicosParticipantes && servicio.tecnicosParticipantes.length > 0 ? (
              servicio.tecnicosParticipantes.map((tec, idx) => (
                <View key={tec.id || idx} style={styles.filaTecnico}>
                  <Text style={styles.iconoTecnico}>👤</Text>
                  <Text style={styles.valor}>{tec.nombre}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.textoVacio}>No se registraron técnicos adicionales.</Text>
            )}
          </View>

          {/* Tarjeta de Snapshot Inmutable (Insumos, Equipos, Estaciones) */}
          <View style={styles.tarjeta} testID="seccion-snapshot-servicio">
            <Text style={styles.seccionTitulo}>3. Detalle Registrado (Snapshot Inmutable)</Text>

            {snapshotVista.insumos.length > 0 ? (
              <View style={styles.subseccionSnapshot}>
                <Text style={styles.subseccionTitulo}>Insumos aplicados ({snapshotVista.insumos.length})</Text>
                {snapshotVista.insumos.map((insumo, idx) => (
                  <View key={`insumo-${idx}`} style={styles.itemSnapshot}>
                    <Text style={styles.itemSnapshotTitulo}>{insumo.nombre}</Text>
                    <Text style={styles.itemSnapshotDetalle}>
                      {[
                        insumo.dosis ? `Dosis: ${insumo.dosis}` : null,
                        insumo.lote ? `Lote: ${insumo.lote}` : null,
                        insumo.cantidad ? `Cantidad: ${insumo.cantidad}` : null,
                        insumo.registroDigesa ? `DIGESA: ${insumo.registroDigesa}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sin detalle adicional'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {snapshotVista.equipos.length > 0 ? (
              <View style={styles.subseccionSnapshot}>
                <Text style={styles.subseccionTitulo}>Equipos utilizados ({snapshotVista.equipos.length})</Text>
                {snapshotVista.equipos.map((equipo, idx) => (
                  <View key={`equipo-${idx}`} style={styles.itemSnapshot}>
                    <Text style={styles.itemSnapshotTitulo}>{equipo.nombre}</Text>
                    <Text style={styles.itemSnapshotDetalle}>
                      {[
                        equipo.codigoInterno ? `Código: ${equipo.codigoInterno}` : null,
                        equipo.tipo ? `Tipo: ${equipo.tipo}` : null,
                        equipo.marcaModelo ? `Modelo: ${equipo.marcaModelo}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sin detalle adicional'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {snapshotVista.estaciones.length > 0 ? (
              <View style={styles.subseccionSnapshot}>
                <Text style={styles.subseccionTitulo}>
                  Estaciones inspeccionadas ({snapshotVista.estaciones.length})
                </Text>
                {snapshotVista.estaciones.map((est, idx) => (
                  <View key={`estacion-${idx}`} style={styles.itemSnapshot}>
                    <Text style={styles.itemSnapshotTitulo}>
                      {est.etiqueta}
                      {est.estado ? ` — ${est.estado}` : ''}
                    </Text>
                    <Text style={styles.itemSnapshotDetalle}>
                      {[
                        est.consumoGramos !== undefined ? `Consumo: ${est.consumoGramos} g` : null,
                        est.repuestoGramos !== undefined ? `Repuesto: ${est.repuestoGramos} g` : null,
                        est.observaciones ? `Obs: ${est.observaciones}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sin observaciones'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {!tieneContenidoSnapshot ? (
              <Text style={styles.textoVacio}>
                No se registraron insumos, equipos ni estaciones en el snapshot de cierre.
              </Text>
            ) : null}

            {snapshotVista.fechaCierre ? (
              <Text style={styles.fechaCierreTexto}>
                Cierre registrado: {snapshotVista.fechaCierre}
              </Text>
            ) : null}
          </View>

          {/* Tarjeta de Solicitud de Corrección */}
          {servicio.puedeSolicitarCorreccion ? (
            <View style={styles.tarjetaAccion} testID="tarjeta-solicitar-correccion">
              <Text style={styles.seccionTitulo}>¿Detectó algún error en este reporte?</Text>
              <Text style={styles.descripcionCorreccion}>
                Para corregir errores de digitación en estaciones, insumos o firmas, solicite la
                aprobación a supervisión o administración.
              </Text>

              {!mostrarFormularioCorreccion ? (
                <Button
                  testID="boton-abrir-formulario-correccion"
                  titulo="📝 Solicitar Corrección a Supervisión"
                  onPress={() => setMostrarFormularioCorreccion(true)}
                  variante="secundario"
                  style={{ marginTop: 8 }}
                />
              ) : (
                <View style={styles.formularioCorreccion} testID="formulario-correccion">
                  <View style={styles.cabeceraInputCorreccion}>
                    <Text style={styles.etiquetaInput}>Motivo detallado de la corrección:</Text>
                    <Text style={styles.contadorCaracteres}>
                      {motivo.trim().length}/{MAX_MOTIVO_CORRECCION}
                    </Text>
                  </View>
                  <TextInput
                    testID="input-motivo-correccion"
                    style={styles.inputArea}
                    multiline
                    numberOfLines={4}
                    maxLength={MAX_MOTIVO_CORRECCION}
                    value={motivo}
                    onChangeText={setMotivo}
                    placeholder="Ej: Se ingresó erróneamente la estación 12 en vez de la 14 con consumo de 10g..."
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={styles.filaBotonesCorreccion}>
                    <TouchableOpacity
                      testID="boton-cancelar-correccion"
                      style={[styles.botonCancelarCorreccion]}
                      onPress={() => {
                        setMostrarFormularioCorreccion(false);
                        setMotivo('');
                      }}
                      disabled={enviando}
                    >
                      <Text style={styles.textoBotonCancelar}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="boton-enviar-correccion"
                      style={[styles.botonEnviarCorreccion, enviando && styles.botonDeshabilitado]}
                      onPress={handleSolicitarCorreccion}
                      disabled={enviando}
                    >
                      {enviando ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.textoBotonEnviar}>Enviar Pedido</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.tarjetaAccion} testID="aviso-sin-correccion">
              <Text style={styles.descripcionCorreccion}>
                Las solicitudes de corrección solo están habilitadas para servicios en estado CERRADO.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTexto: {
    flex: 1,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitulo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  botonCerrarModal: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  textoBotonCerrarModal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  contenido: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  badgeSoloLecturaContenedor: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  badgeSoloLectura: {
    backgroundColor: '#334155',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  badgeTexto: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  explicacionInmutable: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  tarjeta: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tarjetaAccion: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  seccionTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  etiqueta: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  valor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    textAlign: 'right',
  },
  filaTecnico: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconoTecnico: {
    marginRight: 6,
  },
  textoVacio: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  descripcionCorreccion: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 16,
  },
  formularioCorreccion: {
    marginTop: 10,
  },
  cabeceraInputCorreccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contadorCaracteres: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  subseccionSnapshot: {
    marginBottom: 10,
  },
  subseccionTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  itemSnapshot: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemSnapshotTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemSnapshotDetalle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  fechaCierreTexto: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  etiquetaInput: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  inputArea: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  filaBotonesCorreccion: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  botonCancelarCorreccion: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  textoBotonCancelar: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  botonEnviarCorreccion: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#0284c7',
  },
  textoBotonEnviar: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
});
