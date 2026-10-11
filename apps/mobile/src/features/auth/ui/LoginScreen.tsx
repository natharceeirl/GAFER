import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../model/use-auth-store';
import { validarFormularioLogin } from '../model/login-validation';
import { Button, Input, AlertBanner } from '../../../shared/ui';

export interface LoginScreenProps {
  onLoginExitoso?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginExitoso }) => {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [errorUsuario, setErrorUsuario] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  const { estado, error: errorAuth, iniciarSesion, limpiarError } = useAuthStore();
  const estaCargando = estado === 'CARGANDO';

  const handleSubmit = async () => {
    limpiarError();
    const validacion = validarFormularioLogin(usuario, clave);

    setErrorUsuario(validacion.errorUsuario);
    setErrorClave(validacion.errorClave);

    if (!validacion.esValido) {
      return;
    }

    const exito = await iniciarSesion(usuario, clave);
    if (exito && onLoginExitoso) {
      onLoginExitoso();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.badgeContenedor}>
              <Text style={styles.badgeTexto}>GAFER OPERACIONES</Text>
            </View>
            <Text style={styles.titulo}>Saneamiento Ambiental</Text>
            <Text style={styles.subtitulo}>
              Ingreso de personal técnico para control de agenda e inspecciones de campo
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Iniciar Sesión</Text>

            {errorAuth ? (
              <AlertBanner
                tipo="error"
                mensaje={errorAuth}
                onCerrar={limpiarError}
                style={styles.alerta}
              />
            ) : null}

            <Input
              testID="input-usuario"
              label="Usuario o Correo"
              placeholder="ej. jserna o tecnico@gafer.pe"
              valor={usuario}
              onCambio={(texto) => {
                setUsuario(texto);
                if (errorUsuario) setErrorUsuario(null);
              }}
              error={errorUsuario}
              autoCapitalize="none"
              keyboardType="email-address"
              deshabilitado={estaCargando}
            />

            <Input
              testID="input-clave"
              label="Contraseña"
              placeholder="Ingrese su contraseña"
              valor={clave}
              onCambio={(texto) => {
                setClave(texto);
                if (errorClave) setErrorClave(null);
              }}
              error={errorClave}
              esClave
              deshabilitado={estaCargando}
            />

            <Button
              testID="boton-ingresar"
              titulo="Acceder a Agenda"
              onPress={handleSubmit}
              cargando={estaCargando}
              deshabilitado={estaCargando}
              variante="primario"
              style={styles.botonAcceso}
            />

            <View style={styles.footerAviso}>
              <Text style={styles.footerTexto}>
                Acceso restringido para personal técnico acreditado. Las operaciones se registrarán de forma local para sincronización posterior.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1f4d3d',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeContenedor: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  badgeTexto: {
    color: '#1f4d3d',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a2e26',
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 13,
    color: '#556961',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 16,
  },
  alerta: {
    marginBottom: 16,
  },
  botonAcceso: {
    marginTop: 18,
  },
  footerAviso: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
  },
  footerTexto: {
    fontSize: 11,
    color: '#8c9ba5',
    textAlign: 'center',
    lineHeight: 16,
  },
});
