import React, { useState } from 'react';
import { Printer, X, CheckCircle2, Share2, Image as ImageIcon, Copy, Check, MessageSquare } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function ReceiptModal({ sale, settings, onClose }) {
  if (!sale) return null;

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copyToast, setCopyToast] = useState('');
  const [customPhone, setCustomPhone] = useState(sale.customerPhone || '');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

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

  // Format exact Thermal Monospace WhatsApp Text
  const generateThermalWhatsAppText = () => {
    const divider = '══════════════════════════';
    const subDivider = '──────────────────────────';

    const itemLines = (sale.items || []).map((item, idx) => {
      const unit = item.unitName ? ` [${item.unitName}]` : '';
      const qtyPrice = `${item.quantity} × ${Number(item.unitPrice).toFixed(2)}`;
      const total = `${Number(item.total).toFixed(2)} ج.م`;
      return `${idx + 1}. *${item.name}*${unit}\n   ${qtyPrice} = *${total}*`;
    }).join('\n');

    return [
      `🧾 *${storeName}*`,
      settings?.slogan ? `${settings.slogan}` : 'نظام الكاشير والمكتبة الشامل',
      settings?.address ? `📍 ${settings.address}` : '',
      settings?.phone ? `📞 للتواصل: ${settings.phone}` : '',
      divider,
      `*رقم الفاتورة:* #${sale.id}`,
      `*التاريخ:* ${new Date(sale.createdAt).toLocaleString('ar-EG')}`,
      `*الكاشير:* ${sale.cashierName || 'أحمد محمود'}`,
      `*العميل:* ${sale.customerName || 'عميل نقدي'}`,
      `*طريقة الدفع:* ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}`,
      subDivider,
      `*بيان الأصناف والمشتريات:*`,
      itemLines,
      subDivider,
      `الإجمالي قبل الخصم: ${Number(sale.subtotal || sale.total).toFixed(2)} ج.م`,
      Number(sale.discount) > 0 ? `قيمة الخصم الممنوح: -${Number(sale.discount).toFixed(2)} ج.م` : null,
      divider,
      `*الإجمالي المطلوب: ${Number(sale.total).toFixed(2)} ج.م*`,
      `*المبلغ المدفوع: ${Number(sale.paidAmount).toFixed(2)} ج.م*`,
      Number(sale.remainingAmount) > 0
        ? `⚠️ *المتبقي (آجل بالحساب): ${Number(sale.remainingAmount).toFixed(2)} ج.م*`
        : `الحالة: *خالص ومسدد بالكامل ✅*`,
      divider,
      settings?.receiptFooter || `شكراً لتعاملكم مع ${storeName}! ✨`,
      `مشغل بواسطة ريفيكس سيستم • Powered by RIVIX System`,
      `*#${sale.id}*`
    ].filter(Boolean).join('\n');
  };

  const handleWhatsAppTextShare = () => {
    const text = generateThermalWhatsAppText();
    let url = '';
    const cleanPhone = customPhone.replace(/[^0-9]/g, '');
    if (cleanPhone && cleanPhone.length >= 10) {
      const formatted = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
      url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  };

  // Capture the EXACT thermal receipt as a high-res image for WhatsApp
  const handleShareReceiptImage = async () => {
    const receiptElement = document.getElementById('printable-area');
    if (!receiptElement) return;

    setIsGeneratingImage(true);
    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 380,
        windowWidth: 380,
        scrollX: 0,
        scrollY: 0
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingImage(false);
          return;
        }

        const fileName = `فاتورة_${sale.id}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // 1. Try Mobile/Native Share sheet (shares direct image to WhatsApp)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `فاتورة ${storeName} #${sale.id}`,
              text: `فاتورة ${storeName} #${sale.id} للعميل ${sale.customerName}`
            });
            setIsGeneratingImage(false);
            return;
          } catch (err) {
            // User cancelled or fallback
          }
        }

        // 2. Desktop Fallback: Copy Image to Clipboard for Instant Ctrl+V in WhatsApp Web
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopyToast('تم نسخ صورة الفاتورة للحافظة! يمكنك لصقها (Ctrl+V) في محادثة الواتساب فوراً ✓');
            setTimeout(() => setCopyToast(''), 5000);
          }
        } catch (clipErr) {
          console.warn('Clipboard write failed', clipErr);
        }

        // 3. Download the receipt image file
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = fileName;
        a.click();

        // 4. Open WhatsApp Web / App
        const cleanPhone = customPhone.replace(/[^0-9]/g, '');
        const targetUrl = cleanPhone && cleanPhone.length >= 10
          ? `https://wa.me/${cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone}`
          : 'https://web.whatsapp.com/';
        window.open(targetUrl, '_blank');

        setIsGeneratingImage(false);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to generate receipt image', err);
      setIsGeneratingImage(false);
      alert('حدث خطأ أثناء تصدير صورة الفاتورة، يرجى المحاولة مرة أخرى.');
    }
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
              <p className="text-xs text-emerald-100">جاهزة للطباعة الحرارية 80mm أو الإرسال واتساب (صورة / نص)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-emerald-700/60 hover:bg-emerald-800 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Copy Notification Toast */}
        {copyToast && (
          <div className="no-print bg-emerald-100 border-b border-emerald-300 text-emerald-900 px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-center animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{copyToast}</span>
          </div>
        )}

        {/* Printable Thermal Receipt 80mm */}
        <div
          id="printable-area"
          style={{ width: '380px', maxWidth: '380px', margin: '0 auto', direction: 'rtl', fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
          className="p-5 bg-white text-slate-900 text-sm font-sans"
        >
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
            <div className="mt-2 pt-2 border-t border-dotted border-slate-300 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-sans">
              <img src="/rivix-logo.png" alt="Rivix" className="w-3.5 h-3.5 rounded-full object-contain" />
              <span>مشغل بواسطة ريفيكس سيستم • RIVIX SYSTEM</span>
            </div>
          </div>
        </div>

        {/* Optional Customer WhatsApp Phone */}
        {showPhoneInput && (
          <div className="no-print bg-slate-100 p-3 border-t border-slate-200 text-xs flex items-center gap-2">
            <label className="font-bold text-slate-700 whitespace-nowrap">رقم واتساب العميل:</label>
            <input
              type="tel"
              placeholder="010XXXXXXXX"
              value={customPhone}
              onChange={(e) => setCustomPhone(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-bold outline-none bg-white"
            />
          </div>
        )}

        {/* Bottom Action Buttons */}
        <div className="no-print bg-slate-50 p-4 border-t border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow transition text-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة (Enter)</span>
            </button>

            {/* Exact Thermal Image to WhatsApp */}
            <button
              onClick={handleShareReceiptImage}
              disabled={isGeneratingImage}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow transition text-xs active:scale-95"
              title="إرسال صورة طبق الأصل من البون الحراري على الواتساب"
            >
              <ImageIcon className="w-4 h-4" />
              <span>{isGeneratingImage ? 'جاري تجهيز الصورة...' : 'صورة البون (واتساب)'}</span>
            </button>

            {/* Monospace Formatted Text WhatsApp */}
            <button
              onClick={handleWhatsAppTextShare}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 text-xs transition"
              title="إرسال فاتورة نصية منسقة ببيانات وتفاصيل البون"
            >
              <MessageSquare className="w-4 h-4" />
              <span>نص منسق</span>
            </button>

            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-3 rounded-xl transition text-xs"
            >
              إغلاق
            </button>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setShowPhoneInput(!showPhoneInput)}
              className="text-emerald-700 hover:underline font-bold"
            >
              {showPhoneInput ? 'إخفاء رقم الهاتف' : '+ إدخال رقم هاتف العميل للإرسال المباشر'}
            </button>
            <span>جاهزة للبون الحراري 80mm والصور</span>
          </div>
        </div>
      </div>
    </div>
  );
}
