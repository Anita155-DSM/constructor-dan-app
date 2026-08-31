import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE, guardarToken, haySesionGuardada, getUsuarioGuardado } from '../utils/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Falta información', 'Completá el correo y la contraseña.');
      return;
    }
    setCargando(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok && data.ok) {
        if (data.token) await guardarToken(data.token, data.usuario ?? null);
        router.replace('/dashboard');
      } else {
        Alert.alert('Error', data.msg || 'Correo o contraseña incorrectos.');
      }
    } catch {
      // Sin internet: si ya inició sesión antes en este teléfono, lo dejamos
      // entrar para seguir trabajando offline.
      const usuario = await getUsuarioGuardado<{ email?: string }>();
      const puedeEntrarOffline =
        (await haySesionGuardada()) &&
        (!usuario?.email || usuario.email.toLowerCase() === email.trim().toLowerCase());

      if (puedeEntrarOffline) {
        Alert.alert(
          'Sin internet',
          'Vas a entrar con la última sesión guardada. Podés trabajar normal; los datos se envían solos cuando vuelva la señal.',
          [{ text: 'Entrar', onPress: () => router.replace('/dashboard') }],
        );
      } else {
        Alert.alert(
          'Sin conexión',
          'No hay internet y todavía no iniciaste sesión en este teléfono. Conectate una vez para poder usar la app después sin señal.',
        );
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <View style={styles.accentBar} />
          <Text style={styles.title}>CONSTRUCTOR DAN</Text>
          <Text style={styles.subtitle}>Iniciar sesión</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!cargando}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu contraseña"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!cargando}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, cargando && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={cargando}
            activeOpacity={0.8}
          >
            {cargando
              ? <ActivityIndicator color="#FFFFFF" size="large" />
              : <Text style={styles.buttonText}>ENTRAR</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')} disabled={cargando} style={styles.linkButton}>
            <Text style={styles.linkText}>¿No tenés cuenta? Registrate aquí</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  formContainer: { paddingHorizontal: 24, paddingVertical: 40 },
  accentBar: { height: 8, backgroundColor: '#FBBF24', borderRadius: 4, marginBottom: 24, width: '40%', alignSelf: 'center' },
  title: { fontSize: 25, fontWeight: '900', color: '#1F2937', textAlign: 'center', letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#4B5563', textAlign: 'center', marginBottom: 36, fontWeight: '500' },
  inputGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 8, padding: 16, fontSize: 16, color: '#111827' },
  button: { backgroundColor: '#EA580C', paddingVertical: 18, borderRadius: 8, marginTop: 14, alignItems: 'center', elevation: 3 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  linkButton: { marginTop: 20 },
  linkText: { color: '#EA580C', fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
