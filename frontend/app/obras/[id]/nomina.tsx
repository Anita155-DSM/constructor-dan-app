import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../../utils/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = {
  lunes: 'L', martes: 'M', miercoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S',
};
const ROL_COLOR: Record<string, { fondo: string; texto: string }> = {
  contratista: { fondo: '#FEF3C7', texto: '#92400E' },
  oficial:     { fondo: '#EFF6FF', texto: '#1E40AF' },
  ayudante:    { fondo: '#F0FDF4', texto: '#166534' },
};

type Peon = {
  id: string;
  nombre: string;
  rol: 'ayudante' | 'oficial' | 'contratista';
  jornal_diario: string;
  ausencias: string[];
};

type SemanaSaved = {
  id: number;
  fecha_lunes: string;
  monto_recibido: number;
  quien_pago: string | null;
  total_nomina_peones: number;
  reserva_herramienta: number;
  ganancia_contratista: number;
  notas: string | null;
  peones: {
    nombre: string;
    rol: string;
    jornal_diario: number;
    dias_trabajados: number;
    ausencias: string[];
    total_peon: number;
  }[];
};

type SaldoResumen = {
  total_presupuestado: number;
  total_cobrado: number;
  saldo_pendiente: number;
  pct_cobrado: number;
  ganancia_acumulada: number;
} | null;

export default function NominaScreen() {
  const router = useRouter();
  const { id: obraId } = useLocalSearchParams<{ id: string }>();

  // ── Tab activo: 'carga' o 'historial'
  const [tab, setTab] = useState<'carga' | 'historial'>('carga');

  // ── Estado carga semanal
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [fechaLunes, setFechaLunes] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [quienPago, setQuienPago]   = useState('');
  const [notas, setNotas]           = useState('');
  const [peones, setPeones]         = useState<Peon[]>([]);
  const [reservaPct, setReservaPct] = useState(0);
  const [semanaExiste, setSemanaExiste] = useState(false);
  const [modalAgregarPeon, setModalAgregarPeon] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoRol, setNuevoRol]     = useState<Peon['rol']>('ayudante');
  const [nuevoJornal, setNuevoJornal] = useState('');

  // ── Estado historial
  const [historial, setHistorial]   = useState<SemanaSaved[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [saldoResumen, setSaldoResumen] = useState<SaldoResumen>(null);
  const [semanaExpandida, setSemanaExpandida] = useState<number | null>(null);

  // ── Cargar semana actual
  const cargarSemanaActual = useCallback(async () => {
    setCargando(true);
    try {
      const res = await apiFetch(`/obras/${obraId}/nomina/actual`);
      if (res.status === 401) { router.replace('/login'); return; }
      const data = await res.json();
      setFechaLunes(data.fecha_lunes);
      setReservaPct(data.reserva_herramienta_pct || 0);
      if (data.existe) {
        setSemanaExiste(true);
        setMontoRecibido(String(data.monto_recibido));
        setQuienPago(data.quien_pago || '');
        setNotas(data.notas || '');
        setPeones((data.peones || []).map((p: any, i: number) => ({
          id: String(i),
          nombre: p.nombre, rol: p.rol,
          jornal_diario: String(p.jornal_diario),
          ausencias: p.ausencias || [],
        })));
      } else {
        setSemanaExiste(false);
        setMontoRecibido(''); setQuienPago(''); setNotas('');
        setPeones((data.peones_sugeridos || []).map((p: any, i: number) => ({
          id: String(i), nombre: p.nombre, rol: p.rol,
          jornal_diario: String(p.jornal_diario), ausencias: [],
        })));
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar la nómina.');
    } finally {
      setCargando(false);
    }
  }, [obraId]);

  // ── Cargar historial + saldo
  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    try {
      const [resHist, resSaldo] = await Promise.all([
        apiFetch(`/obras/${obraId}/nomina`),
        apiFetch(`/obras/${obraId}/saldos`),
      ]);
      if (resHist.ok) setHistorial(await resHist.json());
      if (resSaldo.ok) {
        const s = await resSaldo.json();
        setSaldoResumen(s.resumen || null);
      }
    } catch { /* silencioso */ }
    finally { setCargandoHistorial(false); }
  }, [obraId]);

  useEffect(() => { cargarSemanaActual(); }, [cargarSemanaActual]);
  useEffect(() => { if (tab === 'historial') cargarHistorial(); }, [tab, cargarHistorial]);

  // ── Cálculos en vivo
  const totalNomina = peones.reduce((sum, p) => {
    const dias = Math.max(0, 6 - p.ausencias.length);
    return sum + (parseFloat(p.jornal_diario) || 0) * dias;
  }, 0);
  const monto    = parseFloat(montoRecibido) || 0;
  const reserva  = parseFloat((monto * reservaPct / 100).toFixed(2));
  const ganancia = parseFloat((monto - totalNomina - reserva).toFixed(2));

  // ── Peones
  const toggleAusencia = (peonId: string, dia: string) =>
    setPeones(prev => prev.map(p => {
      if (p.id !== peonId) return p;
      const ya = p.ausencias.includes(dia);
      return { ...p, ausencias: ya ? p.ausencias.filter(d => d !== dia) : [...p.ausencias, dia] };
    }));

  const updatePeon = (id: string, campo: keyof Peon, valor: any) =>
    setPeones(prev => prev.map(p => p.id === id ? { ...p, [campo]: valor } : p));

  const quitarPeon = (id: string) => {
    if (peones.length === 1) { Alert.alert('', 'Tiene que haber al menos un peón.'); return; }
    setPeones(prev => prev.filter(p => p.id !== id));
  };

  const agregarPeon = () => {
    if (!nuevoNombre.trim()) { Alert.alert('', 'Escribí el nombre.'); return; }
    if (!nuevoJornal || parseFloat(nuevoJornal) <= 0) { Alert.alert('', 'Escribí el jornal.'); return; }
    setPeones(prev => [...prev, {
      id: Date.now().toString(), nombre: nuevoNombre.trim(),
      rol: nuevoRol, jornal_diario: nuevoJornal, ausencias: [],
    }]);
    setNuevoNombre(''); setNuevoJornal(''); setNuevoRol('ayudante');
    setModalAgregarPeon(false);
  };

  // ── Guardar nómina
  const handleGuardar = async () => {
    if (!monto || monto <= 0) { Alert.alert('Falta el monto', 'Ingresá cuánto te pagó el patrón.'); return; }
    const invalidos = peones.filter(p => !p.jornal_diario || parseFloat(p.jornal_diario) <= 0);
    if (invalidos.length > 0) { Alert.alert('Falta jornal', `${invalidos[0].nombre} no tiene jornal cargado.`); return; }

    setGuardando(true);
    try {
      const res = await apiFetch(`/obras/${obraId}/nomina`, {
        method: 'POST',
        body: JSON.stringify({
          fecha_lunes: fechaLunes,
          monto_recibido: monto,
          quien_pago: quienPago.trim() || null,
          notas: notas.trim() || null,
          peones: peones.map(p => ({
            nombre: p.nombre, rol: p.rol,
            jornal_diario: parseFloat(p.jornal_diario),
            ausencias: p.ausencias,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSemanaExiste(true);
        // Refrescar historial en segundo plano
        cargarHistorial();
        Alert.alert(
          '✅ Guardado',
          `Tu ganancia esta semana: $${ganancia.toLocaleString('es-AR')}`,
          [{ text: 'Ver historial', onPress: () => setTab('historial') }, { text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.error || 'No se pudo guardar.');
      }
    } catch {
      Alert.alert('Sin conexión', 'Verificá que el servidor esté corriendo.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#EA580C" /></View>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Nómina</Text>
          <Text style={s.headerSub}>{formatFechaCorta(fechaLunes)}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'carga' && s.tabActivo]} onPress={() => setTab('carga')}>
          <Text style={[s.tabText, tab === 'carga' && s.tabTextActivo]}>Esta semana</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'historial' && s.tabActivo]} onPress={() => setTab('historial')}>
          <Text style={[s.tabText, tab === 'historial' && s.tabTextActivo]}>
            Historial {historial.length > 0 ? `(${historial.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════ TAB: CARGA SEMANAL ══════════════════════ */}
      {tab === 'carga' && (
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Pago del patrón */}
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <MaterialCommunityIcons name="cash" size={18} color="#374151" />
              <Text style={s.cardTitle}>PAGO DEL PATRÓN</Text>
            </View>
            <Text style={s.label}>¿Cuánto te pagó esta semana?</Text>
            <TextInput
              style={[s.input, s.inputGrande]}
              placeholder="$ 0"
              placeholderTextColor="#9CA3AF"
              value={montoRecibido}
              onChangeText={setMontoRecibido}
              keyboardType="decimal-pad"
            />
            <Text style={[s.label, { marginTop: 12 }]}>¿Quién pagó? <Text style={s.opcional}>(opcional)</Text></Text>
            <TextInput
              style={s.input}
              placeholder="El patrón / Su chofer Juan"
              placeholderTextColor="#9CA3AF"
              value={quienPago}
              onChangeText={setQuienPago}
              autoCapitalize="words"
            />
          </View>

          {/* Peones */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <View style={s.cardTitleRow}>
                <MaterialCommunityIcons name="account-hard-hat" size={18} color="#374151" />
                <Text style={s.cardTitle}>PEONES</Text>
              </View>
              <TouchableOpacity style={s.btnAgregarPeon} onPress={() => setModalAgregarPeon(true)}>
                <Text style={s.btnAgregarPeonText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>Verde = trabajó. Tocá un día para marcar ausencia (rojo).</Text>

            {peones.map(peon => {
              const dias    = Math.max(0, 6 - peon.ausencias.length);
              const total   = (parseFloat(peon.jornal_diario) || 0) * dias;
              const colores = ROL_COLOR[peon.rol];
              return (
                <View key={peon.id} style={s.peonCard}>
                  <View style={s.peonHeader}>
                    <View style={[s.rolBadge, { backgroundColor: colores.fondo }]}>
                      <Text style={[s.rolText, { color: colores.texto }]}>{peon.rol}</Text>
                    </View>
                    <Text style={s.peonNombre} numberOfLines={1}>{peon.nombre}</Text>
                    <TouchableOpacity onPress={() => quitarPeon(peon.id)} style={s.quitarBtn}>
                      <Text style={s.quitarText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.peonJornalRow}>
                    <Text style={s.peonJornalLabel}>Jornal por día $</Text>
                    <TextInput
                      style={s.jornalInput}
                      value={peon.jornal_diario}
                      onChangeText={v => updatePeon(peon.id, 'jornal_diario', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={s.diasRow}>
                    {DIAS.map(dia => {
                      const ausente = peon.ausencias.includes(dia);
                      return (
                        <TouchableOpacity
                          key={dia}
                          style={[s.diaBtn, ausente && s.diaBtnAusente]}
                          onPress={() => toggleAusencia(peon.id, dia)}
                        >
                          <Text style={[s.diaBtnText, ausente && s.diaBtnTextAusente]}>
                            {DIAS_LABEL[dia]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={s.peonResumen}>
                    <Text style={s.peonResumenText}>{dias} día{dias !== 1 ? 's' : ''}</Text>
                    <Text style={s.peonTotal}>${total.toLocaleString('es-AR')}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Resumen de la semana */}
          {monto > 0 && (
            <View style={s.resumenSemana}>
              <View style={s.cardTitleRow}>
                <MaterialCommunityIcons name="chart-box-outline" size={18} color="#374151" />
                <Text style={s.cardTitle}>RESUMEN DE LA SEMANA</Text>
              </View>
              <FilaResumen label="Recibí del patrón" valor={monto} />
              <FilaResumen label="Nómina peones" valor={-totalNomina} color="#FCA5A5" />
              {reservaPct > 0 && (
                <FilaResumen label={`Reserva herramientas (${reservaPct}%)`} valor={-reserva} color="#FCA5A5" />
              )}
              <View style={s.divider} />
              <View style={s.resumenRow}>
                <Text style={s.gananciLabel}>Tu ganancia</Text>
                <Text style={[s.gananciValor, ganancia < 0 && { color: '#FCA5A5' }]}>
                  ${ganancia.toLocaleString('es-AR')}
                </Text>
              </View>
              {ganancia < 0 && (
                <View style={s.alertaNeg}>
                  <Text style={s.alertaNegText}>La nómina supera lo recibido. Revisá los montos.</Text>
                </View>
              )}
            </View>
          )}

          {/* Notas */}
          <View style={s.card}>
            <Text style={s.label}>Notas <Text style={s.opcional}>(opcional)</Text></Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Ej: El patrón trajo materiales, quedó debiendo..."
              placeholderTextColor="#9CA3AF"
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Botón guardar */}
          <TouchableOpacity
            style={[s.btnGuardar, guardando && s.btnDisabled]}
            onPress={handleGuardar}
            disabled={guardando}
            activeOpacity={0.85}
          >
            {guardando
              ? <ActivityIndicator color="#FFFFFF" size="large" />
              : <Text style={s.btnGuardarText}>{semanaExiste ? 'ACTUALIZAR NÓMINA' : 'GUARDAR NÓMINA'}</Text>
            }
          </TouchableOpacity>
          <View style={{ height: 50 }} />
        </ScrollView>
      )}

      {/* ══════════════════════ TAB: HISTORIAL ══════════════════════════ */}
      {tab === 'historial' && (
        <ScrollView style={s.scroll}>
          {cargandoHistorial ? (
            <View style={s.loadingHistorial}><ActivityIndicator color="#EA580C" /></View>
          ) : (
            <>
              {/* Resumen vs presupuesto */}
              {saldoResumen && (
                <View style={s.saldoCard}>
                  <View style={s.cardTitleRow}>
                    <MaterialCommunityIcons name="chart-line" size={18} color="#374151" />
                    <Text style={s.cardTitle}>COMPARACIÓN VS PRESUPUESTO</Text>
                  </View>

                  <View style={s.saldoFila}>
                    <Text style={s.saldoLabel}>Presupuesto total</Text>
                    <Text style={s.saldoValor}>${saldoResumen.total_presupuestado.toLocaleString('es-AR')}</Text>
                  </View>
                  <View style={s.saldoFila}>
                    <Text style={s.saldoLabel}>Cobrado hasta ahora</Text>
                    <Text style={[s.saldoValor, { color: '#22C55E' }]}>${saldoResumen.total_cobrado.toLocaleString('es-AR')}</Text>
                  </View>

                  {/* Barra de progreso */}
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${saldoResumen.pct_cobrado}%` }]} />
                  </View>
                  <Text style={s.progressLabel}>{saldoResumen.pct_cobrado}% cobrado</Text>

                  <View style={s.divider} />
                  <View style={s.saldoFila}>
                    <Text style={[s.saldoLabel, { fontWeight: '700', color: '#1F2937' }]}>
                      {saldoResumen.saldo_pendiente > 0 ? 'Falta cobrar' : 'Obra pagada ✓'}
                    </Text>
                    <Text style={[s.saldoValor, {
                      fontSize: 20, fontWeight: '900',
                      color: saldoResumen.saldo_pendiente > 0 ? '#EA580C' : '#22C55E',
                    }]}>
                      ${Math.abs(saldoResumen.saldo_pendiente).toLocaleString('es-AR')}
                    </Text>
                  </View>
                  <View style={s.saldoFila}>
                    <Text style={s.saldoLabel}>Tu ganancia acumulada</Text>
                    <Text style={[s.saldoValor, { color: '#FBBF24', fontWeight: '800' }]}>
                      ${saldoResumen.ganancia_acumulada.toLocaleString('es-AR')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Lista de semanas */}
              {historial.length === 0 ? (
                <View style={s.emptyHistorial}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={40} color="#9CA3AF" style={s.emptyHistorialIcon} />
                  <Text style={s.emptyHistorialText}>Todavía no hay semanas registradas.</Text>
                </View>
              ) : (
                historial.map((semana, idx) => {
                  const expandida = semanaExpandida === semana.id;
                  const esSemanaActual = semana.fecha_lunes === fechaLunes;
                  return (
                    <TouchableOpacity
                      key={semana.id}
                      style={[s.semanaCard, esSemanaActual && s.semanaCardActual]}
                      onPress={() => setSemanaExpandida(expandida ? null : semana.id)}
                      activeOpacity={0.8}
                    >
                      {/* Cabecera de semana */}
                      <View style={s.semanaHeader}>
                        <View style={s.semanaHeaderLeft}>
                          {esSemanaActual && (
                            <View style={s.semanaActualBadge}>
                              <Text style={s.semanaActualText}>Esta semana</Text>
                            </View>
                          )}
                          <Text style={s.semanaFecha}>{formatFechaLarga(semana.fecha_lunes)}</Text>
                          {semana.quien_pago && (
                            <Text style={s.semanaQuien}>Pagó: {semana.quien_pago}</Text>
                          )}
                        </View>
                        <View style={s.semanaHeaderRight}>
                          <Text style={s.semanaMonto}>${semana.monto_recibido.toLocaleString('es-AR')}</Text>
                          <Text style={[s.semanaGanancia, semana.ganancia_contratista < 0 && { color: '#DC2626' }]}>
                            Gan: ${semana.ganancia_contratista.toLocaleString('es-AR')}
                          </Text>
                          <Text style={s.expandirIcon}>{expandida ? '▲' : '▼'}</Text>
                        </View>
                      </View>

                      {/* Detalle expandible */}
                      {expandida && (
                        <View style={s.semanaDetalle}>
                          <View style={s.detalleFinanzas}>
                            <DetalleFilaFin label="Nómina peones" valor={semana.total_nomina_peones} negativo />
                            {semana.reserva_herramienta > 0 && (
                              <DetalleFilaFin label="Reserva herram." valor={semana.reserva_herramienta} negativo />
                            )}
                            <View style={s.detalleDivider} />
                            <DetalleFilaFin label="Ganancia" valor={semana.ganancia_contratista} destacado />
                          </View>

                          {/* Lista de peones */}
                          <Text style={s.peonesTitle}>Peones esta semana:</Text>
                          {semana.peones.map((p, i) => (
                            <View key={i} style={s.peonHistRow}>
                              <View style={s.peonHistLeft}>
                                <View style={[s.rolBadgeSm, { backgroundColor: ROL_COLOR[p.rol]?.fondo || '#F3F4F6' }]}>
                                  <Text style={[s.rolTextSm, { color: ROL_COLOR[p.rol]?.texto || '#374151' }]}>{p.rol}</Text>
                                </View>
                                <Text style={s.peonHistNombre}>{p.nombre}</Text>
                              </View>
                              <View style={s.peonHistRight}>
                                <Text style={s.peonHistDias}>{p.dias_trabajados} días</Text>
                                <Text style={s.peonHistTotal}>${p.total_peon.toLocaleString('es-AR')}</Text>
                              </View>
                            </View>
                          ))}

                          {semana.notas && (
                            <View style={s.semanaNotas}>
                              <View style={s.semanaNotasRow}>
                                <MaterialCommunityIcons name="note-text-outline" size={16} color="#92400E" />
                                <Text style={s.semanaNotasText}>{semana.notas}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal agregar peón */}
      <Modal visible={modalAgregarPeon} transparent animationType="slide" onRequestClose={() => setModalAgregarPeon(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setModalAgregarPeon(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Agregar peón</Text>

            <Text style={s.label}>Nombre</Text>
            <TextInput style={s.input} placeholder="Ej: Carlos" placeholderTextColor="#9CA3AF" value={nuevoNombre} onChangeText={setNuevoNombre} autoCapitalize="words" />

            <Text style={[s.label, { marginTop: 12 }]}>Rol</Text>
            <View style={s.rolRow}>
              {(['ayudante', 'oficial', 'contratista'] as const).map(r => (
                <TouchableOpacity key={r} style={[s.rolBtn, nuevoRol === r && s.rolBtnActivo]} onPress={() => setNuevoRol(r)}>
                  <Text style={[s.rolBtnText, nuevoRol === r && s.rolBtnTextActivo]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { marginTop: 12 }]}>Jornal diario $</Text>
            <TextInput style={s.input} placeholder="Ej: 30000" placeholderTextColor="#9CA3AF" value={nuevoJornal} onChangeText={setNuevoJornal} keyboardType="decimal-pad" />

            <TouchableOpacity style={[s.btnGuardar, { marginTop: 16 }]} onPress={agregarPeon}>
              <Text style={s.btnGuardarText}>AGREGAR</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function FilaResumen({ label, valor, color }: { label: string; valor: number; color?: string }) {
  const abs = Math.abs(valor);
  const neg = valor < 0;
  return (
    <View style={s.resumenRow}>
      <Text style={s.resumenLabel}>{label}</Text>
      <Text style={[s.resumenValor, color ? { color } : {}]}>
        {neg ? '-' : ''}${abs.toLocaleString('es-AR')}
      </Text>
    </View>
  );
}

function DetalleFilaFin({ label, valor, negativo, destacado }: { label: string; valor: number; negativo?: boolean; destacado?: boolean }) {
  return (
    <View style={s.detalleFinRow}>
      <Text style={[s.detalleFinLabel, destacado && { fontWeight: '700', color: '#1F2937' }]}>{label}</Text>
      <Text style={[s.detalleFinValor, negativo && { color: '#DC2626' }, destacado && { color: '#FBBF24', fontWeight: '800' }]}>
        {negativo ? '-' : ''}${valor.toLocaleString('es-AR')}
      </Text>
    </View>
  );
}

function formatFechaCorta(fecha: string) {
  if (!fecha) return '';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}
function formatFechaLarga(fecha: string) {
  if (!fecha) return '';
  return 'Semana del ' + new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F3F4F6' },
  loading:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingHistorial: { padding: 40, alignItems: 'center' },
  header:      { backgroundColor: '#1F2937', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerSub:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  backBtn:     { width: 70 },
  backText:    { color: '#FBBF24', fontSize: 15, fontWeight: '600' },
  scroll:      { flex: 1 },

  // Tabs
  tabs:        { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab:         { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActivo:   { borderBottomWidth: 3, borderBottomColor: '#EA580C' },
  tabText:     { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActivo: { color: '#EA580C', fontWeight: '800' },

  // Cards
  card:        { backgroundColor: '#FFFFFF', margin: 12, marginBottom: 8, borderRadius: 14, padding: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle:   { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.5 },
  label:       { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 },
  opcional:    { fontSize: 12, fontWeight: '400', color: '#9CA3AF' },
  hint:        { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  input:       { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, fontSize: 15, color: '#111827' },
  inputGrande: { fontSize: 28, fontWeight: '900', color: '#1F2937', textAlign: 'center', padding: 18 },
  inputMulti:  { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },

  // Peones
  btnAgregarPeon:     { backgroundColor: '#EA580C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnAgregarPeonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  peonCard:    { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, marginBottom: 10 },
  peonHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  peonNombre:  { flex: 1, fontSize: 15, fontWeight: '800', color: '#1F2937' },
  rolBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rolText:     { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  quitarBtn:   { padding: 4 },
  quitarText:  { fontSize: 16, color: '#9CA3AF' },
  peonJornalRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  peonJornalLabel:{ fontSize: 13, color: '#6B7280', flex: 1 },
  jornalInput:    { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 16, fontWeight: '700', color: '#111827', width: 120, textAlign: 'right' },
  diasRow:     { flexDirection: 'row', gap: 6, marginBottom: 10 },
  diaBtn:      { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#DCFCE7', alignItems: 'center', borderWidth: 1, borderColor: '#86EFAC' },
  diaBtnAusente:    { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  diaBtnText:       { fontSize: 13, fontWeight: '800', color: '#166534' },
  diaBtnTextAusente:{ color: '#DC2626' },
  peonResumen:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  peonResumenText:  { fontSize: 13, color: '#6B7280' },
  peonTotal:        { fontSize: 16, fontWeight: '900', color: '#1F2937' },

  // Resumen semana
  resumenSemana: { backgroundColor: '#1F2937', margin: 12, marginBottom: 8, borderRadius: 14, padding: 18 },
  resumenRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resumenLabel:  { fontSize: 14, color: '#9CA3AF' },
  resumenValor:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  divider:       { height: 1, backgroundColor: '#374151', marginVertical: 10 },
  gananciLabel:  { fontSize: 16, fontWeight: '800', color: '#FBBF24' },
  gananciValor:  { fontSize: 24, fontWeight: '900', color: '#FBBF24' },
  alertaNeg:     { backgroundColor: '#7F1D1D', borderRadius: 8, padding: 10, marginTop: 8 },
  alertaNegText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },

  // Botón guardar
  btnGuardar:     { backgroundColor: '#EA580C', paddingVertical: 20, borderRadius: 12, alignItems: 'center', marginHorizontal: 12, elevation: 3 },
  btnDisabled:    { opacity: 0.6 },
  btnGuardarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },

  // Historial — saldo card
  saldoCard:     { backgroundColor: '#FFFFFF', margin: 12, marginBottom: 8, borderRadius: 14, padding: 16 },
  saldoFila:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  saldoLabel:    { fontSize: 14, color: '#6B7280' },
  saldoValor:    { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  progressBg:    { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden', marginVertical: 8 },
  progressFill:  { height: '100%', backgroundColor: '#22C55E', borderRadius: 5 },
  progressLabel: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 },

  // Historial — semanas
  emptyHistorial:     { alignItems: 'center', paddingTop: 40 },
  emptyHistorialIcon: { marginBottom: 12 },
  emptyHistorialText: { fontSize: 14, color: '#9CA3AF' },

  semanaCard:       { backgroundColor: '#FFFFFF', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  semanaCardActual: { borderColor: '#EA580C', borderWidth: 2 },
  semanaHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  semanaHeaderLeft: { flex: 1 },
  semanaHeaderRight:{ alignItems: 'flex-end', gap: 2 },
  semanaActualBadge:{ backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginBottom: 4, alignSelf: 'flex-start' },
  semanaActualText: { fontSize: 10, fontWeight: '700', color: '#EA580C' },
  semanaFecha:      { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  semanaQuien:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  semanaMonto:      { fontSize: 16, fontWeight: '900', color: '#1F2937' },
  semanaGanancia:   { fontSize: 12, color: '#22C55E', fontWeight: '600' },
  expandirIcon:     { fontSize: 10, color: '#9CA3AF', marginTop: 4 },

  semanaDetalle:    { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  detalleFinanzas:  { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12 },
  detalleFinRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detalleFinLabel:  { fontSize: 13, color: '#6B7280' },
  detalleFinValor:  { fontSize: 13, fontWeight: '600', color: '#374151' },
  detalleDivider:   { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },

  peonesTitle:  { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  peonHistRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  peonHistLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  peonHistRight:{ alignItems: 'flex-end' },
  rolBadgeSm:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  rolTextSm:    { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  peonHistNombre: { fontSize: 14, fontWeight: '600', color: '#374151' },
  peonHistDias:   { fontSize: 12, color: '#9CA3AF' },
  peonHistTotal:  { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  semanaNotas:    { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginTop: 10 },
  semanaNotasRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  semanaNotasText:{ flex: 1, fontSize: 13, color: '#92400E' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: '#1F2937', marginBottom: 16, textAlign: 'center' },
  rolRow:       { flexDirection: 'row', gap: 8 },
  rolBtn:       { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  rolBtnActivo: { backgroundColor: '#1F2937', borderColor: '#1F2937' },
  rolBtnText:   { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'capitalize' },
  rolBtnTextActivo: { color: '#FBBF24' },
});
