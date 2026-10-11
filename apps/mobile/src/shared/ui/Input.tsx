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
          placeholderTextColor="#9e9e9e"
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
              {claveVisible ? 'Ocultar' : 'Mostrar'}
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
    marginVertical: 8,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
    marginBottom: 6,
  },
  campoContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  campoError: {
    borderColor: '#d32f2f',
    backgroundColor: '#fffbfa',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1a1a1a',
  },
  botonVisibilidad: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  textoVisibilidad: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f4d3d',
  },
  textoError: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 4,
    fontWeight: '500',
  },
  textoAyuda: {
    fontSize: 12,
    color: '#607d8b',
    marginTop: 4,
  },
});
