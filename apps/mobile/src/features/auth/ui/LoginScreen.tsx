import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  NativeModules,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../model/use-auth-store';
import { validarFormularioLogin } from '../model/login-validation';
import { Button, Input, AlertBanner } from '../../../shared/ui';

export interface LoginScreenProps {
  onLoginExitoso?: () => void;
}

const detectarHostMetro = (): string | null => {
  try {
    const scriptURL: string = (NativeModules as any)?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:3000`;
    }
  } catch {
    // Entorno no nativo o fallback
  }
  return null;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginExitoso }) => {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [errorUsuario, setErrorUsuario] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [mostrarConfigServidor, setMostrarConfigServidor] = useState(false);

  const {
    estado,
    error: errorAuth,
    servidorUrl,
    iniciarSesion,
    iniciarSesionDemo,
    actualizarServidorUrl,
    limpiarError,
  } = useAuthStore();

  const [inputServidor, setInputServidor] = useState(servidorUrl);
  const estaCargando = estado === 'CARGANDO';

  // Si estamos en un dispositivo físico con Expo Go, detectar automáticamente la IP del host
  useEffect(() => {
    const hostDetectado = detectarHostMetro();
    if (hostDetectado && servidorUrl === 'http://localhost:3000') {
      actualizarServidorUrl(hostDetectado);
      setInputServidor(hostDetectado);
    }
  }, [servidorUrl, actualizarServidorUrl]);

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

  const handleIngresoDemo = async () => {
    limpiarError();
    const exito = await iniciarSesionDemo(usuario || 'demo.tecnico1');
    if (exito && onLoginExitoso) {
      onLoginExitoso();
    }
  };

  const handleGuardarServidor = () => {
    if (inputServidor.trim()) {
      actualizarServidorUrl(inputServidor.trim());
      setMostrarConfigServidor(false);
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
              placeholder="ej. demo.tecnico1 o jserna"
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
              titulo={estaCargando ? 'Conectando...' : 'Acceder con API'}
              onPress={handleSubmit}
              cargando={estaCargando}
              deshabilitado={estaCargando}
              variante="primario"
              style={styles.botonAcceso}
            />

            <View style={styles.separadorO}>
              <View style={styles.lineaSeparador} />
              <Text style={styles.textoSeparadorO}>O PARA PROBAR AHORA</Text>
              <View style={styles.lineaSeparador} />
            </View>

            <Button
              testID="boton-demo"
              titulo="Ingresar en Modo Demostración (Offline)"
              onPress={handleIngresoDemo}
              deshabilitado={estaCargando}
              variante="secundario"
              style={styles.botonDemo}
            />

            {/* Ajustes del Servidor API para pruebas en red local */}
            <View style={styles.servidorSeccion}>
              <TouchableOpacity
                onPress={() => setMostrarConfigServidor(!mostrarConfigServidor)}
                style={styles.toggleServidor}
                accessibilityRole="button"
              >
                <Text style={styles.toggleServidorTexto}>
                  ⚙ Servidor: {servidorUrl} ({mostrarConfigServidor ? 'ocultar' : 'cambiar'})
                </Text>
              </TouchableOpacity>

              {mostrarConfigServidor ? (
                <View style={styles.cajaConfigServidor}>
                  <Input
                    label="Dirección del Servidor API"
                    placeholder="http://192.168.X.X:3000"
                    valor={inputServidor}
                    onCambio={setInputServidor}
                    ayuda="En celular físico, ingrese la IP de su PC en la misma red Wi-Fi."
                  />
                  <Button
                    titulo="Guardar Servidor"
                    onPress={handleGuardarServidor}
                    variante="secundario"
                    style={styles.botonGuardarServidor}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.footerAviso}>
              <Text style={styles.footerTexto}>
                Acceso para personal técnico acreditado. Las operaciones de campo se registran localmente para sincronización posterior.
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
    marginTop: 14,
  },
  separadorO: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  lineaSeparador: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  textoSeparadorO: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginHorizontal: 10,
    letterSpacing: 0.6,
  },
  botonDemo: {
    marginBottom: 10,
  },
  servidorSeccion: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  toggleServidor: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  toggleServidorTexto: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  cajaConfigServidor: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  botonGuardarServidor: {
    height: 40,
    marginTop: 6,
  },
  footerAviso: {
    marginTop: 16,
    paddingTop: 14,
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
