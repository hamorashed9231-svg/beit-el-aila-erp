import {
  BarChart3, TrendingUp, Wallet, Receipt, ShieldCheck, Cloud,
  RefreshCw, Download, Upload, Plus, CheckCircle2, Lock, Printer, MessageSquare, Send,
  Calendar, CalendarDays, RotateCcw, Clock, Filter
} from 'lucide-react';

export default function ReportsAndAdminView({
  state,
  currentUser,
  onSwitchUser,
  onAddExpense,
  onTriggerCloudSync,
  onRestoreBackup,
  onResetAllData,
  onSaveSettings,
  onSaveUser
}) {
  const [activeTab, setActiveTab] = useState('profits'); // profits | expenses | users | cloud_sync
  const [editingUser, setEditingUser] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPin, setEditUserPin] = useState('');
  const [editUserShift, setEditUserShift] = useState('');

  // New Expense State
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('مستلزمات طباعة وأحبار');
  const [expAmount, setExpAmount] = useState('');

  // Store Settings State
  const [storeName, setStoreName] = useState(state.settings?.storeName || 'بيت العيلة');
  const [storePhone, setStorePhone] = useState(state.settings?.phone || '');
  const [storeAddress, setStoreAddress] = useState(state.settings?.address || '');
  const [bwRate, setBwRate] = useState(state.settings?.printPrices?.bwSingleA4 || 1.0);
  const [colorRate, setColorRate] = useState(state.settings?.printPrices?.colorSingleA4 || 5.0);

  // Date Helpers for Daily Reset & Filtering Any Day
  const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getTodayStr = () => getLocalDateStr(new Date());

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateStr(d);
  };

  // Date Filter: 'today' (default - auto-resets each day!) | 'yesterday' | 'custom' | 'this_week' | 'this_month' | 'all'
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedCustomDate, setSelectedCustomDate] = useState(() => getTodayStr());

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();

  // Active Sales filtered by selected date
  const filteredSales = (state.sales || []).filter(sale => {
    if (sale.status === 'returned') return false;
    const saleDate = getLocalDateStr(sale.createdAt);

    if (dateFilter === 'today') {
      return saleDate === todayStr;
    }
    if (dateFilter === 'yesterday') {
      return saleDate === yesterdayStr;
    }
    if (dateFilter === 'custom') {
      return saleDate === selectedCustomDate;
    }
    if (dateFilter === 'this_week') {
      const saleTime = new Date(sale.createdAt).getTime();
      return saleTime >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }
    if (dateFilter === 'this_month') {
      const d = new Date(sale.createdAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateFilter === 'all') {
      return true;
    }
    return saleDate === todayStr;
  });

  // Expenses filtered by selected date
  const filteredExpenses = (state.expenses || []).filter(exp => {
    const expDate = getLocalDateStr(exp.createdAt);

    if (dateFilter === 'today') {
      return expDate === todayStr;
    }
    if (dateFilter === 'yesterday') {
      return expDate === yesterdayStr;
    }
    if (dateFilter === 'custom') {
      return expDate === selectedCustomDate;
    }
    if (dateFilter === 'this_week') {
      const expTime = new Date(exp.createdAt).getTime();
      return expTime >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }
    if (dateFilter === 'this_month') {
      const d = new Date(exp.createdAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateFilter === 'all') {
      return true;
    }
    return expDate === todayStr;
  });

  // Financial Calculations for the Selected Date / Period
  const totalRevenue = filteredSales.reduce((s, sale) => s + Number(sale.total || 0), 0);
  const totalCostOfGoods = filteredSales.reduce((s, sale) => s + Number(sale.totalCost || 0), 0);
  const grossProfit = totalRevenue - totalCostOfGoods;

  // Distinguish between actual operational business expenses and manager cash withdrawals
  const operationalExpensesList = filteredExpenses.filter(
    exp => exp.category !== 'تحصيل وتوريد نقدية للمدير العام'
  );
  const totalOperationalExpenses = operationalExpensesList.reduce((s, exp) => s + Number(exp.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, exp) => s + Number(exp.amount || 0), 0);
  const netProfitAfterExpenses = grossProfit - totalOperationalExpenses;

  // Cash Drawer / Payment Method Breakdown for Selected Date
  const cashCollected = filteredSales
    .filter(s => s.paymentMethod === 'cash')
    .reduce((s, sale) => s + Number(sale.paidAmount || 0), 0);
  const vodafoneCollected = filteredSales
    .filter(s => s.paymentMethod === 'vodafone_cash')
    .reduce((s, sale) => s + Number(sale.paidAmount || 0), 0);
  const instapayCollected = filteredSales
    .filter(s => s.paymentMethod === 'instapay')
    .reduce((s, sale) => s + Number(sale.paidAmount || 0), 0);
  const creditDeferred = filteredSales.reduce((s, sale) => s + Number(sale.remainingAmount || 0), 0);

  // Opening float is relevant to the active current shift/today
  const openingShiftCash = (dateFilter === 'today' || dateFilter === 'all')
    ? Number(state.settings?.drawerOpeningCash ?? state.shifts?.[0]?.openingCash ?? 0)
    : 0;
  const netCashInDrawer = openingShiftCash + cashCollected - totalExpenses;

  const getDateLabel = () => {
    if (dateFilter === 'today') {
      return `اليوم (${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`;
    }
    if (dateFilter === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `أمس (${y.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`;
    }
    if (dateFilter === 'custom') {
      const parts = selectedCustomDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return `يوم (${d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`;
      }
      return `تاريخ (${selectedCustomDate})`;
    }
    if (dateFilter === 'this_week') return 'آخر 7 أيام';
    if (dateFilter === 'this_month') return 'الشهر الحالي';
    if (dateFilter === 'all') return 'جميع الفترات (إجمالي تراكمي)';
    return 'اليوم';
  };

  const handleSendReportWhatsApp = () => {
    const divider = '══════════════════════════';
    const subDivider = '──────────────────────────';
    const reportText = [
      `📊 *تقرير أرباح ومبيعات الوردية (Shift Z-Report)*`,
      `🏢 *مكتبة ${storeName}*`,
      `📅 *فترة التقرير:* ${getDateLabel()}`,
      divider,
      `*وقت استخراج التقرير:* ${new Date().toLocaleString('ar-EG')}`,
      `*المستخدم الحالي:* ${currentUser?.name || 'المدير العام'}`,
      divider,
      `*💰 جرد نقدية الدرج:*`,
      openingShiftCash > 0 ? `• عهدة بداية الدرج (فكة): ${openingShiftCash.toFixed(2)} ج.م` : null,
      `• مبيعات نقدية (كاش): +${cashCollected.toFixed(2)} ج.م`,
      `• مسحوبات ومصروفات: -${totalExpenses.toFixed(2)} ج.م`,
      subDivider,
      `*💵 صافي الكاش بالدرج للفترة:* ${netCashInDrawer.toFixed(2)} ج.م`,
      divider,
      `*📈 ملخص المبيعات والإيرادات:*`,
      `• إجمالي الفواتير: ${filteredSales.length} فاتورة`,
      `• إجمالي الإيرادات: ${totalRevenue.toFixed(2)} ج.م`,
      `• تكلفة البضاعة المباعة: ${totalCostOfGoods.toFixed(2)} ج.م`,
      `• مجمل الربح: +${grossProfit.toFixed(2)} ج.م`,
      `• صافي الربح الحقيقي: ${netProfitAfterExpenses.toFixed(2)} ج.م`,
      subDivider,
      `• محفظة فودافون كاش: ${vodafoneCollected.toFixed(2)} ج.م`,
      `• تحويلات إنستا باي: ${instapayCollected.toFixed(2)} ج.م`,
      `• آجل ومتبقي على العملاء: ${creditDeferred.toFixed(2)} ج.م`,
      divider,
      `مشغل بنظام ريفيكس سيستم • Powered by RIVIX System`,
      `✅ تقرير موجه إلى المدير العام Ahmed kharbosh (+20 12 03544606)`
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/201203544606?text=${encodeURIComponent(reportText)}`, '_blank');
  };

  const handleAddExpSubmit = (e) => {
    e.preventDefault();
    if (!expTitle || !expAmount) return;
    onAddExpense({
      title: expTitle,
      category: expCategory,
      amount: Number(expAmount),
      paidBy: currentUser?.name || 'المدير'
    });
    setExpTitle('');
    setExpAmount('');
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_بيت_العيلة_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        onRestoreBackup(parsed);
      } catch (err) {
        alert('ملف النسخة الاحتياطية غير صالح');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveStoreSettings = (e) => {
    e.preventDefault();
    onSaveSettings({
      storeName,
      phone: storePhone,
      address: storeAddress,
      printPrices: {
        ...(state.settings?.printPrices || {}),
        bwSingleA4: Number(bwRate),
        colorSingleA4: Number(colorRate)
      }
    });
    alert('تم حفظ إعدادات مكتبة بيت العيلة وأسعار الطباعة بنجاح!');
  };

  const pendingSyncCount = (state.syncQueue || []).filter(q => q.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 inline-flex flex-wrap gap-2 shadow-sm">
        <button
          onClick={() => setActiveTab('profits')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'profits' ? 'bg-slate-900 text-white shadow' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          تقارير الأرباح وتقفيل الوردية (Z-Report)
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'expenses' ? 'bg-rose-600 text-white shadow' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          المصروفات اليومية ({state.expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'users' ? 'bg-purple-700 text-white shadow' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          صلاحيات الموظفين وإعدادات المكتبة
        </button>
        <button
          onClick={() => setActiveTab('cloud_sync')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'cloud_sync' ? 'bg-emerald-600 text-white shadow' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Cloud className="w-4 h-4" />
          المزامنة السحابية والنسخ الاحتياطي (Offline + Cloud)
          {pendingSyncCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {pendingSyncCount} بالانتظار
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PROFITS & SHIFT Z-REPORT */}
      {activeTab === 'profits' && (
        <div className="space-y-5">
          {/* Date Selector & Daily Reset Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 ml-1">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                <span>فترة التقرير:</span>
              </div>

              {/* Quick Filter Buttons */}
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold flex-wrap">
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    dateFilter === 'today'
                      ? 'bg-emerald-600 text-white shadow font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="يتصفر تلقائياً كل يوم جديد في تمام 00:00"
                >
                  اليوم (تلقائي)
                </button>

                <button
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    dateFilter === 'yesterday'
                      ? 'bg-emerald-600 text-white shadow font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  أمس
                </button>

                <button
                  onClick={() => setDateFilter('this_week')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    dateFilter === 'this_week'
                      ? 'bg-emerald-600 text-white shadow font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  آخر 7 أيام
                </button>

                <button
                  onClick={() => setDateFilter('this_month')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    dateFilter === 'this_month'
                      ? 'bg-emerald-600 text-white shadow font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  هذا الشهر
                </button>

                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    dateFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  كل الفترات (إجمالي)
                </button>
              </div>
            </div>

            {/* Custom Date Picker: Inspect Any Specific Day */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
                <label className="font-bold text-slate-600 text-[11px] whitespace-nowrap">اختيار يوم محدد:</label>
                <input
                  type="date"
                  value={selectedCustomDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedCustomDate(e.target.value);
                      setDateFilter('custom');
                    }
                  }}
                  className="bg-transparent font-bold text-slate-800 outline-none text-xs cursor-pointer"
                />
              </div>

              {dateFilter !== 'today' && (
                <button
                  onClick={() => {
                    setDateFilter('today');
                    setSelectedCustomDate(getTodayStr());
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition"
                  title="العودة لأرباح اليوم الحالي"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>اليوم الحالي</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Banner with Auto-Reset Badge */}
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>أنت تستعرض الآن: <strong className="text-emerald-950 font-black">{getDateLabel()}</strong></span>
              {dateFilter === 'today' ? (
                <span className="bg-emerald-200/90 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                  ⚡ يتصفر تلقائياً كل يوم جديد ويبدأ من الصفر (0 ج.م)
                </span>
              ) : (
                <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  استعراض أرشيف الأرباح ليوم محدد
                </span>
              )}
            </div>
            <div className="text-[11px] font-bold text-emerald-800">
              {filteredSales.length} فاتورة منفذة • {filteredExpenses.length} بنود مصروفات
            </div>
          </div>

          {/* Financial KPIs for Selected Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">إجمالي المبيعات والإيرادات</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalRevenue.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">من {filteredSales.length} فاتورة فعلية</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">مجمل الربح (قبل المصروفات)</span>
              <h3 className="text-2xl font-black text-blue-700 mt-1">+{grossProfit.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-slate-400 mt-1">تكلفة البضاعة المباعة: {totalCostOfGoods.toLocaleString()} ج</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">إجمالي المصروفات التشغيلية</span>
              <h3 className="text-2xl font-black text-rose-600 mt-1">- {totalOperationalExpenses.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-slate-400 mt-1">أحبار، ورق، كهرباء، ومستلزمات (دون سحوبات الدرج)</p>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-bold text-emerald-400">صافي الربح النهائي الحقيقي</span>
              <h3 className="text-2xl font-black text-white mt-1">{netProfitAfterExpenses.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-slate-300 mt-1">بعد خصم التكلفة وعمولات المدرسين والمصروفات</p>
            </div>
          </div>

          {/* Shift Z-Report & Drawer Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  تقرير تقفيل الوردية والدرج النقدي (Shift Z-Report)
                </h3>
                <p className="text-xs text-slate-500">
                  تفصيل المبالغ المحصلة حسب طريقة الدفع والنقدية المتوقعة في درج الكاشير لـ {getDateLabel()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendReportWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  title="إرسال تقرير المبيعات والدرج إلى واتساب المدير (+20 12 03544606)"
                >
                  <Send className="w-4 h-4" />
                  إرسال لواتساب المدير (+20 12 03544606)
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  طباعة تقرير الوردية
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-bold">عهدة بداية الدرج</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">{openingShiftCash} ج.م</span>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 block font-bold">مبيعات نقدية (كاش)</span>
                <span className="text-lg font-black text-emerald-700 mt-1 block">+{cashCollected} ج.م</span>
              </div>
              <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200">
                <span className="text-rose-800 block font-bold">محفظة فودافون كاش</span>
                <span className="text-lg font-black text-rose-700 mt-1 block">{vodafoneCollected} ج.م</span>
              </div>
              <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200">
                <span className="text-purple-800 block font-bold">تحويلات إنستا باي</span>
                <span className="text-lg font-black text-purple-700 mt-1 block">{instapayCollected} ج.م</span>
              </div>
              <div className="bg-slate-900 text-white p-3.5 rounded-xl">
                <span className="text-emerald-400 block font-bold">صافي الكاش الفعلي بالدرج</span>
                <span className="text-lg font-black text-white mt-1 block">{netCashInDrawer.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          {/* Invoices Breakdown Table for the Selected Day */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                فواتير ومبيعات {getDateLabel()} ({filteredSales.length} فاتورة)
              </h4>
              <span className="text-xs font-bold text-slate-500">
                إجمالي إيراد الفترة: <strong className="text-slate-800">{totalRevenue.toFixed(2)} ج.م</strong> • صافي الربح: <strong className="text-emerald-600">+{netProfitAfterExpenses.toFixed(2)} ج.م</strong>
              </span>
            </div>

            {filteredSales.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <span>لا توجد مبيعات أو فواتير مسجلة في هذا اليوم حتى الآن (العداد مصفّر 0.00 ج.م).</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="p-2.5">رقم الفاتورة</th>
                      <th className="p-2.5">الوقت</th>
                      <th className="p-2.5">العميل</th>
                      <th className="p-2.5">طريقة الدفع</th>
                      <th className="p-2.5">الإجمالي</th>
                      <th className="p-2.5">الربح المحقق</th>
                      <th className="p-2.5">الكاشير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.map((sale) => {
                      const saleProfit = (Number(sale.total) || 0) - (Number(sale.totalCost) || 0);
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-mono font-bold text-slate-800">#{sale.id}</td>
                          <td className="p-2.5 text-slate-500 font-mono">
                            {new Date(sale.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">{sale.customerName || 'عميل نقدي'}</td>
                          <td className="p-2.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
                              {sale.paymentMethod === 'cash'
                                ? 'نقدي (كاش)'
                                : sale.paymentMethod === 'vodafone_cash'
                                ? 'فودافون كاش'
                                : sale.paymentMethod === 'instapay'
                                ? 'إنستا باي'
                                : 'آجل'}
                            </span>
                          </td>
                          <td className="p-2.5 font-black text-slate-900">{Number(sale.total).toFixed(2)} ج.م</td>
                          <td className="p-2.5 font-black text-emerald-600">+{saleProfit.toFixed(2)} ج.م</td>
                          <td className="p-2.5 text-slate-500">{sale.cashierName || 'الكاشير'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleAddExpSubmit}
            className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs h-fit"
          >
            <h3 className="font-black text-base text-slate-900">تسجيل مصروف يومي جديد</h3>
            <div>
              <label className="block font-bold mb-1">بيان المصروف</label>
              <input
                type="text"
                required
                value={expTitle}
                onChange={e => setExpTitle(e.target.value)}
                placeholder="مثال: شراء حبر ماكينة ريكو / أكياس شنط / كهرباء"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">بند المصروف</label>
              <select
                value={expCategory}
                onChange={e => setExpCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
              >
                <option value="مستلزمات طباعة وأحبار">مستلزمات طباعة وأحبار</option>
                <option value="مرافق وفواتير (كهرباء/إنترنت)">مرافق وفواتير (كهرباء/إنترنت)</option>
                <option value="رواتب ويوميات">رواتب ويوميات</option>
                <option value="تغليف وشنط ومطبوعات">تغليف وشنط ومطبوعات</option>
                <option value="نثريات وصيانة">نثريات وصيانة</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">المبلغ المنصرف (ج.م)</label>
              <input
                type="number"
                required
                min="1"
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-black text-rose-600 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              تسجيل المصروف وخصمه من الدرج
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-black text-sm text-slate-900">سجل المصروفات اليومية والشهرية</h4>
              <span className="font-black text-sm text-rose-600">الإجمالي: {totalExpenses} ج.م</span>
            </div>
            <div className="divide-y divide-slate-100">
              {state.expenses.map(exp => (
                <div key={exp.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div>
                    <div className="font-black text-slate-900 text-sm">{exp.title}</div>
                    <div className="text-slate-500 mt-0.5">
                      {exp.category} • بواسطة: {exp.paidBy} • {new Date(exp.createdAt).toLocaleString('ar-EG')}
                    </div>
                  </div>
                  <span className="bg-rose-100 text-rose-700 font-black px-3 py-1.5 rounded-xl text-sm">
                    - {exp.amount} ج.م
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USERS / ROLES & STORE SETTINGS */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  ورديات الكاشير والموظفين (شيفت 1 وشيفت 2)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحديد اسم الكاشير وباسورد كل شيفت بواسطة صاحب المكتبة
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {state.users.map(u => {
                const isCurrent = currentUser?.id === u.id;
                const isEditing = editingUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-2xl border transition ${
                      isCurrent ? 'bg-purple-50/60 border-purple-400' : 'bg-white border-slate-200'
                    }`}
                  >
                    {isEditing ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!editUserName.trim() || !editUserPin.trim()) return;
                          if (onSaveUser) {
                            await onSaveUser({
                              ...u,
                              name: editUserName.trim(),
                              pin: editUserPin.trim(),
                              shiftName: editUserShift.trim()
                            });
                          }
                          setEditingUser(null);
                        }}
                        className="space-y-3 text-xs"
                      >
                        <div className="font-bold text-slate-800">
                          تعديل بيانات {u.role === 'admin' ? 'حساب المدير العام' : (u.shiftName || 'الكاشير')}:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block font-bold text-slate-600 mb-1">اسم الموظف / الكاشير:</label>
                            <input
                              type="text"
                              required
                              value={editUserName}
                              onChange={e => setEditUserName(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 font-bold"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-600 mb-1">كلمة المرور / الباسورد (PIN):</label>
                            <input
                              type="text"
                              required
                              value={editUserPin}
                              onChange={e => setEditUserPin(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 font-mono font-black text-center"
                            />
                          </div>
                        </div>
                        {u.role !== 'admin' && (
                          <div>
                            <label className="block font-bold text-slate-600 mb-1">اسم الوردية (الشيفت):</label>
                            <input
                              type="text"
                              value={editUserShift}
                              onChange={e => setEditUserShift(e.target.value)}
                              placeholder="مثال: الوردية الصباحية / الوردية المسائية"
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 font-bold"
                            />
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs"
                          >
                            حفظ التعديلات
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                            className="bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs"
                          >
                            إلغاء
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">{u.name}</span>
                            {u.shiftName && (
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {u.shiftName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                            <span>
                              الدور: <strong>{u.role === 'admin' ? 'مدير عام' : 'كاشير وردية'}</strong>
                            </span>
                            <span>
                              الباسورد: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-black text-slate-800">{u.pin}</code>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setEditUserName(u.name);
                              setEditUserPin(u.pin);
                              setEditUserShift(u.shiftName || '');
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition"
                          >
                            تعديل الباسورد والاسم
                          </button>
                          <button
                            onClick={() => onSwitchUser(u)}
                            disabled={isCurrent}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              isCurrent
                                ? 'bg-emerald-600 text-white cursor-default'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {isCurrent ? 'النشط ✓' : 'تبديل'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleSaveStoreSettings}
            className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs"
          >
            <h3 className="font-black text-base text-slate-900">إعدادات بيانات المكتبة والفاتورة الحرارية</h3>
            <div>
              <label className="block font-bold mb-1">اسم المكتبة على الفواتير والمتجر</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">أرقام التليفون والواتساب</label>
              <input
                type="text"
                value={storePhone}
                onChange={e => setStorePhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">عنوان المكتبة</label>
              <input
                type="text"
                value={storeAddress}
                onChange={e => setStoreAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-bold mb-1">سعر تصوير ورقة A4 أبيض وأسود (ج)</label>
                <input
                  type="number"
                  step="0.25"
                  value={bwRate}
                  onChange={e => setBwRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">سعر طباعة ورقة A4 ألوان (ج)</label>
                <input
                  type="number"
                  step="0.25"
                  value={colorRate}
                  onChange={e => setColorRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow mt-2"
            >
              حفظ الإعدادات
            </button>
          </form>

          {/* Official Rivix System Ownership & Copyright Card */}
          <div className="lg:col-span-12 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white p-6 rounded-3xl border border-cyan-500/30 shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-right">
                <img
                  src="/rivix-logo.png"
                  alt="Rivix System"
                  className="w-16 h-16 rounded-2xl object-contain bg-white p-1 border-2 border-cyan-400 shadow-lg shadow-cyan-500/20"
                />
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-black text-xl text-white tracking-wide">RIVIX SYSTEM</h3>
                    <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-black px-3 py-0.5 rounded-full">
                      نظام معتمد ومرخص رسميًا
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-bold mt-1">
                    المالك والمطور: شركة ريفيكس سيستم • Rivix Operations Platform
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    جميع الحقوق محفوظة لشركة ريفيكس سيستم © {new Date().getFullYear()} Rivix System. All Rights Reserved.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto text-center text-xs">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="text-[10px] text-slate-400">حالة التفعيل</div>
                  <div className="font-black text-emerald-400 text-sm mt-0.5">أصلي ومفعل ✓</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="text-[10px] text-slate-400">الترخيص التجاري</div>
                  <div className="font-black text-cyan-300 text-sm mt-0.5">{storeName}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400">الدعم والتحديثات</div>
                  <div className="font-black text-blue-300 text-sm mt-0.5">ريفيكس سيستم</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OFFLINE + CLOUD SYNC & BACKUP ENGINE */}
      {activeTab === 'cloud_sync' && (
        <div className="space-y-5">
          <div className="bg-gradient-to-l from-slate-900 to-emerald-950 text-white p-6 rounded-3xl shadow-lg flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
                <Cloud className="w-4 h-4" />
                نظام هجين: أوفلاين على جهاز الكاشير + مزامنة سحابية تلقائية
              </div>
              <h3 className="text-xl font-black">محرك المزامنة والنسخ الاحتياطي (Offline-First + Cloud Sync)</h3>
              <p className="text-xs text-slate-300">
                آخر مزامنة ناجحة: {new Date(state.settings?.lastSyncTime || Date.now()).toLocaleString('ar-EG')} • رمز الفرع: {state.settings?.branchId}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={onTriggerCloudSync}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                مزامنة الآن مع السحابة وحفظ نسخة احتياطية
              </button>
              <button
                onClick={handleExportJSON}
                className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                تحميل قاعدة البيانات (JSON)
              </button>
              <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                استرجاع نسخة احتياطية
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
              {onResetAllData && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من تصفير ومسح جميع البيانات (الأصناف، الفواتير، الطلبات، والعملاء) لبدء النظام من الصفر؟')) {
                      onResetAllData();
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5 shadow"
                >
                  تصفير ومسح كل البيانات
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-black text-sm text-slate-900">طابور عمليات المزامنة السحابية (Sync Log)</h4>
              <span className="text-xs font-bold text-slate-500">
                إجمالي الحركات المسجلة: {state.syncQueue?.length || 0}
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {(state.syncQueue || []).map(item => (
                <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-500">{item.id}</span>
                    <span className="font-black text-slate-900">{item.action}</span>
                    <span className="text-slate-500">الكيان: {item.entity}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{new Date(item.timestamp).toLocaleString('ar-EG')}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        item.status === 'synced'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status === 'synced' ? 'تمت المزامنة سحابياً ☁️✓' : 'محفوظ أوفلاين - بانتظار المزامنة ⏳'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
