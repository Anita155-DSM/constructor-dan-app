import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE } from '../utils/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleRegistro = async () => {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Falta información', 'Completá todos los campos.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'Mínimo 6 caracteres.');
      return;
    }

    setCargando(true);

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        router.replace('/login');
      } else {
        Alert.alert('Error', data.msg || 'No se pudo crear la cuenta.');
      }
    } catch (error) {
      Alert.alert(
        'Sin conexión',
        'No se pudo conectar al servidor. Verificá tu conexión o el backend desplegado.'
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <View style={styles.accentBar} />
          <Text style={styles.title}>CONSTRUCTOR DAN</Text>
          <Text style={styles.subtitle}>Crear cuenta</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Daniel Pérez"
              placeholderTextColor="#9CA3AF"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              editable={!cargando}
              returnKeyType="next"
            />
          </View>

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
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!cargando}
              returnKeyType="done"
              onSubmitEditing={handleRegistro}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, cargando && styles.buttonDisabled]}
            onPress={handleRegistro}
            disabled={cargando}
            activeOpacity={0.8}
          >
            {cargando ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Text style={styles.buttonText}>CREAR MI CUENTA</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/login')}
            disabled={cargando}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>¿Ya tenés cuenta? Iniciá sesión aquí</Text>
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
  accentBar: {
    height: 8,
    backgroundColor: '#FBBF24',
    borderRadius: 4,
    marginBottom: 24,
    width: '40%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 36,
    fontWeight: '500',
  },
  inputGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#EA580C',
    paddingVertical: 18,
    borderRadius: 8,
    marginTop: 14,
    alignItems: 'center',
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  linkButton: { marginTop: 20 },
  linkText: { color: '#EA580C', fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
