import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../../utils/api';

type Semana = {
  id: number;
  fecha_lunes: string;
  monto_recibido: number;
  total_nomina_peones: number;
  reserva_herramienta: number;
  ganancia_contratista: number;
};

type SaldoData = {
  obra: {
    nombre_cliente: string;
    tipo: string;
    estado: string;
    reserva_herramienta_pct: number;
  };
  presupuesto: {
    total_con_rebaja: number;
    precio_ofertado: number;
    ganancia_rebaja: number;
    aprobado: boolean;
  } | null;
  resumen: {
    total_presupuestado: number;
    total_cobrado: number;
    saldo_pendiente: number;
    pct_cobrado: number;
    ganancia_acumulada: number;
    reserva_acumulada: number;
    cantidad_semanas: number;
  };
  semanas: Semana[];
};

export default function SaldosScreen() {
  const router = useRouter();
  const { id: obraId } = useLocalSearchParams<{ id: string }>();
  const [data, setData]           = useState<SaldoData | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verDetalle, setVerDetalle] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const res = await apiFetch(`/obras/${obraId}/saldos`);
      if (res.status === 401) { router.replace('/login'); return; }
      if (!res.ok) { Alert.alert('Error', 'No se pudieron cargar los saldos.'); return; }
      setData(await res.json());
    } catch {
      if (!silencioso) Alert.alert('Error', 'Verificá la conexión al servidor.');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [obraId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#EA580C" /></View>
  );

  if (!data) return null;

  const { obra, presupuesto, resumen, semanas } = data;
  const pendiente  = resumen.saldo_pendiente;
  const pct        = resumen.pct_cobrado;
  const faltaCobrar = pendiente > 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => {
          if (typeof router.canGoBack === 'function' && router.canGoBack()) router.back();
          else router.replace('/dashboard');
        }} style={s.backBtn}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Saldos</Text>
          <Text style={s.headerSub} numberOfLines={1}>{obra.nombre_cliente}</Text>
        </View>
        <View style={{ width: 70 }} />
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
        {/* ── Tarjeta principal — lo más importante arriba ── */}
        <View style={[s.mainCard, faltaCobrar ? s.mainCardPendiente : s.mainCardPago]}>
          <Text style={s.mainCardLabel}>
            {faltaCobrar ? 'FALTA COBRAR' : 'OBRA PAGADA ✓'}
          </Text>
          <Text style={[s.mainCardMonto, !faltaCobrar && { color: '#86EFAC' }]}>
            ${Math.abs(pendiente).toLocaleString('es-AR')}
          </Text>
          {!faltaCobrar && pendiente < 0 && (
            <Text style={s.mainCardExtra}>
              (cobró ${Math.abs(pendiente).toLocaleString('es-AR')} de más)
            </Text>
          )}

          {/* Barra de progreso */}
          {presupuesto && (
            <View style={s.progressContainer}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={s.progressLabel}>{pct}% cobrado</Text>
            </View>
          )}
        </View>

        {/* ── Sin presupuesto aprobado ── */}
        {!presupuesto && (
          <View style={s.alertCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#92400E" style={s.alertIcon} />
            <Text style={s.alertText}>
              Esta obra no tiene presupuesto aprobado. Los saldos no se pueden calcular hasta aprobar uno.
            </Text>
            <TouchableOpacity
              style={s.alertBtn}
              onPress={() => router.push(`/obras/${obraId}/presupuesto` as any)}
            >
              <Text style={s.alertBtnText}>Ir al presupuesto →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Desglose financiero ── */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <MaterialCommunityIcons name="cash-multiple" size={18} color="#374151" />
            <Text style={s.cardTitle}>DETALLE DE COBROS</Text>
          </View>

          <FilaResumen label="Presupuesto total" valor={resumen.total_presupuestado} />
          <FilaResumen label="Total cobrado" valor={resumen.total_cobrado} color="#22C55E" />
          <View style={s.divider} />
          <FilaResumen
            label="Saldo pendiente"
            valor={pendiente}
            color={faltaCobrar ? '#EA580C' : '#22C55E'}
            grande
          />
        </View>

        {/* ── Ganancia acumulada ── */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <MaterialCommunityIcons name="chart-line" size={18} color="#374151" />
            <Text style={s.cardTitle}>TU GANANCIA ACUMULADA</Text>
          </View>

          <FilaResumen label="Ganancia neta total" valor={resumen.ganancia_acumulada} color="#FBBF24" grande />
          {resumen.reserva_acumulada > 0 && (
            <FilaResumen label="Reserva herramientas guardada" valor={resumen.reserva_acumulada} color="#9CA3AF" />
          )}
          <View style={s.semanasInfo}>
            <Text style={s.semanasText}>
              {resumen.cantidad_semanas} semana{resumen.cantidad_semanas !== 1 ? 's' : ''} registrada{resumen.cantidad_semanas !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* ── Historial semanal ── */}
        {semanas.length > 0 && (
          <View style={s.card}>
            <TouchableOpacity
              style={s.detalleHeader}
              onPress={() => setVerDetalle(!verDetalle)}
              activeOpacity={0.8}
            >
              <View style={s.cardTitleRow}>
                <MaterialCommunityIcons name="calendar-week" size={18} color="#374151" />
                <Text style={s.cardTitle}>HISTORIAL SEMANAL</Text>
              </View>
              <Text style={s.detalleToggle}>{verDetalle ? '▲ Ocultar' : '▼ Ver todo'}</Text>
            </TouchableOpacity>

            {/* Siempre mostrar la última semana */}
            <SemanaRow semana={semanas[semanas.length - 1]} ultima />

            {verDetalle && semanas.slice(0, -1).reverse().map(sem => (
              <SemanaRow key={sem.id} semana={sem} />
            ))}
          </View>
        )}

        {/* ── Acciones rápidas ── */}
        <View style={s.accionesRow}>
          <TouchableOpacity
            style={s.accionBtn}
            onPress={() => router.push(`/obras/${obraId}/nomina` as any)}
          >
            <MaterialCommunityIcons name="account-hard-hat" size={28} color="#EA580C" style={s.accionIcono} />
            <Text style={s.accionLabel}>Nueva nómina</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.accionBtn}
            onPress={() => router.push(`/obras/${obraId}/presupuesto` as any)}
          >
            <MaterialCommunityIcons name="clipboard-text" size={28} color="#EA580C" style={s.accionIcono} />
            <Text style={s.accionLabel}>Ver presupuesto</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function FilaResumen({ label, valor, color, grande }: {
  label: string; valor: number; color?: string; grande?: boolean;
}) {
  return (
    <View style={s.fila}>
      <Text style={[s.filaLabel, grande && s.filaLabelGrande]}>{label}</Text>
      <Text style={[s.filaValor, grande && s.filaValorGrande, color ? { color } : {}]}>
        ${valor.toLocaleString('es-AR')}
      </Text>
    </View>
  );
}

function SemanaRow({ semana, ultima }: { semana: Semana; ultima?: boolean }) {
  const fecha = new Date(semana.fecha_lunes + 'T12:00:00');
  const label = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  return (
    <View style={[s.semanaRow, ultima && s.semanaRowUltima]}>
      <View style={s.semanaLeft}>
        {ultima && <Text style={s.semanaUltimaTag}>Última</Text>}
        <Text style={s.semanaFecha}>Sem. {label}</Text>
      </View>
      <View style={s.semanaRight}>
        <Text style={s.semanaRecibido}>${semana.monto_recibido.toLocaleString('es-AR')}</Text>
        <Text style={s.semanaGanancia}>Ganancia: ${semana.ganancia_contratista.toLocaleString('es-AR')}</Text>
      </View>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loading:   { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:       { backgroundColor: '#1F2937', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerSub:    { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  backBtn:      { width: 70 },
  backText:     { color: '#FBBF24', fontSize: 15, fontWeight: '600' },
  scroll:       { flex: 1 },

  // Tarjeta principal
  mainCard:          { margin: 12, borderRadius: 16, padding: 24, alignItems: 'center' },
  mainCardPendiente: { backgroundColor: '#1F2937' },
  mainCardPago:      { backgroundColor: '#14532D' },
  mainCardLabel:     { fontSize: 12, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  mainCardMonto:     { fontSize: 44, fontWeight: '900', color: '#EA580C', marginBottom: 4 },
  mainCardExtra:     { fontSize: 13, color: '#9CA3AF', marginBottom: 8 },

  progressContainer: { width: '100%', marginTop: 16 },
  progressBg:        { height: 8, backgroundColor: '#374151', borderRadius: 4, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
  progressLabel:     { fontSize: 12, color: '#9CA3AF', marginTop: 6, textAlign: 'center' },

  // Alerta sin presupuesto
  alertCard: { backgroundColor: '#FEF3C7', margin: 12, borderRadius: 12, padding: 16, alignItems: 'center' },
  alertIcon: { marginBottom: 8 },
  alertText: { fontSize: 14, color: '#92400E', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  alertBtn:  { backgroundColor: '#92400E', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  alertBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Cards
  card:      { backgroundColor: '#FFFFFF', margin: 12, marginTop: 0, borderRadius: 14, padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: '#374151', letterSpacing: 0.5 },

  fila:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filaLabel:       { fontSize: 14, color: '#6B7280' },
  filaLabelGrande: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  filaValor:       { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  filaValorGrande: { fontSize: 22, fontWeight: '900' },
  divider:         { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },

  semanasInfo: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  semanasText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  // Historial
  detalleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  detalleToggle: { fontSize: 13, color: '#EA580C', fontWeight: '600' },

  semanaRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  semanaRowUltima: { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 8, marginBottom: 4 },
  semanaLeft:      { gap: 2 },
  semanaRight:     { alignItems: 'flex-end' },
  semanaUltimaTag: { fontSize: 10, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase' },
  semanaFecha:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  semanaRecibido:  { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  semanaGanancia:  { fontSize: 12, color: '#22C55E', marginTop: 2 },

  // Acciones
  accionesRow: { flexDirection: 'row', gap: 10, margin: 12, marginTop: 0 },
  accionBtn:   { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  accionIcono: { marginBottom: 6 },
  accionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'center' },
});
