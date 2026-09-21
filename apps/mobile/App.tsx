import React from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useBorradorStore } from './src/features/operaciones/model/use-borrador-store';

export default function App() {
  const borrador = useBorradorStore((state) => state.borrador);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>GAFER Saneamiento Ambiental</Text>
        <Text style={styles.subtitle}>Operaciones de Campo (Offline-First)</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.statusLabel}>
          Estado: {borrador ? `Inspección activa (${borrador.servicioId})` : 'Sin inspección iniciada'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1f4d3d',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#d4edda',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 15,
    color: '#333333',
  },
});
