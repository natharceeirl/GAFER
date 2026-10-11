import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TouchableOpacity } from 'react-native';

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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    width: '100%',
  },
  textoBase: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
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
    fontSize: 14,
    fontWeight: '700',
  },
  contenedorError: {
    backgroundColor: '#ffebee',
    borderColor: '#ffcdd2',
  },
  textoError: {
    color: '#b71c1c',
  },
  contenedorAdvertencia: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffecb3',
  },
  textoAdvertencia: {
    color: '#f57f17',
  },
  contenedorInfo: {
    backgroundColor: '#e8f5e9',
    borderColor: '#c8e6c9',
  },
  textoInfo: {
    color: '#1b5e20',
  },
});
