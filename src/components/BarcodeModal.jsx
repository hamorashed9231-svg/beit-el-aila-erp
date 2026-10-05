import React, { useState } from 'react';
import { Printer, X, Barcode } from 'lucide-react';

export default function BarcodeModal({ item, storeName = 'بيت العيلة', onClose }) {
  const [copies, setCopies] = useState(4);
  const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);

  if (!item) return null;

  const units = item.units && item.units.length > 0
    ? item.units
    : [{ name: item.baseUnit || 'قطعة', price: item.sellPrice, barcode: item.barcode || item.code || item.id }];

  const activeUnit = units[selectedUnitIdx] || units[0];
  const codeValue = activeUnit.barcode || item.barcode || item.code || item.id;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="no-print bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">طباعة ملصقات الباركود والتسعير</h3>
              <p className="text-xs text-slate-300">مقاس ملصق حراري قياسي (38mm × 25mm)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="no-print p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اختر الوحدة المراد طباعة باركودها</label>
            <select
              value={selectedUnitIdx}
              onChange={e => setSelectedUnitIdx(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {units.map((u, i) => (
                <option key={i} value={i}>{u.name} - {u.price} ج.م ({u.barcode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">عدد الملصقات (الاستيكرات)</label>
            <input
              type="number"
              min="1"
              max="40"
              value={copies}
              onChange={e => setCopies(Math.max(1, Math.min(40, Number(e.target.value))))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Printable Stickers Grid */}
        <div id="printable-area" className="p-6 max-h-96 overflow-y-auto bg-white">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: copies }).map((_, idx) => (
              <div
                key={idx}
                className="border-2 border-dashed border-slate-400 rounded-xl p-2.5 text-center flex flex-col items-center justify-between bg-white"
              >
                <div className="text-[11px] font-black text-slate-800">{storeName}</div>
                <div className="text-xs font-bold text-slate-900 line-clamp-1 my-0.5">{item.name || item.title}</div>
                <div className="flex items-center justify-center gap-[1.5px] h-9 my-1 px-2">
                  {Array.from(String(codeValue) + '9182').map((ch, i) => (
                    <span
                      key={i}
                      className="bg-black inline-block h-full"
                      style={{
                        width: ((ch.charCodeAt(0) + i) % 3 + 1) + 'px',
                        marginRight: i % 3 === 0 ? '2px' : '1px'
                      }}
                    />
                  ))}
                </div>
                <div className="font-mono text-[10px] tracking-widest text-slate-700">{codeValue}</div>
                <div className="mt-1 bg-slate-900 text-white text-xs font-black px-2.5 py-0.5 rounded-md">
                  {activeUnit.price} ج.م ({activeUnit.name})
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="no-print bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition"
          >
            <Printer className="w-4 h-4" />
            طباعة {copies} ملصق باركود الآن
          </button>
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-4 rounded-xl transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
