import { initialDatabase } from '../server/seedData.js';

export const STORAGE_KEY = 'beit_el_aila_offline_db_v3';
export const FIREBASE_DB_URL = 'https://beit-el-aila-erp-default-rtdb.firebaseio.com/state.json';

function normalizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return structuredClone(initialDatabase);
  // Firebase RTDB drops empty arrays; ensure all collections exist as arrays
  const collections = [
    'users', 'categories', 'products', 'studyNotes', 'noteReservations',
    'printJobs', 'customers', 'suppliers', 'sales', 'onlineOrders',
    'expenses', 'shifts', 'syncQueue'
  ];
  collections.forEach(key => {
    if (!Array.isArray(parsed[key])) {
      parsed[key] = initialDatabase[key] ? structuredClone(initialDatabase[key]) : [];
    }
  });
  if (!parsed.settings) {
    parsed.settings = structuredClone(initialDatabase.settings);
  } else {
    if (!parsed.settings.storeName || parsed.settings.storeName === 'مكتبة العيلة') {
      parsed.settings.storeName = 'بيت العيلة';
    }
    if (!parsed.settings.logoUrl) {
      parsed.settings.logoUrl = '/logo.jpg';
    }
  }
  return parsed;
}

export function getLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeState(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('Failed to read local cache', e);
  }
  const initial = structuredClone(initialDatabase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function saveLocalCache(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save local cache', e);
  }
}

export async function pushStateToFirebase(state) {
  try {
    const res = await fetch(FIREBASE_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    return res.ok;
  } catch (e) {
    console.warn('Firebase Cloud Sync deferred (Offline mode):', e.message);
    return false;
  }
}

export async function fetchStateFromFirebase() {
  try {
    const res = await fetch(FIREBASE_DB_URL);
    if (!res.ok) throw new Error(`Firebase HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.products) {
      const normalized = normalizeState(data);
      saveLocalCache(normalized);
      return { state: normalized, cloudConnected: true };
    } else {
      // Seed Firebase RTDB on first run
      const initial = getLocalCache();
      await pushStateToFirebase(initial);
      return { state: initial, cloudConnected: true };
    }
  } catch (e) {
    return { state: getLocalCache(), cloudConnected: false, error: e.message };
  }
}

export async function apiRequest(endpoint, options = {}) {
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 1. Try local Express server first when running locally
  if (isLocalhost) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (res.ok) {
        const data = await res.json();
        const nextState = data?.state || (endpoint === '/api/state' && data?.products ? data : null);
        if (nextState) {
          const normalized = normalizeState(nextState);
          saveLocalCache(normalized);
          // Background sync to Firebase Cloud
          pushStateToFirebase(normalized);
        }
        return { ...data, offlineFallback: false };
      }
    } catch (err) {
      // Fall through to Firebase Cloud / Offline Engine
    }
  }

  // 2. When hosted on Firebase (or when local Node server is off):
  if (endpoint === '/api/state' && (!options.method || options.method === 'GET')) {
    const fb = await fetchStateFromFirebase();
    if (fb.cloudConnected) {
      return { ...fb.state, offlineFallback: false, firebaseCloud: true };
    }
  }

  // Return offlineFallback: true so App.jsx runs its state updater and we sync the resulting state to Firebase
  const localState = getLocalCache();
  return { state: localState, offlineFallback: true };
}
