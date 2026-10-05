import React, { useState } from 'react';
import {
  Globe, ShoppingBag, Truck, CheckCircle2, Plus, Minus,
  Search, BookOpen, Upload, Printer, Share2, MapPin, Phone, Sparkles, ExternalLink, Copy, Check, Package, Smartphone
} from 'lucide-react';

export default function OnlineStoreView({
  state,
  isStandalone = false,
  onSubmitOnlineOrder,
  onUpdateOnlineOrder,
  onSubmitOnlinePrintJob
}) {
  // When opened inside the ERP, default to 'orders_admin' so staff manage orders first,
  // while when opened as the standalone customer store (/store or on Mobile/Tablet), always show 'storefront'
  const [viewMode, setViewMode] = useState(isStandalone ? 'storefront' : 'orders_admin');
  const [storeTab, setStoreTab] = useState('products'); // products | notes | online_print
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnitByProduct, setSelectedUnitByProduct] = useState({});
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Customer Checkout Form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('delivery'); // delivery | pickup
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [custNotes, setCustNotes] = useState('');

  // Online Print File Form
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfPages, setPdfPages] = useState(50);
  const [pdfCopies, setPdfCopies] = useState(1);
  const [pdfColor, setPdfColor] = useState('bw');
  const [pdfSides, setPdfSides] = useState('double');
  const [pdfBinding, setPdfBinding] = useState('spiralSmall');
  const [pdfCustomerName, setPdfCustomerName] = useState('');
  const [pdfCustomerPhone, setPdfCustomerPhone] = useState('');
  const [pdfSubmitted, setPdfSubmitted] = useState(false);

  const storeName = state.settings?.storeName || 'بيت العيلة';
  const logoUrl = state.settings?.logoUrl || '/logo.jpg';
  const standaloneStoreUrl = `${window.location.origin}/store`;

  const onlineProducts = (state.products || []).filter(p => p.showOnline !== false);
  const onlineNotes = (state.studyNotes || []).filter(n => n.showOnline !== false);

  const filteredProducts = onlineProducts.filter(p => {
    const matchCat = selectedCat === 'ALL' || p.category === selectedCat;
    const q = searchQuery.trim().toLowerCase();
    return matchCat && (!q || p.name.toLowerCase().includes(q));
  });

  const getProductChosenUnit = (prod) => {
    const units = prod.units?.length > 0
      ? prod.units
      : [{ name: prod.baseUnit || 'قطعة', factor: 1, price: prod.sellPrice }];
    const chosenName = selectedUnitByProduct[prod.id];
    return units.find(u => u.name === chosenName) || units[0];
  };

  const addToStoreCart = (item, type = 'product', customUnit = null) => {
    const id = item.id;
    const chosenUnit = type === 'product' ? (customUnit || getProductChosenUnit(item)) : null;
    const unitName = type === 'studyNote' ? 'مذكرة' : (chosenUnit?.name || item.baseUnit || 'قطعة');
    const factor = type === 'studyNote' ? 1 : (Number(chosenUnit?.factor) || 1);
    const price = type === 'studyNote' ? Number(item.sellPrice) : Number(chosenUnit?.price ?? item.sellPrice);
    const name = type === 'studyNote'
      ? `${item.title} (${item.teacherName})`
      : (factor > 1 ? `${item.name} - ${unitName}` : item.name);
    const cartKey = `${type}-${id}-${unitName}`;

    setCart(prev => {
      const idx = prev.findIndex(i => i.cartKey === cartKey);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        updated[idx].total = updated[idx].quantity * updated[idx].price;
        return updated;
      }
      return [
        ...prev,
        { cartKey, id, type, name, unitName, factor, quantity: 1, price, total: price }
      ];
    });
  };

  const updateStoreCartQty = (cartKey, delta) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.cartKey !== cartKey) return i;
          const nq = i.quantity + delta;
          if (nq <= 0) return null;
          return { ...i, quantity: nq, total: nq * i.price };
        })
        .filter(Boolean)
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);
  const baseDeliveryFee = state.settings?.deliveryFee ?? 25;
  const freeThreshold = state.settings?.freeDeliveryThreshold ?? 500;
  const deliveryFee = deliveryMethod === 'pickup' ? 0 : (subtotal >= freeThreshold ? 0 : baseDeliveryFee);
  const finalTotal = subtotal + deliveryFee;

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    const payload = {
      customerName: custName,
      customerPhone: custPhone,
      address: deliveryMethod === 'pickup' ? 'استلام من فرع المكتبة' : custAddress,
      deliveryMethod,
      paymentMethod,
      notes: custNotes,
      subtotal,
      deliveryFee,
      total: finalTotal,
      items: cart
    };
    onSubmitOnlineOrder(payload);
    setOrderSuccess({
      customerName: custName,
      total: finalTotal,
      deliveryMethod
    });
    setCart([]);
    setCheckoutOpen(false);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustNotes('');
  };

  // Calculate Online PDF Print Price
  const calcOnlinePrintTotal = () => {
    const sheets = pdfSides === 'double' ? Math.ceil(Number(pdfPages) / 2) : Number(pdfPages);
    const rate = pdfColor === 'color' ? (pdfSides === 'double' ? 8 : 5) : (pdfSides === 'double' ? 1.5 : 1);
    const bindPrice = pdfBinding === 'spiralSmall' ? 15 : pdfBinding === 'spiralLarge' ? 25 : 0;
    return (sheets * rate + bindPrice) * Number(pdfCopies || 1);
  };

  const handleSendOnlinePrint = (e) => {
    e.preventDefault();
    const total = calcOnlinePrintTotal();
    onSubmitOnlinePrintJob({
      customerName: `${pdfCustomerName} (أونلاين)`,
      customerPhone: pdfCustomerPhone,
      fileName: pdfFileName || 'ملف_طباعة_أونلاين.pdf',
      description: `طلب طباعة أونلاين: ${pdfFileName || 'ملف PDF'} (${pdfPages} ص × ${pdfCopies} نسخة)`,
      pagesCount: Number(pdfPages),
      copies: Number(pdfCopies),
      paperSize: 'A4',
      colorMode: pdfColor,
      sides: pdfSides,
      binding: pdfBinding,
      costEstimate: Number((total * 0.45).toFixed(2)),
      totalPrice: total,
      paidAmount: 0,
      status: 'pending',
      source: 'online'
    });
    setPdfSubmitted(true);
    setTimeout(() => setPdfSubmitted(false), 5000);
    setPdfFileName('');
    setPdfCustomerName('');
    setPdfCustomerPhone('');
  };

  const sendOrderWhatsApp = (order) => {
    const statusLabels = {
      new: 'تم استلام طلبك وجاري المراجعة 📝',
      preparing: `جاري تجهيز وتغليف طلبك في ${storeName} 📦`,
      out_for_delivery: 'طلبك خرج مع مندوب التوصيل وفي الطريق إليك 🛵',
      completed: `تم تسليم الطلب بنجاح، شكراً لثقتكم في ${storeName} ✅`
    };
    const msg = `مرحباً *${order.customerName}* 👋\nتحديث بخصوص طلبك رقم *${order.id}* من *متجر ${storeName}*:\nالحالة الحالية: *${statusLabels[order.status] || order.status}*\nإجمالي الطلب: *${order.total} ج.م*\nنسعد دائماً بخدمتكم!`;
    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopyStoreLink = () => {
    navigator.clipboard?.writeText(standaloneStoreUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const newOrdersCount = (state.onlineOrders || []).filter(o => o.status === 'new' || o.status === 'preparing').length;
  const activeMode = isStandalone ? 'storefront' : viewMode;

  return (
    <div className={`space-y-4 sm:space-y-5 ${activeMode === 'storefront' && cart.length > 0 ? 'pb-24' : ''}`}>
      {/* Standalone Customer Store Header when opened on /store or Mobile/Tablet */}
      {isStandalone ? (
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm -mx-3 sm:-mx-4 px-3 sm:px-4 py-2.5 sm:py-3 mb-1">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={logoUrl}
                alt={storeName}
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl object-contain bg-white border border-slate-200 p-1 shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-black text-base sm:text-xl text-slate-900 truncate">{storeName}</h1>
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                    المتجر الإلكتروني
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                  {state.settings?.slogan || 'لكل العيلة - أدوات مكتبية • كتب • مذكرات • هدايا وسناكس'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {state.settings?.phone && (
                <a
                  href={`tel:${state.settings.phone.split('-')[0].trim()}`}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span dir="ltr">{state.settings.phone}</span>
                </a>
              )}
              <button
                onClick={() => setCheckoutOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline">السلة</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded-lg">{totalCartItems}</span>
                <span className="hidden sm:inline">• {subtotal.toFixed(0)} ج.م</span>
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* ERP Admin Bar: Emphasizes that the Store is Separate & Mobile/Tablet Ready */
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt={storeName}
                className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm text-slate-900">بوابة ربط متجر {storeName} للموبايل والتابلت</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    متوافق 100% مع الموبايل والتابلت ومتصل لحظياً
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  عند فتح الرابط من أي موبايل أو تابلت يظهر للعميل المتجر فقط لطلب الأصناف أو رفع ملفات الطباعة
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyStoreLink}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition"
                title="نسخ رابط المتجر لمشاركته مع العملاء على الموبايل والواتساب"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'تم نسخ رابط المتجر!' : 'نسخ رابط المتجر للموبايل'}
              </button>

              <a
                href="/store"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow transition"
              >
                <ExternalLink className="w-4 h-4" />
                فتح المتجر المستقل في نافذة جديدة
              </a>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewMode('orders_admin')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition ${
                  viewMode === 'orders_admin'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                لوحة إدارة وتجهيز طلبات المتجر ({(state.onlineOrders || []).length})
                {newOrdersCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                    {newOrdersCount} طلب نشط
                  </span>
                )}
              </button>
              <button
                onClick={() => setViewMode('storefront')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition ${
                  viewMode === 'storefront'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                معاينة شكل المتجر للعميل
              </button>
            </div>

            {viewMode === 'storefront' && (
              <button
                onClick={() => setCheckoutOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2 shadow"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                سلة المشتريات ({totalCartItems}) • {subtotal.toFixed(0)} ج.م
              </button>
            )}
          </div>
        </div>
      )}

      {/* Order Success Alert */}
      {orderSuccess && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 shrink-0" />
            <div>
              <h4 className="font-black text-sm">تم إرسال طلبك بنجاح إلى مكتبة {storeName}! 🎉</h4>
              <p className="text-xs text-emerald-100">
                شكراً يا {orderSuccess.customerName}، الإجمالي {orderSuccess.total} ج.م — تم تسجيل الطلب في سيستم المكتبة وجاري التجهيز فوراً.
              </p>
            </div>
          </div>
          {!isStandalone ? (
            <button
              onClick={() => {
                setOrderSuccess(null);
                setViewMode('orders_admin');
              }}
              className="bg-white text-emerald-800 font-black text-xs px-3.5 py-2 rounded-xl"
            >
              مشاهدة الطلب في لوحة الإدارة ←
            </button>
          ) : (
            <button
              onClick={() => setOrderSuccess(null)}
              className="bg-white/20 hover:bg-white/30 text-white font-bold text-xs px-3 py-1.5 rounded-xl"
            >
              إغلاق ✕
            </button>
          )}
        </div>
      )}

      {/* VIEW MODE 1: CUSTOMER E-COMMERCE STOREFRONT (100% Mobile & Tablet Optimized) */}
      {activeMode === 'storefront' && (
        <div className="space-y-4">
          {/* Storefront Hero Banner */}
          <div className="bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="max-w-2xl space-y-2.5 w-full">
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5" />
                  متجر {storeName} • اطلب من موبايلك أو التابلت بسهولة
                </span>
                <h2 className="text-lg sm:text-2xl md:text-3xl font-black leading-snug">
                  كل احتياجاتك من الأدوات المكتبية، الكتب، الهدايا، السناكس، والمذكرات أو طباعة ملفات PDF أونلاين!
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-300">
                  توصيل سريع للمنزل أو استلام فوري من المكتبة • توصيل مجاني للطلبات فوق {freeThreshold} ج.م
                </p>

                {/* Mobile & Tablet Friendly 3-Tab Switcher */}
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 pt-2">
                  <button
                    onClick={() => setStoreTab('products')}
                    className={`px-2 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-black text-center transition ${
                      storeTab === 'products'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    🛍️ الأصناف ({onlineProducts.length})
                  </button>
                  <button
                    onClick={() => setStoreTab('notes')}
                    className={`px-2 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-black text-center transition ${
                      storeTab === 'notes'
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    📘 المذكرات ({onlineNotes.length})
                  </button>
                  <button
                    onClick={() => setStoreTab('online_print')}
                    className={`px-2 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-black text-center transition ${
                      storeTab === 'online_print'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    🖨️ طباعة PDF
                  </button>
                </div>
              </div>

              <div className="hidden lg:flex items-center justify-center bg-white p-3 rounded-3xl shadow-2xl border-4 border-white/20 shrink-0">
                <img src={logoUrl} alt={storeName} className="w-28 h-28 object-contain" />
              </div>
            </div>
          </div>

          {/* Store Tab 1: Products */}
          {storeTab === 'products' && (
            <div className="space-y-3.5">
              {/* Mobile/Tablet Search + Swipeable Categories */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`ابحث عن أي منتج في متجر ${storeName}...`}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-sm sm:text-xs font-bold outline-none"
                  />
                </div>

                {state.categories?.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedCat('ALL')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition ${
                        selectedCat === 'ALL' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      الكل ({onlineProducts.length})
                    </button>
                    {state.categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCat(c.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                          selectedCat === c.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2 shadow-sm">
                  <Package className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <h4 className="font-black text-sm text-slate-800">لا توجد منتجات معروضة حالياً في هذا القسم</h4>
                  <p className="text-xs text-slate-500">
                    بمجرد إضافة الأصناف من شاشة الكاشير أو المخزن في {storeName} ستظهر هنا للعملاء تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {filteredProducts.map(prod => {
                    const units = prod.units?.length > 0
                      ? prod.units
                      : [{ name: prod.baseUnit || 'قطعة', factor: 1, price: prod.sellPrice }];
                    const chosenUnit = getProductChosenUnit(prod);
                    const cartKey = `product-${prod.id}-${chosenUnit.name}`;
                    const itemInCart = cart.find(i => i.cartKey === cartKey);

                    return (
                      <div
                        key={prod.id}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between p-2.5 sm:p-3"
                      >
                        <div>
                          <div className="h-32 sm:h-36 rounded-xl overflow-hidden bg-slate-100 mb-2.5 relative">
                            <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                            {prod.featured && (
                              <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                                الأكثر طلباً ⭐
                              </span>
                            )}
                            <span
                              className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                prod.stock > 0 ? 'bg-slate-900/75 text-white' : 'bg-rose-600 text-white'
                              }`}
                            >
                              {prod.stock > 0 ? 'متوفر ✓' : 'نفد حالياً'}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-2 min-h-[32px]">{prod.name}</h4>

                          {/* Unit Selector if Product has both Piece & Carton/Box */}
                          {units.length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {units.map((u, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedUnitByProduct(prev => ({ ...prev, [prod.id]: u.name }))}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                                    chosenUnit.name === u.name
                                      ? 'bg-blue-50 border-blue-500 text-blue-800'
                                      : 'bg-slate-50 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {u.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                          <div>
                            <span className="text-sm sm:text-base font-black text-emerald-700">
                              {chosenUnit.price} ج.م
                            </span>
                            <span className="text-[10px] text-slate-400 block">{chosenUnit.name}</span>
                          </div>

                          {itemInCart ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-1.5 py-1">
                              <button
                                type="button"
                                onClick={() => updateStoreCartQty(cartKey, -1)}
                                className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center shadow-sm active:scale-95"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-black text-xs text-emerald-800 px-1">{itemInCart.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateStoreCartQty(cartKey, 1)}
                                className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToStoreCart(prod, 'product', chosenUnit)}
                              disabled={prod.stock <= 0}
                              className="bg-slate-900 hover:bg-emerald-600 active:scale-95 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              أضف
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Store Tab 2: Study Notes Online */}
          {storeTab === 'notes' && (
            onlineNotes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2 shadow-sm">
                <BookOpen className="w-12 h-12 text-purple-300 mx-auto stroke-1" />
                <h4 className="font-black text-sm text-slate-800">لا توجد مذكرات معروضة حالياً</h4>
                <p className="text-xs text-slate-500">ستظهر المذكرات الدراسية هنا فور إضافتها من قسم التصوير والمذكرات.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {onlineNotes.map(note => (
                  <div
                    key={note.id}
                    className="bg-white rounded-2xl border-2 border-purple-100 p-4 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <span className="bg-purple-100 text-purple-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                        {note.grade} • {note.subject}
                      </span>
                      <h4 className="font-black text-base text-slate-900 mt-2">{note.title}</h4>
                      <p className="text-xs font-bold text-purple-700 mt-1">{note.teacherName}</p>
                      <p className="text-xs text-slate-500 mt-1">{note.pagesCount} صفحة • {note.printType}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-lg font-black text-purple-800">{note.sellPrice} ج.م</span>
                      <button
                        type="button"
                        onClick={() => addToStoreCart(note, 'studyNote')}
                        className="bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" />
                        اطلب المذكرة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Store Tab 3: Upload PDF to Print Online */}
          {storeTab === 'online_print' && (
            <form
              onSubmit={handleSendOnlinePrint}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 max-w-2xl mx-auto shadow-sm space-y-4 text-xs"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900">
                    ارفع ملفك (PDF) من الموبايل أو التابلت واطبعه في {storeName}
                  </h3>
                  <p className="text-slate-500 text-[11px] sm:text-xs">
                    ارفع المحاضرات أو الشيتات واحسب تكلفتها فوراً واستلمها جاهزة بدون انتظار!
                  </p>
                </div>
              </div>

              {pdfSubmitted && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl font-bold">
                  ✅ تم إرسال ملف الطباعة إلى قسم التصوير في {storeName} بنجاح! سيتم تجهيزه فوراً.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">اسمك بالكامل</label>
                  <input
                    type="text"
                    required
                    value={pdfCustomerName}
                    onChange={e => setPdfCustomerName(e.target.value)}
                    placeholder="الاسم الثلاثي"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">رقم الموبايل / واتساب</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={pdfCustomerPhone}
                    onChange={e => setPdfCustomerPhone(e.target.value)}
                    placeholder="010..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">اختر ملف الـ PDF من جهازك</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setPdfFileName(f.name);
                    }}
                    className="w-full rounded-xl border border-dashed border-slate-300 p-2.5 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">عدد صفحات الملف</label>
                  <input
                    type="number"
                    min="1"
                    value={pdfPages}
                    onChange={e => setPdfPages(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">عدد النسخ</label>
                  <input
                    type="number"
                    min="1"
                    value={pdfCopies}
                    onChange={e => setPdfCopies(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">نوع الطباعة</label>
                  <select
                    value={pdfColor}
                    onChange={e => setPdfColor(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold bg-white text-sm sm:text-xs"
                  >
                    <option value="bw">أبيض وأسود</option>
                    <option value="color">ألوان</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">التغليف</label>
                  <select
                    value={pdfBinding}
                    onChange={e => setPdfBinding(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold bg-white text-sm sm:text-xs"
                  >
                    <option value="spiralSmall">تغليف سلك + غلاف (+15 ج)</option>
                    <option value="spiralLarge">تغليف سلك كبير (+25 ج)</option>
                    <option value="none">بدون تغليف (تدبيس)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
                <span>التكلفة الإجمالية المحسوبة:</span>
                <span className="text-xl font-black text-emerald-400">{calcOnlinePrintTotal().toFixed(2)} ج.م</span>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-black py-3.5 rounded-xl shadow flex items-center justify-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" />
                إرسال أمر الطباعة الآن للمكتبة
              </button>
            </form>
          )}
        </div>
      )}

      {/* Sticky Bottom Cart Bar on Mobile & Tablet when items are in Cart */}
      {activeMode === 'storefront' && cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">
                سلة مشترياتك ({totalCartItems} صنف)
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-700">
                الإجمالي: {subtotal.toFixed(0)} ج.م
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              عرض السلة وإتمام الطلب ←
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: ONLINE ORDERS ADMIN DASHBOARD (Inside ERP Only) */}
      {activeMode === 'orders_admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-sm">لوحة إدارة وتجهيز طلبات متجر {storeName} الإلكتروني</h3>
              <p className="text-xs text-slate-400">عند تحويل حالة الطلب إلى "مكتمل" يتم خصم الأصناف من المخزن وإصدار فاتورة كاشير تلقائياً</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
              إجمالي الطلبات: {(state.onlineOrders || []).length}
            </span>
          </div>

          {(state.onlineOrders || []).length === 0 ? (
            <div className="p-12 text-center space-y-2 text-slate-400">
              <Truck className="w-12 h-12 mx-auto stroke-1 text-slate-300" />
              <p className="font-black text-sm text-slate-600">لا توجد طلبات أونلاين حالياً</p>
              <p className="text-xs">انسخ رابط المتجر وشاركه مع عملائك، وأي طلب من الموبايل أو التابلت سيظهر هنا فوراً.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(state.onlineOrders || []).map(order => (
                <div key={order.id} className="p-5 hover:bg-slate-50 transition space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-slate-900">{order.id}</span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            order.status === 'new'
                              ? 'bg-rose-100 text-rose-700'
                              : order.status === 'preparing'
                              ? 'bg-amber-100 text-amber-800'
                              : order.status === 'out_for_delivery'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {order.status === 'new'
                            ? 'طلب جديد 🔔'
                            : order.status === 'preparing'
                            ? 'جاري التجهيز 📦'
                            : order.status === 'out_for_delivery'
                            ? 'خرج للتوصيل 🛵'
                            : 'مكتمل وتم التسليم ✅'}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                      <h4 className="font-black text-sm text-slate-900 mt-1">
                        {order.customerName} — <span className="text-emerald-700" dir="ltr">{order.customerPhone}</span>
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {order.address} ({order.deliveryMethod === 'pickup' ? 'استلام من الفرع' : 'توصيل للمنزل'})
                      </p>
                      {order.notes && <p className="text-xs text-amber-700 font-bold mt-1">ملاحظة: {order.notes}</p>}
                    </div>

                    <div className="text-left">
                      <div className="text-lg font-black text-emerald-700">{order.total} ج.م</div>
                      <div className="text-[11px] text-slate-500">شامل توصيل: {order.deliveryFee} ج</div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap gap-2">
                    {order.items?.map((item, i) => (
                      <span key={i} className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800">
                        {item.name} × {item.quantity} ({item.total} ج)
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => sendOrderWhatsApp(order)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      إرسال تحديث واتساب للعميل
                    </button>
                    {order.status === 'new' && (
                      <button
                        onClick={() => onUpdateOnlineOrder(order.id, { status: 'preparing' })}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                      >
                        بدء التجهيز 📦
                      </button>
                    )}
                    {(order.status === 'new' || order.status === 'preparing') && (
                      <button
                        onClick={() => onUpdateOnlineOrder(order.id, { status: 'out_for_delivery' })}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                      >
                        إرسال مع المندوب 🛵
                      </button>
                    )}
                    {order.status !== 'completed' && (
                      <button
                        onClick={() => onUpdateOnlineOrder(order.id, { status: 'completed' })}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        تأكيد التسليم وخصم المخزون وإصدار فاتورة
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Storefront Cart & Checkout Modal (Bottom Sheet on Mobile, Centered on Tablet/Desktop) */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handlePlaceOrder}
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                سلة مشتريات متجر {storeName}
              </h3>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl"
              >
                إغلاق ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-slate-400 py-8 font-bold">سلة المشتريات فارغة</p>
            ) : (
              <>
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {cart.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-800 flex-1">{item.name}</div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateStoreCartQty(item.cartKey, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-black px-1.5 text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateStoreCartQty(item.cartKey, 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="font-black text-emerald-700 w-16 text-left">{item.total} ج</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block font-bold mb-1">الاسم بالكامل</label>
                    <input
                      type="text"
                      required
                      value={custName}
                      onChange={e => setCustName(e.target.value)}
                      placeholder="اكتب اسمك"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">رقم الموبايل / واتساب</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      value={custPhone}
                      onChange={e => setCustPhone(e.target.value)}
                      placeholder="010..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">طريقة الاستلام</label>
                    <select
                      value={deliveryMethod}
                      onChange={e => setDeliveryMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold bg-white text-sm sm:text-xs"
                    >
                      <option value="delivery">توصيل للمنزل (+{baseDeliveryFee} ج)</option>
                      <option value="pickup">استلام من فرع المكتبة (مجاناً)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">طريقة الدفع</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold bg-white text-sm sm:text-xs"
                    >
                      <option value="cash">الدفع عند الاستلام</option>
                      <option value="vodafone_cash">فودافون كاش</option>
                      <option value="instapay">إنستا باي (InstaPay)</option>
                    </select>
                  </div>
                  {deliveryMethod === 'delivery' && (
                    <div className="sm:col-span-2">
                      <label className="block font-bold mb-1">العنوان بالتفصيل</label>
                      <input
                        type="text"
                        required
                        value={custAddress}
                        onChange={e => setCustAddress(e.target.value)}
                        placeholder="الشارع - رقم العقار - الدور - علامة مميزة"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold text-sm sm:text-xs"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block font-bold mb-1">ملاحظات إضافية (اختياري)</label>
                    <input
                      type="text"
                      value={custNotes}
                      onChange={e => setCustNotes(e.target.value)}
                      placeholder="أي تفاصيل إضافية للطلب..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-sm sm:text-xs"
                    />
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>المشتريات: {subtotal} ج.م</span>
                    <span>التوصيل: {deliveryFee} ج.م</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-emerald-400 pt-1 border-t border-slate-700">
                    <span>الإجمالي المطلوب:</span>
                    <span>{finalTotal} ج.م</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-3.5 rounded-xl shadow text-sm"
                >
                  تأكيد وإرسال الطلب لمكتبة {storeName} الآن
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
