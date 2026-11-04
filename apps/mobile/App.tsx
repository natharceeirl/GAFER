import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/features/auth/model/use-auth-store';
import { useBorradorStore } from './src/features/operaciones/model/use-borrador-store';
import { BorradorRepository } from './src/features/operaciones/model/borrador-repository';
import { inicializarBaseDeDatos } from './src/shared/db/sqlite';
import { LoginScreen } from './src/features/auth/ui';
import { AgendaScreen } from './src/features/agenda/ui';
import { TOKENS } from './src/shared/theme/tokens';

function AppContent() {
  const { estado, restaurarSesion } = useAuthStore();
  const [iniciando, setIniciando] = useState(true);

  useEffect(() => {
    let montado = true;
    (async () => {
      try {
        await restaurarSesion();
        // Inicializar persistencia SQLite local y restaurar borrador activo si existe
        await inicializarBaseDeDatos();
        const repo = new BorradorRepository();
        const borradorActivo = await repo.obtenerActivo();
        if (borradorActivo) {
          useBorradorStore.getState().restaurarBorrador(borradorActivo);
        }
      } catch (error) {
        console.warn('Advertencia al inicializar almacenamiento local SQLite:', error);
      } finally {
        if (montado) {
          setIniciando(false);
        }
      }
    })();

    return () => {
      montado = false;
    };
  }, [restaurarSesion]);

  if (iniciando) {
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
});
