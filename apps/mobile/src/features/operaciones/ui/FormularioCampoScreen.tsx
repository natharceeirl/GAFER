import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { OperacionSyncSchema } from '@gafer/contracts';
import { useAuthStore } from '../../auth/model/use-auth-store';
import { BorradorInspeccion, useBorradorStore } from '../model/use-borrador-store';
import {
  FormularioCampo,
  InsumoAplicado,
  EquipoCatalogoItem,
  BloqueCierre,
  METODOS_APLICACION,
  ESTADOS_GENERALES,
  NIVELES_INFESTACION,
  UNIDADES,
  CATALOGOS_CAMPO_DEFECTO,
  EQUIPOS_CATALOGO_SEMILLA,
  crearFormularioCampo,
  validarCierre,
} from '../model/formulario-campo';
import { FirmaPadModal } from './FirmaPadModal';
import { Button, AlertBanner } from '../../../shared/ui';
import { TOKENS } from '../../../shared/theme/tokens';

export interface FormularioCampoScreenProps {
  onVolver: () => void;
  onAbrirPlanillaDrt?: () => void;
  formularioInicial?: FormularioCampo;
}

interface UsuarioBasico {
  id: string;
  nombres: string;
  apellidos: string;
}

function construirFormularioInicial(
  borrador: BorradorInspeccion | null,
  usuario: UsuarioBasico | null,
  formularioInicial?: FormularioCampo,
): FormularioCampo {
  if (borrador?.datosCampo) {
    return borrador.datosCampo;
  }
  if (formularioInicial) {
    return formularioInicial;
  }

  const tecnicoNombre = usuario
    ? `${usuario.nombres} ${usuario.apellidos}`
    : 'Técnico Operador';

  if (!borrador) {
    return crearFormularioCampo({
      cliente: { razonSocial: 'Sin servicio activo' },
      sede: { nombre: 'Sin sede seleccionada' },
      servicio: {
        id: '',
        tipo: 'Inspección de Saneamiento',
        requiereCertificado: false,
      },
      tecnicoNombre,
      tecnicoId: usuario?.id,
    });
  }

  const cfg = borrador.configServicio;
  return crearFormularioCampo({
    cliente: {
      razonSocial: borrador.clienteRazonSocial || 'Cliente no especificado',
    },
    sede: {
      nombre: borrador.sedeNombre || 'Sede no especificada',
    },
    servicio: {
      id: borrador.servicioId,
      tipo: borrador.servicioTipo || 'Inspección de Saneamiento',
      tipoServicio: cfg?.tipoServicio,
      requiereCertificado: cfg?.requiereCertificado ?? false,
      insumosAutorizados: cfg?.insumosAutorizados,
      dosisReferencial: cfg?.dosisReferencial,
      equiposAutorizados: cfg?.equiposAutorizados,
    },
    tecnicoNombre,
    tecnicoId: usuario?.id,
  });
}

export const FormularioCampoScreen: React.FC<FormularioCampoScreenProps> = ({
  onVolver,
  onAbrirPlanillaDrt,
  formularioInicial,
}) => {
  const { usuario } = useAuthStore();
  const borrador = useBorradorStore((state) => state.borrador);
  const actualizarCampo = useBorradorStore((state) => state.actualizarCampo);
  const finalizarServicioCampo = useBorradorStore((state) => state.finalizarServicioCampo);

  const [guardando, setGuardando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [erroresBloque, setErroresBloque] = useState<Partial<Record<BloqueCierre, string>>>({});
  const [nuevoColega, setNuevoColega] = useState('');
  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);

  // Inicializar estado del formulario con borrador activo o inicial (sin datos ficticios)
  const [formulario, setFormulario] = useState<FormularioCampo>(() =>
    construirFormularioInicial(borrador, usuario, formularioInicial),
  );

  const scrollRef = useRef<ScrollView>(null);
  const ultimoFormularioRef = useRef(formulario);
  ultimoFormularioRef.current = formulario;
  const servicioIdCargadoRef = useRef<string>(formulario.servicioId);
  const montadoRef = useRef(true);
  const finalizandoRef = useRef(false);
  const finalizadoRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mensajeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardadoEnCursoRef = useRef<Promise<boolean> | null>(null);

  const usuarioId = usuario?.id ?? borrador?.usuarioId;

  const cancelarAutoGuardado = useCallback(() => {
    if (autoSaveTimerRef.current !== null) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      cancelarAutoGuardado();
      if (mensajeTimerRef.current !== null) {
        clearTimeout(mensajeTimerRef.current);
        mensajeTimerRef.current = null;
      }
    };
  }, [cancelarAutoGuardado]);

  // Sincronizar si el borrador activo llega después del montaje o cambia de servicio
  useEffect(() => {
    if (formularioInicial || finalizandoRef.current || finalizadoRef.current) {
      return;
    }
    if (!borrador) {
      return;
    }
    if (borrador.servicioId !== servicioIdCargadoRef.current) {
      servicioIdCargadoRef.current = borrador.servicioId;
      setFormulario(construirFormularioInicial(borrador, usuario));
    }
  }, [borrador, formularioInicial, usuario]);

  // Guarda el formulario en SQLite. Nunca escribe si no hay servicioId válido o si está cerrando/cerrado.
  const guardarFormulario = useCallback(
    async (formularioAGuardar: FormularioCampo): Promise<boolean> => {
      if (
        finalizandoRef.current ||
        finalizadoRef.current ||
        !formularioAGuardar.servicioId.trim()
      ) {
        return false;
      }
      const promesa = actualizarCampo(formularioAGuardar, {
        usuarioId,
        clienteRazonSocial: formularioAGuardar.clienteRazon,
        sedeNombre: formularioAGuardar.proyectoNombre,
        servicioTipo: formularioAGuardar.servicioEtiqueta,
      });
      guardadoEnCursoRef.current = promesa;
      try {
        return await promesa;
      } finally {
        if (guardadoEnCursoRef.current === promesa) {
          guardadoEnCursoRef.current = null;
        }
      }
    },
    [actualizarCampo, usuarioId],
  );

  // Guardado periódico automático en SQLite durable ("Durable before visible").
  // Se detiene al iniciar cierre/finalización para no resucitar un borrador cerrado.
  useEffect(() => {
    if (
      finalizado ||
      finalizandoRef.current ||
      finalizadoRef.current ||
      !formulario.servicioId.trim()
    ) {
      cancelarAutoGuardado();
      return;
    }

    cancelarAutoGuardado();
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (finalizandoRef.current || finalizadoRef.current) {
        return;
      }
      guardarFormulario(ultimoFormularioRef.current).then((ok) => {
        if (!montadoRef.current || finalizandoRef.current || finalizadoRef.current) {
          return;
        }
        if (!ok) {
          setErrorValidacion(
            'No se pudo guardar en el teléfono. No cierre la app y avise a soporte.',
          );
        }
      });
    }, 1500);

    return cancelarAutoGuardado;
  }, [formulario, finalizado, guardarFormulario, cancelarAutoGuardado]);

  // Equipos a renderizar en Bloque 2: combina catálogo autorizado del servicio + catálogo semilla + IDs seleccionados
  const equiposDisponibles = useMemo<EquipoCatalogoItem[]>(() => {
    const mapa = new Map<string, EquipoCatalogoItem>();
    for (const eq of formulario.equiposCatalogo ?? []) {
      mapa.set(eq.id, eq);
    }
    for (const eq of EQUIPOS_CATALOGO_SEMILLA) {
      if (!mapa.has(eq.id)) {
        mapa.set(eq.id, eq);
      }
    }
    for (const eqId of formulario.equipos) {
      if (!mapa.has(eqId)) {
        mapa.set(eqId, {
          id: eqId,
          codigoInterno: eqId.slice(0, 8).toUpperCase(),
          nombre: `Equipo autorizado (${eqId.slice(0, 8)})`,
          tipo: 'AUTORIZADO',
        });
      }
    }
    return Array.from(mapa.values());
  }, [formulario.equiposCatalogo, formulario.equipos]);

  // Manejo de cambios en el formulario
  const cambiar = <K extends keyof FormularioCampo>(campo: K, valor: FormularioCampo[K]) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
    setErrorValidacion(null);
  };

  const cambiarInsumo = (insumoId: string, cambio: Partial<InsumoAplicado>) => {
    setFormulario((prev) => ({
      ...prev,
      insumos: prev.insumos.map((ins) =>
        ins.insumoId === insumoId ? { ...ins, ...cambio } : ins,
      ),
    }));
    setErrorValidacion(null);
  };

  const toggleEquipo = (equipoId: string) => {
    setFormulario((prev) => {
      const existe = prev.equipos.includes(equipoId);
      const nuevosEquipos = existe
        ? prev.equipos.filter((id) => id !== equipoId)
        : [...prev.equipos, equipoId];
      return { ...prev, equipos: nuevosEquipos };
    });
    setErrorValidacion(null);
  };

  const toggleMetodo = (metodo: string) => {
    setFormulario((prev) => {
      const existe = prev.metodos.includes(metodo);
      const nuevos = existe
        ? prev.metodos.filter((m) => m !== metodo)
        : [...prev.metodos, metodo];
      return { ...prev, metodos: nuevos };
    });
    setErrorValidacion(null);
  };

  const toggleItemCatalogo = (
    campo: 'hallazgos' | 'acciones' | 'observaciones' | 'recomendaciones',
    item: string,
  ) => {
    setFormulario((prev) => {
      const actual = prev[campo];
      const existe = actual.includes(item);
      const nuevos = existe
        ? actual.filter((it) => it !== item)
        : [...actual, item];
      return { ...prev, [campo]: nuevos };
    });
  };

  const agregarColega = () => {
    const nombre = nuevoColega.trim();
    if (!nombre) return;
    if (!formulario.personal.includes(nombre)) {
      setFormulario((prev) => ({
        ...prev,
        personal: [...prev.personal, nombre],
      }));
    }
    setNuevoColega('');
  };

  const removerColega = (nombre: string) => {
    setFormulario((prev) => ({
      ...prev,
      personal: prev.personal.filter((p) => p !== nombre),
    }));
  };

  const handleGuardarBorrador = async () => {
    if (finalizandoRef.current || finalizadoRef.current) {
      return;
    }
    cancelarAutoGuardado();
    setGuardando(true);
    try {
      const ok = await guardarFormulario(ultimoFormularioRef.current);
      if (!ok) {
        throw new Error('No se pudo guardar el formulario en SQLite');
      }
      const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMensajeGuardado(`Borrador guardado en SQLite local a las ${ahora} hrs.`);
      if (mensajeTimerRef.current !== null) {
        clearTimeout(mensajeTimerRef.current);
      }
      mensajeTimerRef.current = setTimeout(() => {
        mensajeTimerRef.current = null;
        if (montadoRef.current) {
          setMensajeGuardado(null);
        }
      }, 4000);
    } catch {
      setErrorValidacion('Error al guardar el borrador en la base de datos local.');
    } finally {
      setGuardando(false);
    }
  };

  const handleCerrarInspeccion = () => {
    if (finalizandoRef.current || finalizadoRef.current) {
      return;
    }

    const formActual = ultimoFormularioRef.current;
    const errores = validarCierre(formActual);
    setErroresBloque(errores);

    if (Object.keys(errores).length > 0) {
      const cantidad = Object.keys(errores).length;
      const primerError = Object.values(errores)[0];
      setErrorValidacion(
        `Faltan ${cantidad} bloque(s) por completar para cerrar la inspección: ${primerError}`,
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // Validar UUID del servicio y sesión del técnico antes de encolar en sync_outbox (F6)
    const agregadoIdCheck = OperacionSyncSchema.shape.agregadoId.safeParse(formActual.servicioId);
    if (!agregadoIdCheck.success) {
      Alert.alert(
        'Servicio No Válido',
        'El identificador del servicio no es un UUID válido. Vuelva a iniciar la visita desde la agenda.',
      );
      return;
    }

    const actorIdCheck = OperacionSyncSchema.shape.actorId.safeParse(usuario?.id);
    if (!actorIdCheck.success) {
      Alert.alert(
        'Sesión de Técnico Requerida',
        'No se pudo identificar al técnico autenticado para registrar la operación. Vuelva a iniciar sesión e intente nuevamente.',
      );
      return;
    }
    const actorId = actorIdCheck.data;

    Alert.alert(
      'Cierre de Inspección en Campo',
      '¿Está seguro de cerrar y firmar la inspección? Al cerrarse se generará el documento, se bloqueará la edición y quedará encolada para sincronización.',
      [
        { text: 'Revisar datos', style: 'cancel' },
        {
          text: 'Cerrar e Iniciar Sincronización',
          style: 'default',
          onPress: async () => {
            if (finalizandoRef.current || finalizadoRef.current) {
              return;
            }
            finalizandoRef.current = true;
            cancelarAutoGuardado();
            setGuardando(true);
            try {
              if (guardadoEnCursoRef.current) {
                await guardadoEnCursoRef.current;
              }
              const { operationId } = await finalizarServicioCampo(
                ultimoFormularioRef.current,
                actorId,
              );
              finalizadoRef.current = true;
              setFinalizado(true);

              Alert.alert(
                'Inspección Cerrada Exitosamente',
                `El servicio ha concluido. Operación #${operationId.slice(0, 8)} encolada en Outbox de SQLite y lista para revisión del supervisor.`,
                [{ text: 'Aceptar', onPress: onVolver }],
              );
            } catch (err: unknown) {
              finalizandoRef.current = false;
              const mensaje =
                err instanceof Error ? err.message : 'No se pudo cerrar la inspección.';
              setErrorValidacion(mensaje);
            } finally {
              if (montadoRef.current) {
                setGuardando(false);
              }
            }
          },
        },
      ],
    );
  };

  // Guarda cambios pendientes en SQLite antes de desmontar la pantalla (F3)
  const handleVolver = useCallback(async () => {
    cancelarAutoGuardado();
    if (finalizadoRef.current) {
      onVolver();
      return;
    }
    if (finalizandoRef.current) {
      return;
    }
    if (!ultimoFormularioRef.current.servicioId.trim()) {
      onVolver();
      return;
    }

    const ok = await guardarFormulario(ultimoFormularioRef.current);
    if (!ok) {
      Alert.alert(
        'No se pudo guardar',
        'El formulario no quedó guardado en el teléfono. Si sale ahora puede perder los últimos cambios.',
        [
          { text: 'Permanecer', style: 'cancel' },
          { text: 'Salir de todos modos', style: 'destructive', onPress: onVolver },
        ],
      );
      return;
    }
    onVolver();
  }, [cancelarAutoGuardado, guardarFormulario, onVolver]);

  // Interceptar botón atrás de hardware en Android (y gestos de retorno)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleVolver();
      return true;
    });
    return () => sub.remove();
  }, [handleVolver]);

  // Guarda cambios del formulario de campo antes de navegar a la Planilla DRT (F1, F3)
  const handleAbrirPlanillaDrt = useCallback(async () => {
    if (!onAbrirPlanillaDrt || finalizandoRef.current || finalizadoRef.current) {
      return;
    }
    cancelarAutoGuardado();
    if (ultimoFormularioRef.current.servicioId.trim()) {
      const ok = await guardarFormulario(ultimoFormularioRef.current);
      if (!ok) {
        Alert.alert(
          'No se pudo guardar',
          'No se pudieron guardar los últimos cambios antes de abrir la Planilla DRT.',
        );
        return;
      }
    }
    onAbrirPlanillaDrt();
  }, [cancelarAutoGuardado, guardarFormulario, onAbrirPlanillaDrt]);

  const firmarConformidad = () => {
    if (!formulario.firmanteNombre.trim() || !formulario.firmanteCargo.trim()) {
      Alert.alert(
        'Datos del Contacto Requeridos',
        'Por favor ingrese el nombre y cargo del contacto del cliente antes de estampar la firma.',
      );
      return;
    }

    setModalFirmaVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Cabecera Principal */}
        <View style={styles.cabecera}>
          <TouchableOpacity
            testID="boton-volver-formulario"
            onPress={handleVolver}
            style={styles.botonRetroceso}
          >
            <Text style={styles.textoBotonRetroceso}>← Volver</Text>
          </TouchableOpacity>

          <View style={styles.infoCabecera}>
            <Text style={styles.tituloCabecera} numberOfLines={1}>
              {formulario.clienteRazon}
            </Text>
            <Text style={styles.subtituloCabecera} numberOfLines={1}>
              {formulario.proyectoNombre} · {formulario.servicioEtiqueta}
            </Text>
          </View>

          <View style={styles.badgeEstado}>
            <Text style={styles.textoBadgeEstado}>BORRADOR</Text>
          </View>
        </View>

        {/* Notificaciones y Alertas */}
        {mensajeGuardado ? (
          <AlertBanner mensaje={mensajeGuardado} tipo="info" style={styles.alerta} />
        ) : null}

        {errorValidacion ? (
          <AlertBanner
            mensaje={errorValidacion}
            tipo="error"
            onCerrar={() => setErrorValidacion(null)}
            style={styles.alerta}
          />
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Bloque 1: Identificación y Personal */}
          <View style={[styles.bloque, erroresBloque.personal && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>1</Text>
              <Text style={styles.bloqueTitulo}>Datos del Servicio y Personal Técnico</Text>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.labelFijo}>Cliente:</Text>
              <Text style={styles.valorFijo}>{formulario.clienteRazon}</Text>
              <Text style={styles.labelFijo}>Sede / Proyecto:</Text>
              <Text style={styles.valorFijo}>{formulario.proyectoNombre}</Text>
              <Text style={styles.labelFijo}>Tipo de Servicio:</Text>
              <Text style={styles.valorFijo}>{formulario.servicioEtiqueta}</Text>
            </View>

            <View style={styles.filaHoras}>
              <View style={styles.campoMitad}>
                <Text style={styles.labelInput}>Fecha del Servicio</Text>
                <TextInput
                  testID="input-fecha-servicio"
                  style={styles.inputTexto}
                  value={formulario.fecha}
                  onChangeText={(t) => cambiar('fecha', t)}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>

              <View style={styles.campoMitad}>
                <Text style={styles.labelInput}>Hora Inicio</Text>
                <TextInput
                  testID="input-hora-inicio"
                  style={styles.inputTexto}
                  value={formulario.horaInicio}
                  onChangeText={(t) => cambiar('horaInicio', t)}
                  placeholder="HH:MM"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>
            </View>

            <View style={styles.filaHoras}>
              <View style={styles.campoMitad}>
                <Text style={styles.labelInput}>Hora Término</Text>
                <TextInput
                  testID="input-hora-fin"
                  style={styles.inputTexto}
                  value={formulario.horaFin}
                  onChangeText={(t) => cambiar('horaFin', t)}
                  placeholder="HH:MM"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>
            </View>

            <Text style={styles.subtituloSeccion}>Personal que Intervino en Campo (*)</Text>
            <View style={styles.contenedorChips}>
              {formulario.personal.map((tecnico) => (
                <View key={tecnico} style={styles.chipTecnico}>
                  <Text style={styles.textoChipTecnico}>👤 {tecnico}</Text>
                  {formulario.personal.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => removerColega(tecnico)}
                      style={styles.botonRemoverChip}
                    >
                      <Text style={styles.textoRemoverChip}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.filaAgregarColega}>
              <TextInput
                style={[styles.inputTexto, styles.inputFlex]}
                value={nuevoColega}
                onChangeText={setNuevoColega}
                placeholder="Nombre de técnico de apoyo..."
                placeholderTextColor={TOKENS.inkFaint}
              />
              <TouchableOpacity
                onPress={agregarColega}
                style={styles.botonAgregarColega}
              >
                <Text style={styles.textoBotonAgregarColega}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            {erroresBloque.personal ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.personal}</Text>
            ) : null}
          </View>

          {/* Bloque 2: Herramientas y Equipos Asignados */}
          <View style={[styles.bloque, erroresBloque.equipos && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>2</Text>
              <Text style={styles.bloqueTitulo}>Herramientas y Equipos Asignados (§8.2)</Text>
            </View>
            <Text style={styles.indicacionBloque}>
              Marque los equipos efectivamente utilizados durante la atención:
            </Text>

            <View style={styles.listaEquipos}>
              {equiposDisponibles.map((eq) => {
                const seleccionado = formulario.equipos.includes(eq.id);
                return (
                  <TouchableOpacity
                    key={eq.id}
                    testID={`equipo-toggle-${eq.id}`}
                    onPress={() => toggleEquipo(eq.id)}
                    style={[
                      styles.itemEquipo,
                      seleccionado && styles.itemEquipoSeleccionado,
                    ]}
                  >
                    <View style={styles.checkboxEquipo}>
                      <Text style={styles.textoCheckboxEquipo}>
                        {seleccionado ? '✓' : '○'}
                      </Text>
                    </View>
                    <View style={styles.infoEquipo}>
                      <Text
                        style={[
                          styles.nombreEquipo,
                          seleccionado && styles.nombreEquipoSeleccionado,
                        ]}
                      >
                        {eq.nombre}
                      </Text>
                      <Text style={styles.codigoEquipo}>
                        Código: {eq.codigoInterno}
                        {eq.tipo ? ` · Tipo: ${eq.tipo}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {erroresBloque.equipos ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.equipos}</Text>
            ) : null}
          </View>

          {/* Bloque 3: Insumos Químicos Autorizados y Dosis (§8.2) */}
          <View style={[styles.bloque, erroresBloque.insumos && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>3</Text>
              <Text style={styles.bloqueTitulo}>Insumos Químicos y Dosis Autorizadas (§8.2)</Text>
            </View>
            <Text style={styles.indicacionBloque}>
              Insumos precargados del servicio. Registre lote, vencimiento y consumo real:
            </Text>

            {formulario.insumos.map((ins, index) => {
              const advertenciaDosis =
                ins.dosisReal &&
                ins.dosisReferencial &&
                ins.dosisReal.trim() !== ins.dosisReferencial.trim();

              return (
                <View key={ins.insumoId || index} style={styles.tarjetaInsumo}>
                  <View style={styles.cabeceraTarjetaInsumo}>
                    <View style={styles.tituloInsumoContenedor}>
                      <Text style={styles.nombreInsumo}>
                        {ins.nombreComercial || 'Insumo químico'}
                      </Text>
                      {ins.principioActivo ? (
                        <Text style={styles.principioInsumo}>
                          Principio activo: {ins.principioActivo}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      testID={`insumo-toggle-aplicado-${ins.insumoId}`}
                      onPress={() =>
                        cambiarInsumo(ins.insumoId, { aplicado: !ins.aplicado })
                      }
                      style={[
                        styles.toggleInsumo,
                        ins.aplicado ? styles.toggleInsumoActivo : styles.toggleInsumoInactivo,
                      ]}
                    >
                      <Text
                        style={[
                          styles.textoToggleInsumo,
                          ins.aplicado && styles.textoToggleInsumoActivo,
                        ]}
                      >
                        {ins.aplicado ? '✓ Aplicado' : 'No aplicado'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dosis referencial de contrato */}
                  <View style={styles.dosisRefBox}>
                    <Text style={styles.dosisRefEtiqueta}>Dosis Referencial Oficial:</Text>
                    <Text style={styles.dosisRefTexto}>
                      {ins.dosisReferencial || 'Estándar según ficha técnica'}
                    </Text>
                  </View>

                  {ins.aplicado ? (
                    <View style={styles.camposInsumo}>
                      <View style={styles.filaDobleInput}>
                        <View style={styles.campoMitad}>
                          <Text style={styles.labelInput}>N° de Lote (*)</Text>
                          <TextInput
                            testID={`input-lote-${ins.insumoId}`}
                            style={styles.inputTexto}
                            value={ins.lote}
                            onChangeText={(t) =>
                              cambiarInsumo(ins.insumoId, { lote: t })
                            }
                            placeholder="Ej. L-2451-SA"
                            placeholderTextColor={TOKENS.inkFaint}
                          />
                        </View>

                        <View style={styles.campoMitad}>
                          <Text style={styles.labelInput}>Vencimiento (*)</Text>
                          <TextInput
                            testID={`input-vencimiento-${ins.insumoId}`}
                            style={styles.inputTexto}
                            value={ins.vencimiento}
                            onChangeText={(t) =>
                              cambiarInsumo(ins.insumoId, { vencimiento: t })
                            }
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor={TOKENS.inkFaint}
                          />
                        </View>
                      </View>

                      <View style={styles.filaDobleInput}>
                        <View style={styles.campoMitad}>
                          <Text style={styles.labelInput}>Cantidad Utilizada (*)</Text>
                          <TextInput
                            testID={`input-cantidad-${ins.insumoId}`}
                            style={styles.inputTexto}
                            value={ins.cantidad}
                            onChangeText={(t) =>
                              cambiarInsumo(ins.insumoId, { cantidad: t })
                            }
                            placeholder="0.00"
                            keyboardType="numeric"
                            placeholderTextColor={TOKENS.inkFaint}
                          />
                        </View>

                        <View style={styles.campoMitad}>
                          <Text style={styles.labelInput}>Unidad de Medida</Text>
                          <View style={styles.selectorUnidad}>
                            {UNIDADES.map((unid) => {
                              const unidLower = unid.toLowerCase();
                              const activa = ins.unidad?.toLowerCase() === unidLower;
                              return (
                                <TouchableOpacity
                                  key={unid}
                                  onPress={() =>
                                    cambiarInsumo(ins.insumoId, { unidad: unidLower })
                                  }
                                  style={[
                                    styles.chipUnidad,
                                    activa && styles.chipUnidadActivo,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.textoChipUnidad,
                                      activa && styles.textoChipUnidadActivo,
                                    ]}
                                  >
                                    {unidLower}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>

                      <View style={styles.campoLleno}>
                        <Text style={styles.labelInput}>Dosis Real Aplicada</Text>
                        <TextInput
                          testID={`input-dosis-real-${ins.insumoId}`}
                          style={styles.inputTexto}
                          value={ins.dosisReal || ''}
                          onChangeText={(t) =>
                            cambiarInsumo(ins.insumoId, { dosisReal: t })
                          }
                          placeholder="Dosis real en campo..."
                          placeholderTextColor={TOKENS.inkFaint}
                        />
                        {advertenciaDosis ? (
                          <Text style={styles.avisoDosisModificada}>
                            ⚠️ La dosis ingresada difiere de la referencial autorizada.
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.campoLleno}>
                        <Text style={styles.labelInput}>Zonas o Áreas Tratadas (*)</Text>
                        <TextInput
                          testID={`input-zonas-${ins.insumoId}`}
                          style={styles.inputTexto}
                          value={ins.zonas}
                          onChangeText={(t) =>
                            cambiarInsumo(ins.insumoId, { zonas: t })
                          }
                          placeholder="Ej. Almacén 1, perímetro y garita principal"
                          placeholderTextColor={TOKENS.inkFaint}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {erroresBloque.insumos ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.insumos}</Text>
            ) : null}
          </View>

          {/* Bloque 4: Métodos de Aplicación */}
          <View style={[styles.bloque, erroresBloque.metodos && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>4</Text>
              <Text style={styles.bloqueTitulo}>Métodos de Aplicación (*)</Text>
            </View>
            <View style={styles.contenedorChips}>
              {METODOS_APLICACION.map((metodo) => {
                const activo = formulario.metodos.includes(metodo);
                return (
                  <TouchableOpacity
                    key={metodo}
                    testID={`metodo-chip-${metodo}`}
                    onPress={() => toggleMetodo(metodo)}
                    style={[styles.chipMetodo, activo && styles.chipMetodoActivo]}
                  >
                    <Text
                      style={[
                        styles.textoChipMetodo,
                        activo && styles.textoChipMetodoActivo,
                      ]}
                    >
                      {activo ? '✓ ' : '+ '}
                      {metodo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {erroresBloque.metodos ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.metodos}</Text>
            ) : null}
          </View>

          {/* Bloque 5: Condiciones Ambientales */}
          <View style={[styles.bloque, erroresBloque.condiciones && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>5</Text>
              <Text style={styles.bloqueTitulo}>Condiciones Ambientales (*)</Text>
            </View>
            <View style={styles.filaTripleInput}>
              <View style={styles.campoTercio}>
                <Text style={styles.labelInput}>Temp. (°C)</Text>
                <TextInput
                  testID="input-temperatura"
                  style={styles.inputTexto}
                  value={formulario.temperatura}
                  onChangeText={(t) => cambiar('temperatura', t)}
                  placeholder="22"
                  keyboardType="numeric"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>

              <View style={styles.campoTercio}>
                <Text style={styles.labelInput}>Humedad (%)</Text>
                <TextInput
                  testID="input-humedad"
                  style={styles.inputTexto}
                  value={formulario.humedad}
                  onChangeText={(t) => cambiar('humedad', t)}
                  placeholder="65"
                  keyboardType="numeric"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>

              <View style={styles.campoTercio}>
                <Text style={styles.labelInput}>Viento (km/h)</Text>
                <TextInput
                  testID="input-viento"
                  style={styles.inputTexto}
                  value={formulario.viento}
                  onChangeText={(t) => cambiar('viento', t)}
                  placeholder="10"
                  keyboardType="numeric"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>
            </View>
            {erroresBloque.condiciones ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.condiciones}</Text>
            ) : null}
          </View>

          {/* Bloque 6: Diagnóstico y Hallazgos */}
          <View style={[styles.bloque, erroresBloque.diagnostico && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>6</Text>
              <Text style={styles.bloqueTitulo}>Diagnóstico y Hallazgos (*)</Text>
            </View>

            <Text style={styles.labelInput}>Estado General del Establecimiento (*)</Text>
            <View style={styles.filaBotonesSeleccion}>
              {ESTADOS_GENERALES.map((est) => (
                <TouchableOpacity
                  key={est}
                  testID={`estado-general-${est}`}
                  onPress={() => cambiar('estadoGeneral', est)}
                  style={[
                    styles.botonOpcion,
                    formulario.estadoGeneral === est && styles.botonOpcionActivo,
                  ]}
                >
                  <Text
                    style={[
                      styles.textoBotonOpcion,
                      formulario.estadoGeneral === est && styles.textoBotonOpcionActivo,
                    ]}
                  >
                    {est}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelInput}>Nivel de Infestación (*)</Text>
            <View style={styles.filaBotonesSeleccion}>
              {NIVELES_INFESTACION.map((niv) => (
                <TouchableOpacity
                  key={niv}
                  testID={`nivel-infestacion-${niv}`}
                  onPress={() => cambiar('nivelInfestacion', niv)}
                  style={[
                    styles.botonOpcion,
                    formulario.nivelInfestacion === niv && styles.botonOpcionActivo,
                  ]}
                >
                  <Text
                    style={[
                      styles.textoBotonOpcion,
                      formulario.nivelInfestacion === niv && styles.textoBotonOpcionActivo,
                    ]}
                  >
                    {niv}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelInput}>Hallazgos Observados (Catálogo Rápido)</Text>
            <View style={styles.contenedorChips}>
              {CATALOGOS_CAMPO_DEFECTO.hallazgos.map((h) => {
                const activo = formulario.hallazgos.includes(h);
                return (
                  <TouchableOpacity
                    key={h}
                    onPress={() => toggleItemCatalogo('hallazgos', h)}
                    style={[styles.chipTexto, activo && styles.chipTextoActivo]}
                  >
                    <Text
                      style={[
                        styles.textoChipTexto,
                        activo && styles.textoChipTextoActivo,
                      ]}
                    >
                      {activo ? '✓ ' : '+ '}
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.labelInput}>Detalle de Hallazgos y Acciones</Text>
            <TextInput
              testID="input-hallazgos-detalle"
              style={[styles.inputTexto, styles.inputArea]}
              value={formulario.hallazgosDetalle}
              onChangeText={(t) => cambiar('hallazgosDetalle', t)}
              placeholder="Detalle los hallazgos específicos encontrados..."
              placeholderTextColor={TOKENS.inkFaint}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.labelInput}>Observaciones Libres de Campo</Text>
            <TextInput
              testID="input-observaciones-libre"
              style={[styles.inputTexto, styles.inputArea]}
              value={formulario.observacionesLibre}
              onChangeText={(t) => cambiar('observacionesLibre', t)}
              placeholder="Notas u observaciones de campo..."
              placeholderTextColor={TOKENS.inkFaint}
              multiline
              numberOfLines={2}
            />
            {erroresBloque.diagnostico ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.diagnostico}</Text>
            ) : null}
          </View>

          {/* Bloque 7: Conformidad del Cliente y Firma */}
          <View style={[styles.bloque, erroresBloque.conformidad && styles.bloqueConError]}>
            <View style={styles.bloqueHeader}>
              <Text style={styles.bloqueNumero}>7</Text>
              <Text style={styles.bloqueTitulo}>Conformidad del Cliente y Firma (*)</Text>
            </View>

            <TouchableOpacity
              testID="toggle-responsable-no-disponible"
              onPress={() =>
                cambiar('responsableNoDisponible', !formulario.responsableNoDisponible)
              }
              style={[
                styles.itemDisponibilidad,
                formulario.responsableNoDisponible && styles.itemDisponibilidadActivo,
              ]}
            >
              <Text style={styles.textoCheckboxDisponibilidad}>
                {formulario.responsableNoDisponible ? '☑' : '☐'}
              </Text>
              <Text style={styles.textoDisponibilidad}>
                Responsable del cliente NO estuvo disponible al momento del servicio
              </Text>
            </TouchableOpacity>

            {!formulario.responsableNoDisponible ? (
              <View style={styles.seccionFirma}>
                <View style={styles.filaDobleInput}>
                  <View style={styles.campoMitad}>
                    <Text style={styles.labelInput}>Nombre del Contacto (*)</Text>
                    <TextInput
                      testID="input-firmante-nombre"
                      style={styles.inputTexto}
                      value={formulario.firmanteNombre}
                      onChangeText={(t) => cambiar('firmanteNombre', t)}
                      placeholder="Nombre del responsable"
                      placeholderTextColor={TOKENS.inkFaint}
                    />
                  </View>

                  <View style={styles.campoMitad}>
                    <Text style={styles.labelInput}>Cargo del Contacto (*)</Text>
                    <TextInput
                      testID="input-firmante-cargo"
                      style={styles.inputTexto}
                      value={formulario.firmanteCargo}
                      onChangeText={(t) => cambiar('firmanteCargo', t)}
                      placeholder="Ej. Jefe de Planta"
                      placeholderTextColor={TOKENS.inkFaint}
                    />
                  </View>
                </View>

                <View style={styles.cajaFirma}>
                  {formulario.firma ? (
                    <View style={styles.estadoFirmaRegistrada}>
                      <Text style={styles.textoFirmaRegistrada}>
                        ✓ Firma Digital Registrada por {formulario.firmanteNombre}
                      </Text>
                      <TouchableOpacity
                        onPress={() => cambiar('firma', null)}
                        style={styles.botonLimpiarFirma}
                      >
                        <Text style={styles.textoLimpiarFirma}>Borrar Firma</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Button
                      testID="boton-firmar-cliente"
                      titulo="✍ Capturar Firma de Conformidad"
                      onPress={firmarConformidad}
                      variante="secundario"
                    />
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.cajaNoDisponibleAviso}>
                <Text style={styles.textoNoDisponibleAviso}>
                  ℹ Se dejará constancia en el documento oficial de que no hubo personal responsable disponible para recepcionar la firma.
                </Text>
              </View>
            )}
            {erroresBloque.conformidad ? (
              <Text style={styles.textoErrorCampo}>{erroresBloque.conformidad}</Text>
            ) : null}
          </View>

          {/* Bloque 8: Certificado de Saneamiento (si aplica) */}
          {formulario.requiereCertificado ? (
            <View style={[styles.bloque, erroresBloque.certificado && styles.bloqueConError]}>
              <View style={styles.bloqueHeader}>
                <Text style={styles.bloqueNumero}>8</Text>
                <Text style={styles.bloqueTitulo}>Certificado de Saneamiento (*)</Text>
              </View>

              <View style={styles.campoLleno}>
                <Text style={styles.labelInput}>Número de Certificado (*)</Text>
                <TextInput
                  testID="input-certificado-numero"
                  style={styles.inputTexto}
                  value={formulario.certificadoNumero || ''}
                  onChangeText={(t) => cambiar('certificadoNumero', t)}
                  placeholder="Ej. CERT-2026-001"
                  placeholderTextColor={TOKENS.inkFaint}
                />
              </View>

              <View style={styles.filaDobleInput}>
                <View style={styles.campoMitad}>
                  <Text style={styles.labelInput}>Fecha de Emisión (*)</Text>
                  <TextInput
                    testID="input-certificado-emision"
                    style={styles.inputTexto}
                    value={formulario.certificadoEmision || ''}
                    onChangeText={(t) => cambiar('certificadoEmision', t)}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={TOKENS.inkFaint}
                  />
                </View>

                <View style={styles.campoMitad}>
                  <Text style={styles.labelInput}>Fecha de Vencimiento (*)</Text>
                  <TextInput
                    testID="input-certificado-vencimiento"
                    style={styles.inputTexto}
                    value={formulario.certificadoVencimiento || ''}
                    onChangeText={(t) => cambiar('certificadoVencimiento', t)}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={TOKENS.inkFaint}
                  />
                </View>
              </View>
              {erroresBloque.certificado ? (
                <Text style={styles.textoErrorCampo}>{erroresBloque.certificado}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Botón de acceso a Planilla DRT si corresponde */}
          {formulario.tipoServicio === 'DRT' && onAbrirPlanillaDrt ? (
            <View style={styles.bloquePlanillaDrt}>
              <Button
                testID="boton-abrir-planilla-drt"
                titulo="📋 Abrir Planilla de Estaciones DRT / Cebaderos"
                onPress={handleAbrirPlanillaDrt}
                variante="secundario"
              />
            </View>
          ) : null}

          {/* Botones de Acción */}
          <View style={styles.accionesFinales}>
            <Button
              testID="boton-guardar-borrador"
              titulo={guardando ? 'Guardando en SQLite...' : '💾 Guardar Borrador (Durable)'}
              onPress={handleGuardarBorrador}
              cargando={guardando}
              variante="secundario"
              style={styles.botonAccion}
            />

            <Button
              testID="boton-cerrar-inspeccion"
              titulo="🔒 Cerrar e Iniciar Revisión"
              onPress={handleCerrarInspeccion}
              deshabilitado={guardando}
              variante="primario"
              style={styles.botonAccion}
            />
          </View>
        </ScrollView>

        <FirmaPadModal
          visible={modalFirmaVisible}
          firmanteNombre={formulario.firmanteNombre}
          firmanteCargo={formulario.firmanteCargo}
          onCancelar={() => setModalFirmaVisible(false)}
          onConfirmar={(firmaDataUri) => {
            cambiar('firma', firmaDataUri);
            setModalFirmaVisible(false);
            Alert.alert('Firma Registrada', 'Firma de conformidad capturada con éxito.');
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.bg,
  },
  flex1: {
    flex: 1,
  },
  cabecera: {
    backgroundColor: TOKENS.panelRaised,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.rule,
  },
  botonRetroceso: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  textoBotonRetroceso: {
    fontSize: 14,
    color: TOKENS.marca,
    fontWeight: '700',
  },
  infoCabecera: {
    flex: 1,
  },
  tituloCabecera: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  subtituloCabecera: {
    fontSize: 12,
    color: TOKENS.inkFaint,
  },
  badgeEstado: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  textoBadgeEstado: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
  },
  alerta: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bloque: {
    backgroundColor: TOKENS.panel,
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TOKENS.rule,
  },
  bloqueConError: {
    borderColor: TOKENS.rojo,
    borderWidth: 2,
  },
  bloqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bloqueNumero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TOKENS.marca,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '800',
    fontSize: 13,
    marginRight: 8,
  },
  bloqueTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: TOKENS.ink,
    flex: 1,
  },
  cardInfo: {
    backgroundColor: TOKENS.panelRaised,
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: TOKENS.rule,
  },
  labelFijo: {
    fontSize: 11,
    color: TOKENS.inkFaint,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valorFijo: {
    fontSize: 13,
    color: TOKENS.ink,
    fontWeight: '600',
    marginBottom: 4,
  },
  filaHoras: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  campoMitad: {
    flex: 1,
  },
  campoTercio: {
    flex: 1,
  },
  filaTripleInput: {
    flexDirection: 'row',
    gap: 8,
  },
  filaDobleInput: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  campoLleno: {
    marginBottom: 8,
  },
  labelInput: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.inkSoft,
    marginBottom: 4,
  },
  inputTexto: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: TOKENS.ink,
  },
  inputArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  subtituloSeccion: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.inkSoft,
    marginTop: 8,
    marginBottom: 6,
  },
  contenedorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chipTecnico: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textoChipTecnico: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  botonRemoverChip: {
    padding: 2,
  },
  textoRemoverChip: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  filaAgregarColega: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inputFlex: {
    flex: 1,
  },
  botonAgregarColega: {
    backgroundColor: TOKENS.panelRaised,
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  textoBotonAgregarColega: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  indicacionBloque: {
    fontSize: 12,
    color: TOKENS.inkFaint,
    marginBottom: 10,
  },
  listaEquipos: {
    gap: 8,
  },
  itemEquipo: {
    backgroundColor: TOKENS.panelRaised,
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemEquipoSeleccionado: {
    borderColor: TOKENS.marca,
    backgroundColor: '#eef8f2',
  },
  checkboxEquipo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textoCheckboxEquipo: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.marca,
  },
  infoEquipo: {
    flex: 1,
  },
  nombreEquipo: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  nombreEquipoSeleccionado: {
    color: TOKENS.marca,
  },
  codigoEquipo: {
    fontSize: 11,
    color: TOKENS.inkFaint,
  },
  tarjetaInsumo: {
    backgroundColor: TOKENS.panelRaised,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TOKENS.rule,
    padding: 12,
    marginBottom: 12,
  },
  cabeceraTarjetaInsumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tituloInsumoContenedor: {
    flex: 1,
    paddingRight: 8,
  },
  nombreInsumo: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  principioInsumo: {
    fontSize: 12,
    color: TOKENS.inkFaint,
  },
  toggleInsumo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  toggleInsumoActivo: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  toggleInsumoInactivo: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  textoToggleInsumo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  textoToggleInsumoActivo: {
    color: '#15803d',
  },
  dosisRefBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  dosisRefEtiqueta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dosisRefTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  camposInsumo: {
    marginTop: 4,
  },
  selectorUnidad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chipUnidad: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  chipUnidadActivo: {
    backgroundColor: TOKENS.marca,
    borderColor: TOKENS.marca,
  },
  textoChipUnidad: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  textoChipUnidadActivo: {
    color: '#fff',
  },
  avisoDosisModificada: {
    fontSize: 11,
    color: TOKENS.naranja,
    fontWeight: '600',
    marginTop: 4,
  },
  chipMetodo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipMetodoActivo: {
    backgroundColor: '#eef8f2',
    borderColor: TOKENS.marca,
  },
  textoChipMetodo: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  textoChipMetodoActivo: {
    color: TOKENS.marca,
  },
  filaBotonesSeleccion: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  botonOpcion: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  botonOpcionActivo: {
    backgroundColor: TOKENS.marca,
    borderColor: TOKENS.marca,
  },
  textoBotonOpcion: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  textoBotonOpcionActivo: {
    color: '#fff',
  },
  chipTexto: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  chipTextoActivo: {
    backgroundColor: '#eef8f2',
    borderColor: TOKENS.marca,
  },
  textoChipTexto: {
    fontSize: 12,
    color: TOKENS.ink,
  },
  textoChipTextoActivo: {
    color: TOKENS.marca,
    fontWeight: '700',
  },
  itemDisponibilidad: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKENS.rule,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  itemDisponibilidadActivo: {
    borderColor: TOKENS.amarillo,
    backgroundColor: '#fefce8',
  },
  textoCheckboxDisponibilidad: {
    fontSize: 18,
    marginRight: 8,
    color: TOKENS.ink,
  },
  textoDisponibilidad: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.ink,
    flex: 1,
  },
  seccionFirma: {
    marginTop: 4,
  },
  cajaFirma: {
    marginTop: 10,
  },
  estadoFirmaRegistrada: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  textoFirmaRegistrada: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 6,
  },
  botonLimpiarFirma: {
    paddingVertical: 4,
  },
  textoLimpiarFirma: {
    fontSize: 11,
    color: TOKENS.rojo,
    fontWeight: '700',
  },
  cajaNoDisponibleAviso: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
  },
  textoNoDisponibleAviso: {
    fontSize: 12,
    color: '#1e40af',
  },
  bloquePlanillaDrt: {
    marginBottom: 16,
  },
  accionesFinales: {
    gap: 12,
    marginTop: 8,
  },
  botonAccion: {
    width: '100%',
  },
  textoErrorCampo: {
    fontSize: 11,
    color: TOKENS.rojo,
    fontWeight: '700',
    marginTop: 4,
  },
});
