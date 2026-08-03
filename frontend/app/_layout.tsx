import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="nueva" />

      {/* ✅ Rutas del módulo obras — la carpeta obras/ y sus sub-rutas */}
      <Stack.Screen name="obras/[id]" />
      <Stack.Screen name="obras/[id]/presupuesto" />
      <Stack.Screen name="obras/[id]/nomina" />
      <Stack.Screen name="obras/[id]/saldos" />
    </Stack>
  );
}
