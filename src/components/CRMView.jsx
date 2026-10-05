import React, { useState } from 'react';
import {
  Users, Truck, Plus, Banknote, FileText, Share2, Award,
  ArrowDownLeft, ArrowUpRight, CheckCircle2
} from 'lucide-react';

export default function CRMView({
  state,
  onSaveCustomer,
  onCustomerPayment,
  onSaveSupplier,
  onSupplierPayment
}) {
  const [activeTab, setActiveTab] = useState('customers'); // customers | suppliers
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Payment Modal
  const [paymentModal, setPaymentModal] = useState(null); // { type: 'customer' | 'supplier', entity }
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Add Customer / Supplier Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTypeOrCat, setFormTypeOrCat] = useState('');
  const [formBalance, setFormBalance] = useState(0);
  const [formLimit, setFormLimit] = useState(3000);
  const [formNotes, setFormNotes] = useState('');

  const totalCustomerReceivables = state.customers.reduce((s, c) => s + (Number(c.balance) || 0), 0);
  const totalSupplierPayables = state.suppliers.reduce((s, sup) => s + (Number(sup.balance) || 0), 0);

  const handleOpenAdd = () => {
    setFormName('');
    setFormPhone('');
    setFormTypeOrCat(activeTab === 'customers' ? 'vip' : 'أدوات مكتبية وكتب');
    setFormBalance(0);
    setFormLimit(3000);
    setFormNotes('');
    setAddModalOpen(true);
  };

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    if (activeTab === 'customers') {
      onSaveCustomer({
        name: formName,
        phone: formPhone,
        type: formTypeOrCat || 'vip',
        balance: Number(formBalance) || 0,
        creditLimit: Number(formLimit) || 3000,
        notes: formNotes
      });
    } else {
      onSaveSupplier({
        name: formName,
        phone: formPhone,
        category: formTypeOrCat || 'مورد عام',
        balance: Number(formBalance) || 0,
        notes: formNotes
      });
    }
    setAddModalOpen(false);
  };

  const handleSubmitPayment = (e) => {
    e.preventDefault();
    if (!paymentModal) return;
    if (paymentModal.type === 'customer') {
      onCustomerPayment(paymentModal.entity.id, {
        amount: Number(payAmount),
        notes: payNotes || 'سداد دفعة نقدية من الحساب الآجل'
      });
    } else {
      onSupplierPayment(paymentModal.entity.id, {
        amount: Number(payAmount),
        notes: payNotes || 'سداد دفعة لمندوب المورد'
      });
    }
    setPaymentModal(null);
    setPayAmount('');
    setPayNotes('');
  };

  const sendWhatsAppStatement = (customer) => {
    const storeName = state.settings?.storeName || 'بيت العيلة';
    const msg = `مرحباً *${customer.name}* 👋\nكشف حساب مختصر من *مكتبة ${storeName}*:\n• إجمالي المسحوبات السابقة: ${customer.totalPurchases} ج.م\n• الرصيد الآجل المتبقي حالياً: *${customer.balance} ج.م*\n• نقاط الولاء المكتسبة: ${customer.loyaltyPoints} نقطة 🎁\nشكراً لتعاملكم الدائم معنا!`;
    const cleanPhone = (customer.phone || '').replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">إجمالي أموالنا عند العملاء (ذمم مدينة / آجل)</span>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{totalCustomerReceivables.toLocaleString()} ج.م</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">موزعة على {state.customers.filter(c => c.balance > 0).length} عملاء آجل</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">إجمالي المستحق علينا للموردين (ذمم دائنة)</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{totalSupplierPayables.toLocaleString()} ج.م</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">موزعة على {state.suppliers.filter(s => s.balance > 0).length} شركات وموردين</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">صافي الموقف الائتماني (لنا - علينا)</span>
            <h3 className="text-2xl font-black text-amber-400 mt-1">
              {(totalCustomerReceivables - totalSupplierPayables).toLocaleString()} ج.م
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">متابعة دقيقة للتحصيل والسداد</p>
          </div>
          <FileText className="w-10 h-10 text-slate-500" />
        </div>
      </div>

      {/* Tabs & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('customers'); setSelectedEntity(null); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
              activeTab === 'customers'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            العملاء والمدارس والمدرسين ({state.customers.length})
          </button>
          <button
            onClick={() => { setActiveTab('suppliers'); setSelectedEntity(null); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
              activeTab === 'suppliers'
                ? 'bg-amber-500 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            الموردين وشركات الفجالة والكتب ({state.suppliers.length})
          </button>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'customers' ? '+ إضافة عميل / مدرسة / مدرس' : '+ إضافة مورد / شركة جديدة'}
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* List Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {activeTab === 'customers' ? (
            <div className="divide-y divide-slate-100">
              {state.customers.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedEntity(c)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition flex items-center justify-between gap-3 ${
                    selectedEntity?.id === c.id ? 'bg-emerald-50/60 border-r-4 border-emerald-600' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900">{c.name}</h4>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {c.type === 'school' ? 'مدرسة / حضانة' : c.type === 'teacher' ? 'مدرس' : c.type === 'vip' ? 'عميل مميز' : 'نقدي'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">📞 {c.phone} • {c.notes}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold">
                      <span className="text-slate-600">إجمالي مسحوبات: {c.totalPurchases} ج</span>
                      <span className="text-amber-600 flex items-center gap-0.5">
                        <Award className="w-3.5 h-3.5" /> نقاط الولاء: {c.loyaltyPoints}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">الرصيد الآجل المستحق</span>
                      <span className={`text-base font-black ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {c.balance} ج.م
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.balance > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModal({ type: 'customer', entity: c });
                            setPayAmount(c.balance);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          تحصيل دفعة
                        </button>
                      )}
                      {c.phone && c.phone !== '-' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sendWhatsAppStatement(c);
                          }}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-emerald-700"
                          title="إرسال كشف حساب واتساب"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {state.suppliers.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedEntity(s)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition flex items-center justify-between gap-3 ${
                    selectedEntity?.id === s.id ? 'bg-amber-50/60 border-r-4 border-amber-500' : ''
                  }`}
                >
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{s.name}</h4>
                    <p className="text-xs text-amber-700 font-bold mt-0.5">{s.category}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">📞 {s.phone} • {s.notes}</p>
                    <p className="text-[11px] font-bold text-slate-600 mt-1">إجمالي التوريدات: {s.totalSupplied.toLocaleString()} ج.م</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">المستحق للمورد</span>
                      <span className={`text-base font-black ${s.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {s.balance} ج.م
                      </span>
                    </div>
                    {s.balance > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModal({ type: 'supplier', entity: s });
                          setPayAmount(s.balance);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        سداد دفعة للمورد
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Statement Ledger (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          {!selectedEntity ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400">
              <FileText className="w-12 h-12 mb-2 stroke-1" />
              <p className="font-bold text-sm text-slate-600">كشف الحساب التفصيلي</p>
              <p className="text-xs mt-1">اضغط على أي عميل أو مورد من القائمة لعرض جميع الفواتير والدفعات المسددة</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-600 block">كشف حساب مالي معتمد</span>
                  <h3 className="font-black text-base text-slate-900">{selectedEntity.name}</h3>
                  <p className="text-xs text-slate-500">{selectedEntity.phone}</p>
                </div>
                <div className="text-left bg-slate-900 text-white px-3.5 py-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">الرصيد المتبقي</span>
                  <span className="font-black text-base text-amber-400">{selectedEntity.balance} ج.م</span>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(selectedEntity.transactions || []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">لا توجد حركات آجلة مسجلة في هذا الحساب</p>
                ) : (
                  selectedEntity.transactions.map(tr => (
                    <div
                      key={tr.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{tr.description}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(tr.date).toLocaleString('ar-EG')}
                        </div>
                      </div>
                      <span
                        className={`font-black px-2.5 py-1 rounded-lg whitespace-nowrap ${
                          tr.type === 'payment' || tr.type === 'return'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {tr.type === 'payment' || tr.type === 'return' ? `- ${tr.amount} ج (سداد)` : `+ ${tr.amount} ج (مديونية)`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal (سند قبض / سند صرف) */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPayment}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4 text-xs"
          >
            <h3 className="font-black text-base text-slate-900">
              {paymentModal.type === 'customer' ? 'سند قبض نقدية من عميل' : 'سند صرف دفعة لمورد'}
            </h3>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-800">{paymentModal.entity.name}</div>
              <div className="text-slate-500 mt-0.5">الرصيد الحالي المستحق: <strong>{paymentModal.entity.balance} ج.م</strong></div>
            </div>
            <div>
              <label className="block font-bold mb-1">المبلغ المسدد الآن (ج.م)</label>
              <input
                type="number"
                required
                min="1"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full rounded-xl border-2 border-emerald-500 px-3 py-2 text-base font-black"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">البيان / طريقة الدفع</label>
              <input
                type="text"
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="مثال: دفعة نقدية بالدرج / تحويل فودافون كاش"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-emerald-600 text-white font-black py-2.5 rounded-xl">
                تأكيد السداد وتحديث الحساب
              </button>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Customer / Supplier Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAdd}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-3 text-xs"
          >
            <h3 className="font-black text-base text-slate-900">
              {activeTab === 'customers' ? 'إضافة عميل جديد' : 'إضافة مورد جديد'}
            </h3>
            <div>
              <label className="block font-bold mb-1">الاسم بالكامل</label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">رقم التليفون / الواتساب</label>
              <input
                type="text"
                required
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">الرصيد الافتتاحي الآجل (إن وجد)</label>
              <input
                type="number"
                value={formBalance}
                onChange={e => setFormBalance(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ملاحظات</label>
              <input
                type="text"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-slate-900 text-white font-black py-2.5 rounded-xl">
                حفظ الحساب
              </button>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-xl"
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
