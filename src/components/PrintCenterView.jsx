import React, { useState } from 'react';
import {
  Printer, BookOpen, Calculator, Plus, CheckCircle2, Clock,
  Share2, Layers, Award, FileText, Settings, Sparkles, Barcode
} from 'lucide-react';

export default function PrintCenterView({
  state,
  currentUser,
  onCreatePrintJob,
  onUpdatePrintJob,
  onSaveStudyNote,
  onCreateReservation,
  onUpdateReservation,
  onOpenBarcodeModal,
  onSaveSettings
}) {
  const [activeSubTab, setActiveSubTab] = useState('calculator'); // calculator | study_notes | reservations

  // Print Calculator State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pagesCount, setPagesCount] = useState(40);
  const [copies, setCopies] = useState(1);
  const [paperSize, setPaperSize] = useState('A4');
  const [colorMode, setColorMode] = useState('bw'); // bw | color
  const [sides, setSides] = useState('double'); // single | double
  const [binding, setBinding] = useState('spiralSmall'); // none | spiralSmall | spiralLarge | thermal | lamination
  const [customDiscount, setCustomDiscount] = useState(0);
  const [manualActualCost, setManualActualCost] = useState(''); // Owner can type actual cost directly per job!

  // Owner Print Cost & Selling Prices Configuration Modal
  const [costSettingsOpen, setCostSettingsOpen] = useState(false);

  // Add Study Note Modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [newNote, setNewNote] = useState({
    title: '',
    teacherName: '',
    teacherPhone: '',
    grade: 'الصف الثالث الثانوي',
    subject: 'اللغة العربية',
    pagesCount: 80,
    printType: 'أبيض وأسود + غلاف ألوان + سلك',
    costPrice: 30,
    teacherCommission: 20,
    sellPrice: 75,
    stockPrinted: 30
  });

  // Add Student Reservation Modal
  const [resModalOpen, setResModalOpen] = useState(false);
  const [resStudentName, setResStudentName] = useState('');
  const [resStudentPhone, setResStudentPhone] = useState('');
  const [resNoteId, setResNoteId] = useState(state.studyNotes[0]?.id || 'NOTE-201');
  const [resQty, setResQty] = useState(1);
  const [resPaid, setResPaid] = useState(50);

  const prices = state.settings?.printPrices || {
    bwSingleA4: 1.0,
    bwDoubleA4: 1.5,
    colorSingleA4: 5.0,
    colorDoubleA4: 8.0,
    bwSingleA3: 2.5,
    colorSingleA3: 10.0,
    spiralBindingSmall: 15.0,
    spiralBindingLarge: 25.0,
    thermalBinding: 20.0,
    laminationA4: 10.0,
    paperCostPerSheetA4: 0,
    tonerCostPerPageBW: 0,
    tonerCostPerPageColor: 0,
    spiralSmallCost: 0,
    spiralLargeCost: 0,
    thermalCost: 0,
    laminationCost: 0
  };

  const [costForm, setCostForm] = useState(() => ({ ...prices }));

  const openCostSettingsModal = () => {
    setCostForm({
      bwSingleA4: prices.bwSingleA4 ?? 1.0,
      bwDoubleA4: prices.bwDoubleA4 ?? 1.5,
      colorSingleA4: prices.colorSingleA4 ?? 5.0,
      colorDoubleA4: prices.colorDoubleA4 ?? 8.0,
      spiralBindingSmall: prices.spiralBindingSmall ?? 15.0,
      spiralBindingLarge: prices.spiralBindingLarge ?? 25.0,
      thermalBinding: prices.thermalBinding ?? 20.0,
      laminationA4: prices.laminationA4 ?? 10.0,
      paperCostPerSheetA4: prices.paperCostPerSheetA4 ?? 0,
      tonerCostPerPageBW: prices.tonerCostPerPageBW ?? 0,
      tonerCostPerPageColor: prices.tonerCostPerPageColor ?? 0,
      spiralSmallCost: prices.spiralSmallCost ?? 0,
      spiralLargeCost: prices.spiralLargeCost ?? 0,
      thermalCost: prices.thermalCost ?? 0,
      laminationCost: prices.laminationCost ?? 0
    });
    setCostSettingsOpen(true);
  };

  const handleSaveCostSettings = async (e) => {
    e.preventDefault();
    if (onSaveSettings) {
      await onSaveSettings({
        printPrices: {
          ...prices,
          ...Object.fromEntries(Object.entries(costForm).map(([k, v]) => [k, Number(v) || 0])),
          _ownerConfiguredCosts: true
        }
      });
    }
    setCostSettingsOpen(false);
  };

  // Calculate Print Job Economics
  const numPages = Math.max(1, Number(pagesCount) || 1);
  const numCopies = Math.max(1, Number(copies) || 1);

  const sheetsPerCopy = sides === 'double' ? Math.ceil(numPages / 2) : numPages;
  const totalPaperSheets = sheetsPerCopy * numCopies;

  let printPricePerCopy = 0;
  if (paperSize === 'A3') {
    const rate = colorMode === 'color' ? prices.colorSingleA3 : prices.bwSingleA3;
    printPricePerCopy = numPages * rate;
  } else {
    if (colorMode === 'color') {
      printPricePerCopy = sides === 'double'
        ? sheetsPerCopy * prices.colorDoubleA4
        : numPages * prices.colorSingleA4;
    } else {
      printPricePerCopy = sides === 'double'
        ? sheetsPerCopy * prices.bwDoubleA4
        : numPages * prices.bwSingleA4;
    }
  }

  const bindingPrices = {
    none: 0,
    spiralSmall: prices.spiralBindingSmall ?? 15,
    spiralLarge: prices.spiralBindingLarge ?? 25,
    thermal: prices.thermalBinding ?? 20,
    lamination: prices.laminationA4 ?? 10
  };

  const bindingCostInternal = {
    none: 0,
    spiralSmall: Number(prices.spiralSmallCost) || 0,
    spiralLarge: Number(prices.spiralLargeCost) || 0,
    thermal: Number(prices.thermalCost) || 0,
    lamination: Number(prices.laminationCost) || 0
  };

  const bindingLabels = {
    none: 'بدون تغليف (تدبيس عادي)',
    spiralSmall: 'تغليف سلك + غلاف شفاف وخلفية',
    spiralLarge: 'تغليف سلك كبير (للملازم الكبيرة)',
    thermal: 'تغليف كعب حراري (مثل الكتب)',
    lamination: 'تغليف حراري بلاستيك (Lamination)'
  };

  const singleCopySellPrice = printPricePerCopy + (bindingPrices[binding] || 0);
  const grossSellTotal = singleCopySellPrice * numCopies;
  const finalSellTotal = Math.max(0, grossSellTotal - Number(customDiscount || 0));

  // Internal Actual Cost (Owner's configured rates OR Owner's direct manual input!)
  const paperFactor = paperSize === 'A3' ? 2 : 1;
  const paperCost = totalPaperSheets * (Number(prices.paperCostPerSheetA4) || 0) * paperFactor;
  const tonerCost =
    numPages *
    numCopies *
    (colorMode === 'color' ? (Number(prices.tonerCostPerPageColor) || 0) : (Number(prices.tonerCostPerPageBW) || 0));
  const totalBindingCost = (bindingCostInternal[binding] || 0) * numCopies;
  const autoCalculatedCost = paperCost + tonerCost + totalBindingCost;
  const totalEstimatedCost = manualActualCost !== '' ? Math.max(0, Number(manualActualCost) || 0) : autoCalculatedCost;
  const estimatedNetProfit = finalSellTotal - totalEstimatedCost;

  const handleSaveAndBillPrintJob = (e) => {
    e.preventDefault();
    const desc = `طباعة ${numPages} ص × ${numCopies} نسخة (${paperSize} - ${colorMode === 'color' ? 'ألوان' : 'أبيض وأسود'} - ${sides === 'double' ? 'وجهين' : 'وجه واحد'}) + ${bindingLabels[binding]}`;
    onCreatePrintJob({
      customerName: customerName || 'عميل مركز الطباعة',
      customerPhone: customerPhone || '-',
      description: desc,
      pagesCount: numPages,
      copies: numCopies,
      paperSize,
      colorMode,
      sides,
      binding,
      costEstimate: Number(totalEstimatedCost.toFixed(2)),
      totalPrice: Number(finalSellTotal.toFixed(2)),
      paidAmount: Number(finalSellTotal.toFixed(2)),
      status: 'completed',
      source: 'pos',
      recordInSales: true,
      cashierName: currentUser?.name || 'مسؤول الطباعة'
    });
    setCustomerName('');
    setCustomerPhone('');
    setCustomDiscount(0);
    setManualActualCost('');
  };

  const handleAddStudyNote = (e) => {
    e.preventDefault();
    onSaveStudyNote(newNote);
    setNoteModalOpen(false);
    setNewNote({
      title: '',
      teacherName: '',
      teacherPhone: '',
      grade: 'الصف الثالث الثانوي',
      subject: 'اللغة العربية',
      pagesCount: 80,
      printType: 'أبيض وأسود + غلاف ألوان + سلك',
      costPrice: 30,
      teacherCommission: 20,
      sellPrice: 75,
      stockPrinted: 30
    });
  };

  const handleAddReservation = (e) => {
    e.preventDefault();
    onCreateReservation({
      studentName: resStudentName,
      studentPhone: resStudentPhone,
      noteId: resNoteId,
      quantity: Number(resQty),
      paidAmount: Number(resPaid),
      status: 'printing'
    });
    setResModalOpen(false);
    setResStudentName('');
    setResStudentPhone('');
  };

  const notifyStudentWhatsApp = (resv) => {
    const storeName = state.settings?.storeName || 'بيت العيلة';
    const msg = `مرحباً ${resv.studentName} 👋\nنود إبلاغك من *مكتبة ${storeName}* بأن مذكرتك المحجوزة:\n📘 *${resv.noteTitle}*\nأصبحت *جاهزة للاستلام الآن* في المكتبة!\nرقم الحجز: ${resv.id}\nالمتبقي عند الاستلام: ${resv.remainingAmount} ج.م\nفي انتظارك!`;
    const cleanPhone = resv.studentPhone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Copier Machines Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {state.settings?.copierCounters?.map(mac => (
          <div key={mac.id} className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow">
            <div>
              <span className="text-[11px] text-emerald-400 font-bold block">عداد ماكينة التصوير المباشر</span>
              <h4 className="font-black text-xs mt-0.5">{mac.name}</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                منذ آخر صيانة: {(mac.currentCounter - mac.lastServiceCounter).toLocaleString()} ورقة
              </p>
            </div>
            <div className="text-left bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 block">العداد الحالي</span>
              <span className="font-mono font-black text-lg text-emerald-400">{mac.currentCounter.toLocaleString()}</span>
            </div>
          </div>
        ))}

        <div className="bg-purple-900 text-white p-4 rounded-2xl flex items-center justify-between shadow">
          <div>
            <span className="text-[11px] text-purple-300 font-bold block">قسم المذكرات الدراسية والمدرسين</span>
            <h4 className="font-black text-sm mt-0.5">{state.studyNotes.length} مذكرات دراسية مسجلة</h4>
            <p className="text-[11px] text-purple-200 mt-1">
              إجمالي الحجوزات النشطة: {state.noteReservations.filter(r => r.status !== 'delivered').length} طالب
            </p>
          </div>
          <BookOpen className="w-10 h-10 text-purple-300 opacity-80" />
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 inline-flex flex-wrap gap-2 shadow-sm">
        <button
          onClick={() => setActiveSubTab('calculator')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeSubTab === 'calculator'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Calculator className="w-4 h-4" />
          حاسبة تكلفة التصوير والطباعة وسجل الأوامر
        </button>
        <button
          onClick={() => setActiveSubTab('study_notes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeSubTab === 'study_notes'
              ? 'bg-purple-700 text-white shadow'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          المذكرات الدراسية وحسابات المدرسين ({state.studyNotes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('reservations')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeSubTab === 'reservations'
              ? 'bg-amber-500 text-white shadow'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          حجوزات الطلاب للمذكرات ({state.noteReservations.length})
        </button>
      </div>

      {/* SUBTAB 1: SMART PRINT COST CALCULATOR & JOBS */}
      {activeSubTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleSaveAndBillPrintJob}
            className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  حاسبة تكلفة الطباعة والتصوير والتغليف الذكية
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">صاحب المكتبة يحدد سعر التكلفة الفعلية وسعر البيع للعميل بحرية كاملة</p>
              </div>
              <button
                type="button"
                onClick={openCostSettingsModal}
                className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                إعدادات أسعار وتكلفة الطباعة
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل (اختياري)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="مثال: طالب / مهندس..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الموبايل</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عدد صفحات الملف الواحد</label>
                <input
                  type="number"
                  min="1"
                  value={pagesCount}
                  onChange={e => setPagesCount(e.target.value)}
                  className="w-full rounded-xl border-2 border-emerald-500 px-3 py-2 text-sm font-black text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">عدد النسخ المطلوبة</label>
                <input
                  type="number"
                  min="1"
                  value={copies}
                  onChange={e => setCopies(e.target.value)}
                  className="w-full rounded-xl border-2 border-emerald-500 px-3 py-2 text-sm font-black text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الطباعة</label>
                <select
                  value={colorMode}
                  onChange={e => setColorMode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                >
                  <option value="bw">أبيض وأسود ليزر</option>
                  <option value="color">ألوان ليزر / إنك جيت</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وجه واحد أم وجهين (وش وظهر)؟</label>
                <select
                  value={sides}
                  onChange={e => setSides(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                >
                  <option value="double">وجهين (وش وظهر - توفير ورق)</option>
                  <option value="single">وجه واحد فقط</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مقاس الورق</label>
                <select
                  value={paperSize}
                  onChange={e => setPaperSize(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                >
                  <option value="A4">ورق قياسي A4</option>
                  <option value="A3">ورق كبير هندسي A3</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع التغليف والتقفيل</label>
                <select
                  value={binding}
                  onChange={e => setBinding(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                >
                  {Object.entries(bindingLabels).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label} (+{bindingPrices[k]} ج للنسخة)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Breakdown Box */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2.5 text-xs">
              <div className="grid grid-cols-3 gap-2 pb-2.5 border-b border-slate-700 text-center items-center">
                <div className="bg-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">الورق الفعلي المستهلك</span>
                  <span className="font-black text-sm text-white mt-0.5 block">{totalPaperSheets} ورقة</span>
                </div>
                <div className="bg-slate-800 p-2 rounded-xl border border-amber-500/40">
                  <label className="text-[10px] text-amber-300 font-bold block mb-1">
                    التكلفة الفعلية على المكتبة (أدخل التكلفة)
                  </label>
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={manualActualCost !== '' ? manualActualCost : autoCalculatedCost}
                      onChange={e => setManualActualCost(e.target.value)}
                      placeholder="0.00"
                      className="w-20 bg-slate-900 text-amber-400 font-black text-sm text-center rounded-lg border border-amber-500/50 focus:border-amber-400 py-0.5 outline-none"
                    />
                    <span className="text-[11px] font-bold text-amber-400">ج.م</span>
                  </div>
                </div>
                <div className="bg-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">صافي ربح المكتبة</span>
                  <span className="font-black text-sm text-emerald-400 mt-0.5 block">
                    +{estimatedNetProfit.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-slate-400 block">سعر النسخة الواحدة شامل التغليف: {singleCopySellPrice.toFixed(2)} ج.م</span>
                  <span className="text-emerald-400 font-bold">المطلوب من العميل ({numCopies} نسخة):</span>
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {finalSellTotal.toFixed(2)} <span className="text-xs text-white">ج.م</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm transition"
            >
              <Printer className="w-5 h-5" />
              اعتماد عملية الطباعة وتحصيل {finalSellTotal.toFixed(2)} ج.م في الدرج
            </button>
          </form>

          {/* Right Side: Active & Recent Print Jobs (including Online PDF Print Requests!) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900">سجل أوامر الطباعة وطلبات رفع ملفات PDF أونلاين</h3>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {state.printJobs.length} عملية
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {state.printJobs.map(job => (
                <div key={job.id} className="p-4 hover:bg-slate-50 space-y-2 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-900">{job.id}</span>
                        {job.source === 'online' && (
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            طلب طباعة أونلاين 🌐
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            job.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {job.status === 'completed' ? 'مكتمل وتم التسليم' : 'قيد الطباعة والتجهيز'}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 mt-1">{job.description}</h4>
                      {job.fileName && (
                        <div className="text-[11px] font-mono text-blue-600 mt-0.5">📎 الملف المرفق: {job.fileName}</div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        العميل: {job.customerName} ({job.customerPhone}) • {new Date(job.createdAt).toLocaleString('ar-EG')}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-black text-sm text-emerald-700">{job.totalPrice} ج.م</div>
                      <div className="text-[10px] text-slate-400">تكلفة: {job.costEstimate} ج</div>
                    </div>
                  </div>
                  {job.status !== 'completed' && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => onUpdatePrintJob(job.id, { status: 'completed', paidAmount: job.totalPrice })}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تمت الطباعة والتسليم
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: STUDY NOTES & TEACHERS */}
      {activeSubTab === 'study_notes' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-black text-sm text-slate-900">دليل المذكرات الدراسية وحسابات نسب المدرسين</h3>
              <p className="text-xs text-slate-500">إدارة الطباعة بالكميات، باركود كل مذكرة، وحساب نسبة المدرس تلقائياً على كل نسخة مباعة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setResModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4" />
                + حجز مذكرة لطالب
              </button>
              <button
                onClick={() => setNoteModalOpen(true)}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                + إضافة مذكرة مدرس جديدة
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.studyNotes.map(note => {
              const netLibraryProfitPerCopy = note.sellPrice - note.costPrice - (note.teacherCommission || 0);
              const totalTeacherDues = (note.totalSold || 0) * (note.teacherCommission || 0);
              return (
                <div key={note.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="bg-purple-100 text-purple-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                        {note.grade} • {note.subject}
                      </span>
                      <h4 className="font-black text-base text-slate-900 mt-1.5">{note.title}</h4>
                      <p className="text-xs font-bold text-purple-700">
                        {note.teacherName} ({note.teacherPhone})
                      </p>
                    </div>
                    <button
                      onClick={() => onOpenBarcodeModal(note)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 transition"
                      title="طباعة باركود المذكرة"
                    >
                      <Barcode className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">سعر الطالب</span>
                      <span className="font-black text-emerald-700">{note.sellPrice} ج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">تكلفة الطباعة</span>
                      <span className="font-bold text-slate-700">{note.costPrice} ج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">نسبة المدرس</span>
                      <span className="font-bold text-purple-700">{note.teacherCommission} ج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">ربح المكتبة</span>
                      <span className="font-black text-blue-700">+{netLibraryProfitPerCopy} ج</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="space-x-3 space-x-reverse">
                      <span className="font-bold text-slate-700">
                        المطبوع الجاهز: <strong className="text-emerald-600">{note.stockPrinted} نسخة</strong>
                      </span>
                      <span className="font-bold text-slate-700">
                        إجمالي المباع: <strong>{note.totalSold} نسخة</strong>
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        onSaveStudyNote({
                          ...note,
                          stockPrinted: Number(note.stockPrinted) + 20
                        })
                      }
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3 py-1.5 rounded-xl"
                    >
                      + طباعة 20 نسخة إضافية
                    </button>
                  </div>

                  <div className="bg-purple-50 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold text-purple-900">
                    <span>إجمالي عمولات المدرس عن النسخ المباعة:</span>
                    <span className="font-black">{totalTeacherDues.toLocaleString()} ج.م</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: STUDENT NOTE RESERVATIONS */}
      {activeSubTab === 'reservations' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-slate-900">كشف حجوزات المذكرات للطلاب واستلام العربون</h3>
              <p className="text-xs text-slate-500">تتبع حالة الطباعة وإرسال إشعار واتساب للطالب فور تجهيز المذكرة</p>
            </div>
            <button
              onClick={() => setResModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              تسجيل حجز جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="py-3 px-4">رقم الحجز / الطالب</th>
                  <th className="py-3 px-3">المذكرة المحجوزة</th>
                  <th className="py-3 px-3 text-center">الكمية</th>
                  <th className="py-3 px-3 text-center">الإجمالي / العربون</th>
                  <th className="py-3 px-3 text-center">المتبقي عند الاستلام</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-4 text-left">إجراءات وإشعار الطالب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.noteReservations.map(resv => (
                  <tr key={resv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono font-black text-slate-900">{resv.id}</div>
                      <div className="font-bold text-slate-800">{resv.studentName}</div>
                      <div className="text-[11px] text-slate-500">{resv.studentPhone}</div>
                    </td>
                    <td className="py-3 px-3 font-bold text-purple-800">{resv.noteTitle}</td>
                    <td className="py-3 px-3 text-center font-black">{resv.quantity}</td>
                    <td className="py-3 px-3 text-center">
                      <div className="font-bold">{resv.totalPrice} ج.م</div>
                      <div className="text-[11px] text-emerald-700 font-bold">مدفوع: {resv.paidAmount} ج</div>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-rose-600">
                      {resv.remainingAmount} ج.م
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          resv.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : resv.status === 'ready'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {resv.status === 'delivered'
                          ? 'تم التسليم ✅'
                          : resv.status === 'ready'
                          ? 'جاهزة للاستلام 📦'
                          : 'قيد الطباعة 🖨️'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => notifyStudentWhatsApp(resv)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          إبلاغ واتساب
                        </button>
                        {resv.status === 'printing' && (
                          <button
                            onClick={() => onUpdateReservation(resv.id, { status: 'ready' })}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-xl"
                          >
                            تحويل لجاهزة
                          </button>
                        )}
                        {resv.status !== 'delivered' && (
                          <button
                            onClick={() => onUpdateReservation(resv.id, { status: 'delivered' })}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1.5 rounded-xl"
                          >
                            تسليم وتحصيل الباقي
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Study Note */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStudyNote}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 space-y-3 text-xs"
          >
            <h3 className="font-black text-base text-slate-900">إضافة مذكرة دراسية جديدة</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block font-bold mb-1">اسم المذكرة</label>
                <input
                  type="text"
                  required
                  value={newNote.title}
                  onChange={e => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="مثال: مذكرة المراجعة النهائية في التاريخ"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">اسم المدرس</label>
                <input
                  type="text"
                  required
                  value={newNote.teacherName}
                  onChange={e => setNewNote({ ...newNote, teacherName: e.target.value })}
                  placeholder="أ/ ..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">موبايل المدرس</label>
                <input
                  type="text"
                  value={newNote.teacherPhone}
                  onChange={e => setNewNote({ ...newNote, teacherPhone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">المرحلة / الصف الدراسي</label>
                <input
                  type="text"
                  value={newNote.grade}
                  onChange={e => setNewNote({ ...newNote, grade: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">المادة</label>
                <input
                  type="text"
                  value={newNote.subject}
                  onChange={e => setNewNote({ ...newNote, subject: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">تكلفة الطباعة للمكتبة (ج)</label>
                <input
                  type="number"
                  value={newNote.costPrice}
                  onChange={e => setNewNote({ ...newNote, costPrice: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">عمولة / نسبة المدرس (ج)</label>
                <input
                  type="number"
                  value={newNote.teacherCommission}
                  onChange={e => setNewNote({ ...newNote, teacherCommission: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-purple-700"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">سعر البيع للطالب (ج)</label>
                <input
                  type="number"
                  value={newNote.sellPrice}
                  onChange={e => setNewNote({ ...newNote, sellPrice: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">الكمية المطبوعة حالياً</label>
                <input
                  type="number"
                  value={newNote.stockPrinted}
                  onChange={e => setNewNote({ ...newNote, stockPrinted: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-purple-700 text-white font-black py-2.5 rounded-xl">
                حفظ المذكرة
              </button>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Student Reservation */}
      {resModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddReservation}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-3 text-xs"
          >
            <h3 className="font-black text-base text-slate-900">حجز مذكرة دراسية لطالب</h3>
            <div>
              <label className="block font-bold mb-1">اسم الطالب</label>
              <input
                type="text"
                required
                value={resStudentName}
                onChange={e => setResStudentName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">رقم موبايل الطالب / واتساب</label>
              <input
                type="text"
                required
                value={resStudentPhone}
                onChange={e => setResStudentPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">اختر المذكرة</label>
              <select
                value={resNoteId}
                onChange={e => setResNoteId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
              >
                {state.studyNotes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.title} - {n.teacherName} ({n.sellPrice} ج)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">الكمية</label>
                <input
                  type="number"
                  min="1"
                  value={resQty}
                  onChange={e => setResQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">العربون المدفوع (ج)</label>
                <input
                  type="number"
                  value={resPaid}
                  onChange={e => setResPaid(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-emerald-700"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-amber-500 text-white font-black py-2.5 rounded-xl">
                تأكيد الحجز
              </button>
              <button
                type="button"
                onClick={() => setResModalOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Owner Print Cost & Selling Prices Configuration Modal */}
      {costSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveCostSettings}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 border border-slate-200 space-y-4 text-xs max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-500" />
                  إعدادات التكلفة الفعلية على المكتبة وأسعار الطباعة للعميل
                </h3>
                <p className="text-[11px] text-slate-500">
                  حدّد هنا التكلفة الفعلية للورق والحبر والتغليف على مكتبتك ليتم حساب التكلفة وصافي الربح بدقة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCostSettingsOpen(false)}
                className="text-slate-500 font-bold"
              >
                إغلاق ✕
              </button>
            </div>

            {/* Section 1: Actual Cost on the Library */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
              <h4 className="font-black text-sm text-amber-950">
                1. التكلفة الفعلية على المكتبة (الورق والحبر والتغليف)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-bold text-slate-700 mb-1">تكلفة ورقة A4 الواحدة على المكتبة (ج)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={costForm.paperCostPerSheetA4}
                    onChange={e => setCostForm({ ...costForm, paperCostPerSheetA4: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-amber-800"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-bold text-slate-700 mb-1">تكلفة حبر الصفحة (أبيض وأسود) (ج)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={costForm.tonerCostPerPageBW}
                    onChange={e => setCostForm({ ...costForm, tonerCostPerPageBW: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-amber-800"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-bold text-slate-700 mb-1">تكلفة حبر الصفحة (ألوان) (ج)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={costForm.tonerCostPerPageColor}
                    onChange={e => setCostForm({ ...costForm, tonerCostPerPageColor: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-amber-800"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-bold text-slate-700 mb-1">تكلفة تغليف سلك صغير على المكتبة (ج)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={costForm.spiralSmallCost}
                    onChange={e => setCostForm({ ...costForm, spiralSmallCost: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-amber-800"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-bold text-slate-700 mb-1">تكلفة تغليف سلك كبير على المكتبة (ج)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={costForm.spiralLargeCost}
                    onChange={e => setCostForm({ ...costForm, spiralLargeCost: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-amber-800"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <label className="block font-bold text-slate-700 mb-1">تكلفة التغليف الحراري على المكتبة (ج)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={costForm.thermalCost}
                    onChange={e => setCostForm({ ...costForm, thermalCost: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-amber-800"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Customer Selling Prices */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
              <h4 className="font-black text-sm text-emerald-950">
                2. أسعار البيع للعميل (للتصوير والطباعة والتغليف)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-bold text-slate-700 mb-1">سعر تصوير A4 أبيض وأسود (وجه واحد)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={costForm.bwSingleA4}
                    onChange={e => setCostForm({ ...costForm, bwSingleA4: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-emerald-700"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-bold text-slate-700 mb-1">سعر تصوير A4 أبيض وأسود (وجهين)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={costForm.bwDoubleA4}
                    onChange={e => setCostForm({ ...costForm, bwDoubleA4: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-emerald-700"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-bold text-slate-700 mb-1">سعر طباعة A4 ألوان (وجه واحد)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={costForm.colorSingleA4}
                    onChange={e => setCostForm({ ...costForm, colorSingleA4: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-emerald-700"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-bold text-slate-700 mb-1">سعر تغليف سلك صغير للعميل</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={costForm.spiralBindingSmall}
                    onChange={e => setCostForm({ ...costForm, spiralBindingSmall: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-emerald-700"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-bold text-slate-700 mb-1">سعر تغليف سلك كبير للعميل</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={costForm.spiralBindingLarge}
                    onChange={e => setCostForm({ ...costForm, spiralBindingLarge: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-emerald-700"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <label className="block font-bold text-slate-700 mb-1">سعر التغليف الحراري للعميل</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={costForm.thermalBinding}
                    onChange={e => setCostForm({ ...costForm, thermalBinding: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-emerald-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow"
              >
                حفظ أسعار وتكاليف الطباعة الخاصة بالمكتبة
              </button>
              <button
                type="button"
                onClick={() => setCostSettingsOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-3 px-5 rounded-xl"
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
