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

  // Firebase RTDB drops empty arrays or converts arrays with numeric keys into objects; ensure all collections exist as clean arrays
  const emptyableCollections = [
    'categories', 'products', 'studyNotes', 'noteReservations',
    'printJobs', 'suppliers', 'sales', 'onlineOrders',
    'expenses', 'shifts', 'syncQueue'
  ];
  emptyableCollections.forEach(key => {
    if (Array.isArray(parsed[key])) {
      parsed[key] = parsed[key].filter(Boolean);
    } else if (parsed[key] && typeof parsed[key] === 'object') {
      parsed[key] = Object.values(parsed[key]).filter(Boolean);
    } else {
      parsed[key] = [];
    }
  });

  // Strip out any legacy dummy items if they ever appear
  parsed.products = parsed.products.filter(p => !DUMMY_BARCODES.has(p.barcode));
  parsed.studyNotes = parsed.studyNotes.filter(n => !DUMMY_NOTE_CODES.has(n.code));

  // Fix bogus default wholesalePrice values (e.g. wholesalePrice stuck at default 9)
  parsed.products.forEach(p => {
    if (p.wholesalePrice === 9 && p.sellPrice !== 10) {
      p.wholesalePrice = p.sellPrice;
    } else if (p.wholesalePrice && p.wholesalePrice >= p.sellPrice) {
      p.wholesalePrice = p.sellPrice;
    }
  });

  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    parsed.users = [
      { id: 'USR-1', name: 'المدير العام Ahmed kharbosh', username: 'admin', pin: '6101994', role: 'admin', permissions: ['all'], active: true },
      { id: 'USR-2', name: 'كاشير الوردية الصباحية (شيفت 1)', username: 'cashier_m', pin: '1111', role: 'cashier', permissions: ['pos', 'print'], shiftName: 'الوردية الصباحية', active: true },
      { id: 'USR-3', name: 'كاشير الوردية المسائية (شيفت 2)', username: 'cashier_e', pin: '2222', role: 'cashier', permissions: ['pos', 'print'], shiftName: 'الوردية المسائية', active: true }
    ];
  } else {
    const admin = parsed.users.find(u => u.id === 'USR-1' || u.role === 'admin') || parsed.users[0];
    if (admin) {
      admin.name = 'المدير العام Ahmed kharbosh';
      admin.pin = '6101994';
      admin.role = 'admin';
    }
    // Ensure morning and evening cashier shifts exist
    const hasMorning = parsed.users.some(u => u.id === 'USR-2' || u.shiftName === 'الوردية الصباحية');
    const hasEvening = parsed.users.some(u => u.id === 'USR-3' || u.shiftName === 'الوردية المسائية');
    if (!hasMorning) {
      parsed.users.push({
        id: 'USR-2',
        name: 'كاشير الوردية الصباحية (شيفت 1)',
        username: 'cashier_m',
        pin: '1111',
        role: 'cashier',
        permissions: ['pos', 'print'],
        shiftName: 'الوردية الصباحية',
        active: true
      });
    }
    if (!hasEvening) {
      parsed.users.push({
        id: 'USR-3',
        name: 'كاشير الوردية المسائية (شيفت 2)',
        username: 'cashier_e',
        pin: '2222',
        role: 'cashier',
        permissions: ['pos', 'print'],
        shiftName: 'الوردية المسائية',
        active: true
      });
    }
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

export function generateNextId(prefix, list = [], startAt = 1000) {
  let maxNum = startAt;
  if (Array.isArray(list)) {
    list.forEach(item => {
      if (item && typeof item.id === 'string' && item.id.startsWith(`${prefix}-`)) {
        const numPart = parseInt(item.id.slice(prefix.length + 1), 10);
        if (!Number.isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
  }
  return `${prefix}-${maxNum + 1}`;
}

let inMemoryState = null;
let activeMutationsCount = 0;
let lastMutationTimestamp = 0;

export function beginMutation() {
  activeMutationsCount += 1;
  lastMutationTimestamp = Date.now();
  try {
    localStorage.setItem(DIRTY_OFFLINE_KEY, '1');
  } catch (e) {
    // ignore
  }
}

export function endMutation() {
  activeMutationsCount = Math.max(0, activeMutationsCount - 1);
  lastMutationTimestamp = Date.now();
}

export function isMutationInProgress() {
  return activeMutationsCount > 0 || (Date.now() - lastMutationTimestamp < 5000);
}

export function getLocalCache() {
  cleanLegacyCache();
  if (inMemoryState) {
    return inMemoryState;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryState = normalizeState(JSON.parse(raw));
      return inMemoryState;
    }
  } catch (e) {
    console.warn('Failed to read local cache', e);
  }
  const initial = normalizeState(structuredClone(initialDatabase));
  inMemoryState = initial;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch (e) {
    // ignore
  }
  return initial;
}

export function saveLocalCache(state) {
  const normalized = normalizeState(state);
  inMemoryState = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Failed to save local cache', e);
  }
  return normalized;
}

export const DIRTY_OFFLINE_KEY = 'beit_el_aila_dirty_offline_v5';

export async function pushStateToFirebase(state) {
  try {
    const normalized = normalizeState(state);
    if (!normalized._updatedAt) {
      normalized._updatedAt = Date.now();
    }
    const pushTimestamp = normalized._updatedAt;
    saveLocalCache(normalized);

    const res = await fetch(FIREBASE_DB_URL, {
      method: 'PUT',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    });
    if (res.ok) {
      // Only clear dirty flag if no newer local mutation happened while PUT was in flight
      const latestLocal = getLocalCache();
      if (!latestLocal._updatedAt || latestLocal._updatedAt <= pushTimestamp) {
        try {
          localStorage.removeItem(DIRTY_OFFLINE_KEY);
        } catch (e) {
          // ignore
        }
      } else {
        // A newer mutation occurred while uploading; push the latest state now
        await pushStateToFirebase(latestLocal);
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

function hasLocalData(state) {
  if (!state) return false;
  return (
    (state.products && state.products.length > 0) ||
    (state.categories && state.categories.length > 0) ||
    (state.sales && state.sales.length > 0) ||
    (state.studyNotes && state.studyNotes.length > 0) ||
    (state.printJobs && state.printJobs.length > 0) ||
    (state.suppliers && state.suppliers.length > 0) ||
    (state.expenses && state.expenses.length > 0) ||
    (state.onlineOrders && state.onlineOrders.length > 0)
  );
}

export async function fetchStateFromFirebase() {
  try {
    // Never overwrite local state if a mutation is currently in progress
    if (isMutationInProgress()) {
      return { state: getLocalCache(), cloudConnected: true };
    }

    // If the user has unsynced local changes, push them to Firebase first!
    if (typeof window !== 'undefined' && localStorage.getItem(DIRTY_OFFLINE_KEY) === '1') {
      const localPending = getLocalCache();
      const pushed = await pushStateToFirebase(localPending);
      return { state: localPending, cloudConnected: pushed };
    }

    const res = await fetch(FIREBASE_DB_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Firebase HTTP ${res.status}`);
    const data = await res.json();

    // Re-check if user mutated state while GET request was in-flight
    if (isMutationInProgress() || (typeof window !== 'undefined' && localStorage.getItem(DIRTY_OFFLINE_KEY) === '1')) {
      return { state: getLocalCache(), cloudConnected: true };
    }

    if (data && (data.settings || data.users || data._initialized)) {
      const cloudNormalized = normalizeState(data);
      const localCurrent = getLocalCache();

      const localTime = Number(localCurrent._updatedAt) || 0;
      const cloudTime = Number(cloudNormalized._updatedAt) || 0;

      // Protect local data if local state is newer or equal to cloud OR if cloud has no timestamp & is empty while local has data OR a recent mutation occurred
      if (
        (localTime > 0 && localTime >= cloudTime) ||
        (cloudTime === 0 && !hasLocalData(cloudNormalized) && hasLocalData(localCurrent)) ||
        (Date.now() - lastMutationTimestamp < 8000)
      ) {
        // Merge any new online orders or online print jobs from cloud before pushing local state back up
        let merged = false;
        if (Array.isArray(cloudNormalized.onlineOrders)) {
          cloudNormalized.onlineOrders.forEach(co => {
            if (!localCurrent.onlineOrders.some(lo => lo.id === co.id)) {
              localCurrent.onlineOrders.unshift(co);
              merged = true;
            }
          });
        }
        if (Array.isArray(cloudNormalized.printJobs)) {
          cloudNormalized.printJobs.forEach(cp => {
            if (!localCurrent.printJobs.some(lp => lp.id === cp.id)) {
              localCurrent.printJobs.unshift(cp);
              merged = true;
            }
          });
        }
        if (merged) {
          saveLocalCache(localCurrent);
          await pushStateToFirebase(localCurrent);
        }
        return { state: localCurrent, cloudConnected: true };
      }

      saveLocalCache(cloudNormalized);
      return { state: cloudNormalized, cloudConnected: true };
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
  const isGetState = endpoint === '/api/state' && (!options.method || options.method === 'GET');
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 1. Try local Express server first when running locally
  if (isLocalhost) {
    try {
      const res = await fetch(endpoint, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (res.ok) {
        const data = await res.json();
        const nextState = data?.state || (isGetState && (data?.settings || data?.products) ? data : null);
        if (nextState) {
          const normalized = normalizeState(nextState);
          if (!isGetState) {
            normalized._updatedAt = Date.now();
          }
          saveLocalCache(normalized);
          if (!isGetState) {
            pushStateToFirebase(normalized);
          }
        }
        return { ...data, offlineFallback: false };
      }
    } catch (err) {
      // Fall through to Firebase Cloud / Offline Engine
    }
  }

  // 2. When hosted on Firebase (or when local Node server is off):
  if (isGetState) {
    const fb = await fetchStateFromFirebase();
    if (fb.cloudConnected) {
      return { ...fb.state, offlineFallback: false, firebaseCloud: true };
    }
  }

  // Return offlineFallback: true so App.jsx runs its state updater and syncs the resulting state to Firebase
  const localState = getLocalCache();
  return { state: localState, offlineFallback: true };
}
