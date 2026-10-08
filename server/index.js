import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialDatabase } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const FIREBASE_DB_URL = 'https://beit-el-aila-erp-default-rtdb.firebaseio.com/state_v2.json';

function normalizeServerDB(parsed) {
  if (!parsed || typeof parsed !== 'object') return structuredClone(initialDatabase);
  parsed._initialized = true;
  const emptyable = [
    'categories', 'products', 'studyNotes', 'noteReservations',
    'printJobs', 'suppliers', 'sales', 'onlineOrders',
    'expenses', 'shifts', 'syncQueue'
  ];
  emptyable.forEach(k => {
    if (Array.isArray(parsed[k])) {
      parsed[k] = parsed[k].filter(Boolean);
    } else if (parsed[k] && typeof parsed[k] === 'object') {
      parsed[k] = Object.values(parsed[k]).filter(Boolean);
    } else {
      parsed[k] = [];
    }
  });
  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    parsed.users = structuredClone(initialDatabase.users);
  } else {
    const admin = parsed.users.find(u => u.id === 'USR-1' || u.role === 'admin') || parsed.users[0];
    if (admin) {
      admin.name = 'المدير العام Ahmed kharbosh';
      admin.pin = '6101994';
      admin.role = 'admin';
    }
  }
  if (!Array.isArray(parsed.customers) || parsed.customers.length === 0) {
    parsed.customers = structuredClone(initialDatabase.customers);
  }
  if (parsed.settings) {
    if (!parsed.settings.storeName || parsed.settings.storeName === 'مكتبة العيلة') {
      parsed.settings.storeName = 'بيت العيلة';
    }
    if (!parsed.settings.logoUrl) {
      parsed.settings.logoUrl = '/logo.jpg';
    }
  } else {
    parsed.settings = structuredClone(initialDatabase.settings);
  }
  return parsed;
}

function generateNextId(prefix, list = [], startAt = 1000) {
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

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return normalizeServerDB(JSON.parse(raw));
    }
  } catch (err) {
    console.error('Error reading DB file, falling back to seed data:', err);
  }
  const clean = structuredClone(initialDatabase);
  fs.writeFileSync(DB_FILE, JSON.stringify(clean, null, 2), 'utf-8');
  return clean;
}

let db = loadDB();

async function pushToFirebaseCloud() {
  try {
    if (!db._updatedAt) db._updatedAt = Date.now();
    const res = await fetch(FIREBASE_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizeServerDB(db))
    });
    if (res.ok && db.syncQueue) {
      db.syncQueue.forEach(item => { item.status = 'synced'; });
      db.settings.lastSyncTime = new Date().toISOString();
    }
  } catch (err) {
    // Offline locally - will sync later
  }
}

async function pullFromFirebaseCloud() {
  try {
    const res = await fetch(FIREBASE_DB_URL);
    if (res.ok) {
      const cloudData = await res.json();
      if (cloudData && (cloudData.settings || cloudData._initialized || cloudData.products)) {
        const cloudNormalized = normalizeServerDB(cloudData);
        const cloudTime = Number(cloudNormalized._updatedAt) || 0;
        const localTime = Number(db._updatedAt) || 0;

        if (cloudTime > localTime) {
          db = cloudNormalized;
        } else {
          // Merge new online orders & online print jobs submitted by customers on https://beit-el-aila-erp.web.app/store
          if (Array.isArray(cloudNormalized.onlineOrders)) {
            cloudNormalized.onlineOrders.forEach(co => {
              const existing = db.onlineOrders.find(lo => lo.id === co.id);
              if (!existing) {
                db.onlineOrders.unshift(co);
              }
            });
          }
          if (Array.isArray(cloudNormalized.printJobs)) {
            cloudNormalized.printJobs.forEach(cp => {
              const existing = db.printJobs.find(lp => lp.id === cp.id);
              if (!existing) {
                db.printJobs.unshift(cp);
              }
            });
          }
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      }
    }
  } catch (err) {
    // Offline locally
  }
}

// Periodically pull online orders from Firebase Cloud into local POS server
setInterval(pullFromFirebaseCloud, 5000);

function saveDB(action = 'UPDATE_DATA', entity = 'system') {
  db._updatedAt = Date.now();
  if (!db.syncQueue) db.syncQueue = [];
  if (action) {
    db.syncQueue.unshift({
      id: `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      entity,
      timestamp: new Date().toISOString(),
      status: 'synced'
    });
    if (db.syncQueue.length > 200) {
      db.syncQueue = db.syncQueue.slice(0, 200);
    }
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  pushToFirebaseCloud();
}

// 1. Get complete state for Offline-First POS & Storefront
app.get('/api/state', async (req, res) => {
  await pullFromFirebaseCloud();
  res.json(db);
});

// 2. Create POS Sale (with multi-unit stock deduction, study notes support, customer credit/loyalty)
app.post('/api/sales', (req, res) => {
  const {
    cashierName = 'أحمد محمود',
    customerId = 'CUS-1',
    paymentMethod = 'cash',
    subtotal = 0,
    discount = 0,
    total = 0,
    paidAmount = 0,
    items = [],
    notes = ''
  } = req.body;

  const customer = db.customers.find(c => c.id === customerId) || db.customers[0];
  const remainingAmount = Math.max(0, Number(total) - Number(paidAmount));

  let totalCost = 0;

  // Deduct stock for each item
  items.forEach(item => {
    const qty = Number(item.quantity) || 1;
    const factor = Number(item.factor) || 1;

    if (item.itemType === 'studyNote') {
      const note = db.studyNotes.find(n => n.id === item.productId);
      if (note) {
        note.stockPrinted = Math.max(0, note.stockPrinted - qty);
        note.totalSold = (note.totalSold || 0) + qty;
        totalCost += (Number(note.costPrice) + Number(note.teacherCommission || 0)) * qty;
      }
    } else if (item.itemType === 'printService') {
      totalCost += (Number(item.costPrice) || 0) * qty;
    } else {
      const product = db.products.find(p => p.id === item.productId);
      if (product) {
        const baseUnitsDeducted = qty * factor;
        product.stock = Math.max(0, product.stock - baseUnitsDeducted);
        totalCost += Number(product.costPrice) * baseUnitsDeducted;
      }
    }
  });

  const profit = Number(total) - totalCost;
  const invoiceId = generateNextId('INV', db.sales, 1000);

  const newSale = {
    id: invoiceId,
    createdAt: new Date().toISOString(),
    cashierName,
    customerId: customer.id,
    customerName: customer.name,
    paymentMethod,
    subtotal: Number(subtotal),
    discount: Number(discount),
    total: Number(total),
    paidAmount: Number(paidAmount),
    remainingAmount,
    totalCost,
    profit,
    notes,
    source: 'pos',
    status: 'completed',
    items
  };

  db.sales.unshift(newSale);

  // Update customer stats & credit balance
  customer.totalPurchases = (customer.totalPurchases || 0) + Number(total);
  customer.loyaltyPoints = (customer.loyaltyPoints || 0) + Math.floor(Number(total) / 10);

  if (remainingAmount > 0) {
    customer.balance = (customer.balance || 0) + remainingAmount;
    if (!customer.transactions) customer.transactions = [];
    customer.transactions.unshift({
      id: `TR-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'invoice',
      amount: remainingAmount,
      description: `متبقي فاتورة مبيعات آجل #${invoiceId} (إجمالي ${total} ج.م - مدفوع ${paidAmount} ج.م)`
    });
  }

  saveDB('CREATE_SALE', invoiceId);
  res.json({ success: true, sale: newSale, state: db });
});

// 3. Return / Refund Sale
app.post('/api/sales/:id/return', (req, res) => {
  const sale = db.sales.find(s => s.id === req.params.id);
  if (!sale || sale.status === 'returned') {
    return res.status(400).json({ error: 'الفاتورة غير موجودة أو تم إرجاعها مسبقاً' });
  }

  sale.status = 'returned';
  sale.returnedAt = new Date().toISOString();

  // Restore stock
  sale.items.forEach(item => {
    const qty = Number(item.quantity) || 1;
    const factor = Number(item.factor) || 1;
    if (item.itemType === 'studyNote') {
      const note = db.studyNotes.find(n => n.id === item.productId);
      if (note) {
        note.stockPrinted += qty;
        note.totalSold = Math.max(0, (note.totalSold || 0) - qty);
      }
    } else if (item.itemType !== 'printService') {
      const product = db.products.find(p => p.id === item.productId);
      if (product) {
        product.stock += qty * factor;
      }
    }
  });

  // Adjust customer balance if credit
  if (sale.remainingAmount > 0) {
    const customer = db.customers.find(c => c.id === sale.customerId);
    if (customer) {
      customer.balance = Math.max(0, (customer.balance || 0) - sale.remainingAmount);
      customer.transactions.unshift({
        id: `TR-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'return',
        amount: sale.remainingAmount,
        description: `إلغاء مديونية مرتجع فاتورة #${sale.id}`
      });
    }
  }

  saveDB('RETURN_SALE', sale.id);
  res.json({ success: true, sale, state: db });
});

// 4. Products Management (Add / Update / Delete / Restock)
app.post('/api/products', (req, res) => {
  const body = req.body;
  const id = body.id || generateNextId('PRD', db.products, 1000);
  const barcode = body.barcode || `622100${Math.floor(100000 + Math.random() * 900000)}`;
  const piecesPerCarton = Math.max(1, Number(body.piecesPerCarton) || 1);

  const newProduct = {
    id,
    barcode,
    sku: body.sku || `SKU-${Date.now().toString().slice(-4)}`,
    name: body.name,
    category: body.category || 'CAT-1',
    costPrice: Number(body.costPrice) || 0,
    sellPrice: Number(body.sellPrice) || 0,
    wholesalePrice: Number(body.wholesalePrice) || Number(body.sellPrice) || 0,
    stock: Number(body.stock) || 0,
    minStock: Number(body.minStock) || 10,
    baseUnit: body.baseUnit || 'قطعة',
    piecesPerCarton,
    location: body.location || 'رف عام',
    showOnline: body.showOnline !== undefined ? body.showOnline : true,
    featured: Boolean(body.featured),
    image: body.image || 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?auto=format&fit=crop&w=400&q=80',
    units: Array.isArray(body.units) && body.units.length > 0
      ? body.units
      : [{ name: body.baseUnit || 'قطعة', factor: 1, price: Number(body.sellPrice) || 0, barcode }]
  };

  const existingIdx = db.products.findIndex(p => p.id === id);
  if (existingIdx >= 0) {
    db.products[existingIdx] = { ...db.products[existingIdx], ...newProduct };
    saveDB('UPDATE_PRODUCT', id);
  } else {
    db.products.unshift(newProduct);
    saveDB('CREATE_PRODUCT', id);
  }

  res.json({ success: true, product: newProduct, state: db });
});

app.delete('/api/products/:id', (req, res) => {
  db.products = db.products.filter(p => p.id !== req.params.id);
  saveDB('DELETE_PRODUCT', req.params.id);
  res.json({ success: true, state: db });
});

// Categories Management (Add / Update / Delete)
app.post('/api/categories', (req, res) => {
  const { id, name, icon = 'Package', color = 'emerald' } = req.body;
  const catId = id || `CAT-${Date.now().toString().slice(-5)}`;
  const newCat = { id: catId, name, icon, color };
  if (!db.categories) db.categories = [];
  const idx = db.categories.findIndex(c => c.id === catId);
  if (idx >= 0) db.categories[idx] = { ...db.categories[idx], ...newCat };
  else db.categories.push(newCat);
  saveDB('SAVE_CATEGORY', catId);
  res.json({ success: true, category: newCat, state: db });
});

app.delete('/api/categories/:id', (req, res) => {
  db.categories = (db.categories || []).filter(c => c.id !== req.params.id);
  saveDB('DELETE_CATEGORY', req.params.id);
  res.json({ success: true, state: db });
});

// Purchase / Restock Invoice from Supplier
app.post('/api/purchases', (req, res) => {
  const { supplierId, items = [], paidAmount = 0, notes = '' } = req.body;
  const supplier = db.suppliers.find(s => s.id === supplierId);

  let totalCost = 0;
  items.forEach(item => {
    const product = db.products.find(p => p.id === item.productId);
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.costPrice) || (product ? product.costPrice : 0);
    totalCost += qty * cost;
    if (product) {
      product.stock += qty;
      if (cost > 0) product.costPrice = cost;
    }
  });

  const remaining = Math.max(0, totalCost - Number(paidAmount));
  if (supplier) {
    supplier.totalSupplied = (supplier.totalSupplied || 0) + totalCost;
    supplier.balance = (supplier.balance || 0) + remaining;
    if (!supplier.transactions) supplier.transactions = [];
    supplier.transactions.unshift({
      id: `STR-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'purchase',
      amount: totalCost,
      paidAmount: Number(paidAmount),
      remaining,
      description: notes || `فاتورة توريد بضاعة للمخزن (${items.length} أصناف)`
    });
  }

  saveDB('CREATE_PURCHASE', supplierId || 'STOCK');
  res.json({ success: true, state: db });
});

// 5. Print Center & Study Notes APIs
app.post('/api/print-jobs', (req, res) => {
  const body = req.body;
  const newJob = {
    id: generateNextId('PRJ', db.printJobs, 500),
    customerName: body.customerName || 'عميل طباعة',
    customerPhone: body.customerPhone || '-',
    description: body.description || 'خدمة طباعة وتصوير',
    fileName: body.fileName || null,
    pagesCount: Number(body.pagesCount) || 1,
    copies: Number(body.copies) || 1,
    paperSize: body.paperSize || 'A4',
    colorMode: body.colorMode || 'bw',
    sides: body.sides || 'single',
    binding: body.binding || 'none',
    costEstimate: Number(body.costEstimate) || 0,
    totalPrice: Number(body.totalPrice) || 0,
    paidAmount: Number(body.paidAmount) || 0,
    status: body.status || 'completed',
    source: body.source || 'pos',
    createdAt: new Date().toISOString()
  };

  db.printJobs.unshift(newJob);

  // Update copier counter automatically
  const totalImpressions = newJob.pagesCount * newJob.copies;
  if (db.settings.copierCounters?.length > 0) {
    const targetMachine = newJob.colorMode === 'color'
      ? (db.settings.copierCounters[1] || db.settings.copierCounters[0])
      : db.settings.copierCounters[0];
    if (targetMachine) {
      targetMachine.currentCounter += totalImpressions;
    }
  }

  // If paid immediately at POS, also record as a POS sale if requested
  if (body.recordInSales) {
    const invoiceId = generateNextId('INV', db.sales, 1000);
    db.sales.unshift({
      id: invoiceId,
      createdAt: new Date().toISOString(),
      cashierName: body.cashierName || 'مسؤول الطباعة',
      customerId: 'CUS-1',
      customerName: newJob.customerName,
      paymentMethod: 'cash',
      subtotal: newJob.totalPrice,
      discount: 0,
      total: newJob.totalPrice,
      paidAmount: newJob.paidAmount,
      remainingAmount: Math.max(0, newJob.totalPrice - newJob.paidAmount),
      totalCost: newJob.costEstimate,
      profit: newJob.totalPrice - newJob.costEstimate,
      source: 'print_center',
      status: 'completed',
      items: [
        {
          productId: newJob.id,
          itemType: 'printService',
          name: newJob.description,
          unitName: 'خدمة طباعة',
          factor: 1,
          quantity: 1,
          unitPrice: newJob.totalPrice,
          costPrice: newJob.costEstimate,
          total: newJob.totalPrice
        }
      ]
    });
  }

  saveDB('CREATE_PRINT_JOB', newJob.id);
  res.json({ success: true, printJob: newJob, state: db });
});

app.patch('/api/print-jobs/:id', (req, res) => {
  const job = db.printJobs.find(j => j.id === req.params.id);
  if (job) {
    Object.assign(job, req.body);
    saveDB('UPDATE_PRINT_JOB', job.id);
  }
  res.json({ success: true, state: db });
});

app.post('/api/study-notes', (req, res) => {
  const body = req.body;
  const id = body.id || generateNextId('NOTE', db.studyNotes, 200);
  const note = {
    id,
    code: body.code || `M-${Date.now().toString().slice(-4)}`,
    title: body.title,
    teacherName: body.teacherName,
    teacherPhone: body.teacherPhone || '',
    grade: body.grade || 'المرحلة الثانوية',
    subject: body.subject || 'عام',
    pagesCount: Number(body.pagesCount) || 50,
    printType: body.printType || 'أبيض وأسود + غلاف ألوان + سلك',
    costPrice: Number(body.costPrice) || 25,
    teacherCommission: Number(body.teacherCommission) || 15,
    sellPrice: Number(body.sellPrice) || 60,
    stockPrinted: Number(body.stockPrinted) || 20,
    reservedCount: Number(body.reservedCount) || 0,
    totalSold: Number(body.totalSold) || 0,
    showOnline: body.showOnline !== undefined ? body.showOnline : true
  };

  const idx = db.studyNotes.findIndex(n => n.id === id);
  if (idx >= 0) {
    db.studyNotes[idx] = { ...db.studyNotes[idx], ...note };
  } else {
    db.studyNotes.unshift(note);
  }
  saveDB('SAVE_STUDY_NOTE', id);
  res.json({ success: true, studyNote: note, state: db });
});

app.post('/api/note-reservations', (req, res) => {
  const body = req.body;
  const note = db.studyNotes.find(n => n.id === body.noteId);
  const qty = Number(body.quantity) || 1;
  const totalPrice = (note ? note.sellPrice : Number(body.unitPrice || 0)) * qty;
  const paidAmount = Number(body.paidAmount) || 0;

  const reservation = {
    id: generateNextId('RES', db.noteReservations, 900),
    studentName: body.studentName,
    studentPhone: body.studentPhone,
    noteId: body.noteId,
    noteTitle: note ? `${note.title} - ${note.teacherName}` : body.noteTitle,
    quantity: qty,
    totalPrice,
    paidAmount,
    remainingAmount: Math.max(0, totalPrice - paidAmount),
    status: body.status || 'printing',
    createdAt: new Date().toISOString()
  };

  if (note) {
    note.reservedCount = (note.reservedCount || 0) + qty;
  }

  db.noteReservations.unshift(reservation);
  saveDB('RESERVE_STUDY_NOTE', reservation.id);
  res.json({ success: true, reservation, state: db });
});

app.patch('/api/note-reservations/:id', (req, res) => {
  const resv = db.noteReservations.find(r => r.id === req.params.id);
  if (resv) {
    const prevStatus = resv.status;
    Object.assign(resv, req.body);
    if (prevStatus !== 'delivered' && resv.status === 'delivered') {
      const note = db.studyNotes.find(n => n.id === resv.noteId);
      if (note) {
        note.stockPrinted = Math.max(0, note.stockPrinted - resv.quantity);
        note.reservedCount = Math.max(0, (note.reservedCount || 0) - resv.quantity);
        note.totalSold = (note.totalSold || 0) + resv.quantity;
      }
      resv.remainingAmount = 0;
      resv.paidAmount = resv.totalPrice;
    }
    saveDB('UPDATE_RESERVATION', resv.id);
  }
  res.json({ success: true, state: db });
});

// 6. Customers & Suppliers (CRM & Credit / Installments)
app.post('/api/customers', (req, res) => {
  const body = req.body;
  const id = body.id || generateNextId('CUS', db.customers, 100);
  const customer = {
    id,
    name: body.name,
    phone: body.phone || '-',
    type: body.type || 'vip',
    balance: Number(body.balance) || 0,
    creditLimit: Number(body.creditLimit) || 2000,
    loyaltyPoints: Number(body.loyaltyPoints) || 0,
    totalPurchases: Number(body.totalPurchases) || 0,
    notes: body.notes || '',
    transactions: body.transactions || []
  };

  const idx = db.customers.findIndex(c => c.id === id);
  if (idx >= 0) {
    db.customers[idx] = { ...db.customers[idx], ...customer };
  } else {
    db.customers.push(customer);
  }
  saveDB('SAVE_CUSTOMER', id);
  res.json({ success: true, customer, state: db });
});

app.post('/api/customers/:id/payment', (req, res) => {
  const customer = db.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

  const amount = Number(req.body.amount) || 0;
  const notes = req.body.notes || 'سداد دفعة نقدية من الحساب الآجل';

  customer.balance = Math.max(0, (customer.balance || 0) - amount);
  if (!customer.transactions) customer.transactions = [];
  customer.transactions.unshift({
    id: `TR-${Date.now()}`,
    date: new Date().toISOString(),
    type: 'payment',
    amount,
    description: notes
  });

  saveDB('CUSTOMER_PAYMENT', customer.id);
  res.json({ success: true, customer, state: db });
});

app.post('/api/suppliers', (req, res) => {
  const body = req.body;
  const id = body.id || generateNextId('SUP', db.suppliers, 100);
  const supplier = {
    id,
    name: body.name,
    phone: body.phone || '-',
    category: body.category || 'مورد عام',
    balance: Number(body.balance) || 0,
    totalSupplied: Number(body.totalSupplied) || 0,
    notes: body.notes || '',
    transactions: body.transactions || []
  };

  const idx = db.suppliers.findIndex(s => s.id === id);
  if (idx >= 0) {
    db.suppliers[idx] = { ...db.suppliers[idx], ...supplier };
  } else {
    db.suppliers.push(supplier);
  }
  saveDB('SAVE_SUPPLIER', id);
  res.json({ success: true, supplier, state: db });
});

app.post('/api/suppliers/:id/payment', (req, res) => {
  const supplier = db.suppliers.find(s => s.id === req.params.id);
  if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

  const amount = Number(req.body.amount) || 0;
  const notes = req.body.notes || 'سداد دفعة للمورد';

  supplier.balance = Math.max(0, (supplier.balance || 0) - amount);
  if (!supplier.transactions) supplier.transactions = [];
  supplier.transactions.unshift({
    id: `STR-${Date.now()}`,
    date: new Date().toISOString(),
    type: 'payment',
    amount,
    description: notes
  });

  saveDB('SUPPLIER_PAYMENT', supplier.id);
  res.json({ success: true, supplier, state: db });
});

// 7. Online Storefront Orders
app.post('/api/online-orders', (req, res) => {
  const body = req.body;
  const order = {
    id: generateNextId('ORD', db.onlineOrders, 700),
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    address: body.address || 'استلام من المكتبة',
    deliveryMethod: body.deliveryMethod || 'delivery',
    paymentMethod: body.paymentMethod || 'cash',
    notes: body.notes || '',
    subtotal: Number(body.subtotal) || 0,
    deliveryFee: Number(body.deliveryFee) || 0,
    total: Number(body.total) || 0,
    status: 'new',
    createdAt: new Date().toISOString(),
    items: body.items || []
  };

  db.onlineOrders.unshift(order);
  saveDB('NEW_ONLINE_ORDER', order.id);
  res.json({ success: true, order, state: db });
});

app.patch('/api/online-orders/:id', (req, res) => {
  const order = db.onlineOrders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  const prevStatus = order.status;
  Object.assign(order, req.body);

  // If completed for the first time, deduct stock & add to sales!
  if (prevStatus !== 'completed' && order.status === 'completed') {
    let totalCost = 0;
    const saleItems = order.items.map(item => {
      const qty = Number(item.quantity) || 1;
      if (item.type === 'studyNote') {
        const note = db.studyNotes.find(n => n.id === item.id);
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
        const product = db.products.find(p => p.id === item.id);
        const factor = Number(item.factor) || 1;
        const cPrice = product ? product.costPrice * factor : item.price * 0.75;
        if (product) {
          product.stock = Math.max(0, product.stock - qty * factor);
        }
        totalCost += cPrice * qty;
        return {
          productId: item.id,
          itemType: 'product',
          name: item.name,
          unitName: item.unitName || 'قطعة',
          factor,
          quantity: qty,
          unitPrice: item.price,
          costPrice: product ? product.costPrice : item.price * 0.75,
          total: item.total
        };
      }
    });

    const invoiceId = generateNextId('INV', db.sales, 1000);
    db.sales.unshift({
      id: invoiceId,
      createdAt: new Date().toISOString(),
      cashierName: 'المتجر الإلكتروني',
      customerId: 'CUS-1',
      customerName: `${order.customerName} (أونلاين)`,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      discount: 0,
      total: order.total,
      paidAmount: order.total,
      remainingAmount: 0,
      totalCost,
      profit: order.total - totalCost,
      source: 'online',
      status: 'completed',
      items: saleItems
    });
  }

  saveDB('UPDATE_ONLINE_ORDER', order.id);
  res.json({ success: true, order, state: db });
});

// 8. Expenses, Shifts, Settings & Cloud Sync
app.post('/api/expenses', (req, res) => {
  const exp = {
    id: `EXP-${db.expenses.length + 1}-${Date.now().toString().slice(-3)}`,
    title: req.body.title,
    category: req.body.category || 'مصروفات عامة',
    amount: Number(req.body.amount) || 0,
    paidBy: req.body.paidBy || 'أحمد محمود',
    createdAt: new Date().toISOString()
  };
  db.expenses.unshift(exp);
  saveDB('CREATE_EXPENSE', exp.id);
  res.json({ success: true, expense: exp, state: db });
});

app.put('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  saveDB('UPDATE_SETTINGS', 'settings');
  res.json({ success: true, settings: db.settings, state: db });
});

app.post('/api/sync', async (req, res) => {
  const now = new Date().toISOString();
  db.settings.lastSyncTime = now;
  if (db.syncQueue) {
    db.syncQueue.forEach(item => {
      item.status = 'synced';
    });
  }
  await pushToFirebaseCloud();
  await pullFromFirebaseCloud();
  // Create a timestamped local backup file as well
  const backupFile = path.join(BACKUP_DIR, `backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');

  res.json({
    success: true,
    syncedAt: now,
    backupFile: path.basename(backupFile),
    state: db
  });
});

app.post('/api/restore', (req, res) => {
  if (req.body && (req.body.settings || req.body.products)) {
    db = normalizeServerDB(req.body);
    saveDB('RESTORE_BACKUP', 'system');
    return res.json({ success: true, state: db });
  }
  res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
});

app.post('/api/reset', (req, res) => {
  db = structuredClone(initialDatabase);
  saveDB('RESET_ALL_DATA', 'system');
  res.json({ success: true, state: db });
});

// Serve frontend build if available
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Beit El-Aila Server & Offline/Cloud Sync Engine running on http://localhost:${PORT}`);
  console.log(`🛍️ Standalone Online Store running on http://localhost:${PORT}/store`);
});
