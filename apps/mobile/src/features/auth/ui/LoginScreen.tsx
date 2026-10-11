import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../model/use-auth-store';
import { validarFormularioLogin } from '../model/login-validation';
import { Button, Input, AlertBanner } from '../../../shared/ui';

export interface LoginScreenProps {
  onLoginExitoso?: () => void;
}

const IP_WIFI_PC = 'http://192.168.18.205:3000';
const IP_EMULADOR = 'http://10.0.2.2:3000';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginExitoso }) => {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [errorUsuario, setErrorUsuario] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [editandoServidor, setEditandoServidor] = useState(false);

  const {
    estado,
    error: errorAuth,
    servidorUrl,
    iniciarSesion,
    iniciarSesionDemo,
    actualizarServidorUrl,
    limpiarError,
  } = useAuthStore();

  const [inputServidor, setInputServidor] = useState(servidorUrl || IP_WIFI_PC);
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

  const handleIngresoDemo = async () => {
    limpiarError();
    const exito = await iniciarSesionDemo(usuario || 'demo.tecnico1');
    if (exito && onLoginExitoso) {
      onLoginExitoso();
    }
  };

  const handleRellenarTecnico = () => {
    setUsuario('demo.tecnico1');
    setClave('Gafer2026!Tecnico');
    setErrorUsuario(null);
    setErrorClave(null);
  };

  const handleSeleccionarPreset = (url: string) => {
    actualizarServidorUrl(url);
    setInputServidor(url);
    setEditandoServidor(false);
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
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Cabecera institucional */}
          <View style={styles.header}>
            <View style={styles.badgeContenedor}>
              <Text style={styles.badgeTexto}>GAFER OPERACIONES</Text>
            </View>
            <Text style={styles.titulo}>Saneamiento Ambiental</Text>
            <Text style={styles.subtitulo}>
              App de campo para control de agenda e inspecciones de técnicos
            </Text>
          </View>

          <View style={styles.card}>
            {/* Selector de Servidor API visible arriba (sin taparse con el teclado) */}
            <View style={styles.servidorPanel}>
              <View style={styles.servidorFilaCabecera}>
                <Text style={styles.servidorEtiqueta}>Servidor API:</Text>
                <Text style={styles.servidorUrlTexto} numberOfLines={1}>
                  {servidorUrl || IP_WIFI_PC}
                </Text>
              </View>

              <View style={styles.presetChipsFila}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    servidorUrl === IP_WIFI_PC && styles.chipActivo,
                  ]}
                  onPress={() => handleSeleccionarPreset(IP_WIFI_PC)}
                >
                  <Text
                    style={[
                      styles.chipTexto,
                      servidorUrl === IP_WIFI_PC && styles.chipTextoActivo,
                    ]}
                  >
                    Wi-Fi PC (192.168.18.205)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chip,
                    servidorUrl === IP_EMULADOR && styles.chipActivo,
                  ]}
                  onPress={() => handleSeleccionarPreset(IP_EMULADOR)}
                >
                  <Text
                    style={[
                      styles.chipTexto,
                      servidorUrl === IP_EMULADOR && styles.chipTextoActivo,
                    ]}
                  >
                    Emulador (10.0.2.2)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, editandoServidor && styles.chipActivo]}
                  onPress={() => setEditandoServidor(!editandoServidor)}
                >
                  <Text
                    style={[
                      styles.chipTexto,
                      editandoServidor && styles.chipTextoActivo,
                    ]}
                  >
                    {editandoServidor ? '✕' : 'Editar IP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {editandoServidor ? (
                <View style={styles.cajaEditarIp}>
                  <Input
                    label="IP / URL del servidor"
                    placeholder="http://192.168.X.X:3000"
                    valor={inputServidor}
                    onCambio={setInputServidor}
                  />
                  <Button
                    titulo="Aplicar IP"
                    onPress={() => handleSeleccionarPreset(inputServidor)}
                    variante="secundario"
                    style={styles.botonAplicarIp}
                  />
                </View>
              ) : null}
            </View>

            <Text style={styles.cardTitulo}>Ingreso de Personal</Text>

            {errorAuth ? (
              <AlertBanner
                tipo="error"
                mensaje={errorAuth}
                onCerrar={limpiarError}
                style={styles.alerta}
              />
            ) : null}

            {/* Atajo rápido para no tipear toda la contraseña larga en móvil */}
            <TouchableOpacity
              onPress={handleRellenarTecnico}
              style={styles.botonRellenar}
              activeOpacity={0.7}
            >
              <Text style={styles.textoBotonRellenar}>
                ⚡ Autocompletar técnico de prueba (demo.tecnico1)
              </Text>
            </TouchableOpacity>

            <Input
              testID="input-usuario"
              label="Usuario de Técnico"
              placeholder="ej. demo.tecnico1"
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
              placeholder="Contraseña del técnico"
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
              titulo={estaCargando ? 'Conectando con la API...' : 'Acceder con API en Vivo'}
              onPress={handleSubmit}
              cargando={estaCargando}
              deshabilitado={estaCargando}
              variante="primario"
              style={styles.botonAcceso}
            />

            <View style={styles.separadorO}>
              <View style={styles.lineaSeparador} />
              <Text style={styles.textoSeparadorO}>O PARA PROBAR SIN ESPERAS</Text>
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

            <View style={styles.footerAviso}>
              <Text style={styles.footerTexto}>
                Acceso para personal técnico acreditado. Las operaciones se registrarán de forma local para sincronización posterior.
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
    padding: 16,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginVertical: 14,
  },
  badgeContenedor: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  badgeTexto: {
    color: '#1f4d3d',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a2e26',
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 12,
    color: '#556961',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  servidorPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  servidorFilaCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  servidorEtiqueta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  servidorUrlTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f4d3d',
  },
  presetChipsFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chipActivo: {
    backgroundColor: '#1f4d3d',
  },
  chipTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextoActivo: {
    color: '#ffffff',
  },
  cajaEditarIp: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  botonAplicarIp: {
    height: 38,
    marginTop: 4,
  },
  cardTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 10,
  },
  alerta: {
    marginBottom: 12,
  },
  botonRellenar: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  textoBotonRellenar: {
    fontSize: 11,
    color: '#4338ca',
    fontWeight: '700',
  },
  botonAcceso: {
    marginTop: 10,
  },
  separadorO: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  lineaSeparador: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  textoSeparadorO: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginHorizontal: 10,
    letterSpacing: 0.6,
  },
  botonDemo: {
    marginBottom: 6,
  },
  footerAviso: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
  },
  footerTexto: {
    fontSize: 11,
    color: '#8c9ba5',
    textAlign: 'center',
    lineHeight: 15,
  },
});
