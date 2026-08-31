import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch, limpiarSesion } from '../../utils/api';

type TipoObra   = 'normal' | 'galpon' | 'refaccion';
type EstadoObra = 'activa' | 'pausada' | 'terminada';

type Obra = {
  id: number;
  nombre_cliente: string;
  direccion: string | null;
  tipo: TipoObra;
  estado: EstadoObra;
  reserva_herramienta_pct: number;
  fecha_inicio: string;
  notas: string | null;
};

type Saldo = {
  resumen: {
    total_presupuestado: number;
    total_cobrado: number;
    saldo_pendiente: number;
    pct_cobrado: number;
    ganancia_acumulada: number;
  };
  presupuesto: { aprobado: boolean } | null;
} | null;

const ESTADO_COLORES: Record<EstadoObra, { fondo: string; texto: string; label: string }> = {
  activa:    { fondo: '#DCFCE7', texto: '#166534', label: 'Activa' },
  pausada:   { fondo: '#FEF9C3', texto: '#854D0E', label: 'Pausada' },
  terminada: { fondo: '#F3F4F6', texto: '#6B7280', label: 'Terminada' },
};

const TIPO_LABEL: Record<TipoObra, string> = {
  normal: 'Obra común', galpon: 'Galpón', refaccion: 'Refacción',
};

const ESTADOS_OPCIONES: { valor: EstadoObra; label: string; icono: string }[] = [
  { valor: 'activa',    label: 'Marcar como activa',    icono: 'check-circle' },
  { valor: 'pausada',   label: 'Pausar obra',           icono: 'pause-circle' },
  { valor: 'terminada', label: 'Marcar como terminada', icono: 'flag-checkered' },
];

export default function DetalleObraScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [obra, setObra]               = useState<Obra | null>(null);
  const [saldo, setSaldo]             = useState<Saldo>(null);
  const [cargando, setCargando]       = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [modalEstado, setModalEstado] = useState(false);
  const [cambiando, setCambiando]     = useState(false);
  const [eliminando, setEliminando]   = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      // Cargamos obra y saldo en paralelo
      const [resObra, resSaldo] = await Promise.all([
        apiFetch(`/obras/${id}`),
        apiFetch(`/obras/${id}/saldos`),
      ]);

      if (resObra.status === 401) { router.replace('/login'); return; }
      if (resObra.status === 404) {
        Alert.alert('Error', 'Obra no encontrada.');
        if (typeof router.canGoBack === 'function' && router.canGoBack()) router.back();
        else router.replace('/dashboard');
        return;
      }

      setObra(await resObra.json());
      if (resSaldo.ok) setSaldo(await resSaldo.json());
    } catch {
      if (!silencioso) Alert.alert('Error', 'No se pudo cargar la obra.');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (nuevoEstado: EstadoObra) => {
    if (!obra || nuevoEstado === obra.estado) { setModalEstado(false); return; }
    setCambiando(true);
    try {
      const res  = await apiFetch(`/obras/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (res.ok && res.offline) {
        // Sin conexión: aplicamos el cambio en pantalla; se envía al sincronizar.
        setObra(prev => (prev ? { ...prev, estado: nuevoEstado } : prev));
        setModalEstado(false);
      } else if (res.ok) {
        setObra(data.obra);
        setModalEstado(false);
      } else {
        Alert.alert('Error', data.error || 'No se pudo cambiar el estado.');
      }
    } catch {
      Alert.alert('Sin conexión', 'No se pudo cambiar el estado. Intentá de nuevo.');
    } finally {
      setCambiando(false);
    }
  };

  const eliminarObra = async () => {
    if (eliminando) return;
    setConfirmarBorrado(false);
    setEliminando(true);
    try {
      const res = await apiFetch(`/obras/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        limpiarSesion();
        router.replace('/login');
        return;
      }

      const text = await res.text();
      if (res.ok && res.offline) {
        Alert.alert(
          'Se eliminará al sincronizar',
          'La obra se quita del servidor cuando vuelva el internet.',
          [{ text: 'Entendido', onPress: () => router.replace('/dashboard') }],
        );
        return;
      }
      if (res.ok) {
        router.replace('/dashboard');
        return;
      }

      let msg = 'No se pudo eliminar.';
      try {
        const j = JSON.parse(text);
        if (j.error) msg = j.error;
      } catch {
        // nada
      }
      Alert.alert('Error', msg);
    } catch (e) {
      console.error('eliminarObra error', e);
      Alert.alert('Error', 'No se pudo eliminar (error de conexión).');
    } finally {
      setEliminando(false);
    }
  };

  if (cargando) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#EA580C" /></View>
  );
  if (!obra) return null;

  const estado = ESTADO_COLORES[obra.estado];
  const pendiente = saldo?.resumen.saldo_pendiente ?? null;
  const pct       = saldo?.resumen.pct_cobrado ?? 0;

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
        <Text style={s.headerTitle} numberOfLines={1}>{obra.nombre_cliente}</Text>
        <TouchableOpacity onPress={() => setConfirmarBorrado(true)} style={[s.deleteBtn, eliminando && s.deleteBtnDisabled]} disabled={eliminando}>
          {eliminando
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <MaterialCommunityIcons name="trash-can-outline" size={22} color="#FFFFFF" />
          }
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
        {/* ── Tarjeta principal ── */}
        <View style={s.card}>
          <View style={s.cardTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.clienteNombre}>{obra.nombre_cliente}</Text>
              {obra.direccion && <Text style={s.direccion}>{obra.direccion}</Text>}
            </View>
            {/* Badge de estado — tocable para cambiar */}
            <TouchableOpacity
              style={[s.estadoBadge, { backgroundColor: estado.fondo }]}
              onPress={() => setModalEstado(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.estadoText, { color: estado.texto }]}>{estado.label} ▼</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <InfoItem label="Tipo"   valor={TIPO_LABEL[obra.tipo]} />
            <InfoItem label="Inicio" valor={formatFecha(obra.fecha_inicio)} />
            {obra.reserva_herramienta_pct > 0 && (
              <InfoItem label="Reserva" valor={`${obra.reserva_herramienta_pct}%`} destacado />
            )}
          </View>

          {obra.notas && (
            <View style={s.notasBox}>
              <Text style={s.notasLabel}>Notas</Text>
              <Text style={s.notasTexto}>{obra.notas}</Text>
            </View>
          )}
        </View>

        {/* ── Mini saldo (si hay presupuesto aprobado) ── */}
        {saldo?.presupuesto?.aprobado && pendiente !== null && (
          <View style={[s.saldoCard, pendiente <= 0 ? s.saldoCardPagada : s.saldoCardPendiente]}>
            <View style={s.saldoLeft}>
              <Text style={s.saldoLabel}>{pendiente <= 0 ? 'OBRA PAGADA ✓' : 'FALTA COBRAR'}</Text>
              <Text style={[s.saldoMonto, pendiente <= 0 && { color: '#86EFAC' }]}>
                ${Math.abs(pendiente).toLocaleString('es-AR')}
              </Text>
            </View>
            {/* Barra de progreso */}
            <View style={s.saldoRight}>
              <Text style={s.saldoPct}>{pct}%</Text>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={s.saldoPctLabel}>cobrado</Text>
            </View>
          </View>
        )}

        {/* Sin presupuesto aprobado */}
        {saldo && !saldo.presupuesto?.aprobado && (
          <TouchableOpacity
            style={s.alertaSinPresupuesto}
            onPress={() => router.push(`/obras/${id}/presupuesto` as any)}
            activeOpacity={0.8}
          >
            <Text style={s.alertaSinPresupuestoText}>
              Sin presupuesto aprobado — Tocá para cargar uno
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Módulos ── */}
        <Text style={s.seccion}>GESTIÓN DE OBRA</Text>

        <ModuloBtn
          icono="clipboard-text" titulo="Presupuesto"
          descripcion="Materiales, precio y rebaja"
          color="#FFF7ED" colorBorde="#FDBA74"
          onPress={() => router.push(`/obras/${id}/presupuesto` as any)}
        />
        <ModuloBtn
          icono="account-hard-hat" titulo="Nómina semanal"
          descripcion="Registrá el pago y los peones"
          color="#EFF6FF" colorBorde="#93C5FD"
          onPress={() => router.push(`/obras/${id}/nomina` as any)}
        />
        <ModuloBtn
          icono="cash-multiple" titulo="Saldos"
          descripcion={
            saldo?.presupuesto?.aprobado
              ? `Falta cobrar: $${(pendiente ?? 0).toLocaleString('es-AR')}`
              : 'Cuánto falta cobrar de esta obra'
          }
          color="#F0FDF4" colorBorde="#86EFAC"
          onPress={() => router.push(`/obras/${id}/saldos` as any)}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal cambio de estado */}
      <Modal visible={modalEstado} transparent animationType="slide" onRequestClose={() => setModalEstado(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setModalEstado(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Cambiar estado de la obra</Text>
            {ESTADOS_OPCIONES.map(op => (
              <TouchableOpacity
                key={op.valor}
                style={[s.modalOpcion, obra.estado === op.valor && s.modalOpcionActual]}
                onPress={() => cambiarEstado(op.valor)}
                disabled={cambiando}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={op.icono as any}
                  size={22}
                  color={obra.estado === op.valor ? '#EA580C' : '#6B7280'}
                  style={s.modalOpcionIcono}
                />
                <Text style={[s.modalOpcionLabel, obra.estado === op.valor && s.modalOpcionLabelActual]}>
                  {op.label}
                </Text>
                {obra.estado === op.valor && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            {cambiando && <ActivityIndicator color="#EA580C" style={{ marginTop: 12 }} />}
            <TouchableOpacity style={s.modalCancelar} onPress={() => setModalEstado(false)}>
              <Text style={s.modalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal confirmar eliminación — evita borrar la obra de un solo toque */}
      <Modal visible={confirmarBorrado} transparent animationType="fade" onRequestClose={() => setConfirmarBorrado(false)}>
        <View style={[s.modalOverlay, { justifyContent: 'center' }]}>
          <View style={s.confirmSheet}>
            <Text style={s.confirmTitle}>¿Eliminar esta obra?</Text>
            <Text style={s.confirmDesc}>
              Se borran también su presupuesto y su nómina. Esta acción no se puede deshacer.
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelar} onPress={() => setConfirmarBorrado(false)} disabled={eliminando}>
                <Text style={s.confirmCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmEliminar, eliminando && s.deleteBtnDisabled]} onPress={eliminarObra} disabled={eliminando}>
                {eliminando
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={s.confirmEliminarText}>Eliminar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoItem({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <View style={s.infoItem}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValor, destacado && s.infoValorDestacado]}>{valor}</Text>
    </View>
  );
}

function ModuloBtn({ icono, titulo, descripcion, color, colorBorde, onPress }: {
  icono: string; titulo: string; descripcion: string;
  color: string; colorBorde: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.moduloBtn, { backgroundColor: color, borderColor: colorBorde }]}
      onPress={onPress} activeOpacity={0.8}
    >
      <MaterialCommunityIcons name={icono as any} size={28} color="#EA580C" style={s.moduloIcono} />
      <View style={s.moduloTextos}>
        <Text style={s.moduloTitulo}>{titulo}</Text>
        <Text style={s.moduloDesc}>{descripcion}</Text>
      </View>
      <Text style={s.moduloArrow}>›</Text>
    </TouchableOpacity>
  );
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loading:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:    { backgroundColor: '#1F2937', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', flex: 1, textAlign: 'center' },
  backBtn:   { width: 70 },
  backText:  { color: '#FBBF24', fontSize: 15, fontWeight: '600' },
  deleteBtn: { width: 70, alignItems: 'flex-end' },
  deleteBtnDisabled: { opacity: 0.7 },
  scroll:    { flex: 1 },

  card:        { backgroundColor: '#FFFFFF', margin: 16, borderRadius: 14, padding: 18, elevation: 2 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  clienteNombre: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
  direccion:   { fontSize: 13, color: '#6B7280', marginTop: 4 },
  estadoBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  estadoText:  { fontSize: 13, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },
  infoRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  infoItem:    { minWidth: 90 },
  infoLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValor:   { fontSize: 14, color: '#374151', fontWeight: '600', marginTop: 2 },
  infoValorDestacado: { color: '#EA580C', fontWeight: '800' },
  notasBox:    { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginTop: 14 },
  notasLabel:  { fontSize: 11, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  notasTexto:  { fontSize: 14, color: '#374151', lineHeight: 20 },

  // Mini saldo
  saldoCard:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: -4, marginBottom: 12, borderRadius: 12, padding: 16 },
  saldoCardPendiente:{ backgroundColor: '#1F2937' },
  saldoCardPagada:   { backgroundColor: '#14532D' },
  saldoLeft:   { gap: 4 },
  saldoLabel:  { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1 },
  saldoMonto:  { fontSize: 24, fontWeight: '900', color: '#EA580C' },
  saldoRight:  { alignItems: 'flex-end', gap: 4 },
  saldoPct:    { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  saldoPctLabel: { fontSize: 10, color: '#9CA3AF' },
  progressBg:  { height: 6, width: 80, backgroundColor: '#374151', borderRadius: 3, overflow: 'hidden' },
  progressFill:{ height: '100%', backgroundColor: '#22C55E', borderRadius: 3 },

  alertaSinPresupuesto:     { backgroundColor: '#FEF3C7', marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 14 },
  alertaSinPresupuestoText: { color: '#92400E', fontWeight: '600', fontSize: 13, textAlign: 'center' },

  seccion: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginHorizontal: 16, marginBottom: 8 },

  moduloBtn:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, borderWidth: 1.5, padding: 16, gap: 14 },
  moduloIcono:  { width: 34, textAlign: 'center' },
  moduloTextos: { flex: 1 },
  moduloTitulo: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  moduloDesc:   { fontSize: 13, color: '#6B7280', marginTop: 2 },
  moduloArrow:  { fontSize: 24, color: '#D1D5DB' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 16, textAlign: 'center' },
  modalOpcion:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 8, backgroundColor: '#F9FAFB', gap: 12 },
  modalOpcionActual: { backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#EA580C' },
  modalOpcionIcono:  { width: 24, textAlign: 'center' },
  modalOpcionLabel:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#374151' },
  modalOpcionLabelActual: { color: '#EA580C', fontWeight: '800' },
  check:        { fontSize: 18, color: '#EA580C', fontWeight: '900' },
  modalCancelar:     { marginTop: 8, padding: 16, alignItems: 'center' },
  modalCancelarText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },

  // Confirmación de borrado
  confirmSheet:       { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22, marginHorizontal: 32, alignSelf: 'center' },
  confirmTitle:       { fontSize: 17, fontWeight: '900', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
  confirmDesc:        { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  confirmBtns:        { flexDirection: 'row', gap: 10 },
  confirmCancelar:    { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  confirmCancelarText:{ fontSize: 15, fontWeight: '700', color: '#6B7280' },
  confirmEliminar:    { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center' },
  confirmEliminarText:{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
