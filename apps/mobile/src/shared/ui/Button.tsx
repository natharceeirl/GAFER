import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { TOKENS } from '../theme/tokens';

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
      activeOpacity={0.85}
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
          color={variante === 'secundario' ? TOKENS.marca : TOKENS.marcaInk}
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
    height: 48,
    borderRadius: TOKENS.radius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1.5,
  },
  contenedorPrimario: {
    backgroundColor: TOKENS.marca,
    borderColor: '#034527',
  },
  contenedorSecundario: {
    backgroundColor: TOKENS.panelRaised,
    borderColor: TOKENS.ruleStrong,
  },
  contenedorPeligro: {
    backgroundColor: TOKENS.rojo,
    borderColor: '#7a1f16',
  },
  deshabilitado: {
    opacity: 0.55,
  },
  textoBase: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  textoPrimario: {
    color: TOKENS.marcaInk,
  },
  textoSecundario: {
    color: TOKENS.ink,
  },
});
