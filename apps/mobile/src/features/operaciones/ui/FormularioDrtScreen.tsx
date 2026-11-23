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
  FotoEvidenciaDrt,
  OperacionSyncSchema,
} from '@gafer/contracts';
import {
  crearEstacionDrt,
  aplicarPrimeraVisita,
  actualizarConsumoEstacion,
  actualizarEstadoEstacion,
  actualizarCantidadGramosEstacion,
  actualizarEstadoFisicoEstacion,
  copiarCeboALote,
  validarEstacionesPlanilla,
  PORCENTAJES_CON_CONSUMO,
  ESTADOS_FISICOS,
} from '../model/estaciones-drt';
import { MAX_TAMANO_FOTO_BYTES } from '../model/fotos-compresion';
import { formatearDetalleBorrador } from '../model/trabajo-colaborativo';
import { ArchivosLocalRepository } from '../model/archivos-local.repository';
import { CapturadorFotosPort } from '../model/captura-fotos';
import { FirmaPadModal, ResultadoFirma } from './FirmaPadModal';
import { GaleriaEvidenciasFotos } from './GaleriaEvidenciasFotos';
import { useAuthStore } from '../../auth/model/use-auth-store';
import { useBorradorStore } from '../model/use-borrador-store';
import { Button, AlertBanner } from '../../../shared/ui';
import { TOKENS } from '../../../shared/theme/tokens';

interface FormularioDrtScreenProps {
  onVolver: () => void;
  archivosRepo?: ArchivosLocalRepository;
  capturadorFotos?: CapturadorFotosPort;
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
  'servicioId': 'El identificador del servicio no es válido (UUID). Vuelva a iniciar la visita desde la agenda.',
  'firmas.clienteConformidadNombre': 'Falta el Nombre del contacto del cliente en la Sección 7 (Firmas y Conformidad).',
  'firmas.clienteConformidadCargo': 'Falta el Cargo del contacto del cliente en la Sección 7 (Firmas y Conformidad).',
  'firmas.firmaDigitalBase64': 'Debe capturar la firma del cliente en pantalla o marcar "Responsable no disponible" en la Sección 7.',
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

export const FormularioDrtScreen: React.FC<FormularioDrtScreenProps> = ({
  onVolver,
  archivosRepo,
  capturadorFotos,
}) => {
  const { usuario } = useAuthStore();
  const borrador = useBorradorStore((state) => state.borrador);
  const revisionRemota = useBorradorStore((state) => state.revisionRemota);
  const actualizarDrt = useBorradorStore((state) => state.actualizarDrt);
  const finalizarServicioDrt = useBorradorStore((state) => state.finalizarServicioDrt);
  const repoArchivos = useMemo(() => archivosRepo ?? new ArchivosLocalRepository(), [archivosRepo]);

  const [guardando, setGuardando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
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
        responsableNoDisponible: false,
      },
      planillaEstaciones: estacionesIniciales,
      fotos: [],
    };
  });

  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);

  // Detección de inspección cerrada / bloqueada para colaboración multi-técnico (§8.2, GAF-37)
  const estaBloqueada = !!borrador?.bloqueada || !!acta.cerradaEnRevision;
  const estaBloqueadaRef = useRef(estaBloqueada);
  estaBloqueadaRef.current = estaBloqueada;

  // Referencia mutable siempre actualizada para auto-guardado seguro
  const ultimaActaRef = useRef(acta);
  ultimaActaRef.current = acta;
  const montadoRef = useRef(true);
  const finalizandoRef = useRef(false);
  const finalizadoRef = useRef(false);
  const saltarAutoSaveRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardadoEnCursoRef = useRef<Promise<boolean> | null>(null);

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
    };
  }, [cancelarAutoGuardado]);

  // Reflejar fusiones remotas LWW o bloqueos externos en pantalla sin rearmar auto-guardado (§8.2, GAF-37)
  useEffect(() => {
    if (revisionRemota === 0) {
      return;
    }
    if (borrador?.servicioId === ultimaActaRef.current.servicioId && borrador.datosDrt) {
      cancelarAutoGuardado();
      saltarAutoSaveRef.current = true;
      setActa(borrador.datosDrt);
    }
  }, [revisionRemota, borrador, cancelarAutoGuardado]);

  useEffect(() => {
    if (estaBloqueada) {
      cancelarAutoGuardado();
      setModalFirmaVisible(false);
    }
  }, [estaBloqueada, cancelarAutoGuardado]);

  const usuarioId = usuario?.id;
  const tecnicoNombre = usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Técnico Operador';
  const tecnicoCargo = usuario?.cargo;

  const metaActualizacionEstacion = () => ({
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: tecnicoNombre,
  });

  // Guarda el acta en SQLite. Devuelve false si no quedó en disco (el store expone el error).
  const guardarActa = useCallback(
    async (actaAGuardar: ActaServicioDrt): Promise<boolean> => {
      if (estaBloqueadaRef.current || finalizandoRef.current || finalizadoRef.current) {
        return false;
      }
      const promesa = actualizarDrt(actaAGuardar, {
        usuarioId,
        clienteRazonSocial: actaAGuardar.clienteRazonSocial,
        sedeNombre: actaAGuardar.sedeDireccion,
        servicioTipo: 'DESRATIZACION_DRT',
        // Autoría del guardado para el trabajo colaborativo (§8.2, GAF-37).
        tecnicoId: usuarioId,
        tecnicoNombre,
        tecnicoCargo,
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
    [actualizarDrt, usuarioId, tecnicoNombre, tecnicoCargo],
  );

  // Auto-guardado en segundo plano en SQLite (debounced 2.5s) bajo la regla §2.4: Durable before visible
  useEffect(() => {
    if (saltarAutoSaveRef.current) {
      saltarAutoSaveRef.current = false;
      cancelarAutoGuardado();
      return;
    }
    if (estaBloqueada || finalizado || finalizandoRef.current || finalizadoRef.current) {
      cancelarAutoGuardado();
      return;
    }

    cancelarAutoGuardado();
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (estaBloqueadaRef.current || finalizandoRef.current || finalizadoRef.current) {
        return;
      }
      guardarActa(ultimaActaRef.current).then((ok) => {
        if (!montadoRef.current || estaBloqueadaRef.current || finalizandoRef.current || finalizadoRef.current) {
          return;
        }
        setMensajeGuardado(
          ok
            ? `Guardado localmente en SQLite a las ${horaActualIso()}`
            : 'No se pudo guardar en el teléfono. No cierre la app.',
        );
      });
    }, 2500);

    return cancelarAutoGuardado;
  }, [acta, estaBloqueada, finalizado, guardarActa, cancelarAutoGuardado]);

  // Manejador seguro para regresar: espera a que el acta quede en SQLite antes de desmontar
  const handleVolver = useCallback(async () => {
    cancelarAutoGuardado();
    if (estaBloqueadaRef.current || finalizadoRef.current) {
      onVolver();
      return;
    }
    if (finalizandoRef.current) {
      return;
    }
    const ok = await guardarActa(ultimaActaRef.current);
    if (!ok) {
      Alert.alert(
        'No se pudo guardar',
        'El acta no quedó guardada en el teléfono. Si sale ahora puede perder los últimos cambios.',
        [
          { text: 'Permanecer', style: 'cancel' },
          { text: 'Salir de todos modos', style: 'destructive', onPress: onVolver },
        ],
      );
      return;
    }
    onVolver();
  }, [cancelarAutoGuardado, estaBloqueada, guardarActa, onVolver]);

  // Interceptar botón atrás de hardware en Android (y navegación por gestos)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleVolver();
      return true;
    });
    return () => sub.remove();
  }, [handleVolver]);

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
        totalRepuestoGramos += est.cantidadReposicion ?? est.repuestoGramos ?? 0;
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
    if (estaBloqueadaRef.current) return;
    setActa((prev) => ({
      ...prev,
      cebosConsumidos: metricasEstaciones.conConsumo,
      cebosRepuestos: metricasEstaciones.conConsumo,
    }));
  };

  const handleGuardarBorradorManual = async () => {
    if (estaBloqueadaRef.current) {
      Alert.alert(
        'Inspección Cerrada (§8.2)',
        'Esta inspección ya fue finalizada y enviada a revisión. Se encuentra bloqueada para nuevas modificaciones.',
      );
      return;
    }
    if (finalizandoRef.current || finalizadoRef.current) {
      return;
    }
    try {
      cancelarAutoGuardado();
      setGuardando(true);
      setErrorValidacion(null);
      const ok = await guardarActa(acta);
      if (!ok) {
        throw new Error('No se pudo guardar el acta en SQLite');
      }
      const hora = horaActualIso();
      setMensajeGuardado(`Borrador guardado a las ${hora} por ${tecnicoNombre}`);
      Alert.alert(
        'Borrador Guardado (§8.2)',
        `Se guardó el borrador en SQLite local a las ${hora} por ${tecnicoNombre}. Los datos están seguros y listos para trabajo colaborativo.`,
      );
    } catch {
      Alert.alert('Error al guardar', 'No se pudo guardar el borrador en la base de datos local.');
    } finally {
      setGuardando(false);
    }
  };

  const handleFinalizarServicio = async () => {
    if (estaBloqueadaRef.current) {
      Alert.alert(
        'Inspección Ya Cerrada (§8.2)',
        'Esta inspección ya fue finalizada previamente y enviada a revisión.',
      );
      return;
    }
    if (finalizandoRef.current || finalizadoRef.current) {
      return;
    }

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

    // 3. Validar conformidad y firma (§13, GAF-36)
    if (!acta.firmas.responsableNoDisponible) {
      if (!acta.firmas.clienteConformidadNombre.trim() || !acta.firmas.clienteConformidadCargo.trim()) {
        setErrorValidacion('Debe ingresar el nombre y cargo del contacto del cliente o marcar "Responsable no disponible".');
        Alert.alert('Firma Incompleta', 'Ingrese nombre y cargo del contacto del cliente, o abra el pad de firma y marque "Responsable no disponible".');
        return;
      }
      const tieneFirmaRegistrada = Boolean(
        (acta.firmas.firmaArchivoId && acta.firmas.firmaRutaLocalRelativa) ||
          acta.firmas.firmaDigitalBase64,
      );
      if (!tieneFirmaRegistrada) {
        setErrorValidacion('Debe capturar la firma del cliente en pantalla o marcar que el responsable no estuvo disponible.');
        Alert.alert('Falta Firma en Pantalla', 'Capture la firma manuscrita en pantalla o marque "Responsable no disponible".');
        return;
      }
    }

    // 4. Validar tamaño de fotos (Decisión C15: <= 1 MB por foto)
    for (const foto of acta.fotos || []) {
      if (foto.tamanoBytes > MAX_TAMANO_FOTO_BYTES) {
        setErrorValidacion(`La foto ${foto.nombre} excede 1 MB (${Math.round(foto.tamanoBytes / 1024)} KB). La regla C15 exige <= 1 MB.`);
        Alert.alert('Foto Excede Límite C15', `La foto ${foto.nombre} supera el tamaño permitido.`);
        return;
      }
    }

    // 5. Verificar sesión válida con UUID de técnico antes de encolar en sync_outbox
    const actorIdCheck = OperacionSyncSchema.shape.actorId.safeParse(usuario?.id);
    if (!actorIdCheck.success) {
      Alert.alert(
        'Sesión de Técnico Requerida',
        'No se pudo identificar al técnico autenticado para registrar la operación. Vuelva a iniciar sesión e intente nuevamente.',
      );
      return;
    }
    const userId = actorIdCheck.data;

    Alert.alert(
      'Finalizar y Encolar Servicio',
      '¿Confirma que desea cerrar el acta de servicio DRT? El servicio y sus estaciones se guardarán de forma durable y se encolarán para sincronización con el servidor.',
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Concluir y Encolar',
          style: 'default',
          onPress: async () => {
            if (estaBloqueadaRef.current || finalizandoRef.current || finalizadoRef.current) {
              return;
            }
            finalizandoRef.current = true;
            cancelarAutoGuardado();
            setGuardando(true);
            try {
              if (guardadoEnCursoRef.current) {
                await guardadoEnCursoRef.current;
              }
              const actaParaCierre: ActaServicioDrt = {
                ...resultado.data,
                cerradaEnRevision: true,
                cerradoPor: tecnicoNombre,
                actualizadoEn: new Date().toISOString(),
                actualizadoPor: tecnicoNombre,
              };
              const res = await finalizarServicioDrt(actaParaCierre, userId, {
                encolarEstacionesIndividuales: true,
              });
              finalizadoRef.current = true;
              setFinalizado(true);
              setGuardando(false);
              Alert.alert(
                'Servicio Registrado con Éxito',
                `El acta DRT fue guardada en SQLite y encolada en Outbox (Op: ${res.operationId.substring(0, 8)}). Se sincronizará automáticamente al detectar conexión.`,
                [{ text: 'OK', onPress: onVolver }],
              );
            } catch (err: unknown) {
              finalizandoRef.current = false;
              setGuardando(false);
              const mensaje =
                err instanceof Error ? err.message : 'Ocurrió un error al persistir el servicio.';
              Alert.alert('Error al finalizar', mensaje);
            }
          },
        },
      ],
    );
  };

  // Manejador de firma capturada o ausencia de responsable (§13, GAF-36)
  // Persiste la firma de forma durable en filesystem + files_local + sync_outbox antes de actualizar UI (§2.4, §13.2).
  const handleGuardarFirmaModal = async (resultado: ResultadoFirma) => {
    if (estaBloqueadaRef.current) {
      return;
    }
    const actaActual = ultimaActaRef.current;
    const firmaArchivoPrevioId = actaActual.firmas.firmaArchivoId;

    if (resultado.responsableNoDisponible) {
      if (firmaArchivoPrevioId) {
        try {
          await repoArchivos.eliminar(firmaArchivoPrevioId);
        } catch {
          // Mantener el flujo de ausencia si el archivo anterior ya no existía.
        }
      }
      setActa((prev) => ({
        ...prev,
        firmas: {
          ...prev.firmas,
          firmaDigitalBase64: undefined,
          firmaArchivoId: undefined,
          firmaRutaLocalRelativa: undefined,
          responsableNoDisponible: true,
          motivoNoDisponible: resultado.motivoNoDisponible,
          clienteConformidadNombre:
            prev.firmas.clienteConformidadNombre || 'Responsable No Disponible',
          clienteConformidadCargo: prev.firmas.clienteConformidadCargo || 'N/A',
        },
      }));
      return;
    }

    if (!resultado.firmaBase64) {
      return;
    }

    try {
      const firmaGuardada = await repoArchivos.guardarFirma({
        inspectionId: actaActual.servicioId,
        firmaBase64: resultado.firmaBase64,
        firmanteNombre: actaActual.firmas.clienteConformidadNombre,
        firmanteCargo: actaActual.firmas.clienteConformidadCargo,
        actorId: usuario?.id,
      });

      if (firmaArchivoPrevioId && firmaArchivoPrevioId !== firmaGuardada.file_id) {
        try {
          await repoArchivos.eliminar(firmaArchivoPrevioId);
        } catch {
          // El archivo nuevo ya quedó durable en disco y SQLite.
        }
      }

      setActa((prev) => ({
        ...prev,
        firmas: {
          ...prev.firmas,
          // §13.2: no duplicar Base64 operativo en JSON de SQLite/sync; referenciar el archivo local durable.
          firmaDigitalBase64: undefined,
          firmaArchivoId: firmaGuardada.file_id,
          firmaRutaLocalRelativa: firmaGuardada.local_path_relative,
          responsableNoDisponible: false,
          motivoNoDisponible: undefined,
        },
      }));
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : 'No se pudo guardar la firma en el dispositivo.';
      Alert.alert('Error al guardar firma', mensaje);
      throw err;
    }
  };

  // Mutadores de campos
  const actualizarCampoActa = (updater: (prev: ActaServicioDrt) => ActaServicioDrt) => {
    if (estaBloqueadaRef.current) return;
    setActa(updater);
  };

  const toggleEspecieRoedor = (esp: EspecieRoedorDrt) => {
    if (estaBloqueadaRef.current) return;
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

  // Mutadores de primera visita y planilla §5.1 (con marca temporal y autor para LWW §8.2)
  const handleTogglePrimeraVisita = (esPrimera: boolean) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => {
      const estacionesActualizadas = aplicarPrimeraVisita(
        prev.planillaEstaciones,
        esPrimera,
        {
          tipoCebo: prev.tipoCebo,
          cantidadGramos: 20,
        },
        meta,
      );
      return {
        ...prev,
        primeraVisita: esPrimera,
        actividad: esPrimera ? 'INSTALACION' : (prev.actividad === 'INSTALACION' ? 'MONITOREO' : prev.actividad),
        planillaEstaciones: estacionesActualizadas,
      };
    });
  };

  const handleCopiarCeboATodas = () => {
    if (estaBloqueadaRef.current) return;
    if (acta.planillaEstaciones.length === 0) return;
    const ref = acta.planillaEstaciones[0];
    const cebo = {
      tipoCebo: ref.tipoCebo || acta.tipoCebo || 'BLOQUE_10G',
      cantidadGramos: ref.cantidadGramos || 20,
      lote: ref.lote || 'LOTE-001',
      vencimiento: ref.vencimiento || '2026-12-31',
    };
    const meta = metaActualizacionEstacion();

    setActa((prev) => ({
      ...prev,
      planillaEstaciones: copiarCeboALote(prev.planillaEstaciones, cebo, meta),
    }));

    Alert.alert(
      'Cebo Replicado',
      `Se aplicó la formulación (${cebo.tipoCebo}, ${cebo.cantidadGramos}g, Lote: ${cebo.lote}, Venc: ${cebo.vencimiento}) a todas las estaciones.`,
    );
  };

  const cambiarEstadoEstacion = (numero: number, nuevoEstado: EstadoEstacionPlanilla) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? actualizarEstadoEstacion(est, nuevoEstado, meta) : est,
      ),
    }));
  };

  const cambiarConsumoPorcentaje = (numero: number, huboConsumo: boolean, porcentaje?: PorcentajeConsumo) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? actualizarConsumoEstacion(est, huboConsumo, porcentaje, meta) : est,
      ),
    }));
  };

  const cambiarCantidadGramosEstacion = (numero: number, gramos: number) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? actualizarCantidadGramosEstacion(est, gramos, meta) : est,
      ),
    }));
  };

  const cambiarEstadoFisico = (numero: number, estadoFisico: EstadoFisicoEstacion) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? actualizarEstadoFisicoEstacion(est, estadoFisico, undefined, meta) : est,
      ),
    }));
  };

  const cambiarDatoEstacion = <K extends keyof ItemEstacionPlanilla>(
    numero: number,
    campo: K,
    valor: ItemEstacionPlanilla[K],
  ) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, [campo]: valor, ...meta } : est,
      ),
    }));
  };

  const cambiarConsumoEstacion = (numero: number, gramos: number) => {
    if (estaBloqueadaRef.current) return;
    const valorSeguro = Number.isFinite(gramos) && gramos >= 0 ? gramos : 0;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, consumoGramos: valorSeguro, ...meta } : est,
      ),
    }));
  };

  const cambiarRepuestoEstacion = (numero: number, gramos: number) => {
    if (estaBloqueadaRef.current) return;
    const valorSeguro = Number.isFinite(gramos) && gramos >= 0 ? gramos : 0;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero
          ? { ...est, repuestoGramos: valorSeguro, cantidadReposicion: valorSeguro, ...meta }
          : est,
      ),
    }));
  };

  const cambiarNotaEstacion = (numero: number, observaciones: string) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
    setActa((prev) => ({
      ...prev,
      planillaEstaciones: prev.planillaEstaciones.map((est) =>
        est.numero === numero ? { ...est, observaciones, ...meta } : est,
      ),
    }));
  };

  const agregarEstaciones = (cantidad = 1) => {
    if (estaBloqueadaRef.current) return;
    const meta = metaActualizacionEstacion();
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
            ...meta,
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
        <TouchableOpacity testID="boton-volver-drt" style={styles.botonVolver} onPress={handleVolver}>
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
          {/* Alerta de Inspección Bloqueada / Cerrada para Colaboración (§8.2, GAF-37) */}
          {estaBloqueada ? (
            <View style={styles.alertaBloqueo}>
              <Text style={styles.alertaBloqueoTitulo}>🔒 Inspección Cerrada y en Revisión (§8.2)</Text>
              <Text style={styles.alertaBloqueoTexto}>
                Esta inspección fue concluida por {acta.cerradoPor || borrador?.guardadoPor?.nombre || 'otro operador'} y enviada a revisión. El formulario se encuentra en modo de solo lectura para evitar inconsistencias o pérdida de datos.
              </Text>
            </View>
          ) : null}

          {/* Banner Informativo de Borrador Colaborativo con Técnico y Hora (§8.2) */}
          <View testID="banner-borrador-info" style={styles.bannerBorradorInfo}>
            <Text style={styles.textoBorradorInfo}>
              💾 {formatearDetalleBorrador(
                borrador?.actualizadoEn || acta.actualizadoEn,
                borrador?.guardadoPor?.nombre || acta.actualizadoPor || (usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Técnico Operador'),
              )}
            </Text>
          </View>

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
              testID="input-cliente-razon-social"
              style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
              editable={!estaBloqueada}
              value={acta.clienteRazonSocial}
              onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, clienteRazonSocial: t }))}
              placeholder="Razón Social"
            />

            <Text style={styles.campoEtiqueta}>Dirección / Sede:</Text>
            <TextInput
              testID="input-sede-direccion"
              style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
              editable={!estaBloqueada}
              value={acta.sedeDireccion}
              onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, sedeDireccion: t }))}
              placeholder="Dirección del establecimiento"
            />

            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Fecha (AAAA-MM-DD):</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.fecha}
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, fecha: t }))}
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Área Tratada (m²):</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.areaTratadaM2 ? String(acta.areaTratadaM2) : ''}
                  keyboardType="numeric"
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, areaTratadaM2: Number(t) || 0 }))}
                  placeholder="Ej. 1200"
                />
              </View>
            </View>

            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Hora Inicio (HH:MM):</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.horaInicio}
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, horaInicio: t }))}
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Hora Término (HH:MM):</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.horaTermino}
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, horaTermino: t }))}
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
                    testID={`chip-actividad-${act}`}
                    disabled={estaBloqueada}
                    style={[styles.chip, seleccionado && styles.chipActivo, estaBloqueada && styles.controlBloqueado]}
                    onPress={() => actualizarCampoActa((p) => ({ ...p, actividad: act }))}
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
                    disabled={estaBloqueada}
                    style={[styles.chip, seleccionado && styles.chipActivo, estaBloqueada && styles.controlBloqueado]}
                    onPress={() => actualizarCampoActa((p) => ({ ...p, tipoCebo: tc }))}
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
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={String(acta.cebosInstalados)}
                  keyboardType="numeric"
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, cebosInstalados: Number(t) || 0 }))}
                />
              </View>
              <View style={styles.columnaTres}>
                <Text style={styles.campoEtiqueta}>Consumidos:</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={String(acta.cebosConsumidos)}
                  keyboardType="numeric"
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, cebosConsumidos: Number(t) || 0 }))}
                />
              </View>
              <View style={styles.columnaTres}>
                <Text style={styles.campoEtiqueta}>Repuestos:</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={String(acta.cebosRepuestos)}
                  keyboardType="numeric"
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, cebosRepuestos: Number(t) || 0 }))}
                />
              </View>
            </View>
            {metricasEstaciones.conConsumo > 0 ? (
              <TouchableOpacity
                style={[styles.botonAutoSuma, estaBloqueada && styles.controlBloqueado]}
                disabled={estaBloqueada}
                onPress={actualizarConteoDesdePlanilla}
              >
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
                    disabled={estaBloqueada}
                    style={[styles.chip, seleccionado && styles.chipActivo, estaBloqueada && styles.controlBloqueado]}
                    onPress={() => actualizarCampoActa((p) => ({ ...p, tipoTrampa: tt }))}
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
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={String(acta.trampasInstaladas)}
                  keyboardType="numeric"
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, trampasInstaladas: Number(t) || 0 }))}
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Trampas Activadas:</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={String(acta.trampasActivadas)}
                  keyboardType="numeric"
                  onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, trampasActivadas: Number(t) || 0 }))}
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
                    disabled={estaBloqueada}
                    style={[styles.chip, marcada && styles.chipActivo, estaBloqueada && styles.controlBloqueado]}
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
              style={[styles.inputTexto, styles.inputArea, estaBloqueada && styles.inputBloqueado]}
              editable={!estaBloqueada}
              value={acta.resultadosRecomendaciones}
              multiline
              numberOfLines={3}
              onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, resultadosRecomendaciones: t }))}
              placeholder="Describa el estado del perímetro, hallazgos y medidas sanitarias..."
            />

            <Text style={styles.campoEtiqueta}>Observaciones del Cliente:</Text>
            <TextInput
              style={[styles.inputTexto, styles.inputArea, estaBloqueada && styles.inputBloqueado]}
              editable={!estaBloqueada}
              value={acta.observacionesCliente}
              multiline
              numberOfLines={2}
              onChangeText={(t) => actualizarCampoActa((p) => ({ ...p, observacionesCliente: t }))}
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
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.firmas.personalResponsableNombre}
                  onChangeText={(t) =>
                    actualizarCampoActa((p) => ({ ...p, firmas: { ...p.firmas, personalResponsableNombre: t } }))
                  }
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Cargo:</Text>
                <TextInput
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.firmas.personalResponsableCargo}
                  onChangeText={(t) =>
                    actualizarCampoActa((p) => ({ ...p, firmas: { ...p.firmas, personalResponsableCargo: t } }))
                  }
                />
              </View>
            </View>

            <Text style={styles.subseccionTitulo}>Conformidad del Cliente:</Text>
            <View style={styles.filaInputs}>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Nombre del Contacto:</Text>
                <TextInput
                  testID="input-cliente-conformidad-nombre"
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.firmas.clienteConformidadNombre}
                  placeholder="Persona que recibe"
                  onChangeText={(t) =>
                    actualizarCampoActa((p) => ({ ...p, firmas: { ...p.firmas, clienteConformidadNombre: t } }))
                  }
                />
              </View>
              <View style={styles.columnaInput}>
                <Text style={styles.campoEtiqueta}>Cargo del Contacto:</Text>
                <TextInput
                  testID="input-cliente-conformidad-cargo"
                  style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                  editable={!estaBloqueada}
                  value={acta.firmas.clienteConformidadCargo}
                  placeholder="Cargo / Área"
                  onChangeText={(t) =>
                    actualizarCampoActa((p) => ({ ...p, firmas: { ...p.firmas, clienteConformidadCargo: t } }))
                  }
                />
              </View>
            </View>

            {/* Estado y Captura de Firma Digital del Cliente (§13, GAF-36) */}
            <View style={styles.contenedorEstadoFirma}>
              {acta.firmas.responsableNoDisponible ? (
                <View style={styles.bannerFirmaAusente}>
                  <Text style={styles.textoFirmaAusente}>
                    ⚠️ Responsable no disponible: {acta.firmas.motivoNoDisponible || 'Sin motivo especificado'}
                  </Text>
                </View>
              ) : acta.firmas.firmaArchivoId || acta.firmas.firmaDigitalBase64 ? (
                <View style={styles.bannerFirmaExitosa}>
                  <Text style={styles.textoFirmaExitosa}>
                    ✓ Firma manuscrita capturada en pantalla (inmutable)
                  </Text>
                </View>
              ) : (
                <View style={styles.bannerFirmaPendiente}>
                  <Text style={styles.textoFirmaPendiente}>
                    ⏳ Pendiente de firma manuscrita en pantalla
                  </Text>
                </View>
              )}

              <TouchableOpacity
                testID="boton-abrir-firma"
                disabled={estaBloqueada}
                style={[styles.botonAbrirFirma, estaBloqueada && styles.controlBloqueado]}
                onPress={() => {
                  if (!estaBloqueadaRef.current) {
                    setModalFirmaVisible(true);
                  }
                }}
              >
                <Text style={styles.textoBotonAbrirFirma}>
                  {acta.firmas.firmaArchivoId ||
                  acta.firmas.firmaDigitalBase64 ||
                  acta.firmas.responsableNoDisponible
                    ? '✏️ Modificar Firma o Ausencia'
                    : '✍️ Capturar Firma del Cliente en Pantalla'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 8. PLANILLA INDIVIDUAL POR ESTACIÓN (§5.1, GAF-35) */}
          <View style={styles.seccionCard}>
            <View style={styles.cabeceraPlanilla}>
              <Text style={styles.seccionTitulo}>8. PLANILLA POR ESTACIÓN DE CONTROL (§5.1)</Text>
              <View style={styles.grupoBotonesAgregar}>
                <TouchableOpacity
                  testID="boton-agregar-estacion-1"
                  disabled={estaBloqueada}
                  style={[styles.botonAgregarEstacion, estaBloqueada && styles.controlBloqueado]}
                  onPress={() => agregarEstaciones(1)}
                >
                  <Text style={styles.textoBotonAgregar}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={estaBloqueada}
                  style={[styles.botonAgregarEstacion, estaBloqueada && styles.controlBloqueado]}
                  onPress={() => agregarEstaciones(5)}
                >
                  <Text style={styles.textoBotonAgregar}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={estaBloqueada}
                  style={[styles.botonAgregarEstacion, estaBloqueada && styles.controlBloqueado]}
                  onPress={() => agregarEstaciones(10)}
                >
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
                    testID="chip-primera-visita-false"
                    disabled={estaBloqueada}
                    style={[
                      styles.chipCompacto,
                      !acta.primeraVisita && styles.chipCompactoActivoVerde,
                      estaBloqueada && styles.controlBloqueado,
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
                    testID="chip-primera-visita-true"
                    disabled={estaBloqueada}
                    style={[
                      styles.chipCompacto,
                      acta.primeraVisita && styles.chipCompactoActivoVerde,
                      estaBloqueada && styles.controlBloqueado,
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
                disabled={estaBloqueada}
                style={[styles.botonCopiarCebo, estaBloqueada && styles.controlBloqueado]}
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
                        testID={`input-tipo-cebo-estacion-${est.numero}`}
                        style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                        editable={!estaBloqueada}
                        value={est.tipoCebo || ''}
                        placeholder="Ej. BLOQUE_10G"
                        onChangeText={(t) => cambiarDatoEstacion(est.numero, 'tipoCebo', t)}
                      />
                    </View>
                    <View style={[styles.columnaInput, { maxWidth: 100 }]}>
                      <Text style={styles.campoEtiqueta}>Gramos Base:</Text>
                      <TextInput
                        testID={`input-gramos-base-estacion-${est.numero}`}
                        style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                        editable={!estaBloqueada}
                        keyboardType="numeric"
                        value={est.cantidadGramos ? String(est.cantidadGramos) : ''}
                        placeholder="20"
                        onChangeText={(t) => cambiarCantidadGramosEstacion(est.numero, Number(t) || 0)}
                      />
                    </View>
                  </View>

                  {/* Fila 2: Lote y Vencimiento */}
                  <View style={styles.filaInputs}>
                    <View style={styles.columnaInput}>
                      <Text style={styles.campoEtiqueta}>Lote:</Text>
                      <TextInput
                        style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                        editable={!estaBloqueada}
                        value={est.lote || ''}
                        placeholder="Ej. L-2026-01"
                        onChangeText={(t) => cambiarDatoEstacion(est.numero, 'lote', t)}
                      />
                    </View>
                    <View style={styles.columnaInput}>
                      <Text style={styles.campoEtiqueta}>Vencimiento (YYYY-MM-DD):</Text>
                      <TextInput
                        style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                        editable={!estaBloqueada}
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
                          disabled={estaBloqueada}
                          style={[
                            styles.chipCompacto,
                            activo && {
                              backgroundColor: esMalo ? '#dc2626' : '#16a34a',
                              borderColor: esMalo ? '#dc2626' : '#16a34a',
                            },
                            estaBloqueada && styles.controlBloqueado,
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
                              testID={`chip-estacion-${est.numero}-${estOpcion}`}
                              disabled={estaBloqueada}
                              style={[
                                styles.chipCompacto,
                                estaActivo && {
                                  backgroundColor: opcionConf.color,
                                  borderColor: opcionConf.color,
                                },
                                estaBloqueada && styles.controlBloqueado,
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
                          testID={`chip-consumo-no-estacion-${est.numero}`}
                          disabled={estaBloqueada}
                          style={[
                            styles.chipCompacto,
                            !est.huboConsumo && styles.chipCompactoActivoVerde,
                            estaBloqueada && styles.controlBloqueado,
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
                          testID={`chip-consumo-si-estacion-${est.numero}`}
                          disabled={estaBloqueada}
                          style={[
                            styles.chipCompacto,
                            est.huboConsumo && styles.chipCompactoActivoNaranja,
                            estaBloqueada && styles.controlBloqueado,
                          ]}
                          onPress={() =>
                            cambiarConsumoPorcentaje(
                              est.numero,
                              true,
                              est.porcentajeConsumo && est.porcentajeConsumo > 0 ? est.porcentajeConsumo : 25,
                            )
                          }
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

                      {/* Porcentaje de Consumo en pasos de 25 (> 0%) + gramos independientes */}
                      {est.huboConsumo ? (
                        <View style={styles.seccionPorcentaje}>
                          <Text style={styles.campoEtiqueta}>Porcentaje de consumo (§5.1):</Text>
                          <View style={styles.chipsContenedorCompacto}>
                            {PORCENTAJES_CON_CONSUMO.map((p) => {
                              const activo = est.porcentajeConsumo === p;
                              return (
                                <TouchableOpacity
                                  key={`porc-${est.numero}-${p}`}
                                  testID={`chip-porcentaje-estacion-${est.numero}-${p}`}
                                  disabled={estaBloqueada}
                                  style={[
                                    styles.chipCompacto,
                                    activo && styles.chipCompactoActivoNaranja,
                                    estaBloqueada && styles.controlBloqueado,
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

                          <View style={styles.filaInputs}>
                            <View style={styles.columnaInput}>
                              <Text style={styles.campoEtiqueta}>Consumo (gramos):</Text>
                              <TextInput
                                testID={`input-consumo-estacion-${est.numero}`}
                                style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                                editable={!estaBloqueada}
                                keyboardType="numeric"
                                value={est.consumoGramos ? String(est.consumoGramos) : ''}
                                placeholder="Ej. 10"
                                onChangeText={(t) => cambiarConsumoEstacion(est.numero, Number(t) || 0)}
                              />
                            </View>
                            <View style={styles.columnaInput}>
                              <Text style={styles.campoEtiqueta}>Repuesto (gramos):</Text>
                              <TextInput
                                testID={`input-repuesto-estacion-${est.numero}`}
                                style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                                editable={!estaBloqueada}
                                keyboardType="numeric"
                                value={
                                  (est.cantidadReposicion ?? est.repuestoGramos)
                                    ? String(est.cantidadReposicion ?? est.repuestoGramos)
                                    : ''
                                }
                                placeholder="Ej. 10"
                                onChangeText={(t) => cambiarRepuestoEstacion(est.numero, Number(t) || 0)}
                              />
                            </View>
                          </View>

                          <View style={styles.panelCalculoConsumo}>
                            <Text style={styles.textoCalculoConsumo}>
                              🍽️ Consumo: <Text style={{ fontWeight: '800' }}>{est.consumoGramos ?? 0} g</Text> ({est.porcentajeConsumo ?? 0}%)
                              {'  '}|{'  '}
                              🔄 Reposición: <Text style={{ fontWeight: '800' }}>{est.cantidadReposicion ?? est.repuestoGramos ?? 0} g</Text>
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
                        style={[styles.inputTexto, estaBloqueada && styles.inputBloqueado]}
                        editable={!estaBloqueada}
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

          {/* 9. EVIDENCIAS FOTOGRÁFICAS (§13, C15) */}
          <GaleriaEvidenciasFotos
            inspectionId={acta.servicioId}
            fotos={acta.fotos || []}
            actorId={usuario?.id}
            archivosRepo={repoArchivos}
            capturador={capturadorFotos}
            soloLectura={estaBloqueada}
            onFotosChange={(fotosActualizadas) =>
              actualizarCampoActa((prev) => ({ ...prev, fotos: fotosActualizadas }))
            }
          />

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barra de Acciones Fijas Inferiores (§8.2) */}
      <View style={styles.barraAccionesFija}>
        {estaBloqueada ? (
          <View testID="banner-barra-bloqueada" style={styles.bannerBarraBloqueada}>
            <Text style={styles.textoBarraBloqueada}>
              🔒 Inspección enviada a revisión (§8.2) — Modo Solo Lectura
            </Text>
          </View>
        ) : (
          <View style={styles.botonesBarraContenedor}>
            <Button
              testID="boton-guardar-borrador"
              titulo="Guardar Borrador"
              onPress={handleGuardarBorradorManual}
              variante="secundario"
              deshabilitado={guardando || finalizado}
              style={styles.botonBarra}
            />
            <Button
              testID="boton-finalizar-drt"
              titulo="Finalizar y Encolar"
              onPress={handleFinalizarServicio}
              variante="primario"
              deshabilitado={guardando || finalizado}
              cargando={guardando}
              style={styles.botonBarra}
            />
          </View>
        )}
      </View>

      {/* Modal de Firma en Pantalla (§13, GAF-36) */}
      <FirmaPadModal
        visible={modalFirmaVisible && !estaBloqueada}
        onCerrar={() => setModalFirmaVisible(false)}
        onGuardar={handleGuardarFirmaModal}
        nombreContactoInicial={acta.firmas.clienteConformidadNombre}
        cargoContactoInicial={acta.firmas.clienteConformidadCargo}
        responsableNoDisponibleInicial={acta.firmas.responsableNoDisponible}
        motivoNoDisponibleInicial={acta.firmas.motivoNoDisponible}
      />
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
  inputBloqueado: {
    backgroundColor: '#e2e8f0',
    color: '#64748b',
  },
  controlBloqueado: {
    opacity: 0.55,
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
  botonesBarraContenedor: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  contenedorEstadoFirma: {
    marginTop: 10,
    gap: 8,
  },
  bannerFirmaAusente: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 6,
    padding: 10,
  },
  textoFirmaAusente: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  bannerFirmaExitosa: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    padding: 10,
  },
  textoFirmaExitosa: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  bannerFirmaPendiente: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 10,
  },
  textoFirmaPendiente: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  botonAbrirFirma: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  textoBotonAbrirFirma: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  alertaBloqueo: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  alertaBloqueoTitulo: {
    fontSize: 12,
    fontWeight: '900',
    color: '#991b1b',
    marginBottom: 4,
  },
  alertaBloqueoTexto: {
    fontSize: 11,
    color: '#7f1d1d',
    lineHeight: 16,
  },
  bannerBorradorInfo: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  textoBorradorInfo: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  bannerBarraBloqueada: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textoBarraBloqueada: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '800',
  },
});
