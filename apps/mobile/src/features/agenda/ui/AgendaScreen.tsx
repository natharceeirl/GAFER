import React, { useEffect, useState } from 'react';
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
import { Button, AlertBanner } from '../../../shared/ui';
import { TOKENS } from '../../../shared/theme/tokens';

type VistaAgenda = 'MIS_VISITAS' | 'DISPONIBLES' | 'SEDES_ACTIVAS';

export const AgendaScreen: React.FC = () => {
  const { usuario, cerrarSesion } = useAuthStore();
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

  const tecnicoId = usuario?.id || 'tecnico-defecto-id';

  useEffect(() => {
    cargarAgenda(tecnicoId);
  }, [cargarAgenda, tecnicoId]);

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
  };

  const handleIniciarSede = (sede: SedeActiva) => {
    iniciarAtencionEnSede(sede);
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

  const visitasMostradas =
    vistaActiva === 'SEDES_ACTIVAS'
      ? []
      : filtrarAgendaPorTecnico(items, tecnicoId, vistaActiva as ModoFiltroAgenda);

  const sedesMostradas =
    vistaActiva === 'SEDES_ACTIVAS'
      ? filtrarSedesActivas(sedesActivas, busquedaSede)
      : [];

  const renderItemVisita = ({ item }: { item: ItemAgenda }) => {
    const esTitular = item.tecnicoTitularId === tecnicoId;
    const esAbierta = item.tecnicoTitularId === null;
    const enCurso = item.estadoCampo === 'EN_CURSO';

    return (
      <View style={[styles.fichaOrden, enCurso && styles.fichaEnCurso]}>
        <View style={styles.cabeceraFicha}>
          <View style={styles.badgeHora}>
            <Text style={styles.textoHora}>
              {item.hora} HRS{item.numeroOrden ? ` · ${item.numeroOrden}` : ''}
            </Text>
          </View>

          <View
            style={[
              styles.badgeTitular,
              esTitular
                ? styles.badgeTitularAsignada
                : esAbierta
                  ? styles.badgeTitularAbierta
                  : styles.badgeTitularColega,
            ]}
          >
            <Text
              style={[
                styles.textoBadgeTitular,
                esTitular
                  ? styles.textoTitularAsignada
                  : esAbierta
                    ? styles.textoTitularAbierta
                    : styles.textoTitularColega,
              ]}
            >
              {esTitular
                ? 'ASIGNADA A MÍ'
                : esAbierta
                  ? 'DISPONIBLE (C12)'
                  : (item.tecnicoTitularNombre || 'COLEGA').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.clienteNombre}>{item.clienteRazonSocial}</Text>
        <Text style={styles.sedeNombre}>
          SEDE: <Text style={styles.sedeValor}>{item.sedeNombre}</Text>
        </Text>
        <Text style={styles.direccionTexto}>{item.sedeDireccion}</Text>

        <View style={styles.separadorFicha} />

        <View style={styles.servicioFila}>
          <Text style={styles.servicioEtiqueta}>SERVICIO:</Text>
          <Text style={styles.servicioValor}>{item.servicioTipo}</Text>
        </View>

        {item.observaciones ? (
          <Text style={styles.observacionesTexto} numberOfLines={2}>
            Nota: {item.observaciones}
          </Text>
        ) : null}

        <View style={styles.accionesVisita}>
          {enCurso ? (
            <View style={styles.badgeEnCurso}>
              <Text style={styles.textoEnCurso}>● INSPECCIÓN ACTIVA EN CURSO</Text>
            </View>
          ) : (
            <Button
              testID={`boton-atender-${item.id}`}
              titulo="Iniciar Inspección"
              onPress={() => handleIniciarVisita(item)}
              variante="primario"
              style={styles.botonAtender}
            />
          )}
        </View>
      </View>
    );
  };

  const renderItemSede = ({ item }: { item: SedeActiva }) => {
    const estaSeleccionada = borrador?.servicioId?.includes(item.id.substring(0, 8));

    return (
      <View style={[styles.fichaOrden, estaSeleccionada && styles.fichaEnCurso]}>
        <View style={styles.cabeceraFicha}>
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      {/* Cabecera superior con estilo de Garita de Control */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.appTitulo}>GAFER SANEAMIENTO AMBIENTAL</Text>
          <Text style={styles.usuarioNombre}>
            {usuario ? usuario.nombres : 'Técnico Operador'}
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
          <View style={styles.placaInspeccionInfo}>
            <View style={styles.indicadorEnServicio}>
              <View style={styles.puntoVerdeActivo} />
              <Text style={styles.indicadorTexto}>EN SERVICIO ACTIVO</Text>
            </View>
            <Text style={styles.placaClienteTexto} numberOfLines={1}>
              {borrador.clienteRazonSocial || 'Atención en Sede'}
              {borrador.sedeNombre ? ` · ${borrador.sedeNombre}` : ''}
            </Text>
            <Text style={styles.placaDetalleTexto} numberOfLines={1}>
              {borrador.servicioTipo || 'Inspección de Saneamiento'}
              {borrador.numeroOrden ? ` · ${borrador.numeroOrden}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            testID="boton-concluir-inspeccion"
            onPress={handleConcluirInspeccion}
            style={styles.botonConcluir}
            accessibilityRole="button"
            accessibilityLabel="Concluir inspección activa"
          >
            <Text style={styles.textoBotonConcluir}>CONCLUIR</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <AlertBanner
          tipo="error"
          mensaje={error}
          style={styles.alertaMensaje}
        />
      ) : null}

      {/* Pestañas de control de visitas (Decisión C12 + Sedes Activas §8.2) */}
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
            ABIERTAS (C12)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'SEDES_ACTIVAS' && styles.tabActivo]}
          onPress={() => setVistaActiva('SEDES_ACTIVAS')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'SEDES_ACTIVAS' && styles.tabTextoActivo]}
          >
            SEDES ACTIVAS
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
        {cargando ? (
          <View style={styles.cargandoContenedor}>
            <ActivityIndicator size="large" color={TOKENS.marca} />
            <Text style={styles.cargandoTexto}>Cargando agenda de operaciones...</Text>
          </View>
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
    color: '#d4edda',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  botonSalir: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  textoSalir: {
    color: TOKENS.marcaInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  placaInspeccionActiva: {
    backgroundColor: TOKENS.panelRaised,
    borderLeftWidth: 4,
    borderLeftColor: TOKENS.marca,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: TOKENS.ruleStrong,
  },
  placaInspeccionInfo: {
    flex: 1,
    paddingRight: 10,
  },
  indicadorEnServicio: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  puntoVerdeActivo: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: TOKENS.marca,
    marginRight: 6,
  },
  indicadorTexto: {
    fontSize: 10,
    fontWeight: '800',
    color: TOKENS.marca,
    letterSpacing: 0.6,
  },
  placaClienteTexto: {
    fontSize: 14,
    fontWeight: '900',
    color: TOKENS.ink,
    letterSpacing: 0.2,
  },
  placaDetalleTexto: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    marginTop: 1,
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
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.inkFaint,
    letterSpacing: 0.5,
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
  },
  fichaEnCurso: {
    borderColor: TOKENS.marca,
    borderWidth: 2,
    backgroundColor: TOKENS.panelRaised,
  },
  cabeceraFicha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeHora: {
    backgroundColor: TOKENS.marca,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TOKENS.radiusSm,
  },
  textoHora: {
    color: TOKENS.marcaInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTitular: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
  },
  textoBadgeTitular: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeTitularAsignada: {
    backgroundColor: TOKENS.verdeInk,
    borderColor: TOKENS.verde,
  },
  textoTitularAsignada: {
    color: TOKENS.verde,
  },
  badgeTitularAbierta: {
    backgroundColor: TOKENS.infoInk,
    borderColor: TOKENS.info,
  },
  textoTitularAbierta: {
    color: TOKENS.info,
  },
  badgeTitularColega: {
    backgroundColor: TOKENS.panelRaised,
    borderColor: TOKENS.ruleStrong,
  },
  textoTitularColega: {
    color: TOKENS.inkSoft,
  },
  clienteNombre: {
    fontSize: 15,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 3,
  },
  sedeNombre: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    marginBottom: 2,
    fontWeight: '700',
  },
  sedeValor: {
    fontWeight: '800',
    color: TOKENS.ink,
  },
  direccionTexto: {
    fontSize: 12,
    color: TOKENS.inkFaint,
    marginBottom: 6,
  },
  separadorFicha: {
    height: 1,
    backgroundColor: TOKENS.rule,
    marginVertical: 6,
  },
  servicioFila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  servicioEtiqueta: {
    fontSize: 11,
    color: TOKENS.inkFaint,
    fontWeight: '700',
    marginRight: 6,
  },
  servicioValor: {
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
});
