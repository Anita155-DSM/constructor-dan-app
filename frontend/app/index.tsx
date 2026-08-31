import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haySesionGuardada } from '../utils/api';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    (async () => {
      // Si ya inició sesión alguna vez en este teléfono, va directo al panel
      // (funciona aunque no haya internet).
      if (await haySesionGuardada()) { router.replace('/dashboard'); return; }
      setVerificando(false);
    })();
  }, []);

  if (verificando) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#EA580C" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="hard-hat" size={92} color="#FBBF24" style={styles.helmetIcon} />
        <View style={styles.accentBar} />

        <Text style={styles.title}>CONSTRUCTOR DAN</Text>
        <Text style={styles.subtitle}>Plataforma de Contratistas</Text>

        <TouchableOpacity style={styles.button} onPress={() => router.push('/login')} activeOpacity={0.85}>
          <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => router.push('/register')}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, styles.buttonSecondaryText]}>CREAR UNA CUENTA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center:    { justifyContent: 'center', alignItems: 'center' },
  content:   { flex: 1, width: '100%', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  helmetIcon: { marginBottom: 4 },
  accentBar: { height: 8, backgroundColor: '#FBBF24', borderRadius: 4, marginBottom: 24, width: 96 },
  title:     { fontSize: 28, fontWeight: '900', color: '#1F2937', textAlign: 'center', letterSpacing: 1, marginBottom: 8 },
  subtitle:  { fontSize: 17, color: '#6B7280', textAlign: 'center', marginBottom: 44, fontWeight: '500' },
  button: {
    backgroundColor: '#EA580C', paddingVertical: 20, paddingHorizontal: 40, borderRadius: 10,
    marginBottom: 16, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#EA580C' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  buttonSecondaryText: { color: '#EA580C' },
});
