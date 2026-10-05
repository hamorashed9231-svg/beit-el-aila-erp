import React from 'react';
import { Printer, X, CheckCircle2, Share2 } from 'lucide-react';

export default function ReceiptModal({ sale, settings, onClose }) {
  if (!sale) return null;

  const paymentLabels = {
    cash: 'نقدي (كاش)',
    vodafone_cash: 'فودافون كاش',
    instapay: 'إنستا باي (InstaPay)',
    credit: 'آجل / ذمم عملاء'
  };

  const handlePrint = () => {
    window.print();
  };

  const storeName = settings?.storeName || 'بيت العيلة';
  const logoUrl = settings?.logoUrl || '/logo.jpg';

  const handleWhatsAppShare = () => {
    const lines = [
      `🧾 *فاتورة من ${storeName}*`,
      `رقم الفاتورة: ${sale.id}`,
      `التاريخ: ${new Date(sale.createdAt).toLocaleString('ar-EG')}`,
      `العميل: ${sale.customerName}`,
      `----------------`,
      ...sale.items.map(item => `• ${item.name} (${item.quantity} ${item.unitName || ''}) = ${item.total} ج.م`),
      `----------------`,
      `الإجمالي الصافي: *${sale.total} ج.م*`,
      `المدفوع: ${sale.paidAmount} ج.م`,
      sale.remainingAmount > 0 ? `المتبقي (آجل): ${sale.remainingAmount} ج.م` : `الحالة: خالص بالكامل ✅`,
      `شكراً لتعاملكم مع ${storeName}!`
    ];
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Top Action Bar (Hidden in Print) */}
        <div className="no-print bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-base">تم حفظ الفاتورة بنجاح</h3>
              <p className="text-xs text-emerald-100">جاهزة للطباعة الحرارية 80mm أو الإرسال واتساب</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-emerald-700/60 hover:bg-emerald-800 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt 80mm */}
        <div id="printable-area" className="p-6 bg-white text-slate-900 text-sm font-sans">
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-3">
            <img src={logoUrl} alt={storeName} className="w-20 h-20 object-contain mx-auto mb-1" />
            <h2 className="text-xl font-black tracking-tight">{storeName}</h2>
            <p className="text-xs text-slate-600 mt-1">{settings?.slogan}</p>
            <p className="text-xs text-slate-600 mt-0.5">{settings?.address}</p>
            <p className="text-xs font-bold text-slate-700 mt-1" dir="ltr">📞 {settings?.phone}</p>
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-3">
            <div><span className="text-slate-500">رقم الفاتورة:</span> <strong className="font-mono">{sale.id}</strong></div>
            <div><span className="text-slate-500">الكاشير:</span> <strong>{sale.cashierName}</strong></div>
            <div className="col-span-2"><span className="text-slate-500">التاريخ:</span> <strong>{new Date(sale.createdAt).toLocaleString('ar-EG')}</strong></div>
            <div className="col-span-2"><span className="text-slate-500">العميل:</span> <strong>{sale.customerName}</strong></div>
            <div className="col-span-2"><span className="text-slate-500">طريقة الدفع:</span> <strong>{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</strong></div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs border-collapse mb-3">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-700">
                <th className="py-1.5 text-right">الصنف / الوحدة</th>
                <th className="py-1.5 text-center">الكمية</th>
                <th className="py-1.5 text-center">السعر</th>
                <th className="py-1.5 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-slate-200">
              {sale.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-1">
                    <div className="font-bold text-slate-900">{item.name}</div>
                    {item.unitName && <div className="text-[11px] text-slate-500">الوحدة: {item.unitName}</div>}
                  </td>
                  <td className="py-2 text-center font-bold">{item.quantity}</td>
                  <td className="py-2 text-center">{Number(item.unitPrice).toFixed(2)}</td>
                  <td className="py-2 text-left font-bold">{Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t-2 border-dashed border-slate-400 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">الإجمالي قبل الخصم:</span>
              <span className="font-semibold">{Number(sale.subtotal || sale.total).toFixed(2)} ج.م</span>
            </div>
            {Number(sale.discount) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>قيمة الخصم:</span>
                <span className="font-bold">- {Number(sale.discount).toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black bg-slate-100 p-2 rounded-lg border border-slate-300">
              <span>الإجمالي المطلوب:</span>
              <span>{Number(sale.total).toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-600">المدفوع:</span>
              <span className="font-bold text-emerald-700">{Number(sale.paidAmount).toFixed(2)} ج.م</span>
            </div>
            {Number(sale.remainingAmount) > 0 && (
              <div className="flex justify-between text-rose-600 font-bold bg-rose-50 p-1.5 rounded">
                <span>المتبقي (مُسجل بالحساب الآجل):</span>
                <span>{Number(sale.remainingAmount).toFixed(2)} ج.م</span>
              </div>
            )}
          </div>

          {/* Barcode Visual representation */}
          <div className="mt-5 pt-3 border-t border-dashed border-slate-300 text-center">
            <div className="inline-flex flex-col items-center">
              <div className="flex items-center justify-center gap-[2px] h-10 px-4 bg-white">
                {Array.from(sale.id + '62210099').map((ch, i) => (
                  <span
                    key={i}
                    className="bg-slate-900 inline-block h-full"
                    style={{ width: (ch.charCodeAt(0) % 3 + 1) + 'px', marginRight: (i % 2 === 0 ? '1px' : '2px') }}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] tracking-widest mt-1 text-slate-600">*{sale.id}*</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              {settings?.receiptFooter || 'شكراً لزيارتكم مكتبة بيت العيلة!'}
            </p>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="no-print bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition"
          >
            <Printer className="w-4 h-4" />
            طباعة الفاتورة (Enter)
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Share2 className="w-4 h-4" />
            واتساب
          </button>
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-4 rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
