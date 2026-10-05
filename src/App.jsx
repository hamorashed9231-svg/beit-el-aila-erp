import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Package, Printer, Users, Globe, BarChart3,
  Cloud, Wifi, WifiOff, RefreshCw, BookOpen, Bell, ShieldCheck, AlertTriangle, ExternalLink
} from 'lucide-react';
import { getLocalCache, saveLocalCache, apiRequest, pushStateToFirebase, STORAGE_KEY } from './api.js';
import POSView from './components/POSView.jsx';
import InventoryView from './components/InventoryView.jsx';
import PrintCenterView from './components/PrintCenterView.jsx';
import CRMView from './components/CRMView.jsx';
import OnlineStoreView from './components/OnlineStoreView.jsx';
import ReportsAndAdminView from './components/ReportsAndAdminView.jsx';
import ReceiptModal from './components/ReceiptModal.jsx';
import BarcodeModal from './components/BarcodeModal.jsx';

export default function App() {
  const [state, setState] = useState(() => getLocalCache());
  const [activeNav, setActiveNav] = useState('pos'); // pos | inventory | print_center | crm | online_store | reports
  const [currentUser, setCurrentUser] = useState(() => getLocalCache().users?.[0]);
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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
      const res = await apiRequest('/api/state');
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
          setState(JSON.parse(e.newValue));
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

  // Helper to apply state update via Local Server, Firebase Cloud, and Offline Cache
  const mutateState = async (endpoint, method, body, optimisticUpdater) => {
    const res = await apiRequest(endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.offlineFallback && res.state) {
      setState(res.state);
      setIsServerConnected(true);
      return res;
    } else {
      // Apply mutation locally and push immediately to Firebase Realtime Database
      let updatedState = null;
      setState(prev => {
        const next = optimisticUpdater ? optimisticUpdater(structuredClone(prev)) : prev;
        if (!next.syncQueue) next.syncQueue = [];
        next.syncQueue.unshift({
          id: `SYNC-${Date.now()}`,
          action: `${method} ${endpoint}`,
          entity: 'cloud_sync',
          timestamp: new Date().toISOString(),
          status: 'synced'
        });
        if (next.syncQueue.length > 150) next.syncQueue = next.syncQueue.slice(0, 150);
        saveLocalCache(next);
        updatedState = next;
        return next;
      });
      if (updatedState) {
        const synced = await pushStateToFirebase(updatedState);
        setIsServerConnected(synced);
      }
      return res;
    }
  };

  // 1. Complete POS Sale
  const handleCompleteSale = async (salePayload) => {
    const res = await mutateState('/api/sales', 'POST', salePayload, (draft) => {
      const invoiceId = `INV-${1000 + draft.sales.length + 1}`;
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
        } else if (item.itemType !== 'printService') {
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
      if (remainingAmount > 0) {
        customer.balance = (customer.balance || 0) + remainingAmount;
      }
      setActiveReceiptSale(newSale);
      return draft;
    });

    if (res && res.sale) {
      setActiveReceiptSale(res.sale);
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
    await mutateState('/api/products', 'POST', product, (draft) => {
      const id = product.id || `PRD-${1000 + draft.products.length + 1}`;
      const idx = draft.products.findIndex(p => p.id === id);
      if (idx >= 0) draft.products[idx] = { ...product, id };
      else draft.products.unshift({ ...product, id });
      return draft;
    });
  };

  const handleDeleteProduct = async (productId) => {
    await mutateState(`/api/products/${productId}`, 'DELETE', null, (draft) => {
      draft.products = draft.products.filter(p => p.id !== productId);
      return draft;
    });
  };

  const handleSaveCategory = async (catPayload) => {
    const catId = catPayload.id || `CAT-${Date.now().toString().slice(-4)}`;
    await mutateState('/api/categories', 'POST', { ...catPayload, id: catId }, (draft) => {
      if (!draft.categories) draft.categories = [];
      const idx = draft.categories.findIndex(c => c.id === catId);
      if (idx >= 0) draft.categories[idx] = { ...draft.categories[idx], ...catPayload, id: catId };
      else draft.categories.push({ id: catId, name: catPayload.name, icon: catPayload.icon || 'Package', color: catPayload.color || 'emerald' });
      return draft;
    });
    return catId;
  };

  const handleDeleteCategory = async (catId) => {
    await mutateState(`/api/categories/${catId}`, 'DELETE', null, (draft) => {
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
      }
      return draft;
    });
  };

  // 4. Print Center & Study Notes
  const handleCreatePrintJob = async (jobPayload) => {
    await mutateState('/api/print-jobs', 'POST', jobPayload, (draft) => {
      const newJob = {
        ...jobPayload,
        id: `PRJ-${500 + draft.printJobs.length + 1}`,
        createdAt: new Date().toISOString()
      };
      draft.printJobs.unshift(newJob);
      if (jobPayload.recordInSales) {
        draft.sales.unshift({
          id: `INV-${1000 + draft.sales.length + 1}`,
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
    await mutateState('/api/study-notes', 'POST', notePayload, (draft) => {
      const id = notePayload.id || `NOTE-${200 + draft.studyNotes.length + 1}`;
      const idx = draft.studyNotes.findIndex(n => n.id === id);
      if (idx >= 0) draft.studyNotes[idx] = { ...notePayload, id };
      else draft.studyNotes.unshift({ ...notePayload, id });
      return draft;
    });
  };

  const handleCreateReservation = async (resPayload) => {
    await mutateState('/api/note-reservations', 'POST', resPayload, (draft) => {
      const note = draft.studyNotes.find(n => n.id === resPayload.noteId);
      const totalPrice = (note ? note.sellPrice : 50) * Number(resPayload.quantity);
      draft.noteReservations.unshift({
        ...resPayload,
        id: `RES-${900 + draft.noteReservations.length + 1}`,
        noteTitle: note ? `${note.title} - ${note.teacherName}` : '',
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
    await mutateState('/api/customers', 'POST', custPayload, (draft) => {
      draft.customers.push({ ...custPayload, id: `CUS-${draft.customers.length + 1}`, transactions: [] });
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
    await mutateState('/api/suppliers', 'POST', supPayload, (draft) => {
      draft.suppliers.push({ ...supPayload, id: `SUP-${draft.suppliers.length + 1}`, totalSupplied: 0, transactions: [] });
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
        id: `ORD-${700 + draft.onlineOrders.length + 1}`,
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
            id: `INV-${1000 + draft.sales.length + 1}`,
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

  const handleTriggerCloudSync = async () => {
    setIsSyncing(true);
    await mutateState('/api/sync', 'POST', {}, (draft) => {
      draft.settings.lastSyncTime = new Date().toISOString();
      if (draft.syncQueue) {
        draft.syncQueue.forEach(q => (q.status = 'synced'));
      }
      return draft;
    });
    setTimeout(() => setIsSyncing(false), 600);
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
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img src={logoUrl} alt={storeName} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5" />
              <span className="font-black text-white">متجر {storeName} الإلكتروني</span>
              <span>— جميع الأسعار والأصناف متصلة مباشرة بفرع المكتبة</span>
            </div>
            <div>{state.settings?.phone ? `📞 للتواصل: ${state.settings.phone} • ` : ''}{state.settings?.address}</div>
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
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                النظام الشامل للكاشير والمخازن والطباعة والمذكرات • متصل بالمتجر المستقل
              </p>
            </div>
          </div>

          {/* Main Navigation Pills */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className={`${item.badgeColor} text-white text-[10px] font-black px-1.5 py-0.2 rounded-full`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status: Standalone Store Link + Offline/Cloud Sync + Active Cashier */}
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
              <span className="font-bold text-slate-200">{currentUser?.name}</span>
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
          />
        )}

        {activeNav === 'inventory' && (
          <InventoryView
            state={state}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onCreatePurchase={handleCreatePurchase}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onOpenBarcodeModal={(item) => setActiveBarcodeItem(item)}
          />
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
          <CRMView
            state={state}
            onSaveCustomer={handleSaveCustomer}
            onCustomerPayment={handleCustomerPayment}
            onSaveSupplier={handleSaveSupplier}
            onSupplierPayment={handleSupplierPayment}
          />
        )}

        {activeNav === 'online_store' && (
          <OnlineStoreView
            state={state}
            isStandalone={false}
            onSubmitOnlineOrder={handleSubmitOnlineOrder}
            onUpdateOnlineOrder={handleUpdateOnlineOrder}
            onSubmitOnlinePrintJob={handleCreatePrintJob}
          />
        )}

        {activeNav === 'reports' && (
          <ReportsAndAdminView
            state={state}
            currentUser={currentUser}
            onSwitchUser={(u) => setCurrentUser(u)}
            onAddExpense={handleAddExpense}
            onTriggerCloudSync={handleTriggerCloudSync}
            onRestoreBackup={handleRestoreBackup}
            onResetAllData={handleResetAllData}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </main>

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
    </div>
  );
}
