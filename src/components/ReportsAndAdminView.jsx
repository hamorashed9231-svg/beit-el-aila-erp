import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, Wallet, Receipt, ShieldCheck, Cloud,
  RefreshCw, Download, Upload, Plus, CheckCircle2, Lock, Printer, MessageSquare
} from 'lucide-react';

export default function ReportsAndAdminView({
  state,
  currentUser,
  onSwitchUser,
  onAddExpense,
  onTriggerCloudSync,
  onRestoreBackup,
  onResetAllData,
  onSaveSettings
}) {
  const [activeTab, setActiveTab] = useState('profits'); // profits | expenses | users | cloud_sync

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

  // Financial Calculations
  const activeSales = state.sales.filter(s => s.status !== 'returned');
  const totalRevenue = activeSales.reduce((s, sale) => s + Number(sale.total || 0), 0);
  const totalCostOfGoods = activeSales.reduce((s, sale) => s + Number(sale.totalCost || 0), 0);
  const grossProfit = totalRevenue - totalCostOfGoods;
  const totalExpenses = state.expenses.reduce((s, exp) => s + Number(exp.amount || 0), 0);
  const netProfitAfterExpenses = grossProfit - totalExpenses;

  // Cash Drawer / Payment Method Breakdown
  const cashCollected = activeSales
    .filter(s => s.paymentMethod === 'cash')
    .reduce((s, sale) => s + Number(sale.paidAmount || 0), 0);
  const vodafoneCollected = activeSales
    .filter(s => s.paymentMethod === 'vodafone_cash')
    .reduce((s, sale) => s + Number(sale.paidAmount || 0), 0);
  const instapayCollected = activeSales
    .filter(s => s.paymentMethod === 'instapay')
    .reduce((s, sale) => s + Number(sale.paidAmount || 0), 0);
  const creditDeferred = activeSales.reduce((s, sale) => s + Number(sale.remainingAmount || 0), 0);

  const openingShiftCash = Number(state.settings?.drawerOpeningCash ?? state.shifts?.[0]?.openingCash ?? 0);
  const netCashInDrawer = openingShiftCash + cashCollected - totalExpenses;

  const handleSendReportWhatsApp = () => {
    const divider = '══════════════════════════';
    const subDivider = '──────────────────────────';
    const reportText = [
      `📊 *تقرير المبيعات والوردية (Shift Z-Report)*`,
      `🏢 *مكتبة بيت العيلة*`,
      divider,
      `*التاريخ والتوقيت:* ${new Date().toLocaleString('ar-EG')}`,
      `*المستخدم الحالي:* ${currentUser?.name || 'المدير العام'}`,
      divider,
      `*💰 جرد نقدية الدرج:*`,
      `• عهدة بداية الدرج (فكة): ${openingShiftCash.toFixed(2)} ج.م`,
      `• مبيعات نقدية (كاش): +${cashCollected.toFixed(2)} ج.م`,
      `• مسحوبات ومصروفات: -${totalExpenses.toFixed(2)} ج.م`,
      subDivider,
      `*💵 صافي الكاش الفعلي بالدرج الآن:* ${netCashInDrawer.toFixed(2)} ج.م`,
      divider,
      `*📈 ملخص المبيعات والإيرادات:*`,
      `• إجمالي الفواتير المنفذة: ${activeSales.length} فاتورة`,
      `• إجمالي الإيرادات: ${totalRevenue.toFixed(2)} ج.م`,
      `• تكلفة البضاعة المباعة: ${totalCostOfGoods.toFixed(2)} ج.م`,
      `• مجمل الربح: +${grossProfit.toFixed(2)} ج.م`,
      `• صافي الربح الحقيقي: ${netProfitAfterExpenses.toFixed(2)} ج.م`,
      subDivider,
      `• محفظة فودافون كاش: ${vodafoneCollected.toFixed(2)} ج.م`,
      `• تحويلات إنستا باي: ${instapayCollected.toFixed(2)} ج.م`,
      `• آجل ومتبقي على العملاء: ${creditDeferred.toFixed(2)} ج.م`,
      divider,
      `✅ تقرير موجه إلى المدير العام Ahmed kharbosh (+20 12 03544606)`
    ].join('\n');
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
          {/* Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">إجمالي المبيعات والإيرادات</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalRevenue.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">من {activeSales.length} فاتورة فعلية</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">مجمل الربح (قبل المصروفات)</span>
              <h3 className="text-2xl font-black text-blue-700 mt-1">+{grossProfit.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-slate-400 mt-1">تكلفة البضاعة المباعة: {totalCostOfGoods.toLocaleString()} ج</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500">إجمالي المصروفات التشغيلية</span>
              <h3 className="text-2xl font-black text-rose-600 mt-1">- {totalExpenses.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-slate-400 mt-1">أحبار، ورق، كهرباء، ومستلزمات</p>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-bold text-emerald-400">صافي الربح النهائي الحقيقي</span>
              <h3 className="text-2xl font-black text-white mt-1">{netProfitAfterExpenses.toLocaleString()} ج.م</h3>
              <p className="text-[11px] text-slate-300 mt-1">بعد خصم التكلفة وعمولات المدرسين والمصروفات</p>
            </div>
          </div>

          {/* Shift Z-Report & Drawer Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  تقرير تقفيل الوردية والدرج النقدي (Shift Z-Report)
                </h3>
                <p className="text-xs text-slate-500">تفصيل المبالغ المحصلة حسب طريقة الدفع والنقدية المتوقعة في درج الكاشير</p>
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
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              الموظفون وصلاحيات الكاشير والمدير
            </h3>
            <p className="text-xs text-slate-500">اضغط على أي حساب للتبديل الفوري وتجربة صلاحيات الموظف:</p>
            <div className="space-y-2.5">
              {state.users.map(u => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                      isCurrent ? 'bg-purple-50 border-purple-400' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        الدور: <strong>{u.role === 'admin' ? 'مدير عام (كامل الصلاحيات)' : u.role === 'cashier' ? 'كاشير مبيعات' : 'مسؤول طباعة ومذكرات'}</strong> • رمز PIN: <code className="font-mono">{u.pin}</code>
                      </div>
                    </div>
                    <button
                      onClick={() => onSwitchUser(u)}
                      disabled={isCurrent}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                        isCurrent
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {isCurrent ? 'المستخدم النشط حالياً ✓' : 'تبديل لهذا الحساب'}
                    </button>
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
