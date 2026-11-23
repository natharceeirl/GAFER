import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/features/auth/model/use-auth-store';
import { useBorradorStore } from './src/features/operaciones/model/use-borrador-store';
import { inicializarBaseDeDatos } from './src/shared/db/sqlite';
import { LoginScreen } from './src/features/auth/ui';
import { AgendaScreen } from './src/features/agenda/ui';
import { TOKENS } from './src/shared/theme/tokens';

function AppContent() {
  const { estado, usuario, restaurarSesion } = useAuthStore();
  const [iniciando, setIniciando] = useState(true);
  const [errorAlmacenamiento, setErrorAlmacenamiento] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [usuarioBorradorListo, setUsuarioBorradorListo] = useState<string | null>(null);

  // 1. Base de datos local y sesión. Sin SQLite no se deja trabajar: lo que el técnico
  //    registre no quedaría en disco (regla "durable antes que visible").
  useEffect(() => {
    let montado = true;
    setIniciando(true);
    setErrorAlmacenamiento(null);
    (async () => {
      try {
        await inicializarBaseDeDatos();
        await restaurarSesion();
      } catch (error) {
        console.error('No se pudo inicializar el almacenamiento local SQLite:', error);
        if (montado) {
          setErrorAlmacenamiento(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (montado) {
          setIniciando(false);
        }
      }
    })();

    return () => {
      montado = false;
    };
  }, [restaurarSesion, intento]);

  // 2. Borrador del técnico de la sesión: se restaura antes de montar AgendaScreen para
  //    evitar carreras con cargarAgenda y sobrescrituras tardías; se quita al cerrar sesión.
  const usuarioId = estado === 'AUTENTICADO' ? usuario?.id ?? null : null;
  useEffect(() => {
    if (iniciando || errorAlmacenamiento) return;

    if (!usuarioId) {
      useBorradorStore.getState().descargarDeMemoria();
      setUsuarioBorradorListo(null);
      return;
    }

    let vigente = true;
    useBorradorStore
      .getState()
      .restaurarActivoDeUsuario(usuarioId)
      .catch((error) => {
        console.error('No se pudo restaurar el borrador local:', error);
      })
      .finally(() => {
        if (vigente) {
          setUsuarioBorradorListo(usuarioId);
        }
      });

    return () => {
      vigente = false;
    };
  }, [usuarioId, iniciando, errorAlmacenamiento]);

  if (errorAlmacenamiento) {
    return (
      <View style={styles.splashContenedor}>
        <StatusBar style="light" />
        <Text style={styles.tituloSplash}>No se pudo abrir el almacenamiento del teléfono</Text>
        <Text style={styles.subtituloSplash}>
          Sin él, los datos de campo no se guardan. Reintente; si el problema sigue, reinicie el
          teléfono o avise a soporte.
        </Text>
        <Text style={styles.detalleError}>{errorAlmacenamiento}</Text>
        <TouchableOpacity
          style={styles.botonReintentar}
          onPress={() => setIntento((n) => n + 1)}
          accessibilityRole="button"
        >
          <Text style={styles.textoReintentar}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const restaurandoBorrador = usuarioId !== null && usuarioBorradorListo !== usuarioId;

  if (iniciando || restaurandoBorrador) {
    return (
      <View style={styles.splashContenedor}>
        <StatusBar style="light" />
        <View style={styles.logoBadge}>
          <Text style={styles.logoTexto}>GAFER</Text>
        </View>
        <Text style={styles.tituloSplash}>Saneamiento Ambiental</Text>
        <Text style={styles.subtituloSplash}>Operaciones de Campo (Offline-First)</Text>
        <ActivityIndicator size="small" color={TOKENS.hoja} style={styles.spinner} />
      </View>
    );
  }

  if (estado !== 'AUTENTICADO') {
    return <LoginScreen />;
  }

  return <AgendaScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContenedor: {
    flex: 1,
    backgroundColor: TOKENS.marca,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: TOKENS.radiusSm,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  logoTexto: {
    fontSize: 22,
    fontWeight: '900',
    color: TOKENS.marcaInk,
    letterSpacing: 3,
  },
  tituloSplash: {
    fontSize: 20,
    fontWeight: '800',
    color: TOKENS.marcaInk,
    textAlign: 'center',
  },
  subtituloSplash: {
    fontSize: 12,
    color: '#d4edda',
    marginTop: 6,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 24,
  },
  detalleError: {
    fontSize: 11,
    color: '#d4edda',
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
  botonReintentar: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: TOKENS.radiusSm,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  textoReintentar: {
    fontSize: 15,
    fontWeight: '800',
    color: TOKENS.marcaInk,
  },
});
