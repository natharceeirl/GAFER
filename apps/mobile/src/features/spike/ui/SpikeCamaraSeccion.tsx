import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ArchivoRepository, ArchivoLocalEntity } from '../../operaciones/model/archivo-repository';
import { TOKENS } from '../../../shared/theme/tokens';

const INSPECCION_SPIKE_ID = 'spike-inspeccion-hardware-test';

export const SpikeCamaraSeccion: React.FC = () => {
  const [fotos, setFotos] = useState<ArchivoLocalEntity[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [repo] = useState(() => new ArchivoRepository());

  const cargarFotos = useCallback(async () => {
    try {
      const lista = await repo.listarArchivos(INSPECCION_SPIKE_ID);
      setFotos(lista);
    } catch (e) {
      console.warn('Error al listar fotos:', e);
    }
  }, [repo]);

  useEffect(() => {
    cargarFotos();
  }, [cargarFotos]);

  const tomarFoto = async () => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para el test de fotos.');
        return;
      }

      setProcesando(true);
      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!resultado.canceled && resultado.assets && resultado.assets[0]) {
        const asset = resultado.assets[0];
        await repo.guardarFotoDesdeUriTemporal(INSPECCION_SPIKE_ID, asset.uri, asset.mimeType ?? 'image/jpeg');
        await cargarFotos();
      }
    } catch (error: any) {
      Alert.alert('Error en captura', error.message || 'No se pudo guardar la foto');
    } finally {
      setProcesando(false);
    }
  };

  const seleccionarDeGaleria = async () => {
    try {
      setProcesando(true);
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!resultado.canceled && resultado.assets && resultado.assets[0]) {
        const asset = resultado.assets[0];
        await repo.guardarFotoDesdeUriTemporal(INSPECCION_SPIKE_ID, asset.uri, asset.mimeType ?? 'image/jpeg');
        await cargarFotos();
      }
    } catch (error: any) {
      Alert.alert('Error en galería', error.message);
    } finally {
      setProcesando(false);
    }
  };

  const eliminarFoto = async (fileId: string) => {
    await repo.eliminarArchivo(fileId);
    await cargarFotos();
  };

  return (
    <View style={styles.contenedor}>
      <View style={styles.cajaProtocolo}>
        <Text style={styles.protocoloTitulo}>🔥 Prueba Hostil: Muerte del Proceso (MIUI)</Text>
        <Text style={styles.protocoloTexto}>
          1. Ve a Ajustes de desarrollador en Android y activa: {'\n'}
          <Text style={styles.resaltado}>"No conservar actividades"</Text> (Don't keep activities).{'\n'}
          2. Presiona "Tomar Foto con Cámara" abajo.{'\n'}
          3. Android matará la app GAFER en segundo plano para abrir la cámara.{'\n'}
          4. Al tomar la foto y volver, comprueba que la foto aparezca guardada y registrada en SQLite sin crasheos.
        </Text>
      </View>

      <View style={styles.botonesFila}>
        <TouchableOpacity
          style={[styles.botonAccion, styles.botonCamara]}
          onPress={tomarFoto}
          disabled={procesando}
        >
          {procesando ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.botonTexto}>📷 Tomar Foto con Cámara</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botonAccion, styles.botonGaleria]}
          onPress={seleccionarDeGaleria}
          disabled={procesando}
        >
          <Text style={styles.botonTexto}>🖼 Galería</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.seccionTitulo}>
        Fotos en documentDirectory ({fotos.length}) — Persistencia SQLite
      </Text>

      {fotos.length === 0 ? (
        <View style={styles.vacioContenedor}>
          <Text style={styles.vacioTexto}>Aún no hay fotos capturadas en el sandbox local.</Text>
        </View>
      ) : (
        <FlatList
          data={fotos}
          keyExtractor={(item) => item.fileId}
          renderItem={({ item }) => {
            const uriAbsoluta = ArchivoRepository.resolverRutaAbsoluta(item.localPathRelative);
            const kb = (item.sizeBytes / 1024).toFixed(1);

            return (
              <View style={styles.tarjetaFoto}>
                <Image source={{ uri: uriAbsoluta }} style={styles.miniatura} />
                <View style={styles.infoFoto}>
                  <Text style={styles.fotoRuta} numberOfLines={1}>
                    📁 {item.localPathRelative}
                  </Text>
                  <Text style={styles.fotoMeta}>
                    Tamaño: {kb} KB | Estado: {item.uploadStatus}
                  </Text>
                  <Text style={styles.fotoTimestamp}>
                    Captura: {new Date(item.capturedAt).toLocaleTimeString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.botonEliminar}
                  onPress={() => eliminarFoto(item.fileId)}
                >
                  <Text style={styles.eliminarTexto}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  cajaProtocolo: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 12,
    marginBottom: 16,
  },
  protocoloTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 6,
  },
  protocoloTexto: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
  },
  resaltado: {
    fontWeight: '800',
    color: '#b45309',
  },
  botonesFila: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  botonAccion: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: TOKENS.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonCamara: {
    backgroundColor: TOKENS.marca,
    flex: 2,
  },
  botonGaleria: {
    backgroundColor: '#475569',
    flex: 1,
  },
  botonTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  seccionTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.ink,
    marginBottom: 10,
  },
  vacioContenedor: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vacioTexto: {
    fontSize: 13,
    color: TOKENS.inkSoft,
  },
  tarjetaFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: TOKENS.radiusSm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  miniatura: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  infoFoto: {
    flex: 1,
    marginLeft: 12,
  },
  fotoRuta: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.ink,
  },
  fotoMeta: {
    fontSize: 11,
    color: TOKENS.inkSoft,
    marginTop: 2,
  },
  fotoTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  botonEliminar: {
    padding: 8,
  },
  eliminarTexto: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '800',
  },
});
