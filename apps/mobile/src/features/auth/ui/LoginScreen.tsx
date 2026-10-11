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
import { TOKENS } from '../../../shared/theme/tokens';

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
          {/* Cabecera de Garita de Control Industrial */}
          <View style={styles.header}>
            <View style={styles.placaMarca}>
              <Text style={styles.placaTexto}>GAFER SANEAMIENTO AMBIENTAL</Text>
            </View>
            <Text style={styles.titulo}>Operaciones de Campo</Text>
            <Text style={styles.subtitulo}>
              Terminal de registro técnico y control de visitas offline
            </Text>
          </View>

          {/* Compartimento técnico */}
          <View style={styles.compartimento}>
            <View style={styles.compartimentoHeader}>
              <Text style={styles.compartimentoTitulo}>INGRESO DE PERSONAL</Text>
              <View style={styles.badgeEstado}>
                <Text style={styles.badgeEstadoTexto}>H2 · CAMPO</Text>
              </View>
            </View>

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
              placeholder="demo.tecnico1"
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
              placeholder="••••••••••••"
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
              titulo={estaCargando ? 'Autenticando...' : 'Iniciar Sesión'}
              onPress={handleSubmit}
              cargando={estaCargando}
              deshabilitado={estaCargando}
              variante="primario"
              style={styles.botonAcceso}
            />

            <View style={styles.pieCompartimento}>
              <Text style={styles.pieTexto}>
                Acceso exclusivo para técnicos de campo autorizados. Las operaciones y certificados se sincronizan de forma segura con la base central.
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
    backgroundColor: TOKENS.marca,
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: TOKENS.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  placaMarca: {
    backgroundColor: TOKENS.marca,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: TOKENS.radiusSm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#034527',
  },
  placaTexto: {
    color: TOKENS.marcaInk,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '900',
    color: TOKENS.ink,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitulo: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  compartimento: {
    backgroundColor: TOKENS.panel,
    borderRadius: TOKENS.radius,
    padding: 18,
    borderWidth: 1.5,
    borderColor: TOKENS.ruleStrong,
  },
  compartimentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: TOKENS.rule,
  },
  compartimentoTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.inkSoft,
    letterSpacing: 0.6,
  },
  badgeEstado: {
    backgroundColor: TOKENS.panelRaised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: TOKENS.rule,
  },
  badgeEstadoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.inkFaint,
  },
  alerta: {
    marginBottom: 12,
  },
  botonAcceso: {
    marginTop: 14,
  },
  pieCompartimento: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: TOKENS.rule,
  },
  pieTexto: {
    fontSize: 11,
    color: TOKENS.inkFaint,
    textAlign: 'center',
    lineHeight: 15,
  },
});
