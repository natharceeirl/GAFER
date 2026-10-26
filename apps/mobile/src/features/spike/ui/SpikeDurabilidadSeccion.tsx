import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { obtenerBaseDeDatos, SqliteDatabasePort } from '../../../shared/db/sqlite';
import { TOKENS } from '../../../shared/theme/tokens';

export const SpikeDurabilidadSeccion: React.FC = () => {
  const [procesando, setProcesando] = useState(false);
  const [conteoOutbox, setConteoOutbox] = useState(0);
  const [conteoBorradores, setConteoBorradores] = useState(0);
  const [conteoArchivos, setConteoArchivos] = useState(0);
  const [versionEsquema, setVersionEsquema] = useState(0);
  const [ultimoResultado, setUltimoResultado] = useState<string | null>(null);

  const db: SqliteDatabasePort = obtenerBaseDeDatos();

  const cargarEstadisticas = useCallback(async () => {
    try {
      const outbox = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM sync_outbox;',
      );
      setConteoOutbox(outbox?.count ?? 0);

      const borradores = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM borradores_inspeccion;',
      );
      setConteoBorradores(borradores?.count ?? 0);

      const archivos = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM files_local;',
      );
      setConteoArchivos(archivos?.count ?? 0);

      const version = await db.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version;',
      );
      setVersionEsquema(version?.user_version ?? 0);
    } catch (e: any) {
      console.warn('Error cargando estadísticas SQLite:', e);
    }
  }, [db]);

  useEffect(() => {
    cargarEstadisticas();
  }, [cargarEstadisticas]);

  // 1. Inserción Masiva en Transacción Exclusiva con WAL y synchronous=FULL (§5.5 y §22.2)
  const ejecutarInsercionMasivaOutbox = async () => {
    try {
      setProcesando(true);
      const inicio = performance.now();
      const lote = 50;

      await db.withExclusiveTransactionAsync(async (tx) => {
        for (let i = 1; i <= lote; i++) {
          const opId = `op-estres-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
          await tx.runAsync(
            `INSERT OR REPLACE INTO sync_outbox (
              operation_id,
              device_id,
              user_id,
              aggregate_type,
              aggregate_id,
              operation_type,
              base_version,
              payload_kind,
              changed_fields_json,
              payload_json,
              aggregate_seq,
              priority,
              depends_on_operation_id,
              created_at_local,
              attempt_count,
              last_attempt_at,
              next_retry_at,
              status,
              last_error_code,
              last_error_message_sanitized
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, 0, NULL, NULL, 'PENDING', NULL, NULL);`,
            [
              opId,
              'redmi-note9-hardware-id',
              'tecnico-spike-id',
              'STATION_RECORD',
              `estacion-${i}`,
              'UPSERT_FIELDS',
              1,
              'PATCH',
              JSON.stringify({ cebo_consumido_pct: i * 2, tipo_trampa: 'CEBADERO' }),
              i,
              'HIGH',
              new Date().toISOString(),
            ],
          );
        }
      });

      const duracion = (performance.now() - inicio).toFixed(1);
      setUltimoResultado(
        `✅ Transacción OK: ${lote} operaciones registradas en ${duracion} ms en memoria flash con WAL + fsync completo.`,
      );
      await cargarEstadisticas();
    } catch (error: any) {
      Alert.alert('Fallo en transacción masiva', error.message);
    } finally {
      setProcesando(false);
    }
  };

  // 2. Verificación de Integridad de la Base de Datos (PRAGMA integrity_check)
  const verificarIntegridadHardware = async () => {
    try {
      setProcesando(true);
      const res = await db.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check;',
      );
      const estado = res?.integrity_check ?? 'desconocido';
      if (estado === 'ok') {
        setUltimoResultado('🛡 PRAGMA integrity_check = OK. Sin páginas corruptas en el chip eMMC.');
      } else {
        setUltimoResultado(`⚠️ PRAGMA integrity_check devolvió: ${estado}`);
      }
    } catch (error: any) {
      Alert.alert('Error en chequeo de integridad', error.message);
    } finally {
      setProcesando(false);
    }
  };

  // 3. Forzar Checkpoint de WAL al archivo principal .db
  const ejecutarWalCheckpoint = async () => {
    try {
      setProcesando(true);
      await db.execAsync('PRAGMA wal_checkpoint(PASSIVE);');
      setUltimoResultado('💾 PRAGMA wal_checkpoint(PASSIVE) ejecutado. Páginas de log fusionadas a disco.');
    } catch (error: any) {
      Alert.alert('Error en checkpoint WAL', error.message);
    } finally {
      setProcesando(false);
    }
  };

  // 4. Limpiar operaciones de prueba
  const limpiarOutboxSpike = async () => {
    try {
      setProcesando(true);
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync("DELETE FROM sync_outbox WHERE device_id = 'redmi-note9-hardware-id';");
      });
      setUltimoResultado('🧹 Operaciones de prueba del spike eliminadas.');
      await cargarEstadisticas();
    } catch (error: any) {
      Alert.alert('Error al limpiar outbox', error.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <ScrollView style={styles.contenedor}>
      <View style={styles.cajaProtocolo}>
        <Text style={styles.protocoloTitulo}>⚡ Pregunta #1 y #2 (§22.2): Durabilidad e Idempotencia</Text>
        <Text style={styles.protocoloTexto}>
          1. Genera 50 operaciones transaccionales para medir tiempo de commit en flash.{'\n'}
          2. Fuerza el cierre de la app desde la lista de apps recientes de MIUI.{'\n'}
          3. Al reabrir, comprueba que el outbox mantiene exactamente las 50 operaciones sin corrupción.
        </Text>
      </View>

      {/* Métricas de Base de Datos */}
      <View style={styles.panelMetricas}>
        <Text style={styles.panelTitulo}>📊 Estado Físico de SQLite (WAL + synchronous=FULL)</Text>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>Versión de Esquema (user_version):</Text>
          <Text style={styles.metricaValor}>v{versionEsquema}</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>Operaciones en sync_outbox:</Text>
          <Text style={styles.metricaValor}>{conteoOutbox}</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>Borradores activos:</Text>
          <Text style={styles.metricaValor}>{conteoBorradores}</Text>
        </View>
        <View style={styles.metricaFila}>
          <Text style={styles.metricaEtiqueta}>Archivos en files_local:</Text>
          <Text style={styles.metricaValor}>{conteoArchivos}</Text>
        </View>
      </View>

      {ultimoResultado && (
        <View style={styles.cajaResultado}>
          <Text style={styles.resultadoTexto}>{ultimoResultado}</Text>
        </View>
      )}

      {/* Botones de Pruebas de Estrés */}
      <View style={styles.accionesColumna}>
        <TouchableOpacity
          style={[styles.botonAccion, styles.botonPrimario]}
          onPress={ejecutarInsercionMasivaOutbox}
          disabled={procesando}
        >
          {procesando ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.botonTexto}>📝 Insertar 50 Ops en Transacción Exclusiva</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botonAccion, styles.botonSecundario]}
          onPress={verificarIntegridadHardware}
          disabled={procesando}
        >
          <Text style={styles.botonTexto}>🛡 Ejecutar PRAGMA integrity_check</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botonAccion, styles.botonSecundario]}
          onPress={ejecutarWalCheckpoint}
          disabled={procesando}
        >
          <Text style={styles.botonTexto}>💾 Forzar Checkpoint de WAL a Disco</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botonAccion, styles.botonLimpiar]}
          onPress={limpiarOutboxSpike}
          disabled={procesando || conteoOutbox === 0}
        >
          <Text style={styles.botonTexto}>🧹 Limpiar Operaciones de Prueba</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  cajaProtocolo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 12,
    marginBottom: 14,
  },
  protocoloTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 6,
  },
  protocoloTexto: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 18,
  },
  panelMetricas: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 12,
    marginBottom: 12,
  },
  panelTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.ink,
    marginBottom: 8,
  },
  metricaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricaEtiqueta: {
    fontSize: 12,
    color: TOKENS.inkSoft,
  },
  metricaValor: {
    fontSize: 12,
    color: TOKENS.ink,
    fontWeight: '700',
  },
  cajaResultado: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: TOKENS.radiusSm,
    padding: 10,
    marginBottom: 12,
  },
  resultadoTexto: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  accionesColumna: {
    gap: 10,
    marginBottom: 32,
  },
  botonAccion: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: TOKENS.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPrimario: {
    backgroundColor: TOKENS.marca,
  },
  botonSecundario: {
    backgroundColor: '#334155',
  },
  botonLimpiar: {
    backgroundColor: '#dc2626',
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
