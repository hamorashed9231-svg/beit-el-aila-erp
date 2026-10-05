import { initialDatabase } from '../server/seedData.js';

export const STORAGE_KEY = 'beit_el_aila_offline_db_v3';

export function getLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure storeName is updated to بيت العيلة and logoUrl is present
      if (parsed.settings) {
        if (!parsed.settings.storeName || parsed.settings.storeName === 'مكتبة العيلة') {
          parsed.settings.storeName = 'بيت العيلة';
        }
        if (!parsed.settings.logoUrl) {
          parsed.settings.logoUrl = '/logo.jpg';
        }
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read local cache', e);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDatabase));
  return structuredClone(initialDatabase);
}

export function saveLocalCache(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save local cache', e);
  }
}

export async function apiRequest(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data && data.state) {
      saveLocalCache(data.state);
    } else if (endpoint === '/api/state' && data && data.products) {
      saveLocalCache(data);
    }
    return { ...data, offlineFallback: false };
  } catch (err) {
    console.warn(`API call to ${endpoint} fell back to Offline Engine:`, err.message);
    const localState = getLocalCache();
    return { state: localState, offlineFallback: true, error: err.message };
  }
}
