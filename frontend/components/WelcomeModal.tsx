// components/WelcomeModal.tsx
// Mensaje de bienvenida que aparece UNA sola vez, la primera vez que se abre
// la app. Diseño grande y claro, cómodo para un adulto mayor.

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getString, setString } from '../utils/storage';

const K_VISTA = 'cd-bienvenida-vista:v1';

export default function WelcomeModal() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const vista = await getString(K_VISTA);
      if (!vista) setVisible(true);
    })();
  }, []);

  const cerrar = async () => {
    await setString(K_VISTA, '1');
    setVisible(false);
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={cerrar} transparent={false}>
      <View style={[s.fondo, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.cascoCirculo}>
            <MaterialCommunityIcons name="hard-hat" size={72} color="#1F2937" />
          </View>

          <Text style={s.titulo}>Constructor Dan</Text>
          <View style={s.barra} />

          <View style={s.tarjeta}>
            <Text style={s.parrafo}>
              Esta app se desarrolló para mi papá:
            </Text>
            <Text style={s.nombre}>Daniel Pérez</Text>
            <Text style={s.dedicatoria}>
              Te amo, pa. Sos grande.
            </Text>
            <Text style={s.firma}>Att. tu hija, Ana</Text>
          </View>

          <Text style={s.ayuda}>
            Podés usar la app aunque estés en el campo sin internet.
            Todo lo que cargues se guarda en el teléfono y se envía solo
            cuando volvés a tener señal.
          </Text>
        </ScrollView>

        <View style={[s.pie, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={s.boton} onPress={cerrar} activeOpacity={0.85} accessibilityRole="button">
            <Text style={s.botonTexto}>Empezar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo:  { flex: 1, backgroundColor: '#FFFBEB' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 },

  cascoCirculo: {
    width: 128, height: 128, borderRadius: 64, backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  titulo: { fontSize: 30, fontWeight: '900', color: '#1F2937', letterSpacing: 0.5, textAlign: 'center' },
  barra:  { width: 72, height: 6, borderRadius: 3, backgroundColor: '#EA580C', marginVertical: 18 },

  tarjeta: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 28, paddingHorizontal: 24,
    width: '100%', alignItems: 'center',
    borderWidth: 2, borderColor: '#FDE68A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  parrafo:     { fontSize: 19, color: '#374151', textAlign: 'center', lineHeight: 28 },
  nombre:      { fontSize: 26, fontWeight: '900', color: '#EA580C', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  dedicatoria: { fontSize: 22, fontWeight: '700', color: '#1F2937', textAlign: 'center', lineHeight: 32 },
  firma:       { fontSize: 18, color: '#6B7280', textAlign: 'center', marginTop: 14, fontStyle: 'italic' },

  ayuda: { fontSize: 16, color: '#92400E', textAlign: 'center', lineHeight: 24, marginTop: 24 },

  pie:   { paddingHorizontal: 24, paddingTop: 12, backgroundColor: '#FFFBEB', borderTopWidth: 1, borderTopColor: '#FDE68A' },
  boton: { backgroundColor: '#EA580C', paddingVertical: 20, borderRadius: 14, alignItems: 'center', elevation: 3 },
  botonTexto: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
});
