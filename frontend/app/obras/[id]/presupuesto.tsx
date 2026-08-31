import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../../utils/api';

const TIPOS_CONSTRUCCION = [
  { valor: 'carpeta',        label: 'Carpeta',               unidad: 'm²', precio_default: 15000, detalle: '7 m² × bolsa cemento 50kg' },
  { valor: 'piso_ceramico',  label: 'Colocación de piso',    unidad: 'm²', precio_default: 30000, detalle: '6 m² × bolsa pegamento 30kg' },
  { valor: 'reboque',        label: 'Reboque / fino',        unidad: 'm²', precio_default: 0,     detalle: '6 m² × bolsa cal 25kg' },
  { valor: 'ceramico_pared', label: 'Cerámico pared',        unidad: 'm²', precio_default: 0,     detalle: '6 m² × bolsa cal 25kg' },
  { valor: 'pared_comun',    label: 'Pared común',           unidad: 'm²', precio_default: 0,     detalle: '3 m² × bolsa cal 25kg' },
  { valor: 'hormigon_viga',  label: 'Hormigón viga 20×30',   unidad: 'ml', precio_default: 0,     detalle: '3 ml × bolsa cemento 50kg' },
  { valor: 'contrapiso',     label: 'Contrapiso',            unidad: 'm³', precio_default: 0,     detalle: '7 bolsas cemento × m³' },
  { valor: 'hormigon',       label: 'Hormigón',              unidad: 'm³', precio_default: 0,     detalle: '7 bolsas cemento × m³' },
];

const TIPOS_FIJO = [
  { valor: 'abertura',       label: 'Colocación abertura',     unidad: 'u', precio_default: 100000 },
  { valor: 'mesada',         label: 'Mesada',                  unidad: 'u', precio_default: 250000 },
  { valor: 'bano_completo',  label: 'Revestimiento baño',      unidad: 'u', precio_default: 500000 },
  { valor: 'demolicion',     label: 'Demolición general',      unidad: 'u', precio_default: 300000 },
  { valor: 'reboque_varios', label: 'Reboques / reparaciones', unidad: 'u', precio_default: 250000 },
  { valor: 'humedad',        label: 'Tratamiento humedad',     unidad: 'u', precio_default: 350000 },
  { valor: 'personalizado',  label: '+ Ítem personalizado',    unidad: 'u', precio_default: 0 },
];

const RENDIMIENTOS: Record<string, { rinde: number; material: string; kg: number; esVolumen?: boolean }> = {
  carpeta:        { rinde: 7,   material: 'cemento',   kg: 50 },
  piso_ceramico:  { rinde: 6,   material: 'pegamento', kg: 30 },
  reboque:        { rinde: 6,   material: 'cal',       kg: 25 },
  ceramico_pared: { rinde: 6,   material: 'cal',       kg: 25 },
  pared_comun:    { rinde: 3,   material: 'cal',       kg: 25 },
  hormigon_viga:  { rinde: 3,   material: 'cemento',   kg: 50 },
  contrapiso:     { rinde: 1/7, material: 'cemento',   kg: 50, esVolumen: true },
  hormigon:       { rinde: 1/7, material: 'cemento',   kg: 50, esVolumen: true },
};

const REBAJAS = [0, 10, 15, 20, 25, 30];

type TipoItem = 'construccion' | 'fijo';
type Item = {
  id: string; tipo: TipoItem; tipo_trabajo: string;
  descripcion: string; cantidad: string; unidad: string; precio_unitario: string;
};

function nuevoItemConstruccion(): Item {
  return { id: Date.now().toString(), tipo: 'construccion', tipo_trabajo: 'carpeta', descripcion: 'Carpeta', cantidad: '', unidad: 'm²', precio_unitario: '15000' };
}
function nuevoItemFijo(): Item {
  return { id: (Date.now() + 1).toString(), tipo: 'fijo', tipo_trabajo: 'abertura', descripcion: 'Colocación abertura', cantidad: '1', unidad: 'u', precio_unitario: '100000' };
}

export default function PresupuestoScreen() {
  const router = useRouter();
  const { id: obraId } = useLocalSearchParams<{ id: string }>();

  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [aprobando, setAprobando]   = useState(false);
  const [presupuestoExistente, setPresupuestoExistente] = useState<any>(null);
  const [items, setItems]           = useState<Item[]>([nuevoItemConstruccion()]);
  const [pctRebaja, setPctRebaja]   = useState(0);
  const [notas, setNotas]           = useState('');
  const [modalTipo, setModalTipo]   = useState<'construccion' | 'fijo' | null>(null);
  const [itemEditando, setItemEditando] = useState<string | null>(null);

  // ✅ NUEVO: estado para mostrar panel de confirmación de aprobación en pantalla
  // En vez de Alert (que falla en Expo Web), mostramos un panel inline
  const [mostrarConfirmAprobar, setMostrarConfirmAprobar] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      try {
        const res = await apiFetch(`/obras/${obraId}/presupuesto`);
        if (res.status === 401) { router.replace('/login'); return; }
        if (res.ok) {
          const data = await res.json();
          setPresupuestoExistente(data);
          setPctRebaja(Number(data.pct_rebaja) || 0);
          setNotas(data.notas || '');
          if (data.items?.length > 0) {
            setItems(data.items.map((it: any, idx: number) => ({
              id: String(idx),
              tipo: RENDIMIENTOS[it.tipo_trabajo] ? 'construccion' : 'fijo',
              tipo_trabajo:    it.tipo_trabajo,
              descripcion:     it.descripcion || it.tipo_trabajo,
              cantidad:        String(it.cantidad),
              unidad:          it.unidad || 'u',
              precio_unitario: String(it.precio_unitario || 0),
            })));
          }
        }
      } catch (e) {
        console.log('Sin presupuesto previo:', e);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [obraId]);

  // Cálculos
  const totalCalculado = items.reduce((sum, item) => {
    return sum + (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0);
  }, 0);
  const totalConRebaja = totalCalculado > 0
    ? parseFloat((totalCalculado * (1 - pctRebaja / 100)).toFixed(2)) : 0;
  const gananciaRebaja = parseFloat((totalCalculado - totalConRebaja).toFixed(2));

  const updateItem = (id: string, campo: keyof Item, valor: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i));

  const quitarItem = (id: string) => {
    if (items.length === 1) { Alert.alert('', 'Tiene que haber al menos un ítem.'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const seleccionarTipo = (itemId: string, tipoTrabajo: string, esConstruccion: boolean) => {
    const lista = esConstruccion ? TIPOS_CONSTRUCCION : TIPOS_FIJO;
    const def   = lista.find(t => t.valor === tipoTrabajo);
    if (!def) return;
    setItems(prev => prev.map(i => i.id !== itemId ? i : {
      ...i,
      tipo_trabajo:    tipoTrabajo,
      descripcion:     tipoTrabajo === 'personalizado' ? '' : def.label,
      unidad:          def.unidad,
      precio_unitario: def.precio_default > 0 ? String(def.precio_default) : i.precio_unitario,
      cantidad:        esConstruccion ? i.cantidad : '1',
    }));
    setItemEditando(null);
    setModalTipo(null);
  };

  // Guardar
  const ejecutarGuardado = async () => {
    setGuardando(true);
    try {
      const itemsValidos = items.filter(i => parseFloat(i.cantidad) > 0);
      const body = {
        precio_ofertado: totalCalculado,
        pct_rebaja:      pctRebaja,
        notas:           notas.trim() || null,
        items: itemsValidos.map(i => ({
          tipo_trabajo:    i.tipo_trabajo,
          descripcion:     i.descripcion || i.tipo_trabajo,
          cantidad:        parseFloat(i.cantidad),
          unidad:          i.unidad,
          precio_unitario: parseFloat(i.precio_unitario) || 0,
        })),
      };
      const res  = await apiFetch(`/obras/${obraId}/presupuesto`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && res.offline) {
        setMostrarConfirmAprobar(false);
        Alert.alert(
          'Guardado en el teléfono',
          'El presupuesto se envía solo cuando vuelva el internet. Vas a poder aprobarlo cuando esté sincronizado.',
        );
      } else if (res.ok) {
        setPresupuestoExistente(data);
        setMostrarConfirmAprobar(false);
      } else {
        Alert.alert('Error al guardar', data.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error('Error guardando:', e);
      Alert.alert('Sin conexión', 'Verificá que el servidor esté corriendo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardar = () => {
    const itemsValidos = items.filter(i => parseFloat(i.cantidad) > 0);
    if (itemsValidos.length === 0) return Alert.alert('Falta info', 'Cargá al menos un ítem con cantidad.');
    if (totalCalculado <= 0)       return Alert.alert('Sin precio', 'El total no puede ser $0.');
    if (presupuestoExistente?.aprobado) {
      Alert.alert('Ya aprobado', '¿Reemplazar el presupuesto aprobado?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', style: 'destructive', onPress: ejecutarGuardado },
      ]);
    } else {
      ejecutarGuardado();
    }
  };

  // ✅ Aprobar — sin Alert, directo al servidor
  const ejecutarAprobacion = async () => {
    console.log('ejecutarAprobacion: iniciando, obraId=', obraId);
    setAprobando(true);
    setMostrarConfirmAprobar(false);
    try {
      const url = `/obras/${obraId}/presupuesto/aprobar`;
      console.log('PATCH', url);
      const res  = await apiFetch(url, { method: 'PATCH' });
      const data = await res.json();
      console.log('Respuesta aprobar:', res.status, JSON.stringify(data));
      if (res.ok) {
        setPresupuestoExistente((p: any) => ({ ...p, aprobado: true }));
      } else {
        Alert.alert('Error al aprobar', data.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error('Error aprobando:', e);
      Alert.alert('Sin conexión', 'Verificá que el servidor esté corriendo.');
    } finally {
      setAprobando(false);
    }
  };

  if (cargando) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#EA580C" /></View>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => {
          if (typeof router.canGoBack === 'function' && router.canGoBack()) router.back();
          else router.replace('/dashboard');
        }} style={s.backBtn}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Presupuesto</Text>
          {presupuestoExistente?.aprobado && (
            <View style={s.aprobadoBadge}><Text style={s.aprobadoText}>✓ Aprobado</Text></View>
          )}
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Construcción */}
        <View style={s.seccion}>
          <View style={s.seccionHeader}>
            <View style={s.seccionTitleRow}>
              <MaterialCommunityIcons name="hammer-wrench" size={18} color="#374151" />
              <Text style={s.seccionTitle}>CONSTRUCCIÓN / m²</Text>
            </View>
            <TouchableOpacity style={s.btnAdd} onPress={() => setItems(p => [...p, nuevoItemConstruccion()])}>
              <Text style={s.btnAddText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
          {items.filter(i => i.tipo === 'construccion').map(item => {
            const r        = RENDIMIENTOS[item.tipo_trabajo];
            const cant     = parseFloat(item.cantidad) || 0;
            const bolsas   = r ? (r.esVolumen ? Math.ceil(cant * 7) : Math.ceil(cant / r.rinde)) : 0;
            const subtotal = cant * (parseFloat(item.precio_unitario) || 0);
            const def      = TIPOS_CONSTRUCCION.find(t => t.valor === item.tipo_trabajo);
            return (
              <View key={item.id} style={s.itemCard}>
                <TouchableOpacity style={s.tipoSelector} onPress={() => { setItemEditando(item.id); setModalTipo('construccion'); }}>
                  <Text style={s.tipoSelectorLabel}>{def?.label || item.descripcion}</Text>
                  <Text style={s.tipoSelectorArrow}>▼</Text>
                </TouchableOpacity>
                {def?.detalle && <Text style={s.detalleRendimiento}>{def.detalle}</Text>}
                <View style={s.inputRow}>
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>Cantidad ({item.unidad})</Text>
                    <TextInput style={s.input} value={item.cantidad} onChangeText={v => updateItem(item.id, 'cantidad', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>$ por {item.unidad}</Text>
                    <TextInput style={s.input} value={item.precio_unitario} onChangeText={v => updateItem(item.id, 'precio_unitario', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9CA3AF" />
                  </View>
                </View>
                <View style={s.itemFooter}>
                  <View>
                    {bolsas > 0 && (
                      <View style={s.bolsasRow}>
                        <MaterialCommunityIcons name="package-variant" size={16} color="#92400E" />
                        <Text style={s.bolsasText}>{bolsas} bolsas de {r?.material} ({r?.kg}kg)</Text>
                      </View>
                    )}
                    {subtotal > 0 && <Text style={s.subtotalText}>Subtotal: ${subtotal.toLocaleString('es-AR')}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => quitarItem(item.id)} style={s.quitarBtn}>
                    <Text style={s.quitarText}>x</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Precio fijo */}
        <View style={s.seccion}>
          <View style={s.seccionHeader}>
            <View style={s.seccionTitleRow}>
              <MaterialCommunityIcons name="cash-multiple" size={18} color="#374151" />
              <Text style={s.seccionTitle}>PRECIO FIJO / UNIDAD</Text>
            </View>
            <TouchableOpacity style={s.btnAdd} onPress={() => setItems(p => [...p, nuevoItemFijo()])}>
              <Text style={s.btnAddText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
          {items.filter(i => i.tipo === 'fijo').length === 0 && (
            <Text style={s.emptyHint}>Abertura, mesada, baño, demolición, etc.</Text>
          )}
          {items.filter(i => i.tipo === 'fijo').map(item => {
            const subtotal = (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0);
            const def      = TIPOS_FIJO.find(t => t.valor === item.tipo_trabajo);
            return (
              <View key={item.id} style={s.itemCard}>
                <TouchableOpacity style={s.tipoSelector} onPress={() => { setItemEditando(item.id); setModalTipo('fijo'); }}>
                  <Text style={s.tipoSelectorLabel}>{def?.label || item.descripcion || 'Ítem personalizado'}</Text>
                  <Text style={s.tipoSelectorArrow}>▼</Text>
                </TouchableOpacity>
                {item.tipo_trabajo === 'personalizado' && (
                  <TextInput style={[s.input, { marginBottom: 8 }]} value={item.descripcion} onChangeText={v => updateItem(item.id, 'descripcion', v)} placeholder="Descripción del trabajo..." placeholderTextColor="#9CA3AF" autoCapitalize="sentences" />
                )}
                <View style={s.inputRow}>
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>Cantidad</Text>
                    <TextInput style={s.input} value={item.cantidad} onChangeText={v => updateItem(item.id, 'cantidad', v)} keyboardType="decimal-pad" placeholder="1" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>Precio por u.</Text>
                    <TextInput style={s.input} value={item.precio_unitario} onChangeText={v => updateItem(item.id, 'precio_unitario', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9CA3AF" />
                  </View>
                </View>
                <View style={s.itemFooter}>
                  {subtotal > 0 && <Text style={s.subtotalText}>Subtotal: ${subtotal.toLocaleString('es-AR')}</Text>}
                  <TouchableOpacity onPress={() => quitarItem(item.id)} style={s.quitarBtn}>
                    <Text style={s.quitarText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Resumen */}
        <View style={s.resumenCard}>
          <View style={s.seccionTitleRow}>
            <MaterialCommunityIcons name="chart-box-outline" size={18} color="#FFFFFF" />
            <Text style={s.seccionTitle}>RESUMEN</Text>
          </View>
          <View style={s.resumenRow}>
            <Text style={s.resumenLabel}>Total de la obra</Text>
            <Text style={s.resumenValorGrande}>${totalCalculado.toLocaleString('es-AR')}</Text>
          </View>
          <Text style={[s.inputLabel, { marginTop: 14, marginBottom: 8, color: '#9CA3AF' }]}>Rebaja que pide el patrón</Text>
          <View style={s.rebajaRow}>
            {REBAJAS.map(r => (
              <TouchableOpacity key={r} style={[s.rebajaBtn, pctRebaja === r && s.rebajaBtnActivo]} onPress={() => setPctRebaja(r)}>
                <Text style={[s.rebajaBtnText, pctRebaja === r && s.rebajaBtnTextActivo]}>
                  {r === 0 ? 'Sin rebaja' : `${r}%`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {totalCalculado > 0 && (
            <View style={s.simulacionBox}>
              {pctRebaja > 0 && (
                <View style={s.simRow}>
                  <Text style={s.simLabel}>Rebaja ({pctRebaja}%)</Text>
                  <Text style={[s.simValor, { color: '#FCA5A5' }]}>-${gananciaRebaja.toLocaleString('es-AR')}</Text>
                </View>
              )}
              <View style={s.simRow}>
                <Text style={s.simLabelTotal}>Lo que cobrás</Text>
                <Text style={s.simTotal}>${totalConRebaja.toLocaleString('es-AR')}</Text>
              </View>
              {pctRebaja > 0 && (
                <View style={s.gananciaDiff}>
                  <View style={s.gananciaDiffRow}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#86EFAC" />
                    <Text style={s.gananciaDiffText}>Igual ganás ${gananciaRebaja.toLocaleString('es-AR')} más que tu precio base</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Notas */}
        <View style={s.seccion}>
          <Text style={s.inputLabel}>Notas (opcional)</Text>
          <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 }]} value={notas} onChangeText={setNotas} placeholder="Observaciones..." placeholderTextColor="#9CA3AF" multiline />
        </View>

        {/* Botón guardar */}
        <TouchableOpacity
          style={[s.btnGuardar, (guardando || aprobando) && s.btnDisabled]}
          onPress={handleGuardar}
          disabled={guardando || aprobando}
          activeOpacity={0.85}
        >
          {guardando
            ? <ActivityIndicator color="#FFFFFF" size="large" />
            : <Text style={s.btnGuardarText}>{presupuestoExistente ? 'ACTUALIZAR PRESUPUESTO' : 'GUARDAR PRESUPUESTO'}</Text>
          }
        </TouchableOpacity>

        {/* ✅ Botón aprobar — SIN Alert, muestra panel inline */}
        {presupuestoExistente && !presupuestoExistente.aprobado && !mostrarConfirmAprobar && (
          <TouchableOpacity
            style={[s.btnAprobar, aprobando && s.btnDisabled]}
            onPress={() => setMostrarConfirmAprobar(true)}
            disabled={aprobando || guardando}
            activeOpacity={0.85}
          >
            <Text style={s.btnAprobarText}>✓ APROBAR — El patrón confirmó</Text>
          </TouchableOpacity>
        )}

        {/* ✅ Panel de confirmación inline — reemplaza el Alert */}
        {mostrarConfirmAprobar && (
          <View style={s.confirmPanel}>
            <Text style={s.confirmTitle}>¿Confirmar aprobación?</Text>
            <Text style={s.confirmDesc}>
              El patrón aceptó ${totalConRebaja.toLocaleString('es-AR')}.{'\n'}
              Una vez aprobado, los saldos quedan activos.
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={s.confirmBtnCancelar}
                onPress={() => setMostrarConfirmAprobar(false)}
              >
                <Text style={s.confirmBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtnOk, aprobando && s.btnDisabled]}
                onPress={ejecutarAprobacion}
                disabled={aprobando}
              >
                {aprobando
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={s.confirmBtnOkText}>Sí, aprobar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Aprobado */}
        {presupuestoExistente?.aprobado && (
          <View style={s.yaAprobado}>
            <Text style={s.yaAprobadoText}>Presupuesto aprobado — saldos activos</Text>
          </View>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Modal selector de tipo */}
      <Modal visible={modalTipo !== null} transparent animationType="slide" onRequestClose={() => setModalTipo(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setModalTipo(null)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{modalTipo === 'construccion' ? 'Tipo de trabajo' : 'Ítem de precio fijo'}</Text>
            <ScrollView>
              {(modalTipo === 'construccion' ? TIPOS_CONSTRUCCION : TIPOS_FIJO).map(t => (
                <TouchableOpacity
                  key={t.valor}
                  style={s.modalOpcion}
                  onPress={() => itemEditando && seleccionarTipo(itemEditando, t.valor, modalTipo === 'construccion')}
                >
                  <View style={s.modalOpcionLeft}>
                    <Text style={s.modalOpcionLabel}>{t.label}</Text>
                    {'detalle' in t && (t as { detalle?: string }).detalle && (
                      <Text style={s.modalOpcionDetalle}>{(t as { detalle?: string }).detalle}</Text>
                    )}
                  </View>
                  {t.precio_default > 0 && <Text style={s.modalOpcionPrecio}>${t.precio_default.toLocaleString('es-AR')}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F3F4F6' },
  loading:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#1F2937', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  backBtn:      { width: 70 },
  backText:     { color: '#FBBF24', fontSize: 15, fontWeight: '600' },
  aprobadoBadge:{ backgroundColor: '#166534', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  aprobadoText: { color: '#86EFAC', fontSize: 11, fontWeight: '700' },
  scroll:       { flex: 1 },
  seccion:      { backgroundColor: '#FFFFFF', margin: 12, marginBottom: 8, borderRadius: 14, padding: 16 },
  seccionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seccionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seccionTitle: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.5 },
  btnAdd:       { backgroundColor: '#EA580C', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  btnAddText:   { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  emptyHint:    { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  itemCard:     { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 10 },
  tipoSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 8 },
  tipoSelectorLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', flex: 1 },
  tipoSelectorArrow: { fontSize: 12, color: '#9CA3AF', marginLeft: 8 },
  detalleRendimiento:{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 8 },
  inputRow:     { flexDirection: 'row', gap: 10 },
  inputGroup:   { flex: 1 },
  inputLabel:   { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  input:        { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827' },
  itemFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  bolsasRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bolsasText:   { fontSize: 13, color: '#92400E', fontWeight: '600' },
  subtotalText: { fontSize: 13, color: '#374151', fontWeight: '700', marginTop: 2 },
  quitarBtn:    { padding: 6 },
  quitarText:   { fontSize: 16, color: '#9CA3AF' },
  resumenCard:        { backgroundColor: '#1F2937', margin: 12, marginBottom: 8, borderRadius: 14, padding: 18 },
  resumenRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumenLabel:       { fontSize: 14, color: '#9CA3AF' },
  resumenValorGrande: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  rebajaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  rebajaBtn:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#374151', borderWidth: 1, borderColor: '#4B5563' },
  rebajaBtnActivo:    { backgroundColor: '#FBBF24', borderColor: '#FBBF24' },
  rebajaBtnText:      { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  rebajaBtnTextActivo:{ color: '#1F2937' },
  simulacionBox:      { backgroundColor: '#374151', borderRadius: 10, padding: 14, marginTop: 4 },
  simRow:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  simLabel:           { fontSize: 13, color: '#9CA3AF' },
  simValor:           { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  simLabelTotal:      { fontSize: 15, fontWeight: '800', color: '#FBBF24' },
  simTotal:           { fontSize: 22, fontWeight: '900', color: '#FBBF24' },
  gananciaDiff:       { backgroundColor: '#166534', borderRadius: 8, padding: 10, marginTop: 8 },
  gananciaDiffRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  gananciaDiffText:   { fontSize: 13, color: '#86EFAC', fontWeight: '600' },
  btnGuardar:         { backgroundColor: '#EA580C', paddingVertical: 20, borderRadius: 12, alignItems: 'center', marginHorizontal: 12, marginTop: 8, elevation: 3 },
  btnDisabled:        { opacity: 0.6 },
  btnGuardarText:     { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  btnAprobar:         { backgroundColor: '#166534', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginHorizontal: 12, marginTop: 10, elevation: 3 },
  btnAprobarText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  // ✅ Panel de confirmación inline
  confirmPanel:       { backgroundColor: '#FFFBEB', borderWidth: 2, borderColor: '#FBBF24', borderRadius: 14, padding: 20, marginHorizontal: 12, marginTop: 10 },
  confirmTitle:       { fontSize: 16, fontWeight: '900', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
  confirmDesc:        { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  confirmBtns:        { flexDirection: 'row', gap: 10 },
  confirmBtnCancelar: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  confirmBtnCancelarText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
  confirmBtnOk:       { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#166534', alignItems: 'center' },
  confirmBtnOkText:   { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },

  yaAprobado:         { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginHorizontal: 12, marginTop: 10, alignItems: 'center' },
  yaAprobadoText:     { color: '#166534', fontWeight: '700', fontSize: 14 },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '75%' },
  modalHandle:        { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:         { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 14, textAlign: 'center' },
  modalOpcion:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOpcionLeft:    { flex: 1 },
  modalOpcionLabel:   { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  modalOpcionDetalle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  modalOpcionPrecio:  { fontSize: 14, fontWeight: '700', color: '#EA580C', marginLeft: 10 },
});
