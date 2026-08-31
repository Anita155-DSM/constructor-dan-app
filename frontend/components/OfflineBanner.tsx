// components/OfflineBanner.tsx
// Barra fija arriba de todo que avisa el estado de la conexión y cuántos
// registros quedan por sincronizar. Pensada para que un adulto mayor entienda
// de un vistazo qué está pasando.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  onEstadoRed, estaOnline, estaSincronizando,
  contarPendientes, sincronizarAhora,
} from '../utils/api';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [online, setOnline]         = useState(estaOnline());
  const [sincro, setSincro]         = useState(estaSincronizando());
  const [pendientes, setPendientes] = useState(0);

  const refrescar = useCallback(async () => {
    setOnline(estaOnline());
    setSincro(estaSincronizando());
    setPendientes(await contarPendientes());
  }, []);

  useEffect(() => {
    refrescar();
    const off = onEstadoRed(refrescar);
    return off;
  }, [refrescar]);

  // Todo en orden y sin pendientes → no molestamos con nada.
  if (online && pendientes === 0 && !sincro) return null;

  const fondo =
    !online       ? '#B45309' :   // ámbar oscuro: sin internet
    sincro        ? '#1D4ED8' :   // azul: sincronizando
                    '#166534';    // verde: hay pendientes, con internet

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 6, backgroundColor: fondo }]}>
      <View style={s.row}>
        {sincro && <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />}
        <Text style={s.texto}>
          {!online
            ? 'Sin internet — podés seguir trabajando, se guarda en el teléfono'
            : sincro
              ? 'Sincronizando…'
              : `${pendientes} ${pendientes === 1 ? 'registro' : 'registros'} sin enviar`}
        </Text>
        {online && !sincro && pendientes > 0 && (
          <TouchableOpacity style={s.btn} onPress={() => sincronizarAhora()}>
            <Text style={s.btnTexto}>Enviar ahora</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { paddingHorizontal: 14, paddingBottom: 8 },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  texto:    { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  btn:      { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnTexto: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
