import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { validarTamanoC15 } from '../model/fotos-compresion';
import {
  CapturadorFotosPort,
  FotoCapturada,
  obtenerCapturadorFotos,
} from '../model/captura-fotos';

export interface GaleriaEvidenciasFotosProps {
  inspectionId: string;
  fotos: FotoEvidenciaDrt[];
  onFotosChange: (fotos: FotoEvidenciaDrt[]) => void;
  actorId?: string;
  archivosRepo?: ArchivosLocalRepository;
  capturador?: CapturadorFotosPort;
}

export const GaleriaEvidenciasFotos: React.FC<GaleriaEvidenciasFotosProps> = ({
  inspectionId,
  fotos,
  onFotosChange,
  actorId,
  archivosRepo,
  capturador,
}) => {
  const [procesando, setProcesando] = useState(false);
  const repo = useMemo(() => archivosRepo ?? new ArchivosLocalRepository(), [archivosRepo]);
  const capturadorActivo = useMemo(() => capturador ?? obtenerCapturadorFotos(), [capturador]);

  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;

  const formatearKBytes = (bytes: number) => {
    return `${Math.round(bytes / 1024)} KB`;
  };

  const procesarFotoCapturada = useCallback(
    async (capturada: FotoCapturada) => {
      const indice = fotosRef.current.length + 1;
      const nombreFinal = capturada.nombre || `Evidencia_${indice}.jpg`;

      const guardada = await repo.guardarFoto({
        inspectionId,
        nombre: nombreFinal,
        uri: capturada.uri,
        buffer: capturada.buffer,
        base64: capturada.base64,
        mimeType: capturada.mimeType || 'image/jpeg',
        actorId,
      });

      const nuevaFoto: FotoEvidenciaDrt = {
        id: guardada.file_id,
        nombre: nombreFinal,
        rutaLocalRelativa: guardada.local_path_relative,
        tamanoBytes: guardada.size_bytes,
        sha256: guardada.sha256,
        mimeType: guardada.mime_type,
        capturadaEn: guardada.captured_at,
        descripcion: `Evidencia de campo #${indice}`,
      };

      onFotosChange([...fotosRef.current, nuevaFoto]);
    },
    [actorId, inspectionId, onFotosChange, repo],
  );

  // Recuperar captura pendiente en Android si MainActivity fue destruida al usar cámara (§13.1.1)
  useEffect(() => {
    let montado = true;
    if (typeof capturadorActivo.recuperarCapturaPendiente !== 'function') {
      return;
    }

    (async () => {
      try {
        const pendiente = await capturadorActivo.recuperarCapturaPendiente?.();
        if (!montado || !pendiente) return;
        setProcesando(true);
        await procesarFotoCapturada(pendiente);
      } catch {
        // Evitar bloquear la pantalla al montar si no hay captura pendiente recuperable.
      } finally {
        if (montado) {
          setProcesando(false);
        }
      }
    })();

    return () => {
      montado = false;
    };
  }, [capturadorActivo, procesarFotoCapturada]);

  const handleCapturar = async (origen: 'CAMARA' | 'GALERIA') => {
    try {
      setProcesando(true);
      const capturada =
        origen === 'CAMARA'
          ? await capturadorActivo.capturarDesdeCamara()
          : await capturadorActivo.seleccionarDeGaleria();

      if (!capturada) {
        return;
      }

      await procesarFotoCapturada(capturada);
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : 'No se pudo capturar o procesar la fotografía.';
      Alert.alert('Error al adjuntar foto', mensaje);
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
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Evidencias Fotográficas (§13, C15)</Text>
          <Text style={styles.subtitulo}>
            Compresión local obligatoria a un máximo de 1 MB por imagen.
          </Text>
        </View>
        <View style={styles.grupoBotonesCaptura}>
          <TouchableOpacity
            testID="boton-capturar-camara"
            style={[styles.botonCapturar, procesando && { opacity: 0.6 }]}
            onPress={() => handleCapturar('CAMARA')}
            disabled={procesando}
          >
            <Text style={styles.textoBotonCapturar}>
              {procesando ? 'Procesando...' : '📷 Cámara'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="boton-seleccionar-galeria"
            style={[styles.botonGaleria, procesando && { opacity: 0.6 }]}
            onPress={() => handleCapturar('GALERIA')}
            disabled={procesando}
          >
            <Text style={styles.textoBotonGaleria}>🖼️ Galería</Text>
          </TouchableOpacity>
        </View>
      </View>

      {fotos.length === 0 ? (
        <View style={styles.vacioContainer}>
          <Text style={styles.vacioTexto}>
            No hay fotografías adjuntas. Use "Cámara" o "Galería" para registrar evidencias.
          </Text>
        </View>
      ) : (
        <View style={styles.listaFotos}>
          {fotos.map((foto, idx) => {
            const cumpleC15 = validarTamanoC15(foto.tamanoBytes);
            return (
              <View key={foto.id} testID={`tarjeta-foto-${foto.id}`} style={styles.tarjetaFoto}>
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
                        {
                          backgroundColor: cumpleC15 ? '#f0fdf4' : '#fef2f2',
                          borderColor: cumpleC15 ? '#86efac' : '#fca5a5',
                        },
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
                    <View
                      testID={`badge-c15-${foto.id}`}
                      style={[
                        styles.badgeC15,
                        !cumpleC15 && styles.badgeC15Invalido,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeC15Texto,
                          !cumpleC15 && styles.badgeC15TextoInvalido,
                        ]}
                      >
                        {cumpleC15 ? 'C15 VÁLIDO' : 'EXCEDE C15'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rutaFoto} numberOfLines={1}>
                    📁 {foto.rutaLocalRelativa}
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`boton-eliminar-foto-${foto.id}`}
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
  grupoBotonesCaptura: {
    flexDirection: 'row',
    gap: 6,
  },
  botonCapturar: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  textoBotonCapturar: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  botonGaleria: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  textoBotonGaleria: {
    color: '#1e293b',
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
  badgeC15Invalido: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  badgeC15Texto: {
    color: '#1d4ed8',
    fontSize: 8,
    fontWeight: '800',
  },
  badgeC15TextoInvalido: {
    color: '#b91c1c',
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
