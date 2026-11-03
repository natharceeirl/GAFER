import React, { useState } from 'react';
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
import { TOKENS } from '../../../shared/theme/tokens';

export interface DetalleServicioCerradoModalProps {
  visible: boolean;
  servicio: ResumenServicioTecnico | null;
  token?: string;
  onCerrar: () => void;
  onCorreccionEnviada?: (inspeccionId: string) => void;
}

export const DetalleServicioCerradoModal: React.FC<DetalleServicioCerradoModalProps> = ({
  visible,
  servicio,
  token,
  onCerrar,
  onCorreccionEnviada,
}) => {
  const [mostrarFormularioCorreccion, setMostrarFormularioCorreccion] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  if (!servicio) return null;

  const apiClient = new MobileApiClient();

  const handleSolicitarCorreccion = async () => {
    const motivoLimpio = motivo.trim();
    if (motivoLimpio.length < 5) {
      Alert.alert(
        'Motivo insuficiente',
        'Por favor describa con detalle qué dato requiere ser corregido (mínimo 5 caracteres).',
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
          <TouchableOpacity onPress={handleCerrar} style={styles.botonCerrarModal}>
            <Text style={styles.textoBotonCerrarModal}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.contenido} contentContainerStyle={styles.scrollContent}>
          {/* Badge de solo lectura */}
          <View style={styles.badgeSoloLecturaContenedor}>
            <View style={styles.badgeSoloLectura}>
              <Text style={styles.badgeTexto}>🔒 SERVICIO CERRADO — SOLO LECTURA</Text>
            </View>
            <Text style={styles.explicacionInmutable}>
              Este documento fue firmado y cerrado en campo. Cumpliendo la normativa sanitaria y el
              acuerdo de GAFER, no se permite su modificación directa.
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
              <Text style={styles.valor}>{servicio.sedeNombre || 'Planta o sede principal'}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Tipo de Servicio:</Text>
              <Text style={styles.valor}>{servicio.servicioTipo || 'Desratización (DRT)'}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Fecha de Ejecución:</Text>
              <Text style={styles.valor}>{servicio.fechaEjecucion}</Text>
            </View>
            <View style={styles.filaDato}>
              <Text style={styles.etiqueta}>Horario:</Text>
              <Text style={styles.valor}>
                {servicio.horaInicio || '08:00'} - {servicio.horaFin || 'Concluido'}
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

          {/* Tarjeta de Solicitud de Corrección */}
          <View style={styles.tarjetaAccion}>
            <Text style={styles.seccionTitulo}>¿Detectó algún error en este reporte?</Text>
            <Text style={styles.descripcionCorreccion}>
              Para corregir errores de digitación en estaciones, insumos o firmas, solicite la
              aprobación a supervisión o administración.
            </Text>

            {!mostrarFormularioCorreccion ? (
              <Button
                titulo="📝 Solicitar Corrección a Supervisión"
                onPress={() => setMostrarFormularioCorreccion(true)}
                variante="secundario"
                style={{ marginTop: 8 }}
              />
            ) : (
              <View style={styles.formularioCorreccion}>
                <Text style={styles.etiquetaInput}>Motivo detallado de la corrección:</Text>
                <TextInput
                  style={styles.inputArea}
                  multiline
                  numberOfLines={4}
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder="Ej: Se ingresó erróneamente la estación 12 en vez de la 14 con consumo de 10g..."
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.filaBotonesCorreccion}>
                  <TouchableOpacity
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
  etiquetaInput: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
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
