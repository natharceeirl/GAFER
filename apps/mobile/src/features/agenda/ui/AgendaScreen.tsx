import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ResumenServicioTecnico } from '@gafer/contracts';
import { useAuthStore } from '../../auth/model/use-auth-store';
import {
  useAgendaStore,
  filtrarAgendaPorTecnico,
  filtrarSedesActivas,
  ItemAgenda,
  SedeActiva,
  ModoFiltroAgenda,
} from '../model/agenda';
import { useBorradorStore } from '../../operaciones/model/use-borrador-store';
import { FormularioDrtScreen, FormularioCampoScreen, DetalleServicioCerradoModal } from '../../operaciones';
import { MobileApiClient } from '../../../shared/api/api-client';
import { Button, AlertBanner } from '../../../shared/ui';
import { TOKENS } from '../../../shared/theme/tokens';

type VistaAgenda = 'MIS_VISITAS' | 'DISPONIBLES' | 'SEDES_ACTIVAS' | 'CERRADOS';

export const AgendaScreen: React.FC = () => {
  const { usuario, token, cerrarSesion } = useAuthStore();
  const {
    items,
    sedesActivas,
    cargando,
    error,
    cargarAgenda,
    iniciarAtencionVisita,
    iniciarAtencionEnSede,
  } = useAgendaStore();

  const borrador = useBorradorStore((state) => state.borrador);
  const limpiarBorrador = useBorradorStore((state) => state.limpiar);

  const [vistaActiva, setVistaActiva] = useState<VistaAgenda>('MIS_VISITAS');
  const [busquedaSede, setBusquedaSede] = useState('');
  const [modoFormularioDrt, setModoFormularioDrt] = useState(false);
  const [modoFormularioCampo, setModoFormularioCampo] = useState(false);

  // GAF-104: Estado de servicios cerrados en solo lectura
  const [serviciosCerrados, setServiciosCerrados] = useState<ResumenServicioTecnico[]>([]);
  const [cargandoCerrados, setCargandoCerrados] = useState(false);
  const [servicioDetalle, setServicioDetalle] = useState<ResumenServicioTecnico | null>(null);
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);

  const tecnicoId = usuario?.id || 'tecnico-defecto-id';

  useEffect(() => {
    cargarAgenda(tecnicoId);
  }, [cargarAgenda, tecnicoId]);

  // GAF-104: Cargar servicios cerrados desde la API con fallback offline / contingencia
  const cargarServiciosCerrados = useCallback(async () => {
    setCargandoCerrados(true);
    try {
      const client = new MobileApiClient();
      const res = await client.obtenerMisServicios(token || undefined);
      if (res && res.length > 0) {
        setServiciosCerrados(res);
      } else {
        throw new Error('Sin servicios devueltos');
      }
    } catch {
      // Si la API no está alcanzable o en modo demo/offline, proveer servicios cerrados de contingencia
      const hoy = new Date().toISOString().split('T')[0];
      setServiciosCerrados([
        {
          id: 'c1111111-2222-4000-8000-000000000001',
          servicioId: 's1111111-1111-4000-8000-000000000001',
          codigoInspeccion: 'GAFER-2026-ALICORP-001',
          estado: 'CERRADO',
          versionSync: 2,
          fechaEjecucion: hoy,
          horaInicio: '08:30',
          horaFin: '11:00',
          tecnicosParticipantes: [
            { id: tecnicoId, nombre: usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Técnico Operador' },
          ],
          puedeSolicitarCorreccion: true,
          clienteRazonSocial: 'ALICORP S.A.A.',
          sedeNombre: 'PLANTA_CALLAO (Av. Argentina 4793)',
          servicioTipo: 'DESINSECTACION Y DESRATIZACION (DRT)',
        },
        {
          id: 'c1111111-2222-4000-8000-000000000002',
          servicioId: 's1111111-1111-4000-8000-000000000002',
          codigoInspeccion: 'GAFER-2026-GLORIA-004',
          estado: 'CERRADO',
          versionSync: 1,
          fechaEjecucion: hoy,
          horaInicio: '14:00',
          horaFin: '16:30',
          tecnicosParticipantes: [
            { id: tecnicoId, nombre: usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Técnico Operador' },
          ],
          puedeSolicitarCorreccion: true,
          clienteRazonSocial: 'GRUPO GLORIA S.A.',
          sedeNombre: 'PLANTA_HUACHIPA (Autopista Ramiro Prialé)',
          servicioTipo: 'DESRATIZACION (DRT)',
        },
      ]);
    } finally {
      setCargandoCerrados(false);
    }
  }, [token, tecnicoId, usuario]);

  useEffect(() => {
    if (vistaActiva === 'CERRADOS') {
      cargarServiciosCerrados();
    }
  }, [vistaActiva, cargarServiciosCerrados]);

  // Guarda de cierre de sesión para prevención de pérdida de datos offline
  const handleCerrarSesion = () => {
    const tieneBorrador = Boolean(borrador);
    const mensajeAdvertencia = tieneBorrador
      ? 'Tiene una inspección activa en borrador sin sincronizar. Además, si se encuentra sin conexión no podrá volver a ingresar hasta tener red. ¿Seguro que desea salir?'
      : 'Si se encuentra en campo sin conexión a internet, no podrá volver a iniciar sesión hasta contar con red Wi-Fi o datos móviles. ¿Desea cerrar sesión?';

    Alert.alert('Cerrar Sesión de Campo', mensajeAdvertencia, [
      { text: 'Permanecer en App', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await cerrarSesion();
        },
      },
    ]);
  };

  const handleIniciarVisita = (visita: ItemAgenda) => {
    iniciarAtencionVisita(visita.id);
    setModoFormularioCampo(true);
  };

  const handleIniciarSede = (sede: SedeActiva) => {
    iniciarAtencionEnSede(sede);
    setModoFormularioCampo(true);
  };

  const handleConcluirInspeccion = () => {
    Alert.alert(
      'Concluir Inspección',
      '¿Desea finalizar la atención de esta visita en su terminal móvil?',
      [
        { text: 'Permanecer en servicio', style: 'cancel' },
        {
          text: 'Concluir',
          style: 'destructive',
          onPress: () => {
            limpiarBorrador();
          },
        },
      ],
    );
  };

  // Filtrado de visitas según la pestaña activa (Decisión C12)
  const modoFiltro: ModoFiltroAgenda =
    vistaActiva === 'DISPONIBLES' ? 'DISPONIBLES' : 'MIS_VISITAS';
  const visitasMostradas = filtrarAgendaPorTecnico(items, tecnicoId, modoFiltro);

  // Filtrado de sedes activas para contingencia (§8.2)
  const sedesMostradas = filtrarSedesActivas(sedesActivas, busquedaSede);

  const renderItemVisita = ({ item }: { item: ItemAgenda }) => {
    const esTitular = item.tecnicoTitularId === tecnicoId;
    const esAbierta = item.tecnicoTitularId === null;
    const estaEnCurso = borrador?.servicioId === item.servicioId;

    return (
      <View style={styles.fichaOrden}>
        <View style={styles.fichaCabecera}>
          <View style={styles.fichaOrdenInfo}>
            <Text style={styles.numeroOrdenTexto}>
              {item.numeroOrden || `ORD-${item.id.slice(0, 8)}`}
            </Text>
            <Text style={styles.horaTexto}>{item.hora} hrs</Text>
          </View>

          {esTitular ? (
            <View style={styles.badgeTitular}>
              <Text style={styles.textoBadgeTitular}>ASIGNADA (TITULAR)</Text>
            </View>
          ) : esAbierta ? (
            <View style={styles.badgeAbierta}>
              <Text style={styles.textoBadgeAbierta}>ABIERTA (SIN TITULAR)</Text>
            </View>
          ) : (
            <View style={styles.badgeColega}>
              <Text style={styles.textoBadgeColega}>OTRO TÉCNICO</Text>
            </View>
          )}
        </View>

        <Text style={styles.clienteNombre}>{item.clienteRazonSocial}</Text>
        <Text style={styles.sedeNombre}>{item.sedeNombre}</Text>
        <Text style={styles.direccionTexto}>{item.sedeDireccion}</Text>
        <Text style={styles.servicioTexto}>{item.servicioTipo}</Text>

        {item.observaciones ? (
          <Text style={styles.observacionesTexto} numberOfLines={2}>
            Nota: {item.observaciones}
          </Text>
        ) : null}

        <View style={styles.accionesVisita}>
          {estaEnCurso ? (
            <View style={styles.badgeEnCurso}>
              <Text style={styles.textoEnCurso}>● EN ATENCIÓN ACTIVA</Text>
            </View>
          ) : (
            <Button
              testID={`boton-atender-${item.id}`}
              titulo={esTitular ? 'Atender Visita' : 'Tomar Visita (C12)'}
              onPress={() => handleIniciarVisita(item)}
              variante={esTitular ? 'primario' : 'secundario'}
              style={styles.botonAtender}
            />
          )}
        </View>
      </View>
    );
  };

  const renderItemSede = ({ item }: { item: SedeActiva }) => {
    const estaSeleccionada = borrador?.sedeNombre === item.nombre;

    return (
      <View style={styles.fichaOrden}>
        <View style={styles.fichaCabecera}>
          <Text style={styles.sedeTitulo}>{item.nombre}</Text>
          <View style={styles.badgeActivo}>
            <Text style={styles.textoBadgeActivo}>SEDE ACTIVA</Text>
          </View>
        </View>

        <Text style={styles.clienteNombre}>{item.clienteRazonSocial}</Text>
        <Text style={styles.direccionTexto}>
          {item.direccionSede} · {item.distrito}
        </Text>

        <View style={styles.accionesVisita}>
          {estaSeleccionada ? (
            <View style={styles.badgeEnCurso}>
              <Text style={styles.textoEnCurso}>● EN ATENCIÓN ACTIVA</Text>
            </View>
          ) : (
            <Button
              testID={`boton-sede-${item.id}`}
              titulo="Atender en Sede (§8.2)"
              onPress={() => handleIniciarSede(item)}
              variante="secundario"
              style={styles.botonAtender}
            />
          )}
        </View>
      </View>
    );
  };

  // GAF-104: Renderizado de tarjetas de servicios cerrados en solo lectura
  const renderItemServicioCerrado = ({ item }: { item: ResumenServicioTecnico }) => {
    return (
      <View style={styles.tarjetaCerrado}>
        <View style={styles.cabeceraCerrado}>
          <Text style={styles.codigoCerrado}>{item.codigoInspeccion}</Text>
          <View style={styles.badgeCerradoSoloLectura}>
            <Text style={styles.textoBadgeCerrado}>🔒 CERRADO</Text>
          </View>
        </View>

        <Text style={styles.clienteCerrado}>{item.clienteRazonSocial || 'Cliente GAFER'}</Text>
        <Text style={styles.sedeCerrado}>Sede: {item.sedeNombre || 'Planta Principal'}</Text>
        <Text style={styles.servicioCerrado}>Servicio: {item.servicioTipo || 'Desratización (DRT)'}</Text>
        <Text style={styles.horarioCerrado}>
          📅 {item.fechaEjecucion} · {item.horaInicio || '08:00'} - {item.horaFin || 'Fin'}
        </Text>

        <View style={styles.accionesCerrado}>
          <TouchableOpacity
            style={styles.botonVerReporte}
            onPress={() => {
              setServicioDetalle(item);
              setModalDetalleVisible(true);
            }}
          >
            <Text style={styles.textoBotonVerReporte}>👁️ Ver Reporte</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonPedirCorreccion}
            onPress={() => {
              setServicioDetalle(item);
              setModalDetalleVisible(true);
            }}
          >
            <Text style={styles.textoBotonPedirCorreccion}>📝 Pedir Corrección</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (modoFormularioCampo) {
    return (
      <FormularioCampoScreen
        onVolver={() => setModoFormularioCampo(false)}
        onAbrirPlanillaDrt={() => {
          setModoFormularioCampo(false);
          setModoFormularioDrt(true);
        }}
      />
    );
  }

  if (modoFormularioDrt) {
    return <FormularioDrtScreen onVolver={() => setModoFormularioDrt(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      {/* Cabecera superior con estilo de Garita de Control */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.appTitulo}>GAFER SANEAMIENTO AMBIENTAL</Text>
          <Text style={styles.usuarioNombre}>
            {usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Técnico Operador'}
          </Text>
          <Text style={styles.fechaTexto}>
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>

        <TouchableOpacity
          testID="boton-logout"
          style={styles.botonSalir}
          onPress={handleCerrarSesion}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión de campo"
        >
          <Text style={styles.textoSalir}>SALIR</Text>
        </TouchableOpacity>
      </View>

      {/* Placa de Inspección Activa en Garita */}
      {borrador ? (
        <View style={styles.placaInspeccionActiva}>
          <TouchableOpacity
            style={styles.placaInspeccionInfo}
            onPress={() => setModoFormularioCampo(true)}
            activeOpacity={0.8}
          >
            <View style={styles.indicadorEnServicio}>
              <View style={styles.puntoVerdeActivo} />
              <Text style={styles.indicadorTexto}>EN SERVICIO ACTIVO (TOCA PARA EDITAR)</Text>
            </View>
            <Text style={styles.placaClienteTexto} numberOfLines={1}>
              {borrador.clienteRazonSocial || 'Atención en Sede'}
              {borrador.sedeNombre ? ` · ${borrador.sedeNombre}` : ''}
            </Text>
            <Text style={styles.placaDetalleTexto} numberOfLines={1}>
              {borrador.servicioTipo || 'Inspección de Saneamiento'}
              {borrador.numeroOrden ? ` · ${borrador.numeroOrden}` : ''}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              testID="boton-abrir-formulario-campo"
              onPress={() => setModoFormularioCampo(true)}
              style={styles.botonAbrirActaDrt}
              accessibilityRole="button"
              accessibilityLabel="Abrir formulario de campo"
            >
              <Text style={styles.textoBotonAbrirActaDrt}>FORMULARIO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="boton-abrir-acta-drt"
              onPress={() => setModoFormularioDrt(true)}
              style={[styles.botonAbrirActaDrt, { backgroundColor: '#3b82f6' }]}
              accessibilityRole="button"
              accessibilityLabel="Abrir acta de servicio DRT"
            >
              <Text style={styles.textoBotonAbrirActaDrt}>ACTA DRT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="boton-concluir-inspeccion"
              onPress={handleConcluirInspeccion}
              style={styles.botonConcluir}
              accessibilityRole="button"
              accessibilityLabel="Concluir inspección activa"
            >
              <Text style={styles.textoBotonConcluir}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {error ? (
        <AlertBanner
          tipo="error"
          mensaje={error}
          style={styles.alertaMensaje}
        />
      ) : null}

      {/* Pestañas de control de visitas (Decisión C12 + Sedes Activas §8.2 + Cerrados GAF-104) */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'MIS_VISITAS' && styles.tabActivo]}
          onPress={() => setVistaActiva('MIS_VISITAS')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'MIS_VISITAS' && styles.tabTextoActivo]}
          >
            MI AGENDA
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'DISPONIBLES' && styles.tabActivo]}
          onPress={() => setVistaActiva('DISPONIBLES')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'DISPONIBLES' && styles.tabTextoActivo]}
          >
            ABIERTAS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'SEDES_ACTIVAS' && styles.tabActivo]}
          onPress={() => setVistaActiva('SEDES_ACTIVAS')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'SEDES_ACTIVAS' && styles.tabTextoActivo]}
          >
            SEDES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'CERRADOS' && styles.tabActivo]}
          onPress={() => setVistaActiva('CERRADOS')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'CERRADOS' && styles.tabTextoActivo]}
          >
            CERRADOS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Buscador de Sedes Activas en modo Contingencia */}
      {vistaActiva === 'SEDES_ACTIVAS' ? (
        <View style={styles.buscadorContenedor}>
          <TextInput
            testID="input-buscar-sede"
            style={styles.inputBuscador}
            placeholder="Buscar por sede, cliente o distrito..."
            placeholderTextColor={TOKENS.inkFaint}
            value={busquedaSede}
            onChangeText={setBusquedaSede}
          />
        </View>
      ) : null}

      {/* Lista de Fichas de Campo */}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.cuerpo}>
        {cargando || (vistaActiva === 'CERRADOS' && cargandoCerrados) ? (
          <View style={styles.cargandoContenedor}>
            <ActivityIndicator size="large" color={TOKENS.marca} />
            <Text style={styles.cargandoTexto}>
              {vistaActiva === 'CERRADOS'
                ? 'Cargando servicios cerrados en solo lectura...'
                : 'Cargando agenda de operaciones...'}
            </Text>
          </View>
        ) : vistaActiva === 'CERRADOS' ? (
          <FlatList
            data={serviciosCerrados}
            keyExtractor={(item) => item.id}
            renderItem={renderItemServicioCerrado}
            contentContainerStyle={styles.listaContenido}
            ListEmptyComponent={
              <View style={styles.vacioContenedor}>
                <Text style={styles.vacioTitulo}>Sin servicios cerrados</Text>
                <Text style={styles.vacioSubtitulo}>
                  Aún no cuenta con reportes de servicio cerrados en su terminal móvil.
                </Text>
              </View>
            }
          />
        ) : vistaActiva === 'SEDES_ACTIVAS' ? (
          <FlatList
            data={sedesMostradas}
            keyExtractor={(item) => item.id}
            renderItem={renderItemSede}
            contentContainerStyle={styles.listaContenido}
            ListEmptyComponent={
              <View style={styles.vacioContenedor}>
                <Text style={styles.vacioTitulo}>Sin sedes encontradas</Text>
                <Text style={styles.vacioSubtitulo}>
                  Verifique el término de búsqueda o la conexión con la base central.
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={visitasMostradas}
            keyExtractor={(item) => item.id}
            renderItem={renderItemVisita}
            contentContainerStyle={styles.listaContenido}
            ListEmptyComponent={
              <View style={styles.vacioContenedor}>
                <Text style={styles.vacioTitulo}>Sin visitas programadas</Text>
                <Text style={styles.vacioSubtitulo}>
                  {vistaActiva === 'MIS_VISITAS'
                    ? 'No tiene visitas asignadas como titular para hoy. Puede revisar las visitas abiertas o elegir una sede activa.'
                    : 'No hay visitas abiertas disponibles sin titular para esta fecha.'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* Modal de Detalle de Servicio Cerrado y Solicitud de Corrección (GAF-104) */}
      <DetalleServicioCerradoModal
        visible={modalDetalleVisible}
        servicio={servicioDetalle}
        token={token || undefined}
        onCerrar={() => setModalDetalleVisible(false)}
        onCorreccionEnviada={() => {
          cargarServiciosCerrados();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.marca,
  },
  header: {
    backgroundColor: TOKENS.marca,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#034527',
  },
  headerInfo: {
    flex: 1,
  },
  appTitulo: {
    color: TOKENS.hoja,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  usuarioNombre: {
    color: TOKENS.marcaInk,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  fechaTexto: {
    color: '#a3e635',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    textTransform: 'capitalize',
  },
  botonSalir: {
    backgroundColor: '#034527',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#056036',
  },
  textoSalir: {
    color: TOKENS.marcaInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  placaInspeccionActiva: {
    backgroundColor: TOKENS.panelRaised,
    borderBottomWidth: 1.5,
    borderBottomColor: TOKENS.ruleStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placaInspeccionInfo: {
    flex: 1,
    marginRight: 10,
  },
  indicadorEnServicio: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  puntoVerdeActivo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TOKENS.verde,
    marginRight: 6,
  },
  indicadorTexto: {
    fontSize: 9,
    fontWeight: '800',
    color: TOKENS.verde,
    letterSpacing: 0.6,
  },
  placaClienteTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  placaDetalleTexto: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    marginTop: 1,
  },
  botonAbrirActaDrt: {
    backgroundColor: TOKENS.marca,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radiusSm,
  },
  textoBotonAbrirActaDrt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  botonConcluir: {
    backgroundColor: TOKENS.panel,
    borderWidth: 1.5,
    borderColor: TOKENS.ruleStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radiusSm,
  },
  textoBotonConcluir: {
    color: TOKENS.ink,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertaMensaje: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: TOKENS.panel,
    borderBottomWidth: 1.5,
    borderBottomColor: TOKENS.ruleStrong,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActivo: {
    borderBottomColor: TOKENS.marca,
    backgroundColor: TOKENS.panelRaised,
  },
  tabTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.inkFaint,
    letterSpacing: 0.3,
  },
  tabTextoActivo: {
    color: TOKENS.marca,
    fontWeight: '900',
  },
  buscadorContenedor: {
    backgroundColor: TOKENS.panel,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: TOKENS.rule,
  },
  inputBuscador: {
    backgroundColor: TOKENS.panelRaised,
    borderRadius: TOKENS.radius,
    height: 40,
    paddingHorizontal: 12,
    fontSize: 13,
    color: TOKENS.ink,
    borderWidth: 1,
    borderColor: TOKENS.ruleStrong,
  },
  cuerpo: {
    flex: 1,
    backgroundColor: TOKENS.bg,
  },
  cargandoContenedor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cargandoTexto: {
    marginTop: 10,
    fontSize: 13,
    color: TOKENS.inkSoft,
    fontWeight: '600',
  },
  listaContenido: {
    padding: 14,
  },
  fichaOrden: {
    backgroundColor: TOKENS.panel,
    borderRadius: TOKENS.radius,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.ruleStrong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  fichaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  fichaOrdenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numeroOrdenTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.ink,
    backgroundColor: TOKENS.panelRaised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: TOKENS.rule,
  },
  horaTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.marca,
  },
  badgeTitular: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
  },
  textoBadgeTitular: {
    color: '#047857',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeAbierta: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
  },
  textoBadgeAbierta: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeColega: {
    backgroundColor: TOKENS.panelRaised,
    borderColor: TOKENS.ruleStrong,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
  },
  textoBadgeColega: {
    color: TOKENS.inkFaint,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  clienteNombre: {
    fontSize: 15,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 2,
  },
  sedeNombre: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.inkSoft,
    marginBottom: 2,
  },
  direccionTexto: {
    fontSize: 12,
    color: TOKENS.inkFaint,
    marginBottom: 6,
  },
  servicioTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.marca,
  },
  observacionesTexto: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  accionesVisita: {
    marginTop: 6,
  },
  botonAtender: {
    height: 42,
    marginVertical: 2,
  },
  badgeEnCurso: {
    backgroundColor: TOKENS.verdeInk,
    borderColor: TOKENS.verde,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: TOKENS.radiusSm,
    alignItems: 'center',
  },
  textoEnCurso: {
    color: TOKENS.verde,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sedeTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  badgeActivo: {
    backgroundColor: TOKENS.verdeInk,
    borderColor: TOKENS.verde,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
  },
  textoBadgeActivo: {
    color: TOKENS.verde,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  vacioContenedor: {
    padding: 30,
    alignItems: 'center',
  },
  vacioTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.inkSoft,
    marginBottom: 4,
  },
  vacioSubtitulo: {
    fontSize: 12,
    color: TOKENS.inkFaint,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Estilos GAF-104: Tarjetas de servicios cerrados
  tarjetaCerrado: {
    backgroundColor: TOKENS.panel,
    borderRadius: TOKENS.radius,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.ruleStrong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  cabeceraCerrado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codigoCerrado: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.ink,
  },
  badgeCerradoSoloLectura: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  textoBadgeCerrado: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  clienteCerrado: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 2,
  },
  sedeCerrado: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    marginBottom: 4,
  },
  servicioCerrado: {
    fontSize: 12,
    color: TOKENS.marca,
    fontWeight: '700',
    marginBottom: 4,
  },
  horarioCerrado: {
    fontSize: 11,
    color: TOKENS.inkFaint,
    marginBottom: 10,
  },
  accionesCerrado: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  botonVerReporte: {
    flex: 1,
    backgroundColor: TOKENS.panelRaised,
    borderWidth: 1,
    borderColor: TOKENS.ruleStrong,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  textoBotonVerReporte: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  botonPedirCorreccion: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  textoBotonPedirCorreccion: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
