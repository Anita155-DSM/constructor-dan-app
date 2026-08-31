import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="nueva" />

      {/* Rutas del módulo obras */}
      <Stack.Screen name="obras/[id]" />
      <Stack.Screen name="obras/[id]/presupuesto" />
      <Stack.Screen name="obras/[id]/nomina" />
      <Stack.Screen name="obras/[id]/saldos" />
    </Stack>
  );
}
