import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Package, Printer, Users, Globe, BarChart3,
  Cloud, Wifi, WifiOff, RefreshCw, BookOpen, Bell, ShieldCheck, AlertTriangle, ExternalLink,
  Lock, Unlock, KeyRound, Eye, EyeOff
} from 'lucide-react';
import {
  getLocalCache,
  saveLocalCache,
  apiRequest,
  pushStateToFirebase,
  STORAGE_KEY,
  generateNextId,
  beginMutation,
  endMutation,
  isMutationInProgress
} from './api.js';
import POSView from './components/POSView.jsx';
import InventoryView from './components/InventoryView.jsx';
import PrintCenterView from './components/PrintCenterView.jsx';
import CRMView from './components/CRMView.jsx';
import OnlineStoreView from './components/OnlineStoreView.jsx';
import ReportsAndAdminView from './components/ReportsAndAdminView.jsx';
import ReceiptModal from './components/ReceiptModal.jsx';
import BarcodeModal from './components/BarcodeModal.jsx';

export const MANAGER_PASSWORD = '6101994';
export const PROTECTED_TABS = new Set(['inventory', 'crm', 'online_store', 'reports']);

export default function App() {
  const [state, setState] = useState(() => getLocalCache());
  const [activeNav, setActiveNav] = useState('pos'); // pos | inventory | print_center | crm | online_store | reports
  const [currentUser, setCurrentUser] = useState(() => getLocalCache().users?.[0]);
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Manager Password Protection (Password: 6101994)
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [passwordModalTarget, setPasswordModalTarget] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Detect if opened in Standalone Customer Store mode (/store, ?mode=store, #store, OR any Mobile/Tablet device)
  const [isStandaloneStore] = useState(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get('erp') === '1' || params.get('admin') === '1') return false;
    if (path.startsWith('/store') || params.get('mode') === 'store' || hash === '#store') return true;
    const ua = navigator.userAgent || '';
    const isMobileOrTabletUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
    const isTouchTabletOrPhone = (navigator.maxTouchPoints > 1 && window.innerWidth < 1024) || window.innerWidth < 768;
    return isMobileOrTabletUA || isTouchTabletOrPhone;
  });

  // Modals
  const [activeReceiptSale, setActiveReceiptSale] = useState(null);
  const [activeBarcodeItem, setActiveBarcodeItem] = useState(null);

  // Initial fetch + live sync between Standalone Store & Library ERP (Online & Offline)
  useEffect(() => {
    async function fetchLatestState() {
      if (isMutationInProgress()) return;
      const res = await apiRequest('/api/state');
      if (isMutationInProgress()) return;
      if (!res.offlineFallback && (res.settings || res.products)) {
        setState(res);
        setIsServerConnected(true);
      } else if (res.state) {
        setState(res.state);
        setIsServerConnected(!res.offlineFallback);
      }
    }
    fetchLatestState();

    // Poll every 4 seconds when server is online so ERP & Store stay 100% synced in real-time
    const interval = setInterval(fetchLatestState, 4000);

    // Listen to localStorage changes for instant Offline cross-window sync
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          saveLocalCache(parsed);
          setState(parsed);
        } catch (err) {
          console.warn('Storage sync parse error', err);
        }
      }
    };
    const handleOnline = () => {
      fetchLatestState();
    };
    const handleOffline = () => {
      setIsServerConnected(false);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to apply state update synchronously to Local Cache & UI, then sync to Local Server & Firebase Cloud
  const mutateState = async (endpoint, method, body, optimisticUpdater) => {
    beginMutation();
    try {
      // 1. Apply mutation synchronously so UI and localStorage are updated immediately (never lost!)
      const currentSnapshot = getLocalCache();
      const next = optimisticUpdater ? optimisticUpdater(structuredClone(currentSnapshot)) : structuredClone(currentSnapshot);
      next._updatedAt = Date.now();
      if (!next.syncQueue) next.syncQueue = [];
      next.syncQueue.unshift({
        id: `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action: `${method} ${endpoint}`,
        entity: 'cloud_sync',
        timestamp: new Date().toISOString(),
        status: 'synced'
      });
      if (next.syncQueue.length > 150) next.syncQueue = next.syncQueue.slice(0, 150);

      const savedLocal = saveLocalCache(next);
      setState(savedLocal);

      // 2. Try local Express server if running on localhost
      const res = await apiRequest(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.offlineFallback && res.state) {
        const serverState = saveLocalCache({ ...res.state, _updatedAt: Date.now() });
        setState(serverState);
        setIsServerConnected(true);
        await pushStateToFirebase(serverState);
        return res;
      }

      // 3. Push updated state immediately to Firebase Realtime Database
      const synced = await pushStateToFirebase(savedLocal);
      setIsServerConnected(synced);
      return { state: savedLocal, offlineFallback: !synced };
    } finally {
      endMutation();
    }
  };

  // 1. Complete POS Sale
  const handleCompleteSale = async (salePayload) => {
    let createdSale = null;
    const res = await mutateState('/api/sales', 'POST', salePayload, (draft) => {
      const invoiceId = generateNextId('INV', draft.sales, 1000);
      const remainingAmount = Math.max(0, salePayload.total - salePayload.paidAmount);
      let totalCost = 0;

      salePayload.items.forEach(item => {
        const qty = Number(item.quantity) || 1;
        const factor = Number(item.factor) || 1;
        if (item.itemType === 'studyNote') {
          const note = draft.studyNotes.find(n => n.id === item.productId);
          if (note) {
            note.stockPrinted = Math.max(0, note.stockPrinted - qty);
            note.totalSold = (note.totalSold || 0) + qty;
          }
        } else if (!['printService', 'mobileRecharge', 'billPayment', 'walletTransfer'].includes(item.itemType)) {
          const prod = draft.products.find(p => p.id === item.productId);
          if (prod) prod.stock = Math.max(0, prod.stock - qty * factor);
        }
        totalCost += (Number(item.costPrice) || 0) * qty * factor;
      });

      const customer = draft.customers.find(c => c.id === salePayload.customerId) || draft.customers[0];
      const newSale = {
        ...salePayload,
        id: invoiceId,
        createdAt: new Date().toISOString(),
        customerName: customer.name,
        remainingAmount,
        totalCost,
        profit: salePayload.total - totalCost,
        status: 'completed'
      };
      draft.sales.unshift(newSale);
      customer.totalPurchases = (customer.totalPurchases || 0) + Number(salePayload.total);
      customer.loyaltyPoints = (customer.loyaltyPoints || 0) + Math.floor(Number(salePayload.total) / 10);
      if (remainingAmount > 0) {
        customer.balance = (customer.balance || 0) + remainingAmount;
        if (!customer.transactions) customer.transactions = [];
        customer.transactions.unshift({
          id: `TR-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'invoice',
          amount: remainingAmount,
          description: `متبقي فاتورة مبيعات آجل #${invoiceId} (إجمالي ${salePayload.total} ج.م - مدفوع ${salePayload.paidAmount} ج.م)`
        });
      }
      createdSale = newSale;
      return draft;
    });

    if (res && res.sale) {
      setActiveReceiptSale(res.sale);
    } else if (createdSale) {
      setActiveReceiptSale(createdSale);
    }
  };

  // 2. Return Sale
  const handleReturnSale = async (saleId) => {
    await mutateState(`/api/sales/${saleId}/return`, 'POST', {}, (draft) => {
      const s = draft.sales.find(x => x.id === saleId);
      if (s && s.status !== 'returned') {
        s.status = 'returned';
        s.items?.forEach(item => {
          const qty = Number(item.quantity) || 1;
          const factor = Number(item.factor) || 1;
          if (item.itemType === 'studyNote') {
            const note = draft.studyNotes.find(n => n.id === item.productId);
            if (note) {
              note.stockPrinted += qty;
              note.totalSold = Math.max(0, (note.totalSold || 0) - qty);
            }
          } else if (item.itemType !== 'printService') {
            const prod = draft.products.find(p => p.id === item.productId);
            if (prod) prod.stock += qty * factor;
          }
        });
      }
      return draft;
    });
  };

  // 3. Save Product
  const handleSaveProduct = async (product) => {
    const existingProducts = getLocalCache().products || [];
    const id = product.id && String(product.id).trim() !== ''
      ? product.id
      : generateNextId('PRD', existingProducts, 1000);
    const fullProduct = { ...product, id };

    return await mutateState('/api/products', 'POST', fullProduct, (draft) => {
      if (!draft.products) draft.products = [];
      const idx = draft.products.findIndex(p => p.id === id);
      if (idx >= 0) draft.products[idx] = { ...draft.products[idx], ...fullProduct };
      else draft.products.unshift(fullProduct);
      return draft;
    });
  };

  const handleDeleteProduct = async (productId) => {
    return await mutateState(`/api/products/${productId}`, 'DELETE', { id: productId }, (draft) => {
      draft.products = (draft.products || []).filter(p => p.id !== productId);
      return draft;
    });
  };

  const handleSaveCategory = async (catPayload) => {
    const existingCats = getLocalCache().categories || [];
    const catId = catPayload.id && String(catPayload.id).trim() !== ''
      ? catPayload.id
      : `CAT-${Date.now().toString().slice(-5)}`;
    const fullCat = {
      id: catId,
      name: catPayload.name,
      icon: catPayload.icon || 'Package',
      color: catPayload.color || 'emerald'
    };
    await mutateState('/api/categories', 'POST', fullCat, (draft) => {
      if (!draft.categories) draft.categories = [];
      const idx = draft.categories.findIndex(c => c.id === catId);
      if (idx >= 0) draft.categories[idx] = { ...draft.categories[idx], ...fullCat };
      else draft.categories.push(fullCat);
      return draft;
    });
    return catId;
  };

  const handleDeleteCategory = async (catId) => {
    return await mutateState(`/api/categories/${catId}`, 'DELETE', { id: catId }, (draft) => {
      draft.categories = (draft.categories || []).filter(c => c.id !== catId);
      return draft;
    });
  };

  const handleCreatePurchase = async (purchasePayload) => {
    await mutateState('/api/purchases', 'POST', purchasePayload, (draft) => {
      let totalCost = 0;
      purchasePayload.items.forEach(it => {
        const p = draft.products.find(x => x.id === it.productId);
        const qty = Number(it.quantity) || 0;
        const cost = Number(it.costPrice) || 0;
        totalCost += qty * cost;
        if (p) {
          p.stock += qty;
          if (cost > 0) p.costPrice = cost;
        }
      });
      const sup = draft.suppliers.find(s => s.id === purchasePayload.supplierId);
      if (sup) {
        const rem = Math.max(0, totalCost - Number(purchasePayload.paidAmount || 0));
        sup.totalSupplied = (sup.totalSupplied || 0) + totalCost;
        sup.balance = (sup.balance || 0) + rem;
        if (!sup.transactions) sup.transactions = [];
        sup.transactions.unshift({
          id: `STR-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'purchase',
          amount: totalCost,
          paidAmount: Number(purchasePayload.paidAmount || 0),
          remaining: rem,
          description: purchasePayload.notes || `فاتورة توريد بضاعة للمخزن`
        });
      }
      return draft;
    });
  };

  // 4. Print Center & Study Notes
  const handleCreatePrintJob = async (jobPayload) => {
    await mutateState('/api/print-jobs', 'POST', jobPayload, (draft) => {
      const newJob = {
        ...jobPayload,
        id: generateNextId('PRJ', draft.printJobs, 500),
        createdAt: new Date().toISOString()
      };
      draft.printJobs.unshift(newJob);

      const totalImpressions = (Number(newJob.pagesCount) || 1) * (Number(newJob.copies) || 1);
      if (draft.settings?.copierCounters?.length > 0) {
        const targetMachine = newJob.colorMode === 'color'
          ? (draft.settings.copierCounters[1] || draft.settings.copierCounters[0])
          : draft.settings.copierCounters[0];
        if (targetMachine) {
          targetMachine.currentCounter = (targetMachine.currentCounter || 0) + totalImpressions;
        }
      }

      if (jobPayload.recordInSales) {
        draft.sales.unshift({
          id: generateNextId('INV', draft.sales, 1000),
          createdAt: new Date().toISOString(),
          cashierName: jobPayload.cashierName || 'مسؤول الطباعة',
          customerId: 'CUS-1',
          customerName: newJob.customerName,
          paymentMethod: 'cash',
          subtotal: newJob.totalPrice,
          discount: 0,
          total: newJob.totalPrice,
          paidAmount: newJob.paidAmount,
          remainingAmount: 0,
          totalCost: newJob.costEstimate,
          profit: newJob.totalPrice - newJob.costEstimate,
          source: 'print_center',
          status: 'completed',
          items: [{
            productId: newJob.id,
            itemType: 'printService',
            name: newJob.description,
            unitName: 'خدمة طباعة',
            factor: 1,
            quantity: 1,
            unitPrice: newJob.totalPrice,
            costPrice: newJob.costEstimate,
            total: newJob.totalPrice
          }]
        });
      }
      return draft;
    });
  };

  const handleUpdatePrintJob = async (jobId, patch) => {
    await mutateState(`/api/print-jobs/${jobId}`, 'PATCH', patch, (draft) => {
      const j = draft.printJobs.find(x => x.id === jobId);
      if (j) Object.assign(j, patch);
      return draft;
    });
  };

  const handleSaveStudyNote = async (notePayload) => {
    const existingNotes = getLocalCache().studyNotes || [];
    const id = notePayload.id && String(notePayload.id).trim() !== ''
      ? notePayload.id
      : generateNextId('NOTE', existingNotes, 200);
    const code = notePayload.code || `M-${Date.now().toString().slice(-4)}`;
    const fullNote = {
      ...notePayload,
      id,
      code,
      reservedCount: notePayload.reservedCount || 0,
      totalSold: notePayload.totalSold || 0,
      showOnline: notePayload.showOnline !== undefined ? notePayload.showOnline : true
    };

    await mutateState('/api/study-notes', 'POST', fullNote, (draft) => {
      if (!draft.studyNotes) draft.studyNotes = [];
      const idx = draft.studyNotes.findIndex(n => n.id === id);
      if (idx >= 0) draft.studyNotes[idx] = { ...draft.studyNotes[idx], ...fullNote };
      else draft.studyNotes.unshift(fullNote);
      return draft;
    });
  };

  const handleCreateReservation = async (resPayload) => {
    await mutateState('/api/note-reservations', 'POST', resPayload, (draft) => {
      const note = draft.studyNotes.find(n => n.id === resPayload.noteId);
      const qty = Number(resPayload.quantity) || 1;
      const totalPrice = (note ? note.sellPrice : 50) * qty;
      if (note) {
        note.reservedCount = (note.reservedCount || 0) + qty;
      }
      draft.noteReservations.unshift({
        ...resPayload,
        id: generateNextId('RES', draft.noteReservations, 900),
        noteTitle: note ? `${note.title} - ${note.teacherName}` : '',
        quantity: qty,
        totalPrice,
        remainingAmount: Math.max(0, totalPrice - Number(resPayload.paidAmount)),
        createdAt: new Date().toISOString()
      });
      return draft;
    });
  };

  const handleUpdateReservation = async (resId, patch) => {
    await mutateState(`/api/note-reservations/${resId}`, 'PATCH', patch, (draft) => {
      const r = draft.noteReservations.find(x => x.id === resId);
      if (r) {
        const prev = r.status;
        Object.assign(r, patch);
        if (prev !== 'delivered' && r.status === 'delivered') {
          const note = draft.studyNotes.find(n => n.id === r.noteId);
          if (note) {
            note.stockPrinted = Math.max(0, note.stockPrinted - r.quantity);
            note.reservedCount = Math.max(0, (note.reservedCount || 0) - r.quantity);
            note.totalSold = (note.totalSold || 0) + r.quantity;
          }
          r.remainingAmount = 0;
          r.paidAmount = r.totalPrice;
        }
      }
      return draft;
    });
  };

  // 5. CRM Customers & Suppliers
  const handleSaveCustomer = async (custPayload) => {
    const existingCusts = getLocalCache().customers || [];
    const id = custPayload.id && String(custPayload.id).trim() !== ''
      ? custPayload.id
      : generateNextId('CUS', existingCusts, 100);
    const fullCust = { ...custPayload, id };

    await mutateState('/api/customers', 'POST', fullCust, (draft) => {
      if (!draft.customers) draft.customers = [];
      const idx = draft.customers.findIndex(c => c.id === id);
      if (idx >= 0) {
        draft.customers[idx] = { ...draft.customers[idx], ...fullCust };
      } else {
        draft.customers.push({
          loyaltyPoints: 0,
          totalPurchases: 0,
          transactions: [],
          ...fullCust
        });
      }
      return draft;
    });
  };

  const handleCustomerPayment = async (customerId, payPayload) => {
    await mutateState(`/api/customers/${customerId}/payment`, 'POST', payPayload, (draft) => {
      const c = draft.customers.find(x => x.id === customerId);
      if (c) {
        c.balance = Math.max(0, c.balance - Number(payPayload.amount));
        if (!c.transactions) c.transactions = [];
        c.transactions.unshift({
          id: `TR-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'payment',
          amount: Number(payPayload.amount),
          description: payPayload.notes || 'سداد دفعة نقدية'
        });
      }
      return draft;
    });
  };

  const handleSaveSupplier = async (supPayload) => {
    const existingSups = getLocalCache().suppliers || [];
    const id = supPayload.id && String(supPayload.id).trim() !== ''
      ? supPayload.id
      : generateNextId('SUP', existingSups, 100);
    const fullSup = { ...supPayload, id };

    await mutateState('/api/suppliers', 'POST', fullSup, (draft) => {
      if (!draft.suppliers) draft.suppliers = [];
      const idx = draft.suppliers.findIndex(s => s.id === id);
      if (idx >= 0) {
        draft.suppliers[idx] = { ...draft.suppliers[idx], ...fullSup };
      } else {
        draft.suppliers.push({
          totalSupplied: 0,
          balance: 0,
          transactions: [],
          ...fullSup
        });
      }
      return draft;
    });
  };

  const handleSupplierPayment = async (supplierId, payPayload) => {
    await mutateState(`/api/suppliers/${supplierId}/payment`, 'POST', payPayload, (draft) => {
      const s = draft.suppliers.find(x => x.id === supplierId);
      if (s) {
        s.balance = Math.max(0, s.balance - Number(payPayload.amount));
        if (!s.transactions) s.transactions = [];
        s.transactions.unshift({
          id: `STR-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'payment',
          amount: Number(payPayload.amount),
          description: payPayload.notes || 'سداد دفعة للمورد'
        });
      }
      return draft;
    });
  };

  // 6. Online Store Orders
  const handleSubmitOnlineOrder = async (orderPayload) => {
    await mutateState('/api/online-orders', 'POST', orderPayload, (draft) => {
      draft.onlineOrders.unshift({
        ...orderPayload,
        id: generateNextId('ORD', draft.onlineOrders, 700),
        status: 'new',
        createdAt: new Date().toISOString()
      });
      return draft;
    });
  };

  const handleUpdateOnlineOrder = async (orderId, patch) => {
    await mutateState(`/api/online-orders/${orderId}`, 'PATCH', patch, (draft) => {
      const o = draft.onlineOrders.find(x => x.id === orderId);
      if (o) {
        const prev = o.status;
        Object.assign(o, patch);
        // Complete order in offline mode as well: deduct stock & create POS invoice
        if (prev !== 'completed' && o.status === 'completed') {
          let totalCost = 0;
          const saleItems = (o.items || []).map(item => {
            const qty = Number(item.quantity) || 1;
            if (item.type === 'studyNote') {
              const note = draft.studyNotes.find(n => n.id === item.id);
              const cPrice = note ? (note.costPrice + (note.teacherCommission || 0)) : item.price * 0.7;
              if (note) {
                note.stockPrinted = Math.max(0, note.stockPrinted - qty);
                note.totalSold = (note.totalSold || 0) + qty;
              }
              totalCost += cPrice * qty;
              return {
                productId: item.id,
                itemType: 'studyNote',
                name: item.name,
                unitName: 'مذكرة',
                factor: 1,
                quantity: qty,
                unitPrice: item.price,
                costPrice: cPrice,
                total: item.total
              };
            } else {
              const prod = draft.products.find(p => p.id === item.id);
              const factor = Number(item.factor) || 1;
              const cPrice = prod ? prod.costPrice * factor : item.price * 0.75;
              if (prod) prod.stock = Math.max(0, prod.stock - qty * factor);
              totalCost += cPrice * qty;
              return {
                productId: item.id,
                itemType: 'product',
                name: item.name,
                unitName: item.unitName || 'قطعة',
                factor,
                quantity: qty,
                unitPrice: item.price,
                costPrice: prod ? prod.costPrice : item.price * 0.75,
                total: item.total
              };
            }
          });
          draft.sales.unshift({
            id: generateNextId('INV', draft.sales, 1000),
            createdAt: new Date().toISOString(),
            cashierName: 'المتجر الإلكتروني',
            customerId: 'CUS-1',
            customerName: `${o.customerName} (أونلاين)`,
            paymentMethod: o.paymentMethod || 'cash',
            subtotal: o.subtotal,
            discount: 0,
            total: o.total,
            paidAmount: o.total,
            remainingAmount: 0,
            totalCost,
            profit: o.total - totalCost,
            source: 'online',
            status: 'completed',
            items: saleItems
          });
        }
      }
      return draft;
    });
  };

  // 7. Expenses, Settings & Cloud Sync
  const handleAddExpense = async (expPayload) => {
    await mutateState('/api/expenses', 'POST', expPayload, (draft) => {
      draft.expenses.unshift({
        ...expPayload,
        id: `EXP-${Date.now()}`,
        createdAt: new Date().toISOString()
      });
      return draft;
    });
  };

  const handleSaveUser = async (userPayload) => {
    await mutateState('/api/users', 'POST', userPayload, (draft) => {
      if (!draft.users) draft.users = [];
      const idx = draft.users.findIndex(u => u.id === userPayload.id);
      if (idx >= 0) {
        draft.users[idx] = { ...draft.users[idx], ...userPayload };
      } else {
        draft.users.push(userPayload);
      }
      return draft;
    });
  };

  const handleTriggerCloudSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch from cloud to ensure we have the very latest data
      const cloudRes = await fetchStateFromFirebase();
      let mergedState = cloudRes.state;

      // 2. Mark sync time and push
      mergedState.settings.lastSyncTime = new Date().toISOString();
      if (mergedState.syncQueue) {
        mergedState.syncQueue.forEach(q => (q.status = 'synced'));
      }
      mergedState._updatedAt = Date.now();
      saveLocalCache(mergedState);
      setState(mergedState);

      const pushed = await pushStateToFirebase(mergedState);
      setIsServerConnected(pushed);
      if (pushed) {
        alert('تمت المزامنة السحابية بنجاح ☁️✓\nجميع البيانات والأرباح والمخازن متطابقة مع السحابة.');
      } else {
        alert('تم حفظ البيانات محلياً على الجهاز بنجاح. المزامنة السحابية ستكتمل فور توفر الإنترنت.');
      }
    } catch (err) {
      console.warn('Sync trigger error', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreBackup = async (backupData) => {
    await mutateState('/api/restore', 'POST', backupData, () => backupData);
  };

  const handleResetAllData = async () => {
    await mutateState('/api/reset', 'POST', {}, (draft) => ({
      ...draft,
      _initialized: true,
      categories: [],
      products: [],
      studyNotes: [],
      noteReservations: [],
      printJobs: [],
      customers: [
        {
          id: 'CUS-1',
          name: 'عميل نقدي (كاشير)',
          phone: '-',
          type: 'walkin',
          balance: 0,
          creditLimit: 0,
          loyaltyPoints: 0,
          totalPurchases: 0,
          notes: 'الحساب الافتراضي للمبيعات النقدية السريعة',
          transactions: []
        }
      ],
      suppliers: [],
      sales: [],
      onlineOrders: [],
      expenses: [],
      shifts: [],
      syncQueue: []
    }));
  };

  const handleSaveSettings = async (settingsPatch) => {
    await mutateState('/api/settings', 'PUT', settingsPatch, (draft) => {
      draft.settings = { ...draft.settings, ...settingsPatch };
      return draft;
    });
  };

  const storeName = state.settings?.storeName || 'بيت العيلة';
  const logoUrl = state.settings?.logoUrl || '/logo.jpg';

  // If opened on /store (or on any Mobile/Tablet device), render ONLY the Standalone Online Storefront for customers
  if (isStandaloneStore) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-4 pb-10">
          <OnlineStoreView
            state={state}
            isStandalone={true}
            onSubmitOnlineOrder={handleSubmitOnlineOrder}
            onUpdateOnlineOrder={handleUpdateOnlineOrder}
            onSubmitOnlinePrintJob={handleCreatePrintJob}
          />
        </main>
        <footer className="bg-slate-900 text-slate-400 text-xs py-6 px-4 text-center border-t border-slate-800">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src={logoUrl} alt={storeName} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5" />
              <div className="text-right">
                <span className="font-black text-white block">متجر {storeName} الإلكتروني</span>
                <span className="text-[11px] text-slate-400">جميع الأسعار والأصناف متصلة مباشرة بفرع المكتبة</span>
              </div>
            </div>
            <div className="text-center sm:text-right">{state.settings?.phone ? `📞 للتواصل: ${state.settings.phone} • ` : ''}{state.settings?.address}</div>
            <div className="flex items-center gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <img src="/rivix-logo.png" alt="Rivix System" className="w-8 h-8 rounded-xl object-contain bg-slate-800 p-0.5 border border-cyan-500/30" />
              <div className="text-right">
                <div className="text-[11px] font-black text-slate-200">مشغل بواسطة RIVIX SYSTEM</div>
                <div className="text-[10px] text-slate-400">جميع الحقوق محفوظة لشركة ريفيكس سيستم © {new Date().getFullYear()}</div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Live Badge Counts for ERP
  const lowStockCount = state.products.filter(p => p.stock <= p.minStock).length;
  const activeOnlineOrdersCount = state.onlineOrders.filter(o => o.status === 'new' || o.status === 'preparing').length;
  const pendingSyncCount = (state.syncQueue || []).filter(q => q.status === 'pending').length;

  const navItems = [
    { id: 'pos', label: 'نقطة البيع (الكاشير)', icon: ShoppingCart },
    { id: 'inventory', label: 'المخازن والباركود', icon: Package, badge: lowStockCount, badgeColor: 'bg-rose-500' },
    { id: 'print_center', label: 'التصوير والمذكرات', icon: Printer },
    { id: 'crm', label: 'العملاء والموردين والآجل', icon: Users },
    { id: 'online_store', label: 'طلبات المتجر المنفصل', icon: Globe, badge: activeOnlineOrdersCount, badgeColor: 'bg-emerald-500' },
    { id: 'reports', label: 'الأرباح والمزامنة والإدارة', icon: BarChart3, badge: pendingSyncCount, badgeColor: 'bg-amber-500' }
  ];

  const handleNavClick = (tabId) => {
    if (tabId === activeNav) return;

    // Free tabs: POS (Cashier) and Print Center
    if (!PROTECTED_TABS.has(tabId)) {
      // Auto-lock manager session when switching back to cashier/pos or printing
      setIsManagerAuthenticated(false);
      setActiveNav(tabId);
      return;
    }

    // Protected tabs: Inventory, CRM, Online Orders, Reports/Admin
    if (isManagerAuthenticated) {
      setActiveNav(tabId);
    } else {
      const targetItem = navItems.find(item => item.id === tabId) || { id: tabId, label: 'القسم المحمي' };
      setPasswordModalTarget(targetItem);
      setEnteredPin('');
      setPinError('');
      setShowPin(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    if (e) e.preventDefault();
    if (enteredPin.trim() === MANAGER_PASSWORD) {
      setIsManagerAuthenticated(true);
      if (passwordModalTarget) {
        setActiveNav(passwordModalTarget.id);
      }
      setPasswordModalTarget(null);
      setEnteredPin('');
      setPinError('');
    } else {
      setPinError('كلمة المرور غير صحيحة! يرجى إدخال رمز المرور الصحيح.');
      setEnteredPin('');
    }
  };

  const renderProtectedSectionLock = (label, tabId) => (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto my-12 shadow-xl">
      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-slate-900 mb-1">منطقة محمية بكلمة مرور</h2>
      <p className="text-xs font-bold text-emerald-700 mb-2">المدير العام Ahmed kharbosh</p>
      <p className="text-xs text-slate-500 mb-6">
        قسم: <strong>{label}</strong> محمي بالكامل لمنع الوصول غير المصرح به (أونلاين وأوفلاين)
      </p>
      <button
        onClick={() => {
          const targetItem = navItems.find(item => item.id === tabId) || { id: tabId, label };
          setPasswordModalTarget(targetItem);
          setEnteredPin('');
          setPinError('');
          setShowPin(false);
        }}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 mx-auto shadow-lg shadow-emerald-600/30 transition active:scale-95"
      >
        <KeyRound className="w-4 h-4" />
        إدخال كلمة المرور
      </button>

      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400">
        <img src="/rivix-logo.png" alt="Rivix" className="w-4 h-4 rounded-full object-contain" />
        <span>منظومة حماية مشغلة بواسطة <strong>RIVIX SYSTEM</strong></span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Top Header Bar */}
      <header className="no-print bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={storeName}
              className="w-12 h-12 rounded-2xl object-contain bg-white p-1 shadow-lg border border-slate-700"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg tracking-tight">{storeName}</h1>
                <span className="bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                  لكل العيلة • ERP + POS
                </span>
                <span className="hidden lg:inline-flex items-center gap-1.5 bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                  <img src="/rivix-logo.png" alt="Rivix" className="w-3.5 h-3.5 rounded-full object-contain" />
                  RIVIX SYSTEM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                النظام الشامل للكاشير والمخازن والطباعة والمذكرات • مشغل بواسطة ريفيكس سيستم
              </p>
            </div>
          </div>

          {/* Main Navigation Pills */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              const isProtected = PROTECTED_TABS.has(item.id);
              const isLocked = isProtected && !isManagerAuthenticated;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {isLocked && (
                    <Lock className="w-3 h-3 text-amber-400 opacity-80" />
                  )}
                  {item.badge > 0 && (
                    <span className={`${item.badgeColor} text-white text-[10px] font-black px-1.5 py-0.2 rounded-full`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status: Standalone Store Link + Lock Button + Offline/Cloud Sync + Manager Name */}
          <div className="flex items-center gap-2">
            <a
              href="/store"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-black shadow transition"
              title="فتح المتجر الإلكتروني المستقل للعملاء في نافذة جديدة"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">فتح المتجر المستقل</span>
            </a>

            {isManagerAuthenticated && (
              <button
                onClick={() => {
                  setIsManagerAuthenticated(false);
                  setActiveNav('pos');
                }}
                className="bg-rose-500/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-black transition shadow"
                title="قفل صلاحيات المدير العام والعودة لشاشة الكاشير"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden md:inline">قفل الإدارة</span>
              </button>
            )}

            <button
              onClick={handleTriggerCloudSync}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold transition"
              title="حالة العمل الأوفلاين والمزامنة السحابية"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <div className="text-right">
                <div className="text-[10px] text-emerald-400 font-black flex items-center gap-1">
                  {isServerConnected ? 'أونلاين + أوفلاين متصل' : 'وضع أوفلاين محلي 100%'}
                </div>
                <div className="text-[9px] text-slate-400">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} حركات للمزامنة` : 'متزامن بالكامل ✓'}
                </div>
              </div>
            </button>

            <div className="hidden xl:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-slate-200">المدير العام Ahmed kharbosh</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="no-print flex-1 max-w-[1440px] w-full mx-auto px-4 py-5">
        {activeNav === 'pos' && (
          <POSView
            state={state}
            currentUser={currentUser}
            onCompleteSale={handleCompleteSale}
            onReturnSale={handleReturnSale}
            onPrintReceipt={(sale) => setActiveReceiptSale(sale)}
            onSaveProduct={handleSaveProduct}
            onSaveCategory={handleSaveCategory}
            onAddExpense={handleAddExpense}
            onSaveSettings={handleSaveSettings}
            onSwitchUser={(u) => setCurrentUser(u)}
          />
        )}

        {activeNav === 'inventory' && (
          isManagerAuthenticated ? (
            <InventoryView
              state={state}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onCreatePurchase={handleCreatePurchase}
              onSaveCategory={handleSaveCategory}
              onDeleteCategory={handleDeleteCategory}
              onOpenBarcodeModal={(item) => setActiveBarcodeItem(item)}
            />
          ) : (
            renderProtectedSectionLock('المخازن والباركود', 'inventory')
          )
        )}

        {activeNav === 'print_center' && (
          <PrintCenterView
            state={state}
            currentUser={currentUser}
            onCreatePrintJob={handleCreatePrintJob}
            onUpdatePrintJob={handleUpdatePrintJob}
            onSaveStudyNote={handleSaveStudyNote}
            onCreateReservation={handleCreateReservation}
            onUpdateReservation={handleUpdateReservation}
            onOpenBarcodeModal={(item) => setActiveBarcodeItem(item)}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeNav === 'crm' && (
          isManagerAuthenticated ? (
            <CRMView
              state={state}
              onSaveCustomer={handleSaveCustomer}
              onCustomerPayment={handleCustomerPayment}
              onSaveSupplier={handleSaveSupplier}
              onSupplierPayment={handleSupplierPayment}
            />
          ) : (
            renderProtectedSectionLock('العملاء والموردين والآجل', 'crm')
          )
        )}

        {activeNav === 'online_store' && (
          isManagerAuthenticated ? (
            <OnlineStoreView
              state={state}
              isStandalone={false}
              onSubmitOnlineOrder={handleSubmitOnlineOrder}
              onUpdateOnlineOrder={handleUpdateOnlineOrder}
              onSubmitOnlinePrintJob={handleCreatePrintJob}
            />
          ) : (
            renderProtectedSectionLock('طلبات المتجر المنفصل', 'online_store')
          )
        )}

        {activeNav === 'reports' && (
          isManagerAuthenticated ? (
            <ReportsAndAdminView
              state={state}
              currentUser={currentUser}
              onSwitchUser={(u) => setCurrentUser(u)}
              onAddExpense={handleAddExpense}
              onTriggerCloudSync={handleTriggerCloudSync}
              onRestoreBackup={handleRestoreBackup}
              onResetAllData={handleResetAllData}
              onSaveSettings={handleSaveSettings}
              onSaveUser={handleSaveUser}
            />
          ) : (
            renderProtectedSectionLock('الأرباح والمزامنة والإدارة', 'reports')
          )
        )}
      </main>

      {/* System Footer - Rivix System Rights & Branding */}
      <footer className="no-print mt-auto bg-slate-900 text-slate-400 text-xs py-4 px-4 border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/rivix-logo.png"
              alt="Rivix System"
              className="w-9 h-9 rounded-xl object-contain bg-slate-800/80 p-0.5 border border-cyan-500/30 shadow-md shadow-cyan-950/50"
            />
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-100 text-sm tracking-wide">RIVIX SYSTEM</span>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold px-2 py-0.2 rounded-full">
                  منصة إدارة العمليات ونقاط البيع
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                جميع الحقوق محفوظة لشركة ريفيكس سيستم © {new Date().getFullYear()} Rivix System. All Rights Reserved.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              نظام مرخص ومعتمد
            </span>
            <span>•</span>
            <span>منظومة العمليات وإدارة نقاط البيع</span>
            <span>•</span>
            <span className="text-slate-300 font-bold">تطوير ودعم شركة ريفيكس سيستم</span>
          </div>
        </div>
      </footer>

      {/* Thermal Receipt Print Modal */}
      {activeReceiptSale && (
        <ReceiptModal
          sale={activeReceiptSale}
          settings={state.settings}
          onClose={() => setActiveReceiptSale(null)}
        />
      )}

      {/* Barcode Sticker Print Modal */}
      {activeBarcodeItem && (
        <BarcodeModal
          item={activeBarcodeItem}
          storeName={storeName}
          onClose={() => setActiveBarcodeItem(null)}
        />
      )}

      {/* Manager Password Protection Modal (Password: 6101994) */}
      {passwordModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-600/30">
              <KeyRound className="w-8 h-8" />
            </div>

            <h3 className="font-black text-lg text-slate-900">
              منطقة محمية بكلمة مرور
            </h3>
            <p className="text-xs font-bold text-emerald-700 mt-0.5">
              المدير العام Ahmed kharbosh
            </p>
            <p className="text-[11px] text-slate-500 mt-1 mb-4">
              أنت تحاول الدخول إلى: <strong className="text-slate-800">{passwordModalTarget.label}</strong>
              <br />
              <span className="text-[10px] text-slate-400">(يعمل أونلاين وأوفلاين بدون إنترنت)</span>
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoFocus
                  placeholder="أدخل رمز المرور السري"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-center text-lg font-black tracking-widest outline-none transition ${
                    pinError
                      ? 'border-rose-500 bg-rose-50/50 text-rose-700 focus:border-rose-600'
                      : 'border-slate-300 bg-slate-50 focus:border-emerald-600 focus:bg-white text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                  title={showPin ? 'إخفاء' : 'إظهار'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {pinError && (
                <div className="bg-rose-100 border border-rose-300 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold text-center">
                  {pinError}
                </div>
              )}

              {/* Quick Touch Keypad for Touch Screens and Keypads */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setEnteredPin((prev) => prev + num);
                      if (pinError) setPinError('');
                    }}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm active:scale-95 transition"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEnteredPin('')}
                  className="py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs active:scale-95 transition"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnteredPin((prev) => prev + '0');
                    if (pinError) setPinError('');
                  }}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm active:scale-95 transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setEnteredPin((prev) => prev.slice(0, -1))}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs active:scale-95 transition"
                >
                  ⌫
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl shadow-lg shadow-emerald-600/30 transition text-sm flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Unlock className="w-4 h-4" />
                  <span>دخول القسم</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalTarget(null);
                    setEnteredPin('');
                    setPinError('');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-2xl transition text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <img src="/rivix-logo.png" alt="Rivix" className="w-4 h-4 rounded-full object-contain" />
              <span>نظام حماية ريفيكس سيستم • Rivix Security Guard</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
