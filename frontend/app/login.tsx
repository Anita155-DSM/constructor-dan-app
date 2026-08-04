import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE, guardarToken } from '../utils/api';

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
        // Guardar token si el backend lo devuelve en el body
        if (data.token) guardarToken(data.token);
        router.replace('/dashboard');
      } else {
        Alert.alert('Error', data.msg || 'Correo o contraseña incorrectos.');
      }
    } catch {
      Alert.alert('Sin conexión', 'Verificá tu conexión o que el backend desplegado esté activo.');
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
