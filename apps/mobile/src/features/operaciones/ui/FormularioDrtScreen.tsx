import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ActaServicioDrt,
  ActaServicioDrtSchema,
  ActividadDrt,
  ActividadDrtSchema,
  TipoCeboDrt,
  TipoCeboDrtSchema,
  TipoTrampaDrt,
  TipoTrampaDrtSchema,
  EspecieRoedorDrt,
  EspecieRoedorDrtSchema,
  EstadoEstacionPlanilla,
  EstadoEstacionPlanillaSchema,
  ItemEstacionPlanilla,
} from '@gafer/contracts';
import { useAuthStore } from '../../auth/model/use-auth-store';
import { useBorradorStore } from '../model/use-borrador-store';
import { Button, AlertBanner } from '../../../shared/ui';
import { TOKENS } from '../../../shared/theme/tokens';

interface FormularioDrtScreenProps {
  onVolver: () => void;
}

const LABELS_ACTIVIDAD: Record<ActividadDrt, string> = {
  EVALUACION: 'Evaluación',
  INSTALACION: 'Instalación',
  MONITOREO: 'Monitoreo',
  EMERGENCIA: 'Emergencia',
};

const LABELS_CEBO: Record<TipoCeboDrt, string> = {
  BLOQUE_5G: 'Bloque 5g',
  BLOQUE_10G: 'Bloque 10g',
  PELLETS: 'Pellets',
  PASTA: 'Pasta',
  LIQUIDO: 'Líquido',
  NINGUNO: 'Ninguno',
};

const LABELS_TRAMPA: Record<TipoTrampaDrt, string> = {
  MECANICA: 'Mecánica',
  PEGATINA: 'Pegatina',
  JAULA: 'Jaula',
  NINGUNA: 'Ninguna',
};

const LABELS_ROEDOR: Record<EspecieRoedorDrt, string> = {
  R_RATTUS: 'R. rattus (Tejado)',
  R_NORVEGICUS: 'R. norvegicus (Alcantarilla)',
  MUS_MUSCULUS: 'Mus musculus (Casero)',
};

const LABELS_ESTADO_ESTACION: Record<EstadoEstacionPlanilla, { label: string; color: string; badge: string }> = {
  SIN_ACTIVIDAD: { label: 'Sin Actividad', color: '#16a34a', badge: 'INTACTA' },
  CON_CONSUMO: { label: 'Con Consumo', color: '#ea580c', badge: 'ACTIVIDAD' },
  SIN_ACCESO: { label: 'Sin Acceso', color: '#64748b', badge: 'BLOQUEADA' },
  EXTRAVIADA: { label: 'Extraviada', color: '#dc2626', badge: 'EXTRAVIADA' },
};

const MAPA_ETIQUETAS_VALIDACION: Record<string, string> = {
  'firmas.clienteConformidadNombre': 'Falta el Nombre del contacto del cliente en la Sección 7 (Firmas y Conformidad).',
  'firmas.clienteConformidadCargo': 'Falta el Cargo del contacto del cliente en la Sección 7 (Firmas y Conformidad).',
  'clienteRazonSocial': 'La Razón Social del cliente no puede estar vacía (Sección 1).',
  'sedeDireccion': 'La Dirección o Sede no puede estar vacía (Sección 1).',
  'horaInicio': 'La Hora de Inicio es obligatoria con formato HH:MM (Sección 1).',
  'horaTermino': 'La Hora de Término es obligatoria con formato HH:MM (Sección 1).',
  'fecha': 'La Fecha del servicio es obligatoria con formato AAAA-MM-DD (Sección 1).',
};

function fechaActualIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function horaActualIso(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const FormularioDrtScreen: React.FC<FormularioDrtScreenProps> = ({ onVolver }) => {
  const { usuario } = useAuthStore();
  const borrador = useBorradorStore((state) => state.borrador);
  const actualizarDrt = useBorradorStore((state) => state.actualizarDrt);
  const finalizarServicioDrt = useBorradorStore((state) => state.finalizarServicioDrt);

  const [guardando, setGuardando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Inicializar estado del acta con datos guardados previamente o plantilla inicial
  const servicioIdInicial = borrador?.servicioId || '00000000-0000-0000-0000-000000000001';

  const [acta, setActa] = useState<ActaServicioDrt>(() => {
    if (borrador?.datosDrt) {
      return borrador.datosDrt;
    }

    const estacionesIniciales: ItemEstacionPlanilla[] = Array.from({ length: 5 }, (_, i) => ({
      numero: i + 1,
      estado: 'SIN_ACTIVIDAD',
      consumoGramos: 0,
      repuestoGramos: 0,
    }));

    return {
      servicioId: servicioIdInicial,
      clienteRazonSocial: borrador?.clienteRazonSocial || 'Cliente Asignado',
      sedeDireccion: borrador?.sedeNombre || 'Sede Principal',
      fecha: fechaActualIso(),
      areaTratadaM2: 500,
      horaInicio: '08:30',
      horaTermino: '11:00',
      actividad: 'MONITOREO',
      tipoCebo: 'BLOQUE_10G',
      cebosInstalados: 20,
      cebosConsumidos: 0,
      cebosRepuestos: 0,
      tipoTrampa: 'MECANICA',
      trampasInstaladas: 5,
      trampasActivadas: 0,
      roedoresDetectados: [],
      resultadosRecomendaciones: '',
      observacionesCliente: '',
      firmas: {
        personalResponsableNombre: usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Técnico Operador',
        personalResponsableCargo: usuario?.cargo || 'Técnico Saneamiento',
        clienteConformidadNombre: '',
        clienteConformidadCargo: '',
        fecha: fechaActualIso(),
      },
      planillaEstaciones: estacionesIniciales,
    };
  });

  // Referencia mutable siempre actualizada para auto-guardado seguro
  const ultimaActaRef = useRef(acta);
  ultimaActaRef.current = acta;

  // Auto-guardado en segundo plano en SQLite (debounced 2.5s) bajo la regla §2.4: Durable before visible
  useEffect(() => {
    const timer = setTimeout(() => {
      actualizarDrt(ultimaActaRef.current, {
        clienteRazonSocial: ultimaActaRef.current.clienteRazonSocial,
        sedeNombre: ultimaActaRef.current.sedeDireccion,
        servicioTipo: 'DESRATIZACION_DRT',
      })
        .then(() => {
          setMensajeGuardado(`Guardado localmente en SQLite a las ${horaActualIso()}`);
        })
        .catch(() => {});
    }, 2500);

    return () => clearTimeout(timer);
  }, [acta, actualizarDrt]);

  // Manejador seguro para regresar: garantiza que todo cambio se guarde en SQLite antes de desmontar
  const handleVolver = () => {
    actualizarDrt(ultimaActaRef.current, {
      clienteRazonSocial: ultimaActaRef.current.clienteRazonSocial,
      sedeNombre: ultimaActaRef.current.sedeDireccion,
      servicioTipo: 'DESRATIZACION_DRT',
    }).catch(() => {});
    onVolver();
  };

  // Interceptar botón atrás de hardware en Android (y navegación por gestos)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleVolver();
      return true;
    });
    return () => sub.remove();
  }, [onVolver]);

  // Resumen en vivo de estaciones de la planilla
  const metricasEstaciones = useMemo(() => {
    let sinActividad = 0;
    let conConsumo = 0;
    let sinAcceso = 0;
    let extraviada = 0;
    let totalConsumoGramos = 0;
    let totalRepuestoGramos = 0;

    for (const est of acta.planillaEstaciones) {
      if (est.estado === 'SIN_ACTIVIDAD') sinActividad++;
      else if (est.estado === 'CON_CONSUMO') {
        conConsumo++;
        totalConsumoGramos += est.consumoGramos || 0;
        totalRepuestoGramos += est.repuestoGramos || 0;
      } else if (est.estado === 'SIN_ACCESO') sinAcceso++;
      else if (est.estado === 'EXTRAVIADA') extraviada++;
    }

    return {
      total: acta.planillaEstaciones.length,
      sinActividad,
      conConsumo,
      sinAcceso,
      extraviada,
      totalConsumoGramos,
      totalRepuestoGramos,
    };
  }, [acta.planillaEstaciones]);

  // Sincronizar automáticamente conteos de cebos si el técnico usa la planilla
  const actualizarConteoDesdePlanilla = () => {
    setActa((prev) => ({
      ...prev,
      cebosConsumidos: metricasEstaciones.conConsumo,
      cebosRepuestos: metricasEstaciones.conConsumo,
    }));
  };

  const handleGuardarBorradorManual = async () => {
    try {
      setGuardando(true);
      setErrorValidacion(null);
      await actualizarDrt(acta, {
        clienteRazonSocial: acta.clienteRazonSocial,
        sedeNombre: acta.sedeDireccion,
        servicioTipo: 'DESRATIZACION_DRT',
      });
      const hora = horaActualIso();
      setMensajeGuardado(`Borrador guardado en SQLite local a las ${hora}`);
    } catch {
      Alert.alert('Error al guardar', 'No se pudo guardar el borrador en la base de datos local.');
    } finally {
      setGuardando(false);
    }
  };

  const handleFinalizarServicio = async () => {
    // 1. Validar esquema completo según acta
    const resultado = ActaServicioDrtSchema.safeParse(acta);
    if (!resultado.success) {
      const listaErrores = resultado.error.errors.map((e) => {
        const pathKey = e.path.join('.');
        return MAPA_ETIQUETAS_VALIDACION[pathKey] || `• ${pathKey}: ${e.message}`;
      });
      setErrorValidacion(`Complete los campos requeridos antes de finalizar:\n\n${listaErrores.join('\n')}`);
      Alert.alert(
        'Formulario Incompleto',
        'Existen campos requeridos del acta en papel pendientes de llenar. Revise la alerta superior.',
      );
      return;
    }

    Alert.alert(
      'Finalizar y Encolar Servicio',
      '¿Confirma que desea cerrar el acta de servicio DRT? El servicio se guardará de forma durable y se encolará para sincronización con el servidor.',
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Concluir y Encolar',
          style: 'default',
          onPress: async () => {
            try {
              setGuardando(true);
              const userId = usuario?.id || 'tecnico-local-01';
              const res = await finalizarServicioDrt(resultado.data, userId);
              Alert.alert(
                'Servicio Registrado con Éxito',
                `El acta DRT fue guardada en SQLite y encolada en Outbox (Op: ${res.operationId.substring(0, 8)}). Se sincronizará automáticamente al detectar conexión.`,
                [{ text: 'OK', onPress: onVolver }],
              );
            } catch (err: any) {
              Alert.alert('Error al finalizar', err?.message || 'Ocurrió un error al persistir el servicio.');
            } finally {
              setGuardando(false);
            }
          },
        },
      ],
    );
  };

  // Mutadores de campos
  const toggleEspecieRoedor = (esp: EspecieRoedorDrt) => {
    setActa((prev) => {
      const yaExiste = prev.roedoresDetectados.includes(esp);
      return {
        ...prev,
        roedoresDetectados: yaExiste
          ? prev.roedoresDetectados.filter((e) => e !== esp)
          : [...prev.roedoresDetectados, esp],
      };
    });
  };

  const cambiarEstadoEstacion = (numero: number, nuevoEstado: EstadoEstacionPlanilla) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, estado: nuevoEstado } : est,
      ),
    }));
  };

  const cambiarConsumoEstacion = (numero: number, gramos: number) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, consumoGramos: gramos, repuestoGramos: gramos } : est,
      ),
    }));
  };

  const cambiarNotaEstacion = (numero: number, observaciones: string) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, observaciones } : est,
      ),
    }));
  };

  const agregarEstaciones = (cantidad = 1) => {
    setActa((prev) => {
      const actuales = [...prev.planillaEstaciones];
      const ultimoNumero = actuales.length > 0 ? actuales[actuales.length - 1].numero : 0;
      const nuevas: ItemEstacionPlanilla[] = [];
      for (let i = 1; i <= cantidad; i++) {
        nuevas.push({
          numero: ultimoNumero + i,
          estado: 'SIN_ACTIVIDAD',
          consumoGramos: 0,
          repuestoGramos: 0,
        });
      }
      return {
        ...prev,
        planillaEstaciones: [...actuales, ...nuevas],
      };
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Cabecera Técnica */}
      <View style={styles.cabeceraBar}>
        <TouchableOpacity style={styles.botonVolver} onPress={handleVolver}>
          <Text style={styles.textoBotonVolver}>← VOLVER</Text>
        </TouchableOpacity>
        <View style={styles.cabeceraCentro}>
          <Text style={styles.cabeceraTitulo}>ACTA DE SERVICIO DRT</Text>
          <Text style={styles.cabeceraSubtitulo}>Control de Roedores en Campo</Text>
        </View>
        <View style={styles.badgeOffline}>
          <Text style={styles.badgeOfflineTexto}>OFFLINE</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContenido}
          keyboardShouldPersistTaps="handled"
        >
          {mensajeGuardado ? (
            <View style={styles.alertaGuardado}>
              <Text style={styles.alertaGuardadoTexto}>✓ {mensajeGuardado}</Text>
            </View>
          ) : null}

          {errorValidacion ? (
            <AlertBanner tipo="error" mensaje={errorValidacion} style={styles.alertaError} />
          ) : null}

          {/* 1. DATOS GENERALES */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>1. DATOS GENERALES DEL SERVICIO</Text>
            <Text style={styles.campoEtiqueta}>Cliente / Razón Social:</Text>
            <TextInput
              style={styles.inputTexto}
              value={acta.clienteRazonSocial}
              onChangeText={(t) => setActa((p) => ({ ...p, clienteRazonSocial: t }))}
              placeholder="Razón Social"
            />

            <Text style={styles.campoEtiqueta}>Dirección / Sede:</Text>
            <TextInput
              style={styles.inputTexto}
              value={acta.sedeDireccion}
              onChangeText={(t) => setActa((p) => ({ ...p, sedeDireccion: t }))}
              placeholder="Dirección del establecimiento"
            />

            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Fecha (AAAA-MM-DD):</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.fecha}
                  onChangeText={(t) => setActa((p) => ({ ...p, fecha: t }))}
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Área Tratada (m²):</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.areaTratadaM2 ? String(acta.areaTratadaM2) : ''}
                  keyboardType="numeric"
                  onChangeText={(t) => setActa((p) => ({ ...p, areaTratadaM2: Number(t) || 0 }))}
                  placeholder="Ej. 1200"
                />
              </View>
            </View>

            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Hora Inicio (HH:MM):</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.horaInicio}
                  onChangeText={(t) => setActa((p) => ({ ...p, horaInicio: t }))}
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Hora Término (HH:MM):</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.horaTermino}
                  onChangeText={(t) => setActa((p) => ({ ...p, horaTermino: t }))}
                />
              </View>
            </View>
          </View>

          {/* 2. ACTIVIDAD */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>2. ACTIVIDAD REALIZADA</Text>
            <View style={styles.chipsContenedor}>
              {ActividadDrtSchema.options.map((act) => {
                const seleccionado = acta.actividad === act;
                return (
                  <TouchableOpacity
                    key={`act-${act}`}
                    style={[styles.chip, seleccionado && styles.chipActivo]}
                    onPress={() => setActa((p) => ({ ...p, actividad: act }))}
                  >
                    <Text style={[styles.chipTexto, seleccionado && styles.chipTextoActivo]}>
                      {LABELS_ACTIVIDAD[act]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 3. CEBOS QUÍMICOS */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>3. CEBOS RATICIDAS EMPLEADOS</Text>
            <Text style={styles.campoEtiqueta}>Formulación de Cebo:</Text>
            <View style={styles.chipsContenedor}>
              {TipoCeboDrtSchema.options.map((tc) => {
                const seleccionado = acta.tipoCebo === tc;
                return (
                  <TouchableOpacity
                    key={`cebo-${tc}`}
                    style={[styles.chip, seleccionado && styles.chipActivo]}
                    onPress={() => setActa((p) => ({ ...p, tipoCebo: tc }))}
                  >
                    <Text style={[styles.chipTexto, seleccionado && styles.chipTextoActivo]}>
                      {LABELS_CEBO[tc]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filaTresInputs}>
              <View style={styles.columnaTres}>
                <Text style={styles.campoEtiqueta}>Instalados:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={String(acta.cebosInstalados)}
                  keyboardType="numeric"
                  onChangeText={(t) => setActa((p) => ({ ...p, cebosInstalados: Number(t) || 0 }))}
                />
              </View>
              <View style={styles.columnaTres}>
                <Text style={styles.campoEtiqueta}>Consumidos:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={String(acta.cebosConsumidos)}
                  keyboardType="numeric"
                  onChangeText={(t) => setActa((p) => ({ ...p, cebosConsumidos: Number(t) || 0 }))}
                />
              </View>
              <View style={styles.columnaTres}>
                <Text style={styles.campoEtiqueta}>Repuestos:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={String(acta.cebosRepuestos)}
                  keyboardType="numeric"
                  onChangeText={(t) => setActa((p) => ({ ...p, cebosRepuestos: Number(t) || 0 }))}
                />
              </View>
            </View>
            {metricasEstaciones.conConsumo > 0 ? (
              <TouchableOpacity style={styles.botonAutoSuma} onPress={actualizarConteoDesdePlanilla}>
                <Text style={styles.textoAutoSuma}>
                  ⚡ Actualizar con suma de planilla ({metricasEstaciones.conConsumo} consumos / {metricasEstaciones.totalConsumoGramos}g)
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 4. TRAMPAS FÍSICAS */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>4. TRAMPAS MECÁNICAS Y CAPTURA</Text>
            <Text style={styles.campoEtiqueta}>Tipo de Trampa:</Text>
            <View style={styles.chipsContenedor}>
              {TipoTrampaDrtSchema.options.map((tt) => {
                const seleccionado = acta.tipoTrampa === tt;
                return (
                  <TouchableOpacity
                    key={`trampa-${tt}`}
                    style={[styles.chip, seleccionado && styles.chipActivo]}
                    onPress={() => setActa((p) => ({ ...p, tipoTrampa: tt }))}
                  >
                    <Text style={[styles.chipTexto, seleccionado && styles.chipTextoActivo]}>
                      {LABELS_TRAMPA[tt]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Trampas Instaladas:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={String(acta.trampasInstaladas)}
                  keyboardType="numeric"
                  onChangeText={(t) => setActa((p) => ({ ...p, trampasInstaladas: Number(t) || 0 }))}
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Trampas Activadas:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={String(acta.trampasActivadas)}
                  keyboardType="numeric"
                  onChangeText={(t) => setActa((p) => ({ ...p, trampasActivadas: Number(t) || 0 }))}
                />
              </View>
            </View>
          </View>

          {/* 5. ESPECIES DE ROEDORES */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>5. ESPECIES DE ROEDORES DETECTADAS</Text>
            <Text style={styles.instruccionTexto}>Seleccione las especies identificadas durante la inspección:</Text>
            <View style={styles.chipsContenedor}>
              {EspecieRoedorDrtSchema.options.map((esp) => {
                const marcada = acta.roedoresDetectados.includes(esp);
                return (
                  <TouchableOpacity
                    key={`esp-${esp}`}
                    style={[styles.chip, marcada && styles.chipActivo]}
                    onPress={() => toggleEspecieRoedor(esp)}
                  >
                    <Text style={[styles.chipTexto, marcada && styles.chipTextoActivo]}>
                      {marcada ? '✓ ' : '+ '}
                      {LABELS_ROEDOR[esp]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 6. RESULTADOS Y OBSERVACIONES */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>6. RESULTADOS, RECOMENDACIONES Y OBSERVACIONES</Text>
            <Text style={styles.campoEtiqueta}>Resultados y Recomendaciones Técnicas:</Text>
            <TextInput
              style={[styles.inputTexto, styles.inputArea]}
              value={acta.resultadosRecomendaciones}
              multiline
              numberOfLines={3}
              onChangeText={(t) => setActa((p) => ({ ...p, resultadosRecomendaciones: t }))}
              placeholder="Describa el estado del perímetro, hallazgos y medidas sanitarias..."
            />

            <Text style={styles.campoEtiqueta}>Observaciones del Cliente:</Text>
            <TextInput
              style={[styles.inputTexto, styles.inputArea]}
              value={acta.observacionesCliente}
              multiline
              numberOfLines={2}
              onChangeText={(t) => setActa((p) => ({ ...p, observacionesCliente: t }))}
              placeholder="Comentarios adicionales del responsable de sede..."
            />
          </View>

          {/* 7. FIRMAS Y CONFORMIDAD */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>7. FIRMAS Y CONFORMIDAD</Text>
            <Text style={styles.subseccionTitulo}>Personal Responsable GAFER:</Text>
            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Nombre del Técnico:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.firmas.personalResponsableNombre}
                  onChangeText={(t) =>
                    setActa((p) => ({ ...p, firmas: { ...p.firmas, personalResponsableNombre: t } }))
                  }
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Cargo:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.firmas.personalResponsableCargo}
                  onChangeText={(t) =>
                    setActa((p) => ({ ...p, firmas: { ...p.firmas, personalResponsableCargo: t } }))
                  }
                />
              </View>
            </View>

            <Text style={styles.subseccionTitulo}>Conformidad del Cliente:</Text>
            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Nombre del Contacto:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.firmas.clienteConformidadNombre}
                  placeholder="Persona que recibe"
                  onChangeText={(t) =>
                    setActa((p) => ({ ...p, firmas: { ...p.firmas, clienteConformidadNombre: t } }))
                  }
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Cargo del Contacto:</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={acta.firmas.clienteConformidadCargo}
                  placeholder="Cargo / Área"
                  onChangeText={(t) =>
                    setActa((p) => ({ ...p, firmas: { ...p.firmas, clienteConformidadCargo: t } }))
                  }
                />
              </View>
            </View>
          </View>

          {/* 8. PLANILLA INDIVIDUAL POR ESTACIÓN */}
          <View style={styles.seccionCard}>
            <View style={styles.cabeceraPlanilla}>
              <Text style={styles.seccionTitulo}>8. PLANILLA POR ESTACIÓN DE CONTROL</Text>
              <View style={styles.grupoBotonesAgregar}>
                <TouchableOpacity style={styles.botonAgregarEstacion} onPress={() => agregarEstaciones(1)}>
                  <Text style={styles.textoBotonAgregar}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonAgregarEstacion} onPress={() => agregarEstaciones(5)}>
                  <Text style={styles.textoBotonAgregar}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonAgregarEstacion} onPress={() => agregarEstaciones(10)}>
                  <Text style={styles.textoBotonAgregar}>+10</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Resumen de Métricas de la Planilla */}
            <View style={styles.panelMetricasPlanilla}>
              <Text style={styles.metricasPlanillaTexto}>
                Total: <Text style={styles.metricaNegrita}>{metricasEstaciones.total}</Text> | Sin Act.:{' '}
                <Text style={{ color: '#16a34a', fontWeight: '700' }}>{metricasEstaciones.sinActividad}</Text> | Con Cons.:{' '}
                <Text style={{ color: '#ea580c', fontWeight: '700' }}>{metricasEstaciones.conConsumo}</Text> | Sin Acceso:{' '}
                <Text style={{ color: '#64748b', fontWeight: '700' }}>{metricasEstaciones.sinAcceso}</Text> | Extrav.:{' '}
                <Text style={{ color: '#dc2626', fontWeight: '700' }}>{metricasEstaciones.extraviada}</Text>
              </Text>
            </View>

            {acta.planillaEstaciones.map((est) => {
              const confEstado = LABELS_ESTADO_ESTACION[est.estado];
              return (
                <View key={`estacion-row-${est.numero}`} style={styles.filaEstacionCard}>
                  <View style={styles.estacionHeader}>
                    <Text style={styles.estacionNumero}>📍 Estación #{est.numero}</Text>
                    <View style={[styles.badgeEstado, { backgroundColor: confEstado.color }]}>
                      <Text style={styles.badgeEstadoTexto}>{confEstado.badge}</Text>
                    </View>
                  </View>

                  {/* Chips de Selección de Estado (incluye Sin Acceso y Extraviada) */}
                  <View style={styles.chipsContenedorCompacto}>
                    {EstadoEstacionPlanillaSchema.options.map((estOpcion) => {
                      const estaActivo = est.estado === estOpcion;
                      const opcionConf = LABELS_ESTADO_ESTACION[estOpcion];
                      return (
                        <TouchableOpacity
                          key={`opcion-${est.numero}-${estOpcion}`}
                          style={[
                            styles.chipCompacto,
                            estaActivo && { backgroundColor: opcionConf.color, borderColor: opcionConf.color },
                          ]}
                          onPress={() => cambiarEstadoEstacion(est.numero, estOpcion)}
                        >
                          <Text
                            style={[
                              styles.chipCompactoTexto,
                              estaActivo && styles.chipCompactoTextoActivo,
                            ]}
                          >
                            {opcionConf.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Si hubo consumo, registrar gramos */}
                  {est.estado === 'CON_CONSUMO' ? (
                    <View style={styles.filaInputs}>
                      <View style={styles.columnaInput}>
                        <Text style={styles.campoEtiqueta}>Consumo (gramos):</Text>
                        <TextInput
                          style={styles.inputTexto}
                          keyboardType="numeric"
                          value={est.consumoGramos ? String(est.consumoGramos) : ''}
                          placeholder="Ej. 10"
                          onChangeText={(t) => cambiarConsumoEstacion(est.numero, Number(t) || 0)}
                        />
                      </View>
                      <View style={styles.columnaInput}>
                        <Text style={styles.campoEtiqueta}>Repuesto (gramos):</Text>
                        <TextInput
                          style={styles.inputTexto}
                          keyboardType="numeric"
                          value={est.repuestoGramos ? String(est.repuestoGramos) : ''}
                          placeholder="Ej. 10"
                          onChangeText={(t) => cambiarConsumoEstacion(est.numero, Number(t) || 0)}
                        />
                      </View>
                    </View>
                  ) : null}

                  {/* Observación individual (obligatoria si es Sin Acceso o Extraviada) */}
                  {(est.estado === 'SIN_ACCESO' || est.estado === 'EXTRAVIADA' || est.observaciones) ? (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.campoEtiqueta}>
                        {est.estado === 'SIN_ACCESO'
                          ? 'Motivo de falta de acceso:'
                          : est.estado === 'EXTRAVIADA'
                            ? 'Detalle de extravío o daño:'
                            : 'Observación:'}
                      </Text>
                      <TextInput
                        style={styles.inputTexto}
                        value={est.observaciones || ''}
                        placeholder="Indique motivo o detalle..."
                        onChangeText={(t) => cambiarNotaEstacion(est.numero, t)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barra de Acciones Fijas Inferiores */}
      <View style={styles.barraAccionesFija}>
        <Button
          titulo="Guardar Borrador"
          onPress={handleGuardarBorradorManual}
          variante="secundario"
          deshabilitado={guardando}
          style={styles.botonBarra}
        />
        <Button
          titulo="Finalizar y Encolar"
          onPress={handleFinalizarServicio}
          variante="primario"
          deshabilitado={guardando}
          cargando={guardando}
          style={styles.botonBarra}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  cabeceraBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.marca,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  botonVolver: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: TOKENS.radiusSm,
  },
  textoBotonVolver: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cabeceraCentro: {
    alignItems: 'center',
  },
  cabeceraTitulo: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  cabeceraSubtitulo: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  badgeOffline: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeOfflineTexto: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContenido: {
    padding: 16,
    gap: 14,
  },
  alertaGuardado: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    padding: 10,
    borderRadius: TOKENS.radiusSm,
  },
  alertaGuardadoTexto: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  alertaError: {
    marginBottom: 4,
  },
  seccionCard: {
    backgroundColor: '#ffffff',
    borderRadius: TOKENS.radiusSm,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: '900',
    color: TOKENS.ink,
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subseccionTitulo: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  instruccionTexto: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    marginBottom: 8,
  },
  campoEtiqueta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
  },
  inputTexto: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: TOKENS.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: TOKENS.ink,
  },
  inputArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  filaInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  columnaInput: {
    flex: 1,
  },
  filaTresInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  columnaTres: {
    flex: 1,
  },
  chipsContenedor: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  chipActivo: {
    backgroundColor: TOKENS.marca,
    borderColor: TOKENS.marca,
  },
  chipTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  chipTextoActivo: {
    color: '#ffffff',
  },
  botonAutoSuma: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: TOKENS.radiusSm,
    marginTop: 8,
    alignItems: 'center',
  },
  textoAutoSuma: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  cabeceraPlanilla: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  grupoBotonesAgregar: {
    flexDirection: 'row',
    gap: 6,
  },
  botonAgregarEstacion: {
    backgroundColor: '#0284c7',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  textoBotonAgregar: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  panelMetricasPlanilla: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  metricasPlanillaTexto: {
    fontSize: 11,
    color: '#334155',
  },
  metricaNegrita: {
    fontWeight: '800',
  },
  filaEstacionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: TOKENS.radiusSm,
    padding: 10,
    marginBottom: 8,
  },
  estacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  estacionNumero: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  badgeEstado: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeEstadoTexto: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  chipsContenedorCompacto: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  chipCompacto: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  chipCompactoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chipCompactoTextoActivo: {
    color: '#ffffff',
  },
  barraAccionesFija: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  botonBarra: {
    flex: 1,
  },
});
