import React, { useState } from 'react';
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
import { TOKENS } from '../../../shared/theme/tokens';

type PestanaSpike = 'CAMARA' | 'PLANO' | 'CRITERIOS';

interface Props {
  onVolver: () => void;
}

export const SpikeLaboratorioScreen: React.FC<Props> = ({ onVolver }) => {
  const [pestana, setPestana] = useState<PestanaSpike>('PLANO');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {/* Encabezado */}
      <View style={styles.encabezado}>
        <TouchableOpacity style={styles.botonVolver} onPress={onVolver}>
          <Text style={styles.volverTexto}>← Volver a Agenda</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>🔬 Laboratorio Spike Técnico</Text>
        <Text style={styles.subtituloHeader}>
          Validación de Hardware en Campo (Guía Rev 2 §22)
        </Text>
      </View>

      {/* Selector de Pestañas */}
      <View style={styles.pestanasFila}>
        <TouchableOpacity
          style={[styles.pestana, pestana === 'PLANO' && styles.pestanaActiva]}
          onPress={() => setPestana('PLANO')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'PLANO' && styles.pestanaTextoActivo]}
          >
            🗺️ Plano 100 Skia
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pestana, pestana === 'CAMARA' && styles.pestanaActiva]}
          onPress={() => setPestana('CAMARA')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'CAMARA' && styles.pestanaTextoActivo]}
          >
            📷 Cámara & Memoria
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pestana, pestana === 'CRITERIOS' && styles.pestanaActiva]}
          onPress={() => setPestana('CRITERIOS')}
        >
          <Text
            style={[styles.pestanaTexto, pestana === 'CRITERIOS' && styles.pestanaTextoActivo]}
          >
            📋 Compuerta §22
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido según pestaña */}
      <View style={styles.contenido}>
        {pestana === 'PLANO' && <SpikePlanoSkiaSeccion />}
        {pestana === 'CAMARA' && <SpikeCamaraSeccion />}
        {pestana === 'CRITERIOS' && (
          <ScrollView style={styles.criteriosContenedor}>
            <Text style={styles.criteriosTitulo}>
              Compuerta de Decisión (Guía Rev 2 §22.7)
            </Text>
            <Text style={styles.criteriosDescripcion}>
              Medir en el Redmi Note 9 de 4 GB bajo MIUI 13. Registrar datos reales, no impresiones.
            </Text>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>1. Fluidez del Plano Murino</Text>
              <Text style={styles.criterioDetalle}>
                • Pan & zoom continuos durante 2 minutos con 100 estaciones.{'\n'}
                • No debe congelarse la UI ni generar ANR.{'\n'}
                • Meta: Sensación fluida sin hipo en el hilo UI.
              </Text>
            </View>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>2. Resistencia a Muerte de Proceso</Text>
              <Text style={styles.criterioDetalle}>
                • Activar "No conservar actividades" en Ajustes de desarrollador.{'\n'}
                • Tomar fotos con la cámara nativa.{'\n'}
                • Al regresar a la app, la foto debe estar guardada en `files_local` y el borrador intacto.
              </Text>
            </View>

            <View style={styles.tarjetaCriterio}>
              <Text style={styles.criterioNombre}>3. Durabilidad SQLite (Ya Blindado)</Text>
              <Text style={styles.criterioDetalle}>
                • Iniciar inspección, forzar detención de la app desde ajustes.{'\n'}
                • Reabrir: la base SQLite con WAL y synchronous=FULL restaura todo.
              </Text>
            </View>

            <View style={styles.cajaDecision}>
              <Text style={styles.decisionTitulo}>Matriz de Decisión:</Text>
              <Text style={styles.decisionTexto}>
                ✅ <Text style={styles.negrita}>Aprobado:</Text> Ambos pasan fluidos $\rightarrow$ Fase 1 en React Native.{'\n\n'}
                ⚠️ <Text style={styles.negrita}>Plan B:</Text> Falla solo background o cámara $\rightarrow$ Módulo Kotlin nativo para esa pieza.{'\n\n'}
                🛑 <Text style={styles.negrita}>Plan C:</Text> Falla Skia y memoria $\rightarrow$ Migración a Android nativo (conservando backend y contratos).
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
    backgroundColor: TOKENS.marca,
  },
  encabezado: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: TOKENS.marca,
  },
  botonVolver: {
    marginBottom: 6,
  },
  volverTexto: {
    color: '#d4edda',
    fontSize: 12,
    fontWeight: '700',
  },
  tituloHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtituloHeader: {
    fontSize: 11,
    color: '#d4edda',
    marginTop: 2,
  },
  pestanasFila: {
    flexDirection: 'row',
    backgroundColor: '#1b4332',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  pestana: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  pestanaActiva: {
    borderBottomColor: TOKENS.hoja,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pestanaTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a7f3d0',
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
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 4,
  },
  criteriosDescripcion: {
    fontSize: 12,
    color: TOKENS.inkSoft,
    marginBottom: 16,
  },
  tarjetaCriterio: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: TOKENS.radiusSm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  criterioNombre: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 6,
  },
  criterioDetalle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  cajaDecision: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 14,
    marginTop: 8,
    marginBottom: 32,
  },
  decisionTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 8,
  },
  decisionTexto: {
    fontSize: 12,
    color: '#14532d',
    lineHeight: 20,
  },
  negrita: {
    fontWeight: '800',
  },
});
