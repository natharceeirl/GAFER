import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/features/auth/model/use-auth-store';
import { LoginScreen } from './src/features/auth/ui';
import { AgendaScreen } from './src/features/agenda/ui';
import { TOKENS } from './src/shared/theme/tokens';

export default function App() {
  const { estado, restaurarSesion } = useAuthStore();
  const [iniciando, setIniciando] = useState(true);

  useEffect(() => {
    let montado = true;
    (async () => {
      try {
        await restaurarSesion();
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
