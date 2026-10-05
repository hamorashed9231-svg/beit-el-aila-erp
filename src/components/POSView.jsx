import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus, Printer,
  PauseCircle, PlayCircle, RotateCcw, UserCheck, CreditCard,
  Banknote, Smartphone, BookOpen, FileText, Sparkles, Check, AlertTriangle
} from 'lucide-react';

export default function POSView({
  state,
  currentUser,
  onCompleteSale,
  onReturnSale,
  onPrintReceipt,
  onSaveProduct,
  onSaveCategory
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeCatalogTab, setActiveCatalogTab] = useState('products'); // products | notes | history
  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('CUS-1');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [isWholesale, setIsWholesale] = useState(false);
  const [scannerToast, setScannerToast] = useState(null);

  // Quick print service modal inside POS
  const [quickPrintOpen, setQuickPrintOpen] = useState(false);
  const [qpDesc, setQpDesc] = useState('تصوير وطباعة أوراق');
  const [qpPages, setQpPages] = useState(10);
  const [qpRate, setQpRate] = useState(1.0);
  const [qpExtra, setQpExtra] = useState(0);

  // Quick Add New Product Modal directly from POS (or when scanning an unknown barcode!)
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [qaName, setQaName] = useState('');
  const [qaBarcode, setQaBarcode] = useState('');
  const [qaCategory, setQaCategory] = useState('CAT-7');
  const [qaBaseUnit, setQaBaseUnit] = useState('قطعة');
  const [qaByCarton, setQaByCarton] = useState(true);
  const [qaCartonsCount, setQaCartonsCount] = useState(5);
  const [qaPiecesPerCarton, setQaPiecesPerCarton] = useState(24);
  const [qaCartonCost, setQaCartonCost] = useState(192);
  const [qaPieceSell, setQaPieceSell] = useState(10);
  const [qaCartonSell, setQaCartonSell] = useState(225);
  const [qaDirectStock, setQaDirectStock] = useState(50);
  const [qaDirectCost, setQaDirectCost] = useState(7);

  // Quick Add Category Modal inside POS
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');

  const searchInputRef = useRef(null);
  const barcodeBufferRef = useRef({ chars: '', lastTime: 0 });

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const finalTotal = Math.max(0, subtotal - Number(discount || 0));

  const effectivePaid = paidAmountInput === ''
    ? (paymentMethod === 'credit' ? 0 : finalTotal)
    : Number(paidAmountInput);

  const changeForCustomer = Math.max(0, effectivePaid - finalTotal);
  const remainingDebt = Math.max(0, finalTotal - effectivePaid);

  const selectedCustomer = state.customers.find(c => c.id === selectedCustomerId) || state.customers[0];

  const openQuickAddProduct = (prefilledBarcode = '') => {
    setQaBarcode(prefilledBarcode || `622100${Math.floor(100000 + Math.random() * 900000)}`);
    setQaName('');
    setQaCategory(state.categories.find(c => c.id === 'CAT-7')?.id || state.categories[0]?.id || 'CAT-1');
    setQaBaseUnit('قطعة');
    setQaByCarton(true);
    setQaCartonsCount(5);
    setQaPiecesPerCarton(24);
    setQaCartonCost(192);
    setQaPieceSell(10);
    setQaCartonSell(225);
    setQuickAddModalOpen(true);
  };

  // Global Keyboard Shortcuts + Hardware USB/Wireless Barcode Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handleHoldCart();
        return;
      } else if (e.key === 'F8') {
        e.preventDefault();
        toggleWholesaleMode();
        return;
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) handleCheckout();
        return;
      }

      // Hardware Barcode Gun Detection when user is NOT typing in an input field
      const tag = document.activeElement?.tagName;
      const isTypingInInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (!isTypingInInput && !quickAddModalOpen && !quickPrintOpen && !quickCatOpen) {
        const now = Date.now();
        if (e.key === 'Enter' && barcodeBufferRef.current.chars.length >= 3) {
          e.preventDefault();
          const scannedCode = barcodeBufferRef.current.chars.trim();
          barcodeBufferRef.current.chars = '';
          processScannedOrSearchedCode(scannedCode);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          // Reset buffer if more than 120ms elapsed since previous character
          if (now - barcodeBufferRef.current.lastTime > 120) {
            barcodeBufferRef.current.chars = '';
          }
          barcodeBufferRef.current.chars += e.key;
          barcodeBufferRef.current.lastTime = now;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const toggleWholesaleMode = () => {
    const nextMode = !isWholesale;
    setIsWholesale(nextMode);
    setCart(prev =>
      prev.map(item => {
        if (item.itemType !== 'product') return item;
        const prod = state.products.find(p => p.id === item.productId);
        if (!prod) return item;
        const basePrice = nextMode ? (prod.wholesalePrice || prod.sellPrice) : prod.sellPrice;
        const newPrice = item.factor === 1 ? basePrice : item.unitPrice;
        return {
          ...item,
          unitPrice: newPrice,
          total: newPrice * item.quantity
        };
      })
    );
  };

  const addProductToCart = (product, specificUnit = null) => {
    const units = product.units?.length > 0
      ? product.units
      : [{ name: product.baseUnit || 'قطعة', factor: 1, price: product.sellPrice, barcode: product.barcode }];

    const chosenUnit = specificUnit || units[0];
    const unitPrice = (isWholesale && chosenUnit.factor === 1)
      ? (product.wholesalePrice || chosenUnit.price)
      : chosenUnit.price;

    setCart(prev => {
      const existingIndex = prev.findIndex(
        i => i.productId === product.id && i.unitName === chosenUnit.name && i.itemType === 'product'
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId: `${product.id}-${chosenUnit.name}-${Date.now()}`,
          productId: product.id,
          itemType: 'product',
          name: product.name,
          unitName: chosenUnit.name,
          factor: chosenUnit.factor || 1,
          availableUnits: units,
          quantity: 1,
          unitPrice: Number(unitPrice),
          costPrice: Number(product.costPrice),
          maxStock: product.stock,
          total: Number(unitPrice)
        }
      ];
    });
  };

  const addStudyNoteToCart = (note) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(i => i.productId === note.id && i.itemType === 'studyNote');
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId: `${note.id}-${Date.now()}`,
          productId: note.id,
          itemType: 'studyNote',
          name: `${note.title} (${note.teacherName})`,
          unitName: 'مذكرة',
          factor: 1,
          availableUnits: [{ name: 'مذكرة', factor: 1, price: note.sellPrice }],
          quantity: 1,
          unitPrice: Number(note.sellPrice),
          costPrice: Number(note.costPrice) + Number(note.teacherCommission || 0),
          maxStock: note.stockPrinted,
          total: Number(note.sellPrice)
        }
      ];
    });
  };

  const handleAddQuickPrint = (e) => {
    e.preventDefault();
    const total = Number(qpPages) * Number(qpRate) + Number(qpExtra);
    const estCost = Number(qpPages) * 0.55;
    setCart(prev => [
      ...prev,
      {
        cartItemId: `QP-${Date.now()}`,
        productId: `QP-${Date.now()}`,
        itemType: 'printService',
        name: `${qpDesc} (${qpPages} ورقة)`,
        unitName: 'خدمة طباعة',
        factor: 1,
        availableUnits: [{ name: 'خدمة طباعة', factor: 1, price: total }],
        quantity: 1,
        unitPrice: total,
        costPrice: estCost,
        maxStock: 9999,
        total
      }
    ]);
    setQuickPrintOpen(false);
  };

  // Process Barcode Scan (from Laser/USB gun or Search Input)
  const processScannedOrSearchedCode = (rawCode) => {
    const q = (rawCode || '').trim();
    if (!q) return;

    // 1. Check exact unit barcode or product barcode or SKU
    for (const prod of state.products) {
      if (prod.barcode === q || prod.sku?.toLowerCase() === q.toLowerCase()) {
        addProductToCart(prod);
        setSearchQuery('');
        setScannerToast(`تمت إضافة: ${prod.name} ✓`);
        setTimeout(() => setScannerToast(null), 2200);
        return;
      }
      if (prod.units) {
        const matchedUnit = prod.units.find(u => u.barcode === q);
        if (matchedUnit) {
          addProductToCart(prod, matchedUnit);
          setSearchQuery('');
          setScannerToast(`تمت إضافة: ${prod.name} (${matchedUnit.name}) ✓`);
          setTimeout(() => setScannerToast(null), 2200);
          return;
        }
      }
    }

    // 2. Check Study Note code
    const matchedNote = state.studyNotes.find(
      n => n.code?.toLowerCase() === q.toLowerCase() || n.id.toLowerCase() === q.toLowerCase()
    );
    if (matchedNote) {
      addStudyNoteToCart(matchedNote);
      setSearchQuery('');
      setScannerToast(`تمت إضافة مذكرة: ${matchedNote.title} ✓`);
      setTimeout(() => setScannerToast(null), 2200);
      return;
    }

    // 3. If single product matches name search, add it directly
    const matchingProds = state.products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    if (matchingProds.length === 1) {
      addProductToCart(matchingProds[0]);
      setSearchQuery('');
      setScannerToast(`تمت إضافة: ${matchingProds[0].name} ✓`);
      setTimeout(() => setScannerToast(null), 2200);
      return;
    }

    // 4. If no product matched (e.g. new Chipsy/Gift barcode scanned or new product name typed),
    // open the Quick Add Product modal with the barcode or name pre-filled!
    if (/^\d{4,}$/.test(q)) {
      openQuickAddProduct(q);
      setSearchQuery('');
    } else if (matchingProds.length === 0) {
      setQaBarcode(`622100${Math.floor(100000 + Math.random() * 900000)}`);
      setQaName(q);
      setQaCategory(state.categories.find(c => c.id === 'CAT-7')?.id || state.categories[0]?.id || 'CAT-1');
      setQaBaseUnit('قطعة');
      setQaByCarton(true);
      setQuickAddModalOpen(true);
    }
  };

  // Barcode scan or Enter key in search input
  const handleBarcodeSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // If user clicked "إضافة" while search box is empty, open the New Product Modal!
      openQuickAddProduct('');
      return;
    }
    processScannedOrSearchedCode(searchQuery);
  };

  const handleSaveQuickProductSubmit = async (e) => {
    e.preventDefault();
    if (!qaName.trim()) return;
    const ppc = qaByCarton ? Math.max(1, Number(qaPiecesPerCarton) || 1) : 1;
    const totalStock = qaByCarton
      ? Math.max(0, Number(qaCartonsCount) || 0) * ppc
      : Math.max(0, Number(qaDirectStock) || 0);
    const pieceCost = qaByCarton
      ? Number((Number(qaCartonCost || 0) / ppc).toFixed(2))
      : Number(qaDirectCost || 0);
    const pieceSell = Number(qaPieceSell || 0);
    const cartonSell = Number(qaCartonSell || pieceSell * ppc);
    const barcode = qaBarcode.trim() || `622100${Math.floor(100000 + Math.random() * 900000)}`;
    const newId = `PRD-${1000 + state.products.length + 1}`;

    const units = [
      { name: qaBaseUnit || 'قطعة', factor: 1, price: pieceSell, barcode }
    ];
    if (qaByCarton && ppc > 1) {
      units.push({
        name: `كرتونة (${ppc} ${qaBaseUnit || 'قطعة'})`,
        factor: ppc,
        price: cartonSell,
        barcode: `${barcode}2`
      });
    }

    const newProduct = {
      id: newId,
      name: qaName.trim(),
      barcode,
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      category: qaCategory,
      costPrice: pieceCost,
      sellPrice: pieceSell,
      wholesalePrice: Math.max(pieceCost, pieceSell - 1),
      stock: totalStock,
      minStock: ppc > 1 ? ppc : 10,
      baseUnit: qaBaseUnit || 'قطعة',
      piecesPerCarton: ppc,
      location: 'رف المعرض',
      showOnline: true,
      featured: false,
      image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80',
      units
    };

    if (onSaveProduct) {
      await onSaveProduct(newProduct);
    }
    addProductToCart(newProduct, units[0]);
    setQuickAddModalOpen(false);
    setSearchQuery('');
    setScannerToast(`تم تعريف الصنف "${newProduct.name}" وإضافته للفاتورة فوراً ✓`);
    setTimeout(() => setScannerToast(null), 3000);
  };

  const updateCartItemQty = (cartItemId, delta) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.cartItemId !== cartItemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...item, quantity: nextQty, total: nextQty * item.unitPrice };
        })
        .filter(Boolean)
    );
  };

  const changeCartItemUnit = (cartItemId, unitName) => {
    setCart(prev =>
      prev.map(item => {
        if (item.cartItemId !== cartItemId) return item;
        const unitObj = item.availableUnits?.find(u => u.name === unitName);
        if (!unitObj) return item;
        return {
          ...item,
          unitName: unitObj.name,
          factor: unitObj.factor || 1,
          unitPrice: Number(unitObj.price),
          total: item.quantity * Number(unitObj.price)
        };
      })
    );
  };

  const updateCartItemCustomPrice = (cartItemId, newPrice) => {
    const val = Math.max(0, Number(newPrice) || 0);
    setCart(prev =>
      prev.map(item =>
        item.cartItemId === cartItemId
          ? { ...item, unitPrice: val, total: item.quantity * val }
          : item
      )
    );
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCarts(prev => [
      ...prev,
      {
        id: `HOLD-${prev.length + 1}`,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        customerName: selectedCustomer.name,
        customerId: selectedCustomerId,
        items: cart,
        total: finalTotal
      }
    ]);
    setCart([]);
    setDiscount(0);
    setPaidAmountInput('');
  };

  const handleRecallCart = (holdId) => {
    const target = heldCarts.find(h => h.id === holdId);
    if (!target) return;
    setCart(target.items);
    setSelectedCustomerId(target.customerId);
    setHeldCarts(prev => prev.filter(h => h.id !== holdId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (remainingDebt > 0 && selectedCustomerId === 'CUS-1') {
      alert('تنبيه: لا يمكن تسجيل فاتورة آجل أو متبقي على "عميل نقدي". يرجى اختيار اسم العميل من القائمة أولاً لحفظ المديونية في حسابه.');
      return;
    }

    const salePayload = {
      cashierName: currentUser?.name || 'أحمد محمود',
      customerId: selectedCustomerId,
      paymentMethod,
      subtotal,
      discount: Number(discount || 0),
      total: finalTotal,
      paidAmount: Math.min(finalTotal, effectivePaid),
      items: cart.map(i => ({
        productId: i.productId,
        itemType: i.itemType,
        name: i.name,
        unitName: i.unitName,
        factor: i.factor,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        costPrice: i.costPrice,
        total: i.total
      }))
    };

    onCompleteSale(salePayload);
    setCart([]);
    setDiscount(0);
    setPaidAmountInput('');
    setPaymentMethod('cash');
  };

  const filteredProducts = state.products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const filteredNotes = state.studyNotes.filter(n => {
    const q = searchQuery.trim().toLowerCase();
    return (
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.teacherName.toLowerCase().includes(q) ||
      n.grade.toLowerCase().includes(q) ||
      n.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Right / Center Column: Catalog & Barcode Search (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Top Barcode & Quick Action Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCatalogTab('products')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  activeCatalogTab === 'products'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                الأصناف والأدوات ({state.products.length})
              </button>
              <button
                onClick={() => setActiveCatalogTab('notes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  activeCatalogTab === 'notes'
                    ? 'bg-purple-700 text-white shadow'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                المذكرات الدراسية ({state.studyNotes.length})
              </button>
              <button
                onClick={() => setActiveCatalogTab('history')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  activeCatalogTab === 'history'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                الفواتير والمرتجعات ({state.sales.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openQuickAddProduct('')}
                className="px-3 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                + تعريف صنف جديد (بالكرتونة/القطعة)
              </button>
              <button
                type="button"
                onClick={() => setQuickPrintOpen(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4 text-emerald-600" />
                + تصوير/طباعة سريعة
              </button>
              <button
                type="button"
                onClick={toggleWholesaleMode}
                title="اختصار F8"
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                  isWholesale
                    ? 'bg-amber-500 text-white border-amber-600 shadow'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isWholesale ? 'تسعير الجملة مفعّل (F8)' : 'تسعير قطاعي عادي (F8)'}
              </button>
            </div>
          </div>

          {/* Scanner Live Toast Alert */}
          {scannerToast && (
            <div className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-between animate-pulse">
              <span>⚡ قارئ الباركود: {scannerToast}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">جاهز للمسح التالي</span>
            </div>
          )}

          {/* Barcode & Smart Search Form */}
          <form onSubmit={handleBarcodeSearchSubmit} className="relative">
            <Barcode className="w-5 h-5 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="امسح الباركود بجهاز الليزر في أي وقت (كيس / قطعة / كرتونة) أو ابحث بالاسم... (F2)"
              className="w-full pr-11 pl-32 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm font-bold transition"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                قارئ الباركود متصل
              </span>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition"
              >
                إضافة
              </button>
            </div>
          </form>

          {/* Category Pills when in Products tab */}
          {activeCatalogTab === 'products' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                كل الأقسام
              </button>
              {state.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickCatOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                قسم جديد
              </button>
            </div>
          )}
        </div>

        {/* Held Invoices Banner */}
        {heldCarts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <PauseCircle className="w-4 h-4 text-amber-600" />
              <span>فواتير معلقة بالانتظار ({heldCarts.length}):</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {heldCarts.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleRecallCart(h.id)}
                  className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                  استدعاء ({h.customerName} - {h.total} ج.م)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: PRODUCTS GRID */}
        {activeCatalogTab === 'products' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[630px] overflow-y-auto pr-1">
            {filteredProducts.map(prod => {
              const isLowStock = prod.stock <= prod.minStock;
              const displayPrice = isWholesale ? (prod.wholesalePrice || prod.sellPrice) : prod.sellPrice;
              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition p-3 flex flex-col justify-between group"
                >
                  <div>
                    <div className="relative h-28 rounded-xl overflow-hidden bg-slate-100 mb-2.5">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span
                        className={`absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-md ${
                          prod.stock <= 0
                            ? 'bg-rose-600 text-white'
                            : isLowStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-900/80 text-white'
                        }`}
                      >
                        الرصيد: {prod.stock} {prod.baseUnit}
                      </span>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-xs font-black px-2.5 py-0.5 rounded-lg shadow">
                        {displayPrice} ج.م
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">{prod.name}</h4>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{prod.barcode} • {prod.location}</div>
                  </div>

                  {/* Multi-unit quick add buttons */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {(prod.units?.length > 0 ? prod.units : [{ name: prod.baseUnit, factor: 1, price: prod.sellPrice }]).map((u, idx) => (
                      <button
                        key={idx}
                        onClick={() => addProductToCart(prod, u)}
                        className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                          idx === 0
                            ? 'bg-slate-900 hover:bg-emerald-600 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        {u.name} ({u.price} ج)
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: STUDY NOTES GRID */}
        {activeCatalogTab === 'notes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[630px] overflow-y-auto pr-1">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => addStudyNoteToCart(note)}
                className="cursor-pointer bg-white rounded-2xl border-2 border-purple-100 hover:border-purple-500 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                      {note.grade} • {note.subject}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-400">{note.code}</span>
                  </div>
                  <h4 className="font-black text-sm text-slate-900">{note.title}</h4>
                  <p className="text-xs font-bold text-purple-700 mt-1">{note.teacherName}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{note.pagesCount} صفحة • {note.printType}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    متاح جاهز: <strong className="text-emerald-700">{note.stockPrinted} نسخة</strong>
                  </span>
                  <span className="bg-purple-700 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    {note.sellPrice} ج.م
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: SALES HISTORY & RETURNS */}
        {activeCatalogTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-800">سجل فواتير الكاشير وإدارة المرتجعات</h4>
              <span className="text-xs text-slate-500">إجمالي {state.sales.length} فاتورة</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {state.sales.map(sale => (
                <div key={sale.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">{sale.id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sale.status === 'returned'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {sale.status === 'returned' ? 'مرتجع بالكامل' : 'مكتملة'}
                      </span>
                      <span className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleString('ar-EG')}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-700 mt-1">
                      العميل: {sale.customerName} • عدد الأصناف: {sale.items?.length || 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-left ml-2">
                      <div className="font-black text-sm text-slate-900">{sale.total} ج.م</div>
                      {sale.remainingAmount > 0 && (
                        <div className="text-[10px] font-bold text-rose-600">آجل متبقي: {sale.remainingAmount} ج</div>
                      )}
                    </div>
                    <button
                      onClick={() => onPrintReceipt(sale)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      الفاتورة
                    </button>
                    {sale.status !== 'returned' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`هل أنت متأكد من عمل مرتجع للفاتورة ${sale.id} وإعادة الأصناف للمخزن؟`)) {
                            onReturnSale(sale.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        مرتجع
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Left Column: Active Cashier Invoice & Payment (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col overflow-hidden sticky top-4">
        {/* Invoice Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm">شاشة الفاتورة الحالية (POS)</h3>
              <p className="text-[11px] text-slate-400">الكاشير: {currentUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              title="تعليق الفاتورة مؤقتاً (F4)"
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 disabled:opacity-40 transition"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              تعليق (F4)
            </button>
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 disabled:opacity-40 transition"
              title="إفراغ السلة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>العميل:</span>
            </div>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {state.customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.balance > 0 ? `(عليه آجل: ${c.balance} ج.م)` : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedCustomer.balance > 0 && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] bg-amber-50 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-200">
              <span>مديونية سابقة على العميل: <strong>{selectedCustomer.balance} ج.م</strong></span>
              <span>حد الائتمان: {selectedCustomer.creditLimit} ج.م</span>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="divide-y divide-slate-100 max-h-[310px] min-h-[210px] overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <Barcode className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              <p className="font-bold text-xs text-slate-500">السلة فارغة حالياً</p>
              <p className="text-[11px] mt-0.5">امسح الباركود أو اضغط على أي صنف أو مذكرة لإضافتها فوراً</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.cartItemId} className="p-2.5 hover:bg-slate-50 rounded-xl transition space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-xs text-slate-900">{item.name}</div>
                    {/* Unit selector dropdown */}
                    <div className="flex items-center gap-2 mt-1">
                      {item.availableUnits && item.availableUnits.length > 1 ? (
                        <select
                          value={item.unitName}
                          onChange={e => changeCartItemUnit(item.cartItemId, e.target.value)}
                          className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg px-2 py-0.5 outline-none"
                        >
                          {item.availableUnits.map((u, i) => (
                            <option key={i} value={u.name}>
                              {u.name} ({u.price} ج)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                          الوحدة: {item.unitName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    <button
                      onClick={() => updateCartItemQty(item.cartItemId, -1)}
                      className="w-6 h-6 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 flex items-center justify-center shadow-sm"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-black text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItemQty(item.cartItemId, 1)}
                      className="w-6 h-6 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 flex items-center justify-center shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Unit Price & Total */}
                  <div className="text-left min-w-[75px]">
                    <div className="font-black text-xs text-emerald-700">{item.total.toFixed(2)} ج.م</div>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={e => updateCartItemCustomPrice(item.cartItemId, e.target.value)}
                      className="w-16 text-[11px] text-left font-mono text-slate-500 border-b border-dashed border-slate-300 focus:border-emerald-600 outline-none bg-transparent"
                      title="تعديل سعر الوحدة"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment Section */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-semibold">المجموع:</span>
              <span className="font-bold">{subtotal.toFixed(2)} ج</span>
            </div>
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-semibold">الخصم (ج.م):</span>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-16 text-left font-bold text-emerald-700 border-b border-slate-300 focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Big Final Total */}
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs text-slate-400 block">الإجمالي النهائي المطلوب</span>
              <span className="text-[11px] text-emerald-400 font-semibold">
                {cart.reduce((s, i) => s + i.quantity, 0)} قطع في الفاتورة
              </span>
            </div>
            <div className="text-2xl font-black tracking-tight text-emerald-400">
              {finalTotal.toFixed(2)} <span className="text-sm font-bold text-white">ج.م</span>
            </div>
          </div>

          {/* Payment Method Pills */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'cash', label: 'كاش نقدي', icon: Banknote },
              { id: 'vodafone_cash', label: 'فودافون كاش', icon: Smartphone },
              { id: 'instapay', label: 'إنستا باي', icon: CreditCard },
              { id: 'credit', label: 'آجل / ذمم', icon: FileText }
            ].map(pm => {
              const Icon = pm.icon;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(pm.id);
                    if (pm.id === 'credit') setPaidAmountInput('0');
                    else setPaidAmountInput('');
                  }}
                  className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 border transition ${
                    paymentMethod === pm.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {pm.label}
                </button>
              );
            })}
          </div>

          {/* Paid Input & Change / Remaining Calculation */}
          <div className="grid grid-cols-2 gap-2 items-center">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">المبلغ المدفوع من العميل</label>
              <input
                type="number"
                placeholder={`${finalTotal.toFixed(2)}`}
                value={paidAmountInput}
                onChange={e => setPaidAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="bg-white rounded-xl p-2 border border-slate-200 text-center">
              {remainingDebt > 0 ? (
                <>
                  <span className="text-[11px] font-bold text-rose-600 block">متبقي آجل على العميل</span>
                  <span className="text-base font-black text-rose-600">{remainingDebt.toFixed(2)} ج.م</span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-bold text-slate-500 block">الباقي للعميل (الفكة)</span>
                  <span className="text-base font-black text-emerald-700">{changeForCustomer.toFixed(2)} ج.م</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 text-base transition"
          >
            <Printer className="w-5 h-5" />
            إتمام البيع وطباعة الفاتورة (F9)
          </button>
        </div>
      </div>

      {/* Quick Print Service Modal inside POS */}
      {quickPrintOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddQuickPrint}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4"
          >
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              إضافة خدمة تصوير / طباعة سريعة للفاتورة
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">وصف الخدمة</label>
              <input
                type="text"
                value={qpDesc}
                onChange={e => setQpDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد الورق</label>
                <input
                  type="number"
                  min="1"
                  value={qpPages}
                  onChange={e => setQpPages(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر الورقة (ج)</label>
                <input
                  type="number"
                  step="0.25"
                  value={qpRate}
                  onChange={e => setQpRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">إضافات/تغليف (ج)</label>
                <input
                  type="number"
                  value={qpExtra}
                  onChange={e => setQpExtra(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl flex justify-between items-center text-sm font-bold text-emerald-900">
              <span>إجمالي خدمة الطباعة:</span>
              <span className="text-lg font-black">{(Number(qpPages) * Number(qpRate) + Number(qpExtra)).toFixed(2)} ج.م</span>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl">
                إضافة للسلة
              </button>
              <button
                type="button"
                onClick={() => setQuickPrintOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add New Product Modal (Triggered from POS or when scanning an unknown barcode!) */}
      {quickAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveQuickProductSubmit}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-3.5 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Barcode className="w-5 h-5 text-blue-600" />
                  تعريف منتج جديد سريع (وإضافته للفاتورة فوراً)
                </h3>
                <p className="text-[11px] text-slate-500">
                  سواء شيبسي، هدايا، ألعاب، أو أدوات مكتبية — ضيفه بالكرتونة أو بالقطعة وهيسمّع في المخزن فوراً
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddModalOpen(false)}
                className="text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">اسم الصنف</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={qaName}
                  onChange={e => setQaName(e.target.value)}
                  placeholder="مثال: شيبسي عائلي / شيكولاتة كادبوري / لعبة / قلم..."
                  className="w-full rounded-xl border-2 border-blue-400 px-3 py-2 font-black text-sm outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">الباركود (امسحه بالجهاز أو اتركه تلقائي)</label>
                <input
                  type="text"
                  value={qaBarcode}
                  onChange={e => setQaBarcode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">القسم</label>
                <select
                  value={qaCategory}
                  onChange={e => setQaCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                >
                  {state.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Carton vs Piece Switcher */}
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-blue-950">طريقة إضافة المخزون:</span>
                <div className="flex bg-white rounded-xl p-1 border border-blue-200">
                  <button
                    type="button"
                    onClick={() => setQaByCarton(true)}
                    className={`px-3 py-1 rounded-lg font-black transition ${
                      qaByCarton ? 'bg-blue-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    📦 بالكرتونة (وعدد القطع داخلها)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQaByCarton(false)}
                    className={`px-3 py-1 rounded-lg font-black transition ${
                      !qaByCarton ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    🔢 بالقطعة الفردية
                  </button>
                </div>
              </div>

              {qaByCarton ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white p-2 rounded-xl border border-blue-200">
                    <label className="block font-black text-blue-900 mb-1">عدد الكراتين</label>
                    <input
                      type="number"
                      min="1"
                      value={qaCartonsCount}
                      onChange={e => setQaCartonsCount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-sm"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-blue-200">
                    <label className="block font-black text-blue-900 mb-1">عدد القطع داخل الكرتونة</label>
                    <input
                      type="number"
                      min="1"
                      value={qaPiecesPerCarton}
                      onChange={e => setQaPiecesPerCarton(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-sm text-blue-700"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-blue-200">
                    <label className="block font-bold text-slate-700 mb-1">سعر شراء الكرتونة جملة</label>
                    <input
                      type="number"
                      step="0.25"
                      value={qaCartonCost}
                      onChange={e => setQaCartonCost(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-sm"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-blue-200">
                    <label className="block font-black text-emerald-800 mb-1">سعر بيع القطعة للعميل</label>
                    <input
                      type="number"
                      step="0.25"
                      value={qaPieceSell}
                      onChange={e => {
                        setQaPieceSell(e.target.value);
                        setQaCartonSell(Number(e.target.value) * Number(qaPiecesPerCarton));
                      }}
                      className="w-full rounded-lg border border-emerald-400 px-2.5 py-1.5 font-black text-sm text-emerald-700"
                    />
                  </div>
                  <div className="col-span-2 bg-slate-900 text-white p-2.5 rounded-xl flex items-center justify-between">
                    <span>الرصيد الإجمالي الذي سيُضاف للمخزن:</span>
                    <span className="font-black text-sm text-emerald-400">
                      {Number(qaCartonsCount) * Number(qaPiecesPerCarton)} قطعة (ويُخصم تلقائياً مع كل بيعة)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <label className="block font-bold mb-1">الكمية (بالقطعة)</label>
                    <input
                      type="number"
                      min="1"
                      value={qaDirectStock}
                      onChange={e => setQaDirectStock(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-black"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <label className="block font-bold mb-1">تكلفة القطعة</label>
                    <input
                      type="number"
                      step="0.25"
                      value={qaDirectCost}
                      onChange={e => setQaDirectCost(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-bold"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <label className="block font-black text-emerald-800 mb-1">سعر بيع القطعة</label>
                    <input
                      type="number"
                      step="0.25"
                      value={qaPieceSell}
                      onChange={e => setQaPieceSell(e.target.value)}
                      className="w-full rounded-lg border border-emerald-400 px-2 py-1.5 font-black text-emerald-700"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow"
              >
                حفظ الصنف في المخزن وإضافته للفاتورة الآن
              </button>
              <button
                type="button"
                onClick={() => setQuickAddModalOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-3 px-5 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Category Modal inside POS */}
      {quickCatOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!quickCatName.trim()) return;
              const newId = await onSaveCategory?.({ name: quickCatName.trim() });
              if (newId) setSelectedCategory(newId);
              setQuickCatName('');
              setQuickCatOpen(false);
            }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 space-y-4 text-xs"
          >
            <h3 className="font-black text-base text-slate-900">إضافة قسم جديد للمكتبة</h3>
            <div>
              <label className="block font-bold mb-1">اسم القسم الجديد</label>
              <input
                type="text"
                required
                autoFocus
                value={quickCatName}
                onChange={e => setQuickCatName(e.target.value)}
                placeholder="مثال: شيبسي وسناكس / مشروبات / عطور وهدايا..."
                className="w-full rounded-xl border-2 border-purple-400 px-3 py-2 font-bold outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-purple-600 text-white font-black py-2.5 rounded-xl">
                إضافة القسم
              </button>
              <button
                type="button"
                onClick={() => setQuickCatOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
