// utils/api.ts
// Centraliza la URL base y el header de autorización.
// Todas las pantallas importan desde acá — si cambia algo, se cambia en un solo lugar.

// Acepta EXPO_PUBLIC_API_URL (nombre usado en .env) o EXPO_PUBLIC_API_BASE.
// Normaliza: sin barra final y garantizando que termina en /api.
const RAW_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'https://constructordan.onrender.com/api';

export const API_BASE = RAW_BASE.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';

/**
 * Devuelve el header Authorization con el token JWT guardado en localStorage.
 * Retorna objeto vacío si no hay token (el backend rechazará con 401).
 */
export const getAuthHeaders = (): Record<string, string> => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('constructor-dan-token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  // En entornos React Native / Expo no hay `window` — usar global como fallback
  const gtoken = (global as any)?.constructorDanToken;
  return gtoken ? { Authorization: `Bearer ${gtoken}` } : {};
};

/**
 * Wrapper de fetch que incluye automáticamente:
 * - Content-Type: application/json
 * - Authorization header con el token
 * - credentials: 'include' para cookies
 *
 * Uso:
 *   const res = await apiFetch('/obras');
 *   const res = await apiFetch('/obras', { method: 'POST', body: JSON.stringify(data) });
 */
export const apiFetch = (path: string, options: RequestInit = {}) => {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers ?? {}),
    },
  });
};

/**
 * Guarda el token JWT en localStorage después del login.
 */
export const guardarToken = (token: string) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('constructor-dan-token', token);
  }
  // Guardar en global para apps nativas (Expo) que no tienen localStorage
  try { (global as any).constructorDanToken = token; } catch { /* silencioso */ }
};

/**
 * Elimina cualquier dato persistido de autenticación al hacer logout.
 */
export const limpiarSesion = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('constructor-dan-token');
    window.sessionStorage.removeItem('constructor-dan-token');

    const storageKeys = ['constructor-dan-token', 'constructor-dan-user'];
    for (const key of storageKeys) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  }
  try { delete (global as any).constructorDanToken; } catch { /* silencioso */ }
};

/**
 * Alias conservado para no romper imports existentes.
 */
export const limpiarToken = limpiarSesion;
