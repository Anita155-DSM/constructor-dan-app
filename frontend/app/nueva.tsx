import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../utils/api';

type TipoObra = 'normal' | 'galpon' | 'refaccion';

const TIPOS = [
  { valor: 'normal',    etiqueta: 'Obra común',  descripcion: 'Precio estándar por m²' },
  { valor: 'galpon',    etiqueta: 'Galpón',       descripcion: 'Reserva 20% herramientas' },
  { valor: 'refaccion', etiqueta: 'Refacción',    descripcion: 'Departamentos, reforma, etc.' },
];

export default function NuevaObraScreen() {
  const router = useRouter();
  const [nombreCliente, setNombreCliente] = useState('');
  const [direccion, setDireccion]         = useState('');
  const [tipo, setTipo]                   = useState<TipoObra>('normal');
  const [notas, setNotas]                 = useState('');
  const [cargando, setCargando]           = useState(false);

  const handleGuardar = async () => {
    if (!nombreCliente.trim()) {
      Alert.alert('Falta el cliente', 'Escribí el nombre del cliente o patrón.');
      return;
    }
    setCargando(true);
    try {
      const res = await apiFetch('/obras', {
        method: 'POST',
        body: JSON.stringify({
          nombre_cliente:  nombreCliente.trim(),
          direccion:       direccion.trim() || null,
          tipo,
          fecha_inicio:    new Date().toISOString().split('T')[0],
          notas:           notas.trim() || null,
        }),
      });

      if (res.status === 401) { router.replace('/login'); return; }

      const data = await res.json();
      if (res.ok) {
        // ✅ FIX #1: redirige directo sin Alert intermedio que falla en Expo Web
        router.replace('/dashboard');
      } else {
        Alert.alert('Error', data.error || 'No se pudo guardar la obra.');
      }
    } catch {
      Alert.alert('Sin conexión', 'Verificá que el servidor esté corriendo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/dashboard')} style={s.backBtn}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nueva obra</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.form}>

          <View style={s.field}>
            <Text style={s.label}>Cliente / Patrón</Text>
            <TextInput
              style={s.input}
              placeholder="Ej: Señor Ramírez"
              placeholderTextColor="#9CA3AF"
              value={nombreCliente}
              onChangeText={setNombreCliente}
              autoCapitalize="words"
              editable={!cargando}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Dirección <Text style={s.opcional}>(opcional)</Text></Text>
            <TextInput
              style={s.input}
              placeholder="Ej: Av. San Martín 452"
              placeholderTextColor="#9CA3AF"
              value={direccion}
              onChangeText={setDireccion}
              autoCapitalize="words"
              editable={!cargando}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Tipo de obra</Text>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t.valor}
                style={[s.tipoBtn, tipo === t.valor && s.tipoBtnActivo]}
                onPress={() => setTipo(t.valor as TipoObra)}
                disabled={cargando}
                activeOpacity={0.8}
              >
                <View style={[s.radio, tipo === t.valor && s.radioActivo]}>
                  {tipo === t.valor && <View style={s.radioDot} />}
                </View>
                <View>
                  <Text style={[s.tipoEtiqueta, tipo === t.valor && s.tipoEtiquetaActiva]}>{t.etiqueta}</Text>
                  <Text style={s.tipoDesc}>{t.descripcion}</Text>
                </View>
                {t.valor === 'galpon' && tipo === t.valor && (
                  <View style={s.reservaBadge}><Text style={s.reservaText}>20% reserva</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Notas <Text style={s.opcional}>(opcional)</Text></Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Ej: Empezamos por la planta baja..."
              placeholderTextColor="#9CA3AF"
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!cargando}
            />
          </View>

          <TouchableOpacity
            style={[s.btnGuardar, cargando && s.btnDisabled]}
            onPress={handleGuardar}
            disabled={cargando}
            activeOpacity={0.85}
          >
            {cargando
              ? <ActivityIndicator color="#FFFFFF" size="large" />
              : <Text style={s.btnGuardarText}>GUARDAR OBRA</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F3F4F6' },
  header:     { backgroundColor: '#1F2937', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:{ fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  backBtn:    { paddingVertical: 4 },
  backText:   { color: '#FBBF24', fontSize: 15, fontWeight: '600' },
  scroll:     { flex: 1 },
  form:       { padding: 16 },
  field:      { marginBottom: 24 },
  label:      { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 6 },
  opcional:   { fontSize: 13, fontWeight: '400', color: '#9CA3AF' },
  input:      { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 10, padding: 16, fontSize: 16, color: '#111827' },
  inputMulti: { minHeight: 90, paddingTop: 14 },
  tipoBtn:    { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipoBtnActivo: { borderColor: '#EA580C', backgroundColor: '#FFF7ED' },
  radio:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioActivo:{ borderColor: '#EA580C' },
  radioDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA580C' },
  tipoEtiqueta:      { fontSize: 15, fontWeight: '700', color: '#374151' },
  tipoEtiquetaActiva:{ color: '#EA580C' },
  tipoDesc:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  reservaBadge: { marginLeft: 'auto', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  reservaText:  { fontSize: 11, fontWeight: '700', color: '#92400E' },
  btnGuardar:     { backgroundColor: '#EA580C', paddingVertical: 20, borderRadius: 12, alignItems: 'center', elevation: 3 },
  btnDisabled:    { opacity: 0.6 },
  btnGuardarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});
