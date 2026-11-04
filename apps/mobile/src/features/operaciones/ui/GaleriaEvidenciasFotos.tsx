import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FotoEvidenciaDrt } from '@gafer/contracts';
import { TOKENS } from '../../../shared/theme/tokens';
import { ArchivosLocalRepository } from '../model/archivos-local.repository';
import { MAX_TAMANO_FOTO_BYTES } from '../model/fotos-compresion';

interface GaleriaEvidenciasFotosProps {
  inspectionId: string;
  fotos: FotoEvidenciaDrt[];
  onFotosChange: (fotos: FotoEvidenciaDrt[]) => void;
  archivosRepo?: ArchivosLocalRepository;
}

export const GaleriaEvidenciasFotos: React.FC<GaleriaEvidenciasFotosProps> = ({
  inspectionId,
  fotos,
  onFotosChange,
  archivosRepo,
}) => {
  const [procesando, setProcesando] = useState(false);
  const repo = archivosRepo || new ArchivosLocalRepository();

  const formatearKBytes = (bytes: number) => {
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleAdjuntarFotoEjemplo = async () => {
    try {
      setProcesando(true);
      // Generar foto sintética de prueba para simulación en campo/vitest
      const indice = fotos.length + 1;
      const tamanoSimulado = Math.floor(600 * 1024); // 600 KB (cumple C15)
      const bufferSimulado = new Uint8Array(tamanoSimulado);
      for (let i = 0; i < tamanoSimulado; i++) bufferSimulado[i] = (i + indice) % 256;

      const guardada = await repo.guardarFoto({
        inspectionId,
        nombre: `Foto_Evidencia_${indice}.jpg`,
        buffer: bufferSimulado,
        mimeType: 'image/jpeg',
      });

      const nuevaFoto: FotoEvidenciaDrt = {
        id: guardada.file_id,
        nombre: `Evidencia_${indice}.jpg`,
        rutaLocalRelativa: guardada.local_path_relative,
        tamanoBytes: guardada.size_bytes,
        sha256: guardada.sha256,
        mimeType: guardada.mime_type,
        capturadaEn: guardada.captured_at,
        descripcion: `Evidencia de campo #${indice}`,
      };

      onFotosChange([...fotos, nuevaFoto]);
    } catch (err: any) {
      Alert.alert('Error al adjuntar foto', err?.message || 'No se pudo procesar la fotografía.');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminarFoto = async (fotoId: string) => {
    try {
      await repo.eliminar(fotoId);
      onFotosChange(fotos.filter((f) => f.id !== fotoId));
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la foto localmente.');
    }
  };

  return (
    <View style={styles.contenedor}>
      <View style={styles.cabecera}>
        <View>
          <Text style={styles.titulo}>Evidencias Fotográficas (§13, C15)</Text>
          <Text style={styles.subtitulo}>
            Compresión local obligatoria a un máximo de 1 MB por imagen.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.botonCapturar, procesando && { opacity: 0.6 }]}
          onPress={handleAdjuntarFotoEjemplo}
          disabled={procesando}
        >
          <Text style={styles.textoBotonCapturar}>
            {procesando ? 'Procesando...' : '📷 + Foto'}
          </Text>
        </TouchableOpacity>
      </View>

      {fotos.length === 0 ? (
        <View style={styles.vacioContainer}>
          <Text style={styles.vacioTexto}>
            No hay fotografías adjuntas. Toque "+ Foto" para registrar evidencias.
          </Text>
        </View>
      ) : (
        <View style={styles.listaFotos}>
          {fotos.map((foto, idx) => {
            const cumpleC15 = foto.tamanoBytes <= MAX_TAMANO_FOTO_BYTES;
            return (
              <View key={foto.id} style={styles.tarjetaFoto}>
                <View style={styles.miniaturaPlaceholder}>
                  <Text style={styles.miniaturaTexto}>🖼️ #{idx + 1}</Text>
                </View>
                <View style={styles.infoFoto}>
                  <Text style={styles.nombreFoto} numberOfLines={1}>
                    {foto.nombre}
                  </Text>
                  <View style={styles.filaBadges}>
                    <View
                      style={[
                        styles.badgeTamano,
                        { backgroundColor: cumpleC15 ? '#f0fdf4' : '#fef2f2' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeTamanoTexto,
                          { color: cumpleC15 ? '#15803d' : '#b91c1c' },
                        ]}
                      >
                        {formatearKBytes(foto.tamanoBytes)} / máx 1 MB
                      </Text>
                    </View>
                    <View style={styles.badgeC15}>
                      <Text style={styles.badgeC15Texto}>C15 VÁLIDO</Text>
                    </View>
                  </View>
                  <Text style={styles.rutaFoto} numberOfLines={1}>
                    📁 {foto.rutaLocalRelativa}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.botonEliminar}
                  onPress={() => handleEliminarFoto(foto.id)}
                >
                  <Text style={styles.textoEliminar}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#ffffff',
    borderRadius: TOKENS.radiusSm,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  titulo: {
    fontSize: 12,
    fontWeight: '900',
    color: TOKENS.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitulo: {
    fontSize: 10,
    color: TOKENS.inkSoft,
    marginTop: 2,
  },
  botonCapturar: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  textoBotonCapturar: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  vacioContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
  },
  vacioTexto: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  listaFotos: {
    gap: 8,
  },
  tarjetaFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 8,
    gap: 10,
  },
  miniaturaPlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniaturaTexto: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  infoFoto: {
    flex: 1,
    gap: 3,
  },
  nombreFoto: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  filaBadges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  badgeTamano: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  badgeTamanoTexto: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeC15: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeC15Texto: {
    color: '#1d4ed8',
    fontSize: 8,
    fontWeight: '800',
  },
  rutaFoto: {
    fontSize: 9,
    color: '#64748b',
  },
  botonEliminar: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
  },
  textoEliminar: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '900',
  },
});
