import { initialDatabase } from '../server/seedData.js';

export const STORAGE_KEY = 'beit_el_aila_clean_db_v5';
const LEGACY_KEYS = [
  'beit_el_aila_clean_db_v4',
  'beit_el_aila_offline_db_v3',
  'beit_el_aila_erp_cache_v2',
  'beit_el_aila_erp_cache_v1',
  'maktabet_el_aila_erp_cache_v1'
];

export const FIREBASE_DB_URL = 'https://beit-el-aila-erp-default-rtdb.firebaseio.com/state_v2.json';

const DUMMY_BARCODES = new Set([
  '622100100101', '622100100201', '622100100301', '622100200101',
  '622100200201', '622100300101', '622100300201', '622100300301',
  '622100400101', '622100400201', '622100500101', '622100500201',
  '622100600101', '622100700101', '622100700201', '622100600201',
  '622100800101'
]);

const DUMMY_NOTE_CODES = new Set([
  'M-3SEC-PHY-01', 'M-3PREP-EN-01', 'M-1SEC-CHEM-01', 'M-6PRIM-AR-01'
]);

function cleanLegacyCache() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  LEGACY_KEYS.forEach(k => {
    try {
      window.localStorage.removeItem(k);
    } catch (e) {
      // ignore
    }
  });
}

export function normalizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return structuredClone(initialDatabase);

  parsed._initialized = true;
  parsed._cleanV5 = true;

  // Firebase RTDB drops empty arrays; ensure all collections exist as arrays (defaulting to empty [])
  const emptyableCollections = [
    'categories', 'products', 'studyNotes', 'noteReservations',
    'printJobs', 'suppliers', 'sales', 'onlineOrders',
    'expenses', 'shifts', 'syncQueue'
  ];
  emptyableCollections.forEach(key => {
    if (!Array.isArray(parsed[key])) {
      parsed[key] = [];
    }
  });

  // Strip out any legacy dummy items if they ever appear
  parsed.products = parsed.products.filter(p => !DUMMY_BARCODES.has(p.barcode));
  parsed.studyNotes = parsed.studyNotes.filter(n => !DUMMY_NOTE_CODES.has(n.code));

  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    parsed.users = structuredClone(initialDatabase.users);
  }

  if (!Array.isArray(parsed.customers) || parsed.customers.length === 0) {
    parsed.customers = structuredClone(initialDatabase.customers);
  } else {
    parsed.customers = parsed.customers.filter(
      c => !['01066778899', '01099887766', '01122334488'].includes(c.phone)
    );
    if (parsed.customers[0]?.id === 'CUS-1' && parsed.sales.length === 0) {
      parsed.customers[0].totalPurchases = 0;
    }
  }

  if (!parsed.settings) {
    parsed.settings = structuredClone(initialDatabase.settings);
  } else {
    if (!parsed.settings.storeName || parsed.settings.storeName === 'مكتبة العيلة') {
      parsed.settings.storeName = 'بيت العيلة';
    }
    if (!parsed.settings.logoUrl) {
      parsed.settings.logoUrl = '/logo.jpg';
    }
    if (parsed.settings.printPrices && !parsed.settings.printPrices._ownerConfiguredCosts) {
      parsed.settings.printPrices.paperCostPerSheetA4 = 0;
      parsed.settings.printPrices.tonerCostPerPageBW = 0;
      parsed.settings.printPrices.tonerCostPerPageColor = 0;
      parsed.settings.printPrices.spiralSmallCost = 0;
      parsed.settings.printPrices.spiralLargeCost = 0;
      parsed.settings.printPrices.thermalCost = 0;
      parsed.settings.printPrices.laminationCost = 0;
    }
  }
  return parsed;
}

export function getLocalCache() {
  cleanLegacyCache();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeState(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('Failed to read local cache', e);
  }
  const initial = structuredClone(initialDatabase);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch (e) {
    // ignore
  }
  return initial;
}

export function saveLocalCache(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  } catch (e) {
    console.warn('Failed to save local cache', e);
  }
}

export const DIRTY_OFFLINE_KEY = 'beit_el_aila_dirty_offline_v5';

export async function pushStateToFirebase(state) {
  try {
    const normalized = normalizeState(state);
    normalized._updatedAt = Date.now();
    const res = await fetch(FIREBASE_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    });
    if (res.ok) {
      try {
        localStorage.removeItem(DIRTY_OFFLINE_KEY);
      } catch (e) {
        // ignore
      }
      return true;
    }
    throw new Error(`Firebase PUT ${res.status}`);
  } catch (e) {
    try {
      localStorage.setItem(DIRTY_OFFLINE_KEY, '1');
    } catch (err) {
      // ignore
    }
    console.warn('Firebase Cloud Sync deferred (Offline mode):', e.message);
    return false;
  }
}

export async function fetchStateFromFirebase() {
  try {
    // If the user worked offline and has unsynced local changes, push them to Firebase first!
    if (typeof window !== 'undefined' && localStorage.getItem(DIRTY_OFFLINE_KEY) === '1') {
      const localPending = getLocalCache();
      const pushed = await pushStateToFirebase(localPending);
      if (pushed) {
        return { state: localPending, cloudConnected: true };
      }
    }

    const res = await fetch(FIREBASE_DB_URL);
    if (!res.ok) throw new Error(`Firebase HTTP ${res.status}`);
    const data = await res.json();
    if (data && (data.settings || data.users || data._initialized)) {
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
        const nextState = data?.state || (endpoint === '/api/state' && (data?.settings || data?.products) ? data : null);
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
