import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="hard-hat" size={84} color="#FBBF24" style={styles.helmetIcon} />
        <View style={styles.accentBar} />
        
        <Text style={styles.title}>CONSTRUCTOR DAN</Text>
        <Text style={styles.subtitle}>Plataforma de Contratistas</Text>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.buttonText}>REGISTRARSE</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => router.push('/login')}
        >
          <Text style={[styles.buttonText, styles.buttonSecondaryText]}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  helmetIcon: {
    marginBottom: 0,
  },
  accentBar: {
    height: 8,
    backgroundColor: '#FBBF24',
    borderRadius: 4,
    marginBottom: 24,
    width: '40%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 48,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#EA580C',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EA580C',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonSecondaryText: {
    color: '#EA580C',
  },
});