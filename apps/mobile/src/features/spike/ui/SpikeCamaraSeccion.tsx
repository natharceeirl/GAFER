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
  const [metricas, setMetricas] = useState({ totalArchivos: 0, totalBytes: 0 });
  const [procesando, setProcesando] = useState(false);
  const [fotoRecuperadaDeMuerte, setFotoRecuperadaDeMuerte] = useState(false);
  const [repo] = useState(() => new ArchivoRepository());

  const cargarFotos = useCallback(async () => {
    try {
      const lista = await repo.listarArchivos(INSPECCION_SPIKE_ID);
      setFotos(lista);
      const met = await repo.obtenerMetricasAlmacenamiento(INSPECCION_SPIKE_ID);
      setMetricas(met);
    } catch (e) {
      console.warn('Error al listar fotos:', e);
    }
  }, [repo]);

  // Recuperación automática obligatoria según Guía Rev 2 §21.7 y §22.4
  // Si Android destruyó la actividad principal al abrir la cámara, getPendingResultAsync()
  // recupera el resultado pendiente al recrear la actividad en el teléfono de 4 GB.
  const verificarResultadoPendienteAndroid = useCallback(async () => {
    try {
      const pendingResult = await ImagePicker.getPendingResultAsync();
      if (
        pendingResult &&
        !('code' in pendingResult) &&
        !pendingResult.canceled &&
        pendingResult.assets &&
        pendingResult.assets.length > 0
      ) {
        setProcesando(true);
        for (const asset of pendingResult.assets) {
          await repo.guardarFotoDesdeUriTemporal(
            INSPECCION_SPIKE_ID,
            asset.uri,
            asset.mimeType ?? 'image/jpeg',
          );
        }
        setFotoRecuperadaDeMuerte(true);
        await cargarFotos();
      }
    } catch (error) {
      console.warn('Error al recuperar resultado pendiente de cámara:', error);
    } finally {
      setProcesando(false);
    }
  }, [repo, cargarFotos]);

  useEffect(() => {
    cargarFotos();
    verificarResultadoPendienteAndroid();
  }, [cargarFotos, verificarResultadoPendienteAndroid]);

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
        await repo.guardarFotoDesdeUriTemporal(
          INSPECCION_SPIKE_ID,
          asset.uri,
          asset.mimeType ?? 'image/jpeg',
        );
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
        await repo.guardarFotoDesdeUriTemporal(
          INSPECCION_SPIKE_ID,
          asset.uri,
          asset.mimeType ?? 'image/jpeg',
        );
        await cargarFotos();
      }
    } catch (error: any) {
      Alert.alert('Error en galería', error.message);
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarPruebaEstres20Fotos = async () => {
    try {
      setProcesando(true);
      await repo.generarLoteDe20FotosEstres(INSPECCION_SPIKE_ID);
      await cargarFotos();
      Alert.alert(
        'Prueba §22.6 Completada',
        'Se generaron 20 fotos físicas en documentDirectory y se persistieron en SQLite. Revisa la memoria y navega al plano para verificar estabilidad sin ANR ni OOM.',
      );
    } catch (error: any) {
      Alert.alert('Error en prueba de estrés', error.message);
    } finally {
      setProcesando(false);
    }
  };

  const limpiarTodasLasFotos = async () => {
    try {
      setProcesando(true);
      await repo.limpiarArchivosDeInspeccion(INSPECCION_SPIKE_ID);
      await cargarFotos();
      setFotoRecuperadaDeMuerte(false);
    } catch (error: any) {
      Alert.alert('Error al limpiar', error.message);
    } finally {
      setProcesando(false);
    }
  };

  const eliminarFoto = async (fileId: string) => {
    await repo.eliminarArchivo(fileId);
    await cargarFotos();
  };

  const totalMb = (metricas.totalBytes / (1024 * 1024)).toFixed(2);

  return (
    <View style={styles.contenedor}>
      {fotoRecuperadaDeMuerte && (
        <View style={styles.alertaRecuperacion}>
          <Text style={styles.alertaRecuperacionTitulo}>
            🟢 ¡ÉXITO EN COMPUERTA §22.7! FOTO RECUPERADA
          </Text>
          <Text style={styles.alertaRecuperacionTexto}>
            La actividad de Android murió al abrir la cámara, pero la foto fue rescatada
            exitosamente con getPendingResultAsync() y asegurada en SQLite.
          </Text>
        </View>
      )}

      <View style={styles.cajaProtocolo}>
        <Text style={styles.protocoloTitulo}>🔥 Prueba Hostil: Muerte del Proceso (MIUI)</Text>
        <Text style={styles.protocoloTexto}>
          1. En Opciones de Desarrollador de MIUI activa: {'\n'}
          <Text style={styles.resaltado}>"No conservar actividades"</Text> (Don't keep activities).{'\n'}
          2. Presiona "Tomar Foto con Cámara". Android destruirá la app para darle memoria a la cámara.{'\n'}
          3. Captura la foto y confirma. La app debe revivir, rescatar el resultado pendiente y registrarlo en SQLite.
        </Text>
      </View>

      {/* Métricas de almacenamiento */}
      <View style={styles.panelMetricas}>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>📦 Total evidencias en SQLite:</Text>
          <Text style={styles.metricaValor}>{metricas.totalArchivos} fotos</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>💾 Espacio físico en documentDirectory:</Text>
          <Text style={styles.metricaValor}>{totalMb} MB</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>🛡 Durabilidad:</Text>
          <Text style={[styles.metricaValor, styles.durabilidadOk]}>
            Paths.document (Sobrevive a limpieza de caché)
          </Text>
        </View>
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
            <Text style={styles.botonTexto}>📷 Tomar Foto Cámara</Text>
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

      {/* Controles de estrés §22.6 */}
      <View style={styles.botonesFila}>
        <TouchableOpacity
          style={[styles.botonAccion, styles.botonEstres]}
          onPress={ejecutarPruebaEstres20Fotos}
          disabled={procesando}
        >
          <Text style={styles.botonTexto}>🧪 Estrés: 20 Fotos (§22.6)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botonAccion, styles.botonLimpiar]}
          onPress={limpiarTodasLasFotos}
          disabled={procesando || fotos.length === 0}
        >
          <Text style={styles.botonTexto}>🧹 Limpiar ({fotos.length})</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.seccionTitulo}>
        Evidencias registradas ({fotos.length}) — SQLite files_local
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
  alertaRecuperacion: {
    backgroundColor: '#ecfdf5',
    borderColor: '#34d399',
    borderWidth: 2,
    borderRadius: TOKENS.radiusSm,
    padding: 14,
    marginBottom: 16,
  },
  alertaRecuperacionTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 4,
  },
  alertaRecuperacionTexto: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 18,
  },
  panelMetricas: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 12,
    marginBottom: 14,
  },
  metricaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricaEtiqueta: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    fontWeight: '600',
  },
  metricaValor: {
    fontSize: 12,
    color: TOKENS.ink,
    fontWeight: '700',
  },
  durabilidadOk: {
    color: '#059669',
  },
  botonesFila: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  botonAccion: {
    flex: 1,
    paddingVertical: 12,
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
  botonEstres: {
    backgroundColor: '#b45309',
    flex: 2,
  },
  botonLimpiar: {
    backgroundColor: '#dc2626',
    flex: 1.2,
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
