import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { TOKENS } from '../theme/tokens';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  valor: string;
  onCambio: (texto: string) => void;
  error?: string | null;
  ayuda?: string;
  esClave?: boolean;
  deshabilitado?: boolean;
  contenedorStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  valor,
  onCambio,
  error,
  ayuda,
  esClave = false,
  contenedorStyle,
  placeholder,
  deshabilitado,
  autoCapitalize = 'none',
  keyboardType = 'default',
  testID,
  ...resto
}) => {
  const [claveVisible, setClaveVisible] = useState(false);

  const tieneError = Boolean(error);

  return (
    <View style={[styles.contenedor, contenedorStyle]}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.campoContenedor, tieneError && styles.campoError]}>
        <TextInput
          testID={testID}
          style={styles.input}
          value={valor}
          onChangeText={onCambio}
          placeholder={placeholder}
          placeholderTextColor={TOKENS.inkFaint}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          secureTextEntry={esClave && !claveVisible}
          editable={!deshabilitado}
          {...resto}
        />

        {esClave ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setClaveVisible(!claveVisible)}
            style={styles.botonVisibilidad}
            accessibilityLabel={claveVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
            accessibilityRole="button"
          >
            <Text style={styles.textoVisibilidad}>
              {claveVisible ? 'OCULTAR' : 'VER'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {tieneError ? (
        <Text style={styles.textoError} accessibilityRole="alert">
          {error}
        </Text>
      ) : ayuda ? (
        <Text style={styles.textoAyuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    marginVertical: 6,
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.inkSoft,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  campoContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: TOKENS.panelRaised,
    borderWidth: 1.5,
    borderColor: TOKENS.ruleStrong,
    borderRadius: TOKENS.radius,
    paddingHorizontal: 12,
  },
  campoError: {
    borderColor: TOKENS.rojo,
    backgroundColor: TOKENS.rojoInk,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: TOKENS.ink,
    fontWeight: '500',
  },
  botonVisibilidad: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  textoVisibilidad: {
    fontSize: 11,
    fontWeight: '800',
    color: TOKENS.marca,
    letterSpacing: 0.5,
  },
  textoError: {
    fontSize: 12,
    color: TOKENS.rojo,
    marginTop: 4,
    fontWeight: '600',
  },
  textoAyuda: {
    fontSize: 11,
    color: TOKENS.inkFaint,
    marginTop: 4,
  },
});
