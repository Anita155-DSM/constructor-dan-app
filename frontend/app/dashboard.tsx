import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiFetch, limpiarSesion } from '../utils/api';

type ObraResumen = {
  id: number;
  nombre_cliente: string;
  estado: 'activa' | 'pausada' | 'terminada';
  tipo: 'normal' | 'galpon' | 'refaccion';
  total_presupuestado: number;
  total_cobrado: number;
  saldo_pendiente: number;
  ganancia_total: number;
  tiene_presupuesto: boolean;
  _pendiente?: boolean; // obra creada sin conexión, todavía no sincronizada
};

type Totales = {
  total_por_cobrar: number;
  ganancia_total: number;
  obras_activas: number;
};

const ESTADO_COLOR: Record<string, { fondo: string; texto: string; label: string }> = {
  activa:    { fondo: '#DCFCE7', texto: '#166534', label: 'Activa' },
  pausada:   { fondo: '#FEF9C3', texto: '#854D0E', label: 'Pausada' },
  terminada: { fondo: '#F3F4F6', texto: '#6B7280', label: 'Terminada' },
};

const TIPO_LABEL: Record<string, string> = {
  normal: 'Obra', galpon: 'Galpón', refaccion: 'Refacción',
};

export default function DashboardScreen() {
  const router = useRouter();
  const [obras, setObras]         = useState<ObraResumen[]>([]);
  const [totales, setTotales]     = useState<Totales | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saliendo, setSaliendo]   = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      // Cargamos el resumen general que incluye saldos de cada obra
      const res = await apiFetch('/resumen');
      if (res.status === 401) { router.replace('/login'); return; }
      const data = await res.json();
      setObras(data.obras || []);
      setTotales(data.totales || null);
    } catch {
      if (!silencioso) Alert.alert('Error', 'No se pudieron cargar las obras.');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLogout = async () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Si el backend no responde, igual limpiamos la sesión local.
    }
    await limpiarSesion();
    setSaliendo(false);
    router.replace('/login');
  };

  const activas    = obras.filter(o => o.estado === 'activa');
  const pausadas   = obras.filter(o => o.estado === 'pausada');
  const terminadas = obras.filter(o => o.estado === 'terminada');

  if (cargando) return (
    <View style={s.loading}>
      <ActivityIndicator size="large" color="#EA580C" />
      <Text style={s.loadingText}>Cargando...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Constructor Dan</Text>
          <Text style={s.headerSub}>
            {activas.length} obra{activas.length !== 1 ? 's' : ''} activa{activas.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={[s.logoutBtn, saliendo && s.logoutBtnDisabled]} disabled={saliendo}>
          <Text style={s.logoutText}>{saliendo ? 'Saliendo...' : 'Salir'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(true); }}
            colors={['#EA580C']}
          />
        }
      >
        {/* ── Resumen financiero global ── */}
        {totales && (
          <View style={s.resumenGlobal}>
            <View style={s.resumenItem}>
              <Text style={s.resumenNum}>{totales.obras_activas}</Text>
              <Text style={s.resumenLabel}>Activas</Text>
            </View>
            <View style={s.resumenSep} />
            <View style={s.resumenItem}>
              <Text style={[s.resumenNum, { color: '#EA580C', fontSize: 18 }]}>
                ${totales.total_por_cobrar.toLocaleString('es-AR')}
              </Text>
              <Text style={s.resumenLabel}>Por cobrar</Text>
            </View>
            <View style={s.resumenSep} />
            <View style={s.resumenItem}>
              <Text style={[s.resumenNum, { color: '#FBBF24', fontSize: 18 }]}>
                ${totales.ganancia_total.toLocaleString('es-AR')}
              </Text>
              <Text style={s.resumenLabel}>Ganancia total</Text>
            </View>
          </View>
        )}

        {/* ── Lista de obras ── */}
        {obras.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="crane" size={52} color="#EA580C" style={s.emptyIcon} />
            <Text style={s.emptyTitle}>Todavía no hay obras</Text>
            <Text style={s.emptyText}>Tocá el botón naranja para registrar tu primera obra.</Text>
          </View>
        ) : (
          <>
            {activas.length > 0 && (
              <>
                <Text style={s.seccion}>EN CURSO</Text>
                {activas.map(o => <ObraCard key={o.id} obra={o} onPress={() => router.push(`/obras/${o.id}` as any)} />)}
              </>
            )}
            {pausadas.length > 0 && (
              <>
                <Text style={s.seccion}>PAUSADAS</Text>
                {pausadas.map(o => <ObraCard key={o.id} obra={o} onPress={() => router.push(`/obras/${o.id}` as any)} />)}
              </>
            )}
            {terminadas.length > 0 && (
              <>
                <Text style={s.seccion}>TERMINADAS</Text>
                {terminadas.map(o => <ObraCard key={o.id} obra={o} onPress={() => router.push(`/obras/${o.id}` as any)} />)}
              </>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => router.push('/nueva')} activeOpacity={0.85}>
        <Text style={s.fabText}>+ Nueva obra</Text>
      </TouchableOpacity>
    </View>
  );
}

function ObraCard({ obra, onPress }: { obra: ObraResumen; onPress: () => void }) {
  const estado = ESTADO_COLOR[obra.estado];
  const falta  = obra.saldo_pendiente > 0;
  const pct    = obra.total_presupuestado > 0
    ? Math.min(100, Math.round((obra.total_cobrado / obra.total_presupuestado) * 100))
    : 0;

  const handlePress = () => {
    if (obra._pendiente) {
      Alert.alert(
        'Sin sincronizar',
        'Esta obra se guardó en el teléfono. Vas a poder abrirla cuando haya internet y se envíe al servidor.',
      );
      return;
    }
    onPress();
  };

  return (
    <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.8}>
      {/* Fila superior */}
      <View style={s.cardTop}>
        <Text style={s.cardCliente} numberOfLines={1}>{obra.nombre_cliente}</Text>
        <View style={[s.badge, { backgroundColor: obra._pendiente ? '#FEF3C7' : estado.fondo }]}>
          <Text style={[s.badgeText, { color: obra._pendiente ? '#92400E' : estado.texto }]}>
            {obra._pendiente ? 'Sin sincronizar' : estado.label}
          </Text>
        </View>
      </View>

      {/* Tipo */}
      <View style={s.tipoPill}>
        <Text style={s.tipoText}>{TIPO_LABEL[obra.tipo]}</Text>
      </View>

      {/* Saldo — solo si tiene presupuesto */}
      {obra.tiene_presupuesto ? (
        <View style={s.cardSaldo}>
          <View style={s.cardSaldoLeft}>
            <Text style={s.cardSaldoLabel}>{falta ? 'Falta cobrar' : 'Pagada ✓'}</Text>
            <Text style={[s.cardSaldoMonto, !falta && { color: '#22C55E' }]}>
              ${Math.abs(obra.saldo_pendiente).toLocaleString('es-AR')}
            </Text>
          </View>
          {/* Mini barra de progreso */}
          <View style={s.miniProgress}>
            <View style={s.miniProgressBg}>
              <View style={[s.miniProgressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.miniProgressPct}>{pct}%</Text>
          </View>
        </View>
      ) : (
        <Text style={s.sinPresupuesto}>Sin presupuesto cargado</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F3F4F6' },
  loading:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 15 },

  header:      { backgroundColor: '#1F2937', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  headerSub:   { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  logoutBtn:   { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#4B5563' },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText:  { color: '#9CA3AF', fontSize: 13 },
  scroll:      { flex: 1 },

  // Resumen global
  resumenGlobal: { backgroundColor: '#1F2937', marginHorizontal: 16, marginTop: 16, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center' },
  resumenItem:   { flex: 1, alignItems: 'center' },
  resumenNum:    { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  resumenLabel:  { fontSize: 11, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  resumenSep:    { width: 1, height: 40, backgroundColor: '#374151' },

  seccion: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginHorizontal: 16, marginTop: 16, marginBottom: 6 },

  card:        { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardCliente: { fontSize: 17, fontWeight: '800', color: '#1F2937', flex: 1, marginRight: 8 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:   { fontSize: 12, fontWeight: '700' },
  tipoPill:    { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 10 },
  tipoText:    { fontSize: 12, fontWeight: '600', color: '#92400E' },

  cardSaldo:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardSaldoLeft:  { gap: 2 },
  cardSaldoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  cardSaldoMonto: { fontSize: 18, fontWeight: '900', color: '#EA580C' },
  miniProgress:   { alignItems: 'flex-end', gap: 4 },
  miniProgressBg: { width: 80, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  miniProgressFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 3 },
  miniProgressPct:  { fontSize: 11, color: '#9CA3AF' },
  sinPresupuesto: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon:  { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
  emptyText:  { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  fab:     { position: 'absolute', bottom: 28, right: 20, left: 20, backgroundColor: '#EA580C', paddingVertical: 18, borderRadius: 12, alignItems: 'center', elevation: 6 },
  fabText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
});
