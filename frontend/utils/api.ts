// utils/api.ts
// Capa de red con soporte OFFLINE para que la app sirva en el campo sin señal.
//
// Cómo funciona:
//  · Los GET se cachean en el teléfono. Si no hay internet, se devuelven los
//    últimos datos guardados.
//  · Los POST/PATCH/DELETE hechos sin internet se guardan en una "bandeja de
//    salida" (outbox) y se envían solos cuando vuelve la conexión.
//  · La sesión (token + usuario) se guarda en el teléfono, así no hay que
//    volver a iniciar sesión cada vez que se abre la app.

import NetInfo from '@react-native-community/netinfo';
import { getJSON, setJSON, remove, getString, setString } from './storage';

// ─── Configuración ───────────────────────────────────────────────────────────
const RAW_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'https://constructordan.onrender.com/api';

export const API_BASE = RAW_BASE.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';

const K_TOKEN   = 'constructor-dan-token';
const K_USER    = 'constructor-dan-user';
const K_CACHE   = 'cd-cache:v1:';       // prefijo por endpoint
const K_OUTBOX  = 'cd-outbox:v1';       // cola de escrituras pendientes
const K_FAILED  = 'cd-outbox-failed:v1'; // escrituras que el servidor rechazó

// Render (plan gratis) apaga el servicio tras ~15 min sin uso y el primer
// pedido puede tardar bastante en "despertarlo". Damos margen.
const FETCH_TIMEOUT_MS = 20000;

// ─── Estado en memoria ───────────────────────────────────────────────────────
let tokenEnMemoria: string | null = null;
let online = true;
let sincronizando = false;
const listeners = new Set<() => void>();

function avisar() { listeners.forEach(fn => { try { fn(); } catch { /* */ } }); }

/** Suscribirse a cambios (conexión / pendientes). Devuelve la función para desuscribir. */
export function onEstadoRed(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function estaOnline(): boolean { return online; }
export function estaSincronizando(): boolean { return sincronizando; }

// ─── Sesión ──────────────────────────────────────────────────────────────────
export async function initSesion(): Promise<void> {
  tokenEnMemoria = await getString(K_TOKEN);
}

export function getToken(): string | null { return tokenEnMemoria; }

export async function guardarToken(token: string, usuario?: unknown): Promise<void> {
  tokenEnMemoria = token;
  await setString(K_TOKEN, token);
  if (usuario !== undefined) await setJSON(K_USER, usuario);
}

export async function getUsuarioGuardado<T = any>(): Promise<T | null> {
  return getJSON<T | null>(K_USER, null);
}

/** ¿Hay una sesión guardada de un login anterior? (para entrar sin internet) */
export async function haySesionGuardada(): Promise<boolean> {
  return !!(await getString(K_TOKEN));
}

export async function limpiarSesion(): Promise<void> {
  tokenEnMemoria = null;
  await Promise.all([
    remove(K_TOKEN), remove(K_USER), remove(K_OUTBOX), remove(K_FAILED),
  ]);
  // Borrar cachés de datos
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(k => k.startsWith(K_CACHE)));
  } catch { /* */ }
  avisar();
}

// Alias histórico para no romper imports viejos
export const limpiarToken = limpiarSesion;

function authHeaders(): Record<string, string> {
  return tokenEnMemoria ? { Authorization: `Bearer ${tokenEnMemoria}` } : {};
}

// ─── Caché de GET ────────────────────────────────────────────────────────────
async function cacheGuardar(path: string, body: string) { await setString(K_CACHE + path, body); }
async function cacheLeer(path: string): Promise<string | null> { return getString(K_CACHE + path); }

async function cacheInvalidar(paths: string[]) {
  await Promise.all(paths.map(p => remove(K_CACHE + p)));
}

// ─── Outbox (escrituras pendientes) ──────────────────────────────────────────
type OpPendiente = {
  id: string;
  method: string;
  path: string;
  body?: string;
  ts: number;
};

export async function getPendientes(): Promise<OpPendiente[]> {
  return getJSON<OpPendiente[]>(K_OUTBOX, []);
}
export async function getFallidos(): Promise<OpPendiente[]> {
  return getJSON<OpPendiente[]>(K_FAILED, []);
}
export async function contarPendientes(): Promise<number> {
  return (await getPendientes()).length;
}

async function encolar(op: Omit<OpPendiente, 'id' | 'ts'>): Promise<void> {
  const lista = await getPendientes();
  lista.push({ ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now() });
  await setJSON(K_OUTBOX, lista);
  avisar();
}

/**
 * Envía al servidor todo lo que quedó pendiente, en orden.
 * Se llama solo al recuperar la conexión, o manualmente con sincronizarAhora().
 */
export async function sincronizarAhora(): Promise<{ enviados: number; pendientes: number; fallidos: number }> {
  if (sincronizando || !online || !tokenEnMemoria) {
    const p = await getPendientes();
    return { enviados: 0, pendientes: p.length, fallidos: (await getFallidos()).length };
  }
  sincronizando = true;
  avisar();

  let enviados = 0;
  try {
    let lista = await getPendientes();
    while (lista.length > 0) {
      const op = lista[0];
      let resp: Response;
      try {
        resp = await fetchConTimeout(`${API_BASE}${op.path}`, {
          method: op.method,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: op.body,
          credentials: 'include',
        });
      } catch {
        break; // se cortó internet de nuevo → reintentar más tarde
      }

      if (resp.ok || resp.status === 404 || resp.status === 409) {
        // Éxito, o el recurso ya no existe / conflicto resuelto → damos por hecho
        enviados++;
        lista = lista.slice(1);
        await setJSON(K_OUTBOX, lista);
        avisar();
      } else if (resp.status === 401) {
        break; // sesión vencida → que el usuario vuelva a entrar
      } else if (resp.status >= 500) {
        break; // problema del servidor → reintentar luego
      } else {
        // 400/422: el servidor lo rechazó y nunca va a andar. Lo movemos a
        // "fallidos" para no perderlo ni bloquear la cola.
        const fallidos = await getFallidos();
        fallidos.push(op);
        await setJSON(K_FAILED, fallidos);
        lista = lista.slice(1);
        await setJSON(K_OUTBOX, lista);
        avisar();
      }
    }
    // Los datos del servidor cambiaron → tirar toda la caché para releer fresco
    await cacheInvalidarTodo();
  } finally {
    sincronizando = false;
    avisar();
  }

  return {
    enviados,
    pendientes: (await getPendientes()).length,
    fallidos: (await getFallidos()).length,
  };
}

// ─── fetch con timeout ───────────────────────────────────────────────────────
function fetchConTimeout(url: string, opts: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ─── Respuesta sintética (para servir desde caché / cola sin romper llamadas) ─
export type RespuestaApi = {
  status: number;
  ok: boolean;
  offline: boolean;
  json: () => Promise<any>;
  text: () => Promise<string>;
};

function respSintetica(status: number, body: string, offline = false): RespuestaApi {
  return {
    status,
    ok: status >= 200 && status < 300,
    offline,
    json: async () => { try { return JSON.parse(body || '{}'); } catch { return {}; } },
    text: async () => body || '',
  };
}

function envolver(r: Response, body: string): RespuestaApi {
  return {
    status: r.status,
    ok: r.ok,
    offline: false,
    json: async () => { try { return JSON.parse(body || '{}'); } catch { return {}; } },
    text: async () => body,
  };
}

// Inyecta las obras creadas offline en los listados, para que se vean aunque
// todavía no estén en el servidor.
async function mergeObrasPendientes(path: string, cachedBody: string | null): Promise<string> {
  const pend = (await getPendientes()).filter(
    o => o.method === 'POST' && o.path === '/obras'
  );
  if (path === '/resumen') {
    const base = cachedBody ? safeParse(cachedBody) : { obras: [], totales: { total_por_cobrar: 0, ganancia_total: 0, obras_activas: 0 } };
    const extra = pend.map((o, i) => obraCard(o, -(i + 1)));
    return JSON.stringify({ ...base, obras: [...extra, ...(base.obras || [])] });
  }
  if (path === '/obras') {
    const base = cachedBody ? safeParse(cachedBody) : [];
    const extra = pend.map((o, i) => obraCard(o, -(i + 1)));
    return JSON.stringify([...extra, ...(Array.isArray(base) ? base : [])]);
  }
  return cachedBody ?? 'null';
}

function safeParse(s: string): any { try { return JSON.parse(s); } catch { return null; } }

function obraCard(op: OpPendiente, id: number) {
  const d = safeParse(op.body || '{}') || {};
  return {
    id,
    nombre_cliente: d.nombre_cliente || 'Obra sin sincronizar',
    estado: 'activa',
    tipo: d.tipo || 'normal',
    total_presupuestado: 0,
    total_cobrado: 0,
    saldo_pendiente: 0,
    ganancia_total: 0,
    tiene_presupuesto: false,
    _pendiente: true, // marca para que la UI muestre "sin sincronizar"
  };
}

// ─── Overlay de NÓMINA para trabajar offline ─────────────────────────────────
// Espeja la lógica del backend para que la nómina cargada sin señal se vea y se
// pueda editar igual que si estuviera guardada, hasta que sincronice.

/** Lunes de la semana de una fecha (igual que getLunes del backend). */
function lunesDe(fecha: Date = new Date()): string {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=dom ... 6=sab
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
  return d.toISOString().split('T')[0];
}

function diasTrabajados(ausencias: string[] = []): number {
  return Math.max(0, 6 - ausencias.length);
}

/** % de reserva de herramientas de una obra, sacado de lo que haya en caché. */
async function reservaPctDe(obraId: string): Promise<number> {
  for (const p of [`/obras/${obraId}`, `/obras/${obraId}/nomina/actual`, `/obras/${obraId}/saldos`]) {
    const c = safeParse((await cacheLeer(p)) || '');
    const v = c?.reserva_herramienta_pct ?? c?.obra?.reserva_herramienta_pct;
    if (typeof v === 'number') return v;
  }
  return 0;
}

/** Convierte un POST de nómina en cola en una "semana" con la misma forma que devuelve el server. */
function semanaDesdePendiente(op: OpPendiente, id: number, reservaPct: number) {
  const d = safeParse(op.body || '{}') || {};
  const peones = (d.peones || []).map((p: any) => {
    const dias = diasTrabajados(p.ausencias);
    const jornal = parseFloat(p.jornal_diario) || 0;
    return {
      nombre: p.nombre,
      rol: p.rol || 'ayudante',
      jornal_diario: jornal,
      dias_trabajados: dias,
      ausencias: p.ausencias || [],
      total_peon: +(jornal * dias).toFixed(2),
    };
  });
  const monto = parseFloat(d.monto_recibido) || 0;
  const totalPeones = +peones.reduce((s: number, p: any) => s + p.total_peon, 0).toFixed(2);
  const reserva = +(monto * (reservaPct / 100)).toFixed(2);
  return {
    id,
    fecha_lunes: d.fecha_lunes || lunesDe(),
    monto_recibido: monto,
    quien_pago: d.quien_pago || null,
    total_nomina_peones: totalPeones,
    reserva_herramienta: reserva,
    ganancia_contratista: +(monto - totalPeones - reserva).toFixed(2),
    notas: d.notas || null,
    peones,
    _pendiente: true,
  };
}

async function pendientesNomina(obraId: string): Promise<OpPendiente[]> {
  return (await getPendientes()).filter(
    o => o.method === 'POST' && o.path === `/obras/${obraId}/nomina`
  );
}

/** GET /obras/:id/nomina/actual sin conexión. */
async function overlayNominaActual(obraId: string, cached: string | null): Promise<string> {
  const lunes = lunesDe();
  const pct = await reservaPctDe(obraId);

  const dePeriodo = (await pendientesNomina(obraId)).filter(o => {
    const b = safeParse(o.body || '{}') || {};
    return (b.fecha_lunes || lunes) === lunes;
  });
  if (dePeriodo.length) {
    const s = semanaDesdePendiente(dePeriodo[dePeriodo.length - 1], -1, pct);
    return JSON.stringify({ existe: true, reserva_herramienta_pct: pct, ...s });
  }

  const c = safeParse(cached || '');
  if (c && c.fecha_lunes === lunes) return JSON.stringify(c); // misma semana

  // Semana nueva (o sin caché): formulario vacío usable, reusando peones
  // conocidos como sugeridos.
  const sugeridos = ((c?.peones ?? c?.peones_sugeridos ?? []) as any[]).map(p => ({
    nombre: p.nombre,
    rol: p.rol,
    jornal_diario: p.jornal_diario ?? p.jornal_default ?? 0,
    ausencias: [],
  }));
  return JSON.stringify({ existe: false, fecha_lunes: lunes, reserva_herramienta_pct: pct, peones_sugeridos: sugeridos });
}

/** GET /obras/:id/nomina (historial) sin conexión. */
async function overlayNominaHistorial(obraId: string, cached: string | null): Promise<string> {
  const base = safeParse(cached || '') || [];
  const lista: any[] = Array.isArray(base) ? base : [];
  const pct = await reservaPctDe(obraId);

  const pend = (await pendientesNomina(obraId)).map((o, i) => semanaDesdePendiente(o, -(i + 1), pct));
  const fechasPend = new Set(pend.map(s => s.fecha_lunes));
  const delServidor = lista.filter(s => !fechasPend.has(s.fecha_lunes));

  return JSON.stringify(
    [...pend, ...delServidor].sort((a, b) => String(b.fecha_lunes).localeCompare(String(a.fecha_lunes)))
  );
}

/** ¿A qué obra pertenece este path? */
function obraIdDe(path: string): string | null {
  const m = path.match(/^\/obras\/(\d+)(\/|$)/);
  return m ? m[1] : null;
}

/** Borra todas las cachés de datos (tras sincronizar, para releer fresco). */
async function cacheInvalidarTodo(): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(k => k.startsWith(K_CACHE)));
  } catch { /* */ }
}

/** Borra las cachés afectadas por un cambio en una obra. */
async function cacheInvalidarObra(obraId: string): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const keys = await AsyncStorage.getAllKeys();
    const pref = `${K_CACHE}/obras/${obraId}`;
    await AsyncStorage.multiRemove([
      `${K_CACHE}/resumen`, `${K_CACHE}/obras`,
      ...keys.filter(k => k.startsWith(pref)),
    ]);
  } catch { /* */ }
}

// ─── apiFetch: el punto de entrada que usan todas las pantallas ───────────────
export async function apiFetch(path: string, options: RequestInit = {}): Promise<RespuestaApi> {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers as Record<string, string> ?? {}),
  };

  // ---------- LECTURAS ----------
  if (method === 'GET') {
    if (online) {
      try {
        const r = await fetchConTimeout(url, { ...options, method, headers, credentials: 'include' });
        const body = await r.text();
        if (r.ok) { await cacheGuardar(path, body); return envolver(r, body); }
        return envolver(r, body); // 401/404/500: pasar tal cual, sin cachear
      } catch {
        /* sin conexión real → cae a caché abajo */
      }
    }
    const cached = await cacheLeer(path);
    if (path === '/resumen' || path === '/obras') {
      return respSintetica(200, await mergeObrasPendientes(path, cached), true);
    }
    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/obras\/(\d+)\/nomina\/actual$/))) {
      return respSintetica(200, await overlayNominaActual(m[1], cached), true);
    }
    if ((m = path.match(/^\/obras\/(\d+)\/nomina$/))) {
      return respSintetica(200, await overlayNominaHistorial(m[1], cached), true);
    }
    if (cached != null) return respSintetica(200, cached, true);
    return respSintetica(503, JSON.stringify({ error: 'Sin conexión y sin datos guardados todavía.' }), true);
  }

  // ---------- ESCRITURAS ----------
  const oid = obraIdDe(path);
  if (online) {
    try {
      const r = await fetchConTimeout(url, { ...options, method, headers, credentials: 'include' });
      const body = await r.text();
      if (r.ok) await (oid ? cacheInvalidarObra(oid) : cacheInvalidar(['/resumen', '/obras', path]));
      return envolver(r, body);
    } catch {
      /* se cortó internet justo ahora → encolar abajo */
    }
  }

  await encolar({ method, path, body: options.body as string | undefined });
  await (oid ? cacheInvalidarObra(oid) : cacheInvalidar(['/resumen', '/obras']));
  return respSintetica(
    202,
    JSON.stringify({
      ok: true,
      offline: true,
      queued: true,
      mensaje: 'Guardado en este teléfono. Se enviará solo cuando haya internet.',
    }),
    true,
  );
}

// ─── Vigilar la conexión ─────────────────────────────────────────────────────
let watchIniciado = false;
export function iniciarVigilanciaRed(): void {
  if (watchIniciado) return;
  watchIniciado = true;
  NetInfo.addEventListener(state => {
    const ahora = !!state.isConnected && state.isInternetReachable !== false;
    const eraOffline = !online;
    online = ahora;
    avisar();
    if (ahora && eraOffline) { sincronizarAhora(); } // volvió internet → sincronizar
  });
}
