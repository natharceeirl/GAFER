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
  PorcentajeConsumo,
  EstadoFisicoEstacion,
} from '@gafer/contracts';
import {
  crearEstacionDrt,
  aplicarPrimeraVisita,
  actualizarConsumoEstacion,
  actualizarEstadoFisicoEstacion,
  copiarCeboALote,
  validarEstacionesPlanilla,
  PORCENTAJES_CONSUMO,
  ESTADOS_FISICOS,
} from '../model/estaciones-drt';
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

    const estacionesIniciales: ItemEstacionPlanilla[] = Array.from({ length: 5 }, (_, i) =>
      crearEstacionDrt(i + 1, {
        tipoCebo: 'BLOQUE_10G',
        cantidadGramos: 20,
        lote: 'L-2026-01',
        vencimiento: '2026-12-31',
        estadoFisico: 'BUENAS_CONDICIONES',
        esInstalacion: false,
      }),
    );

    return {
      servicioId: servicioIdInicial,
      clienteRazonSocial: borrador?.clienteRazonSocial || 'Cliente Asignado',
      sedeDireccion: borrador?.sedeNombre || 'Sede Principal',
      fecha: fechaActualIso(),
      areaTratadaM2: 500,
      horaInicio: '08:30',
      horaTermino: '11:00',
      primeraVisita: false,
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

    // 2. Validar requerimientos técnicos específicos por estación (§5.1, GAF-35)
    const validacionEstaciones = validarEstacionesPlanilla(acta.planillaEstaciones, !!acta.primeraVisita);
    if (!validacionEstaciones.valido) {
      const listaErrores = validacionEstaciones.errores.map((e) => `• ${e}`).join('\n');
      setErrorValidacion(`Corrija los datos de las estaciones antes de finalizar (§5.1):\n\n${listaErrores}`);
      Alert.alert(
        'Estaciones Incompletas (§5.1)',
        'Hay estaciones con datos pendientes (cebo, lote, estado físico u observaciones). Revise la alerta superior.',
      );
      return;
    }

    Alert.alert(
      'Finalizar y Encolar Servicio',
      '¿Confirma que desea cerrar el acta de servicio DRT? El servicio y sus estaciones se guardarán de forma durable y se encolarán para sincronización con el servidor.',
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Concluir y Encolar',
          style: 'default',
          onPress: async () => {
            try {
              setGuardando(true);
              const userId = usuario?.id || 'tecnico-local-01';
              const res = await finalizarServicioDrt(resultado.data, userId, { encolarEstacionesIndividuales: true });
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

  // Mutadores de primera visita y planilla §5.1
  const handleTogglePrimeraVisita = (esPrimera: boolean) => {
    setActa((prev) => {
      const estacionesActualizadas = aplicarPrimeraVisita(prev.planillaEstaciones, esPrimera, {
        tipoCebo: prev.tipoCebo,
        cantidadGramos: 20,
      });
      return {
        ...prev,
        primeraVisita: esPrimera,
        actividad: esPrimera ? 'INSTALACION' : (prev.actividad === 'INSTALACION' ? 'MONITOREO' : prev.actividad),
        planillaEstaciones: estacionesActualizadas,
      };
    });
  };

  const handleCopiarCeboATodas = () => {
    if (acta.planillaEstaciones.length === 0) return;
    const ref = acta.planillaEstaciones[0];
    const cebo = {
      tipoCebo: ref.tipoCebo || acta.tipoCebo || 'BLOQUE_10G',
      cantidadGramos: ref.cantidadGramos || 20,
      lote: ref.lote || 'LOTE-001',
      vencimiento: ref.vencimiento || '2026-12-31',
    };

    setActa((prev) => ({
      ...prev,
      planillaEstaciones: copiarCeboALote(prev.planillaEstaciones, cebo),
    }));

    Alert.alert(
      'Cebo Replicado',
      `Se aplicó la formulación (${cebo.tipoCebo}, ${cebo.cantidadGramos}g, Lote: ${cebo.lote}, Venc: ${cebo.vencimiento}) a todas las estaciones.`,
    );
  };

  const cambiarEstadoEstacion = (numero: number, nuevoEstado: EstadoEstacionPlanilla) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, estado: nuevoEstado } : est,
      ),
    }));
  };

  const cambiarConsumoPorcentaje = (numero: number, huboConsumo: boolean, porcentaje?: PorcentajeConsumo) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? actualizarConsumoEstacion(est, huboConsumo, porcentaje) : est,
      ),
    }));
  };

  const cambiarEstadoFisico = (numero: number, estadoFisico: EstadoFisicoEstacion) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? actualizarEstadoFisicoEstacion(est, estadoFisico) : est,
      ),
    }));
  };

  const cambiarDatoEstacion = <K extends keyof ItemEstacionPlanilla>(
    numero: number,
    campo: K,
    valor: ItemEstacionPlanilla[K],
  ) => {
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, [campo]: valor } : est,
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
      const ref = actuales[0];
      const nuevas: ItemEstacionPlanilla[] = [];
      for (let i = 1; i <= cantidad; i++) {
        nuevas.push(
          crearEstacionDrt(ultimoNumero + i, {
            tipoCebo: ref?.tipoCebo || prev.tipoCebo || 'BLOQUE_10G',
            cantidadGramos: ref?.cantidadGramos || 20,
            lote: ref?.lote || 'L-2026-01',
            vencimiento: ref?.vencimiento || '2026-12-31',
            estadoFisico: 'BUENAS_CONDICIONES',
            esInstalacion: !!prev.primeraVisita,
          }),
        );
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

          {/* 8. PLANILLA INDIVIDUAL POR ESTACIÓN (§5.1, GAF-35) */}
          <View style={styles.seccionCard}>
            <View style={styles.cabeceraPlanilla}>
              <Text style={styles.seccionTitulo}>8. PLANILLA POR ESTACIÓN DE CONTROL (§5.1)</Text>
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

            {/* Selector de Primera Visita (Instalación Inicial) */}
            <View style={styles.contenedorPrimeraVisita}>
              <View style={styles.filaPrimeraVisita}>
                <Text style={styles.etiquetaPrimeraVisita}>🌱 Tipo de Visita:</Text>
                <View style={styles.chipsContenedorCompacto}>
                  <TouchableOpacity
                    style={[
                      styles.chipCompacto,
                      !acta.primeraVisita && styles.chipCompactoActivoVerde,
                    ]}
                    onPress={() => handleTogglePrimeraVisita(false)}
                  >
                    <Text
                      style={[
                        styles.chipCompactoTexto,
                        !acta.primeraVisita && styles.chipCompactoTextoActivo,
                      ]}
                    >
                      Monitoreo / Regular
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.chipCompacto,
                      acta.primeraVisita && styles.chipCompactoActivoVerde,
                    ]}
                    onPress={() => handleTogglePrimeraVisita(true)}
                  >
                    <Text
                      style={[
                        styles.chipCompactoTexto,
                        acta.primeraVisita && styles.chipCompactoTextoActivo,
                      ]}
                    >
                      🌱 Primera Visita (Instalación)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {acta.primeraVisita ? (
                <View style={styles.bannerPrimeraVisita}>
                  <Text style={styles.bannerPrimeraVisitaTexto}>
                    📌 Modo Instalación Inicial: Se instalan estaciones y registra cebo, lote, vencimiento y estado físico. No se evalúa consumo (§5.1).
                  </Text>
                </View>
              ) : null}

              {/* Botón rápido para replicar cebo a todas las estaciones */}
              <TouchableOpacity
                style={styles.botonCopiarCebo}
                onPress={handleCopiarCeboATodas}
              >
                <Text style={styles.textoBotonCopiarCebo}>⚡ Replicar Cebo, Lote y Vencimiento a todas</Text>
              </TouchableOpacity>
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
              const esPrimera = !!acta.primeraVisita || !!est.esInstalacion;
              return (
                <View key={`estacion-row-${est.numero}`} style={styles.filaEstacionCard}>
                  <View style={styles.estacionHeader}>
                    <Text style={styles.estacionNumero}>📍 Estación #{est.numero}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {esPrimera ? (
                        <View style={[styles.badgeEstado, { backgroundColor: '#10b981' }]}>
                          <Text style={styles.badgeEstadoTexto}>INSTALACIÓN</Text>
                        </View>
                      ) : (
                        <View style={[styles.badgeEstado, { backgroundColor: confEstado.color }]}>
                          <Text style={styles.badgeEstadoTexto}>{confEstado.badge}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.badgeEstado,
                          {
                            backgroundColor:
                              est.estadoFisico === 'MALAS_CONDICIONES' ? '#ef4444' : '#16a34a',
                          },
                        ]}
                      >
                        <Text style={styles.badgeEstadoTexto}>
                          {est.estadoFisico === 'MALAS_CONDICIONES' ? '⚠️ MAL ESTADO' : '✓ BUEN ESTADO'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Fila 1: Cebo y Gramos */}
                  <View style={styles.filaInputs}>
                    <View style={styles.columnaInput}>
                      <Text style={styles.campoEtiqueta}>Formulación Cebo:</Text>
                      <TextInput
                        style={styles.inputTexto}
                        value={est.tipoCebo || ''}
                        placeholder="Ej. BLOQUE_10G"
                        onChangeText={(t) => cambiarDatoEstacion(est.numero, 'tipoCebo', t)}
                      />
                    </View>
                    <View style={[styles.columnaInput, { maxWidth: 100 }]}>
                      <Text style={styles.campoEtiqueta}>Gramos Base:</Text>
                      <TextInput
                        style={styles.inputTexto}
                        keyboardType="numeric"
                        value={est.cantidadGramos ? String(est.cantidadGramos) : ''}
                        placeholder="20"
                        onChangeText={(t) => {
                          const g = Number(t) || 0;
                          setActa((prev) => ({
                            ...prev,
                            planillaEstaciones: prev.planillaEstaciones.map((e) =>
                              e.numero === est.numero
                                ? {
                                    ...e,
                                    cantidadGramos: g,
                                    consumoGramos:
                                      e.huboConsumo && e.porcentajeConsumo
                                        ? Math.round((g * (e.porcentajeConsumo / 100)) * 100) / 100
                                        : 0,
                                    repuestoGramos:
                                      e.huboConsumo && e.porcentajeConsumo
                                        ? Math.round((g * (e.porcentajeConsumo / 100)) * 100) / 100
                                        : 0,
                                  }
                                : e,
                            ),
                          }));
                        }}
                      />
                    </View>
                  </View>

                  {/* Fila 2: Lote y Vencimiento */}
                  <View style={styles.filaInputs}>
                    <View style={styles.columnaInput}>
                      <Text style={styles.campoEtiqueta}>Lote:</Text>
                      <TextInput
                        style={styles.inputTexto}
                        value={est.lote || ''}
                        placeholder="Ej. L-2026-01"
                        onChangeText={(t) => cambiarDatoEstacion(est.numero, 'lote', t)}
                      />
                    </View>
                    <View style={styles.columnaInput}>
                      <Text style={styles.campoEtiqueta}>Vencimiento (YYYY-MM-DD):</Text>
                      <TextInput
                        style={styles.inputTexto}
                        value={est.vencimiento || ''}
                        placeholder="2026-12-31"
                        onChangeText={(t) => cambiarDatoEstacion(est.numero, 'vencimiento', t)}
                      />
                    </View>
                  </View>

                  {/* Selector de Estado Físico (§5.1) */}
                  <Text style={styles.campoEtiqueta}>Estado Físico de la Estación:</Text>
                  <View style={styles.chipsContenedorCompacto}>
                    {ESTADOS_FISICOS.map((ef) => {
                      const activo = est.estadoFisico === ef;
                      const esMalo = ef === 'MALAS_CONDICIONES';
                      return (
                        <TouchableOpacity
                          key={`ef-${est.numero}-${ef}`}
                          style={[
                            styles.chipCompacto,
                            activo && {
                              backgroundColor: esMalo ? '#dc2626' : '#16a34a',
                              borderColor: esMalo ? '#dc2626' : '#16a34a',
                            },
                          ]}
                          onPress={() => cambiarEstadoFisico(est.numero, ef)}
                        >
                          <Text
                            style={[
                              styles.chipCompactoTexto,
                              activo && styles.chipCompactoTextoActivo,
                            ]}
                          >
                            {ef === 'BUENAS_CONDICIONES' ? '✓ Buenas Condiciones' : '⚠️ Malas Condiciones'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Consumo (§5.1) */}
                  {!esPrimera ? (
                    <View style={styles.contenedorConsumo}>
                      <Text style={styles.campoEtiqueta}>Estado del Punto de Control:</Text>
                      <View style={styles.chipsContenedorCompacto}>
                        {EstadoEstacionPlanillaSchema.options.map((estOpcion) => {
                          const estaActivo = est.estado === estOpcion;
                          const opcionConf = LABELS_ESTADO_ESTACION[estOpcion];
                          return (
                            <TouchableOpacity
                              key={`opcion-${est.numero}-${estOpcion}`}
                              style={[
                                styles.chipCompacto,
                                estaActivo && {
                                  backgroundColor: opcionConf.color,
                                  borderColor: opcionConf.color,
                                },
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

                      {/* Consumo Sí / No */}
                      <Text style={styles.campoEtiqueta}>¿Hubo consumo de cebo?:</Text>
                      <View style={styles.chipsContenedorCompacto}>
                        <TouchableOpacity
                          style={[
                            styles.chipCompacto,
                            !est.huboConsumo && styles.chipCompactoActivoVerde,
                          ]}
                          onPress={() => cambiarConsumoPorcentaje(est.numero, false)}
                        >
                          <Text
                            style={[
                              styles.chipCompactoTexto,
                              !est.huboConsumo && styles.chipCompactoTextoActivo,
                            ]}
                          >
                            No (0%)
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.chipCompacto,
                            est.huboConsumo && styles.chipCompactoActivoNaranja,
                          ]}
                          onPress={() => cambiarConsumoPorcentaje(est.numero, true, est.porcentajeConsumo || 25)}
                        >
                          <Text
                            style={[
                              styles.chipCompactoTexto,
                              est.huboConsumo && styles.chipCompactoTextoActivo,
                            ]}
                          >
                            Sí (Hubo Consumo)
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Porcentaje de Consumo en pasos de 25 */}
                      {est.huboConsumo ? (
                        <View style={styles.seccionPorcentaje}>
                          <Text style={styles.campoEtiqueta}>Porcentaje de consumo (§5.1):</Text>
                          <View style={styles.chipsContenedorCompacto}>
                            {PORCENTAJES_CONSUMO.map((p) => {
                              const activo = est.porcentajeConsumo === p;
                              return (
                                <TouchableOpacity
                                  key={`porc-${est.numero}-${p}`}
                                  style={[
                                    styles.chipCompacto,
                                    activo && styles.chipCompactoActivoNaranja,
                                  ]}
                                  onPress={() => cambiarConsumoPorcentaje(est.numero, true, p)}
                                >
                                  <Text
                                    style={[
                                      styles.chipCompactoTexto,
                                      activo && styles.chipCompactoTextoActivo,
                                    ]}
                                  >
                                    {p}%
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <View style={styles.panelCalculoConsumo}>
                            <Text style={styles.textoCalculoConsumo}>
                              🍽️ Consumo: <Text style={{ fontWeight: '800' }}>{est.consumoGramos} g</Text> ({est.porcentajeConsumo}%)
                              {'  '}|{'  '}
                              🔄 Reposición: <Text style={{ fontWeight: '800' }}>{est.repuestoGramos} g</Text>
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.bannerPrimeraVisitaEstacion}>
                      <Text style={styles.bannerPrimeraVisitaEstacionTexto}>
                        🌱 Instalación Inicial: Cebo instalado al 100%. No se evalúa consumo (§5.1).
                      </Text>
                    </View>
                  )}

                  {/* Observaciones */}
                  {(est.estadoFisico === 'MALAS_CONDICIONES' ||
                    est.estado === 'SIN_ACCESO' ||
                    est.estado === 'EXTRAVIADA' ||
                    est.observaciones) ? (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.campoEtiqueta}>
                        {est.estadoFisico === 'MALAS_CONDICIONES'
                          ? '⚠️ Detalle del daño físico (Requerido):'
                          : est.estado === 'SIN_ACCESO'
                            ? 'Motivo de falta de acceso (Requerido):'
                            : est.estado === 'EXTRAVIADA'
                              ? 'Detalle de extravío (Requerido):'
                              : 'Observación:'}
                      </Text>
                      <TextInput
                        style={styles.inputTexto}
                        value={est.observaciones || ''}
                        placeholder="Indique motivo o detalle del daño..."
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
  chipCompactoActivoVerde: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  chipCompactoActivoNaranja: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  contenedorPrimeraVisita: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  filaPrimeraVisita: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  etiquetaPrimeraVisita: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  bannerPrimeraVisita: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
  },
  bannerPrimeraVisitaTexto: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '600',
  },
  botonCopiarCebo: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  textoBotonCopiarCebo: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '800',
  },
  contenedorConsumo: {
    marginTop: 4,
  },
  seccionPorcentaje: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 4,
    padding: 8,
    marginTop: 6,
  },
  panelCalculoConsumo: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 4,
  },
  textoCalculoConsumo: {
    fontSize: 11,
    color: '#9a3412',
  },
  bannerPrimeraVisitaEstacion: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 4,
    padding: 6,
    marginTop: 6,
  },
  bannerPrimeraVisitaEstacionTexto: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
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
