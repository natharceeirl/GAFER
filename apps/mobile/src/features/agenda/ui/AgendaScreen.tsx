import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const tecnicoId = usuario?.id || 'tecnico-defecto-id';

  useEffect(() => {
    cargarAgenda(tecnicoId);
  }, [cargarAgenda, tecnicoId]);

  const handleCerrarSesion = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Desea salir de la aplicación? Los datos locales se conservarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await cerrarSesion();
          },
        },
      ],
    );
  };

  const handleIniciarVisita = (visita: ItemAgenda) => {
    const ok = iniciarAtencionVisita(visita.id);
    if (ok) {
      setMensajeExito(
        `Inspección iniciada para ${visita.clienteRazonSocial} (${visita.sedeNombre})`,
      );
    }
  };

  const handleIniciarSede = (sede: SedeActiva) => {
    iniciarAtencionEnSede(sede);
    setMensajeExito(
      `Atención iniciada en sede ${sede.nombre} de ${sede.clienteRazonSocial}`,
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
      <View style={[styles.tarjetaVisita, enCurso && styles.tarjetaEnCurso]}>
        <View style={styles.cabeceraVisita}>
          <View style={styles.badgeHora}>
            <Text style={styles.textoHora}>{item.hora}</Text>
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
                ? 'Mi Visita'
                : esAbierta
                  ? 'Abierta / Disponible'
                  : item.tecnicoTitularNombre || 'Colega'}
            </Text>
          </View>
        </View>

        <Text style={styles.clienteNombre}>{item.clienteRazonSocial}</Text>
        <Text style={styles.sedeNombre}>
          Sede: <Text style={styles.sedeValor}>{item.sedeNombre}</Text>
        </Text>
        <Text style={styles.direccionTexto}>{item.sedeDireccion}</Text>

        <View style={styles.separador} />

        <View style={styles.servicioFila}>
          <Text style={styles.servicioEtiqueta}>Servicio:</Text>
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
              <Text style={styles.textoEnCurso}>● Inspección En Curso</Text>
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
      <View style={[styles.tarjetaSede, estaSeleccionada && styles.tarjetaEnCurso]}>
        <View style={styles.cabeceraSede}>
          <Text style={styles.sedeTitulo}>{item.nombre}</Text>
          <View style={styles.badgeActivo}>
            <Text style={styles.textoBadgeActivo}>Activa</Text>
          </View>
        </View>

        <Text style={styles.clienteNombre}>{item.clienteRazonSocial}</Text>
        <Text style={styles.direccionTexto}>
          {item.direccionSede} - {item.distrito}
        </Text>

        <View style={styles.accionesVisita}>
          <Button
            testID={`boton-sede-${item.id}`}
            titulo="Atender en Sede"
            onPress={() => handleIniciarSede(item)}
            variante="secundario"
            style={styles.botonAtender}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Cabecera superior con datos del técnico y logout */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.appTitulo}>GAFER Campo</Text>
          <Text style={styles.usuarioNombre}>
            {usuario ? `${usuario.nombres} (${usuario.usuario})` : 'Técnico Operador'}
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
          accessibilityLabel="Cerrar sesión"
        >
          <Text style={styles.textoSalir}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Banner de borrador activo si existe */}
      {borrador ? (
        <View style={styles.bannerBorrador}>
          <View style={styles.bannerBorradorInfo}>
            <Text style={styles.bannerBorradorTitulo}>Inspección Activa en Borrador</Text>
            <Text style={styles.bannerBorradorSubtitulo}>
              Servicio: {borrador.servicioId}
            </Text>
          </View>
          <TouchableOpacity
            onPress={limpiarBorrador}
            style={styles.botonFinalizarBorrador}
            accessibilityRole="button"
          >
            <Text style={styles.textoFinalizarBorrador}>Finalizar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Feedback contextual */}
      {mensajeExito ? (
        <AlertBanner
          tipo="info"
          mensaje={mensajeExito}
          onCerrar={() => setMensajeExito(null)}
          style={styles.alertaMensaje}
        />
      ) : null}

      {error ? (
        <AlertBanner
          tipo="error"
          mensaje={error}
          style={styles.alertaMensaje}
        />
      ) : null}

      {/* Selector de Pestañas (Decisión C12 + Sedes Activas §8.2) */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'MIS_VISITAS' && styles.tabActivo]}
          onPress={() => setVistaActiva('MIS_VISITAS')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'MIS_VISITAS' && styles.tabTextoActivo]}
          >
            Mi Agenda
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'DISPONIBLES' && styles.tabActivo]}
          onPress={() => setVistaActiva('DISPONIBLES')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'DISPONIBLES' && styles.tabTextoActivo]}
          >
            Abiertas (C12)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, vistaActiva === 'SEDES_ACTIVAS' && styles.tabActivo]}
          onPress={() => setVistaActiva('SEDES_ACTIVAS')}
        >
          <Text
            style={[styles.tabTexto, vistaActiva === 'SEDES_ACTIVAS' && styles.tabTextoActivo]}
          >
            Sedes Activas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Buscador de Sedes Activas en modo Sedes */}
      {vistaActiva === 'SEDES_ACTIVAS' ? (
        <View style={styles.buscadorContenedor}>
          <TextInput
            testID="input-buscar-sede"
            style={styles.inputBuscador}
            placeholder="Buscar sede, cliente o distrito..."
            placeholderTextColor="#8a9ba8"
            value={busquedaSede}
            onChangeText={setBusquedaSede}
          />
        </View>
      ) : null}

      {/* Contenido principal */}
      <View style={styles.cuerpo}>
        {cargando ? (
          <View style={styles.cargandoContenedor}>
            <ActivityIndicator size="large" color="#1f4d3d" />
            <Text style={styles.cargandoTexto}>Cargando agenda del día...</Text>
          </View>
        ) : vistaActiva === 'SEDES_ACTIVAS' ? (
          <FlatList
            data={sedesMostradas}
            keyExtractor={(item) => item.id}
            renderItem={renderItemSede}
            contentContainerStyle={styles.listaContenido}
            ListEmptyComponent={
              <View style={styles.vacioContenedor}>
                <Text style={styles.vacioTitulo}>No se encontraron sedes</Text>
                <Text style={styles.vacioSubtitulo}>
                  Intente con otro término de búsqueda o verifique la conexión.
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
                <Text style={styles.vacioTitulo}>Sin visitas en esta vista</Text>
                <Text style={styles.vacioSubtitulo}>
                  {vistaActiva === 'MIS_VISITAS'
                    ? 'No tiene visitas programadas como titular hoy. Puede revisar las visitas abiertas o elegir una sede activa.'
                    : 'No hay visitas abiertas disponibles sin titular para esta fecha.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1f4d3d',
  },
  header: {
    backgroundColor: '#1f4d3d',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  appTitulo: {
    color: '#a3e9d2',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  usuarioNombre: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  fechaTexto: {
    color: '#d4edda',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  botonSalir: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  textoSalir: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerBorrador: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBorradorInfo: {
    flex: 1,
  },
  bannerBorradorTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#856404',
  },
  bannerBorradorSubtitulo: {
    fontSize: 12,
    color: '#856404',
    marginTop: 2,
  },
  botonFinalizarBorrador: {
    backgroundColor: '#856404',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  textoFinalizarBorrador: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  alertaMensaje: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActivo: {
    borderBottomColor: '#1f4d3d',
  },
  tabTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#607d8b',
  },
  tabTextoActivo: {
    color: '#1f4d3d',
    fontWeight: '700',
  },
  buscadorContenedor: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  inputBuscador: {
    backgroundColor: '#f1f5f8',
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#263238',
  },
  cuerpo: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  cargandoContenedor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cargandoTexto: {
    marginTop: 12,
    fontSize: 14,
    color: '#546e7a',
  },
  listaContenido: {
    padding: 16,
  },
  tarjetaVisita: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tarjetaEnCurso: {
    borderColor: '#1f4d3d',
    borderWidth: 2,
    backgroundColor: '#f9fdfa',
  },
  cabeceraVisita: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeHora: {
    backgroundColor: '#1f4d3d',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  textoHora: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeTitular: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  textoBadgeTitular: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTitularAsignada: {
    backgroundColor: '#e8f5e9',
  },
  textoTitularAsignada: {
    color: '#2e7d32',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTitularAbierta: {
    backgroundColor: '#e3f2fd',
  },
  textoTitularAbierta: {
    color: '#1565c0',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTitularColega: {
    backgroundColor: '#f3e5f5',
  },
  textoTitularColega: {
    color: '#7b1fa2',
    fontSize: 11,
    fontWeight: '700',
  },
  clienteNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  sedeNombre: {
    fontSize: 13,
    color: '#4a5568',
    marginBottom: 2,
  },
  sedeValor: {
    fontWeight: '600',
    color: '#2d3748',
  },
  direccionTexto: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 8,
  },
  separador: {
    height: 1,
    backgroundColor: '#edf2f7',
    marginVertical: 8,
  },
  servicioFila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  servicioEtiqueta: {
    fontSize: 12,
    color: '#718096',
    marginRight: 6,
  },
  servicioValor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f4d3d',
  },
  observacionesTexto: {
    fontSize: 11,
    color: '#718096',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  accionesVisita: {
    marginTop: 8,
  },
  botonAtender: {
    height: 44,
    marginVertical: 4,
  },
  badgeEnCurso: {
    backgroundColor: '#e8f5e9',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  textoEnCurso: {
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: '700',
  },
  tarjetaSede: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cabeceraSede: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sedeTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a202c',
  },
  badgeActivo: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  textoBadgeActivo: {
    color: '#2e7d32',
    fontSize: 10,
    fontWeight: '700',
  },
  vacioContenedor: {
    padding: 30,
    alignItems: 'center',
  },
  vacioTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a5568',
    marginBottom: 6,
  },
  vacioSubtitulo: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 18,
  },
});
