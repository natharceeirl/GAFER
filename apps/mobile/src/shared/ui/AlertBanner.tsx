import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TouchableOpacity } from 'react-native';
import { TOKENS } from '../theme/tokens';

export interface AlertBannerProps {
  mensaje: string;
  tipo?: 'error' | 'advertencia' | 'info';
  onCerrar?: () => void;
  style?: ViewStyle;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  mensaje,
  tipo = 'error',
  onCerrar,
  style,
}) => {
  if (!mensaje) return null;

  const getEstilosPorTipo = () => {
    switch (tipo) {
      case 'advertencia':
        return {
          contenedor: styles.contenedorAdvertencia,
          texto: styles.textoAdvertencia,
        };
      case 'info':
        return {
          contenedor: styles.contenedorInfo,
          texto: styles.textoInfo,
        };
      case 'error':
      default:
        return {
          contenedor: styles.contenedorError,
          texto: styles.textoError,
        };
    }
  };

  const estilos = getEstilosPorTipo();

  return (
    <View style={[styles.base, estilos.contenedor, style]} accessibilityRole="alert">
      <View style={styles.filaContenido}>
        <Text style={[styles.textoBase, estilos.texto, onCerrar && styles.textoConBoton]}>
          {mensaje}
        </Text>
        {onCerrar ? (
          <TouchableOpacity
            onPress={onCerrar}
            style={styles.botonCerrar}
            accessibilityRole="button"
            accessibilityLabel="Cerrar alerta"
          >
            <Text style={[styles.textoCerrar, estilos.texto]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: TOKENS.radius,
    marginVertical: 8,
    borderWidth: 1.5,
    width: '100%',
  },
  textoBase: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  filaContenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoConBoton: {
    flex: 1,
    marginRight: 8,
  },
  botonCerrar: {
    padding: 4,
  },
  textoCerrar: {
    fontSize: 13,
    fontWeight: '800',
  },
  contenedorError: {
    backgroundColor: TOKENS.rojoInk,
    borderColor: TOKENS.rojo,
  },
  textoError: {
    color: TOKENS.rojo,
  },
  contenedorAdvertencia: {
    backgroundColor: TOKENS.amarilloInk,
    borderColor: TOKENS.amarillo,
  },
  textoAdvertencia: {
    color: TOKENS.amarillo,
  },
  contenedorInfo: {
    backgroundColor: TOKENS.infoInk,
    borderColor: TOKENS.info,
  },
  textoInfo: {
    color: TOKENS.info,
  },
});
