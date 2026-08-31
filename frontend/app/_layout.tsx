import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import OfflineBanner from '../components/OfflineBanner';
import WelcomeModal from '../components/WelcomeModal';
import { initSesion, iniciarVigilanciaRed } from '../utils/api';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    (async () => {
      await initSesion();          // carga token/usuario guardados
      iniciarVigilanciaRed();      // vigila la conexión y sincroniza al volver
      setListo(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  if (!listo) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: '#1F2937' }}>
        <OfflineBanner />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F3F4F6' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="register" />
            <Stack.Screen name="login" />
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="nueva" />
            <Stack.Screen name="obras/[id]" />
            <Stack.Screen name="obras/[id]/presupuesto" />
            <Stack.Screen name="obras/[id]/nomina" />
            <Stack.Screen name="obras/[id]/saldos" />
          </Stack>
        </View>
        <WelcomeModal />
      </View>
    </SafeAreaProvider>
  );
}
