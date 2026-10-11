import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface ButtonProps {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  cargando?: boolean;
  deshabilitado?: boolean;
  style?: ViewStyle;
  textoStyle?: TextStyle;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  titulo,
  onPress,
  variante = 'primario',
  cargando = false,
  deshabilitado = false,
  style,
  textoStyle,
  testID,
}) => {
  const estaInactivo = deshabilitado || cargando;

  const getEstiloContenedor = () => {
    switch (variante) {
      case 'secundario':
        return styles.contenedorSecundario;
      case 'peligro':
        return styles.contenedorPeligro;
      case 'primario':
      default:
        return styles.contenedorPrimario;
    }
  };

  const getEstiloTexto = () => {
    switch (variante) {
      case 'secundario':
        return styles.textoSecundario;
      case 'peligro':
      case 'primario':
      default:
        return styles.textoPrimario;
    }
  };

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={estaInactivo}
      style={[
        styles.base,
        getEstiloContenedor(),
        estaInactivo && styles.deshabilitado,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: estaInactivo, busy: cargando }}
    >
      {cargando ? (
        <ActivityIndicator
          size="small"
          color={variante === 'secundario' ? '#1f4d3d' : '#ffffff'}
        />
      ) : (
        <Text style={[styles.textoBase, getEstiloTexto(), textoStyle]}>
          {titulo}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  contenedorPrimario: {
    backgroundColor: '#1f4d3d',
  },
  contenedorSecundario: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#1f4d3d',
  },
  contenedorPeligro: {
    backgroundColor: '#c62828',
  },
  deshabilitado: {
    opacity: 0.55,
  },
  textoBase: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textoPrimario: {
    color: '#ffffff',
  },
  textoSecundario: {
    color: '#1f4d3d',
  },
});
