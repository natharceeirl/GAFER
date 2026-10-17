import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SpikeCamaraSeccion } from './SpikeCamaraSeccion';
import { SpikePlanoSkiaSeccion } from './SpikePlanoSkiaSeccion';
import { SpikeDurabilidadSeccion } from './SpikeDurabilidadSeccion';
import { obtenerBaseDeDatos } from '../../../shared/db/sqlite';
import { TOKENS } from '../../../shared/theme/tokens';

type PestanaSpike = 'PLANO' | 'CAMARA' | 'DURABILIDAD' | 'CRITERIOS';

interface Props {
  onVolver: () => void;
}

export const SpikeLaboratorioScreen: React.FC<Props> = ({ onVolver }) => {
  const [pestana, setPestana] = useState<PestanaSpike>('PLANO');

  useEffect(() => {
    // Registrar que el usuario está dentro del laboratorio en SQLite
    // para recuperar la vista ante muerte forzada del proceso
    const marcarActivo = async () => {
      try {
        const db = obtenerBaseDeDatos();
        await db.runAsync(
          `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) 
           VALUES ('spike_activo', 'true', ?);`,
          [new Date().toISOString()],
        );
      } catch {
        // En caso de que la db esté en inicialización
      }
    };
    marcarActivo();
  }, []);

  const handleVolver = async () => {
    try {
      const db = obtenerBaseDeDatos();
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) 
         VALUES ('spike_activo', 'false', ?);`,
        [new Date().toISOString()],
      );
    } catch {
      // Ignorar
    }
    onVolver();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {/* Encabezado */}
      <View style={styles.encabezado}>
        <TouchableOpacity style={styles.botonVolver} onPress={handleVolver}>
          <Text style={styles.volverTexto}>← Volver a Agenda</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>🔬 Laboratorio Spike Técnico</Text>
        <Text style={styles.subtituloHeader}>
          Validación de Hardware en Campo (Guía Rev 2 §22)
        </Text>
      </View>

      {/* Selector de Pestañas (4 áreas de riesgo de §22.2) */}
      <View style={styles.pestanasFila}>
        <TouchableOpacity
          style={[styles.pestana, pestana === 'PLANO' && styles.pestanaActiva]}
          onPress={() => setPestana('PLANO')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'PLANO' && styles.pestanaTextoActivo]}
          >
            🗺️ Plano 100
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pestana, pestana === 'CAMARA' && styles.pestanaActiva]}
          onPress={() => setPestana('CAMARA')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'CAMARA' && styles.pestanaTextoActivo]}
          >
            📷 Cámara & 20F
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pestana, pestana === 'DURABILIDAD' && styles.pestanaActiva]}
          onPress={() => setPestana('DURABILIDAD')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'DURABILIDAD' && styles.pestanaTextoActivo]}
          >
            ⚡ Outbox & WAL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pestana, pestana === 'CRITERIOS' && styles.pestanaActiva]}
          onPress={() => setPestana('CRITERIOS')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'CRITERIOS' && styles.pestanaTextoActivo]}
          >
            📋 Compuerta
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido según pestaña */}
      <View style={styles.contenido}>
        {pestana === 'PLANO' && <SpikePlanoSkiaSeccion />}
        {pestana === 'CAMARA' && <SpikeCamaraSeccion />}
        {pestana === 'DURABILIDAD' && <SpikeDurabilidadSeccion />}
        {pestana === 'CRITERIOS' && (
          <ScrollView style={styles.criteriosContenedor}>
            <Text style={styles.criteriosTitulo}>
              Compuerta de Decisión Oficial (Guía Rev 2 §22.7)
            </Text>
            <Text style={styles.criteriosDescripcion}>
              Medición estricta en el Redmi Note 9 de 4 GB bajo MIUI 13. Criterios no negociables
              para autorizar o descartar React Native en la Fase 1:
            </Text>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>1. Plano Skia (100 Estaciones)</Text>
              <Text style={styles.criterioDetalle}>
                • Probar pan y zoom continuo en la pestaña 🗺️ Plano 100.{'\n'}
                • Comprobar el contador de FPS en vivo en pantalla.{'\n'}
                • <Text style={styles.negrita}>Aprobado:</Text> 55 a 60 FPS estables con las 100 estaciones y el plano industrial de fondo.
              </Text>
            </View>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>2. Resistencia a Muerte de Proceso de Android</Text>
              <Text style={styles.criterioDetalle}>
                • Activar "No conservar actividades" en opciones de desarrollador.{'\n'}
                • Tomar una foto con la cámara nativa.{'\n'}
                • Comprobar que al regresar, la app reviva sin pantalla blanca, recupere la foto vía getPendingResultAsync() y la asegure en SQLite.
              </Text>
            </View>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>3. Estrés de 20 Fotos en Memoria (§22.6)</Text>
              <Text style={styles.criterioDetalle}>
                • Presionar "Generar 20 Fotos de Estrés" en la pestaña 📷 Cámara.{'\n'}
                • Alternar entre el plano de 100 estaciones y las 20 fotos.{'\n'}
                • <Text style={styles.negrita}>Criterio de Fallo:</Text> Cierre por OOM o ANR activa el Plan C (migración a nativo).
              </Text>
            </View>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>4. Durabilidad Outbox y Checkpoint WAL</Text>
              <Text style={styles.criterioDetalle}>
                • Insertar 50 operaciones transaccionales en ⚡ Outbox & WAL.{'\n'}
                • Forzar cierre con force-stop o swiping en recientes.{'\n'}
                • Al reabrir, verificar que PRAGMA integrity_check devuelve OK y las 50 operaciones siguen intactas.
              </Text>
            </View>

            <View style={styles.cajaDecision}>
              <Text style={styles.decisionTitulo}>Matriz de Decisión (§22.7):</Text>
              <Text style={styles.decisionTexto}>
                ✅ <Text style={styles.negrita}>Aprobado:</Text> Pasan los 4 criterios $\rightarrow$ Autoriza Fase 1 en React Native.{'\n\n'}
                ⚠️ <Text style={styles.negrita}>Plan B Parcial:</Text> Falla solo background o cámara $\rightarrow$ Módulo Kotlin nativo dentro de RN.{'\n\n'}
                🛑 <Text style={styles.negrita}>Plan C:</Text> Falla Skia o se producen cierres por memoria $\rightarrow$ Migración a Android nativo con Jetpack Compose y Room (conservando contratos, API y sync protocol).
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  encabezado: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  botonVolver: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 6,
  },
  volverTexto: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  tituloHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtituloHeader: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  pestanasFila: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  pestana: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pestanaActiva: {
    backgroundColor: TOKENS.marca,
  },
  pestanaTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  pestanaTextoActivo: {
    color: '#ffffff',
  },
  contenido: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  criteriosContenedor: {
    flex: 1,
    padding: 16,
  },
  criteriosTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 4,
  },
  criteriosDescripcion: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    marginBottom: 16,
    lineHeight: 18,
  },
  tarjetaCriterio: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  criterioNombre: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 4,
  },
  criterioDetalle: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
  },
  cajaDecision: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 12,
    marginTop: 6,
    marginBottom: 32,
  },
  decisionTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 6,
  },
  decisionTexto: {
    fontSize: 11,
    color: '#14532d',
    lineHeight: 18,
  },
  negrita: {
    fontWeight: '800',
  },
});
