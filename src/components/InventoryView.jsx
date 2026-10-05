import React, { useState } from 'react';
import {
  Package, Plus, Search, AlertTriangle, Edit3, Trash2, Barcode,
  Truck, Layers, CheckCircle2, Globe, DollarSign, Archive
} from 'lucide-react';

export default function InventoryView({
  state,
  onSaveProduct,
  onDeleteProduct,
  onCreatePurchase,
  onOpenBarcodeModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Add / Edit Product Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Purchase / Restock Modal State
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState(state.suppliers[0]?.id || 'SUP-1');
  const [purchaseProductId, setPurchaseProductId] = useState(state.products[0]?.id || 'PRD-1001');
  const [purchaseQty, setPurchaseQty] = useState(24);
  const [purchaseCost, setPurchaseCost] = useState(5.5);
  const [purchasePaid, setPurchasePaid] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  const lowStockProducts = state.products.filter(p => p.stock <= p.minStock);
  const totalCostValue = state.products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const totalRetailValue = state.products.reduce((s, p) => s + p.stock * p.sellPrice, 0);

  const openAddModal = () => {
    const generatedBarcode = `622100${Math.floor(100000 + Math.random() * 900000)}`;
    setEditingProduct({
      id: '',
      name: '',
      barcode: generatedBarcode,
      sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
      category: 'CAT-1',
      costPrice: 5,
      sellPrice: 8,
      wholesalePrice: 7,
      stock: 50,
      minStock: 10,
      baseUnit: 'قطعة',
      location: 'رف A-1',
      showOnline: true,
      featured: false,
      image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=400&q=80',
      units: [
        { name: 'قطعة', factor: 1, price: 8, barcode: generatedBarcode },
        { name: 'دستة (12 قطعة)', factor: 12, price: 85, barcode: `${generatedBarcode}2` }
      ]
    });
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(structuredClone(prod));
    setModalOpen(true);
  };

  const handleAddUnitRow = () => {
    setEditingProduct(prev => ({
      ...prev,
      units: [
        ...(prev.units || []),
        {
          name: 'دستة / علبة',
          factor: 12,
          price: Number(prev.sellPrice) * 11,
          barcode: `${prev.barcode}${prev.units?.length + 1 || 2}`
        }
      ]
    }));
  };

  const handleUpdateUnitRow = (idx, field, val) => {
    setEditingProduct(prev => {
      const updated = [...(prev.units || [])];
      updated[idx] = { ...updated[idx], [field]: field === 'name' || field === 'barcode' ? val : Number(val) };
      return { ...prev, units: updated };
    });
  };

  const handleRemoveUnitRow = (idx) => {
    setEditingProduct(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmitProduct = (e) => {
    e.preventDefault();
    onSaveProduct(editingProduct);
    setModalOpen(false);
  };

  const handleSubmitPurchase = (e) => {
    e.preventDefault();
    const total = Number(purchaseQty) * Number(purchaseCost);
    const paid = purchasePaid === '' ? total : Number(purchasePaid);
    onCreatePurchase({
      supplierId: purchaseSupplierId,
      items: [{ productId: purchaseProductId, quantity: Number(purchaseQty), costPrice: Number(purchaseCost) }],
      paidAmount: paid,
      notes: purchaseNotes || `توريد مخزني (${purchaseQty} وحدة)`
    });
    setPurchaseModalOpen(false);
    setPurchaseNotes('');
    setPurchasePaid('');
  };

  const filteredProducts = state.products.filter(p => {
    if (onlyLowStock && p.stock > p.minStock) return false;
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الأصناف المسجلة</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{state.products.length} صنف</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">يدعم تعدد الوحدات والباركود</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">قيمة المخزون (بسعر التكلفة)</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCostValue.toLocaleString()} ج.م</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">رأس المال الفعلي بالبضاعة</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Archive className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">القيمة البيعية المتوقعة</p>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{totalRetailValue.toLocaleString()} ج.م</h3>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
              ربح متوقع: +{(totalRetailValue - totalCostValue).toLocaleString()} ج.م
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setOnlyLowStock(!onlyLowStock)}
          className={`cursor-pointer p-4 rounded-2xl border shadow-sm flex items-center justify-between transition ${
            onlyLowStock
              ? 'bg-rose-600 text-white border-rose-700'
              : 'bg-white border-rose-200 hover:bg-rose-50'
          }`}
        >
          <div>
            <p className={`text-xs font-bold ${onlyLowStock ? 'text-rose-100' : 'text-rose-600'}`}>
              تنبيهات النواقص (Low Stock)
            </p>
            <h3 className="text-2xl font-black mt-1">{lowStockProducts.length} أصناف</h3>
            <p className={`text-[11px] font-semibold mt-0.5 ${onlyLowStock ? 'text-white' : 'text-slate-500'}`}>
              {onlyLowStock ? 'اضغط لعرض كل الأصناف' : 'اضغط لفلترة النواقص فقط'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${onlyLowStock ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Controls & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الباركود أو رقم الرف..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:border-emerald-600 outline-none"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold bg-white outline-none"
          >
            <option value="ALL">جميع الأقسام</option>
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const p = state.products[0];
              if (p) {
                setPurchaseProductId(p.id);
                setPurchaseCost(p.costPrice);
              }
              setPurchaseModalOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Truck className="w-4 h-4" />
            توريد بضاعة (فاتورة مشتريات)
          </button>
          <button
            onClick={openAddModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            إضافة صنف جديد
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="py-3.5 px-4">الصنف / الباركود</th>
                <th className="py-3.5 px-3">القسم / الرف</th>
                <th className="py-3.5 px-3 text-center">الرصيد الحالي</th>
                <th className="py-3.5 px-3 text-center">التكلفة</th>
                <th className="py-3.5 px-3 text-center">قطاعي / جملة</th>
                <th className="py-3.5 px-3">الوحدات المتعددة (قطعة / دستة / كرتونة)</th>
                <th className="py-3.5 px-3 text-center">المتجر</th>
                <th className="py-3.5 px-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(prod => {
                const catName = state.categories.find(c => c.id === prod.category)?.name || 'عام';
                const isLow = prod.stock <= prod.minStock;
                return (
                  <tr key={prod.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img src={prod.image} alt={prod.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                        <div>
                          <div className="font-black text-slate-900 text-sm">{prod.name}</div>
                          <div className="font-mono text-[11px] text-slate-400">{prod.barcode} • {prod.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-700 block">{catName}</span>
                      <span className="text-[11px] text-slate-400">{prod.location}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs ${
                          prod.stock <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                        {prod.stock} {prod.baseUnit}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">حد الطلب: {prod.minStock}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-600">
                      {prod.costPrice} ج.م
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="font-black text-emerald-700 text-sm">{prod.sellPrice} ج.م</div>
                      <div className="text-[11px] text-amber-700 font-bold">جملة: {prod.wholesalePrice || prod.sellPrice} ج</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {prod.units?.map((u, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold"
                          >
                            {u.name}: {u.price} ج ({u.factor}×)
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {prod.showOnline ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Globe className="w-3 h-3" /> معروض
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">مخفي</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenBarcodeModal(prod)}
                          title="طباعة استيكر باركود"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 transition"
                        >
                          <Barcode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(prod)}
                          title="تعديل الصنف والوحدات"
                          className="p-2 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`هل تريد حذف الصنف "${prod.name}"؟`)) {
                              onDeleteProduct(prod.id);
                            }
                          }}
                          title="حذف"
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal with Multi-Unit Builder */}
      {modalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitProduct}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                {editingProduct.id ? 'تعديل بيانات الصنف والوحدات' : 'إضافة صنف جديد للمخزن'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">اسم الصنف بالكامل</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="مثال: قلم جاف روتو سائل أزرق"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">القسم</label>
                <select
                  value={editingProduct.category}
                  onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                >
                  {state.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الباركود الرئيسي</label>
                <input
                  type="text"
                  value={editingProduct.barcode}
                  onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سعر التكلفة (للقطعة الأساسية)</label>
                <input
                  type="number"
                  step="0.25"
                  value={editingProduct.costPrice}
                  onChange={e => setEditingProduct({ ...editingProduct, costPrice: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سعر البيع القطاعي</label>
                <input
                  type="number"
                  step="0.25"
                  value={editingProduct.sellPrice}
                  onChange={e => setEditingProduct({ ...editingProduct, sellPrice: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سعر الجملة (للمدرسين والكميات)</label>
                <input
                  type="number"
                  step="0.25"
                  value={editingProduct.wholesalePrice}
                  onChange={e => setEditingProduct({ ...editingProduct, wholesalePrice: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-amber-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الوحدة الأساسية (قطعة / كتاب / رزمة)</label>
                <input
                  type="text"
                  value={editingProduct.baseUnit}
                  onChange={e => setEditingProduct({ ...editingProduct, baseUnit: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الرصيد الحالي بالمخزن (بالوحدة الأساسية)</label>
                <input
                  type="number"
                  value={editingProduct.stock}
                  onChange={e => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">حد التنبيه بالنواقص (Min Stock)</label>
                <input
                  type="number"
                  value={editingProduct.minStock}
                  onChange={e => setEditingProduct({ ...editingProduct, minStock: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مكان الرف / المخزن</label>
                <input
                  type="text"
                  value={editingProduct.location}
                  onChange={e => setEditingProduct({ ...editingProduct, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editingProduct.showOnline}
                    onChange={e => setEditingProduct({ ...editingProduct, showOnline: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  عرض الصنف في المتجر الإلكتروني للعملاء
                </label>
              </div>
            </div>

            {/* Multi-Units Builder Section */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs text-slate-900">تعدد الوحدات (قطعة / دستة / باكتة / كرتونة)</h4>
                  <p className="text-[11px] text-slate-500">يتم خصم عدد القطع تلقائياً من الرصيد الأساسي عند البيع بأي وحدة</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddUnitRow}
                  className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة وحدة كبرى
                </button>
              </div>

              <div className="space-y-2">
                {editingProduct.units?.map((u, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 text-xs">
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 block">اسم الوحدة</label>
                      <input
                        type="text"
                        value={u.name}
                        onChange={e => handleUpdateUnitRow(idx, 'name', e.target.value)}
                        className="w-full font-bold border-b border-slate-200 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block">تحتوي على كم قطعة؟</label>
                      <input
                        type="number"
                        min="1"
                        value={u.factor}
                        onChange={e => handleUpdateUnitRow(idx, 'factor', e.target.value)}
                        className="w-full font-bold border-b border-slate-200 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block">سعر بيع الوحدة</label>
                      <input
                        type="number"
                        step="0.5"
                        value={u.price}
                        onChange={e => handleUpdateUnitRow(idx, 'price', e.target.value)}
                        className="w-full font-bold text-emerald-700 border-b border-slate-200 outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block">باركود الوحدة</label>
                      <input
                        type="text"
                        value={u.barcode}
                        onChange={e => handleUpdateUnitRow(idx, 'barcode', e.target.value)}
                        className="w-full font-mono text-[11px] border-b border-slate-200 outline-none"
                      />
                    </div>
                    <div className="col-span-1 text-left">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveUnitRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow"
              >
                حفظ بيانات الصنف والوحدات
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="bg-slate-200 text-slate-800 font-bold py-3 px-6 rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Purchase / Supplier Restock Modal */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPurchase}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4 text-xs"
          >
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" />
              توريد بضاعة للمخزن (فاتورة مشتريات)
            </h3>

            <div>
              <label className="block font-bold text-slate-700 mb-1">اختر المورد</label>
              <select
                value={purchaseSupplierId}
                onChange={e => setPurchaseSupplierId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
              >
                {state.suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (له رصيد: {s.balance} ج)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">الصنف المراد تزويد رصيده</label>
              <select
                value={purchaseProductId}
                onChange={e => {
                  const pid = e.target.value;
                  setPurchaseProductId(pid);
                  const found = state.products.find(p => p.id === pid);
                  if (found) setPurchaseCost(found.costPrice);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
              >
                {state.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (الرصيد الحالي: {p.stock})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية الواردة (بالوحدة الأساسية)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={purchaseQty}
                  onChange={e => setPurchaseQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">سعر شراء الوحدة (التكلفة)</label>
                <input
                  type="number"
                  step="0.25"
                  required
                  value={purchaseCost}
                  onChange={e => setPurchaseCost(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex justify-between items-center font-bold text-amber-900">
              <span>إجمالي فاتورة المشتريات:</span>
              <span className="text-base font-black">{(Number(purchaseQty) * Number(purchaseCost)).toFixed(2)} ج.م</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">المبلغ المدفوع للمورد الآن (اتركه فارغاً لو مدفوع بالكامل)</label>
              <input
                type="number"
                placeholder={`${(Number(purchaseQty) * Number(purchaseCost)).toFixed(2)}`}
                value={purchasePaid}
                onChange={e => setPurchasePaid(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ملاحظات الفاتورة</label>
              <input
                type="text"
                value={purchaseNotes}
                onChange={e => setPurchaseNotes(e.target.value)}
                placeholder="مثال: دفعة بضاعة مدارس جديدة"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-xl"
              >
                إضافة الرصيد وحفظ الفاتورة
              </button>
              <button
                type="button"
                onClick={() => setPurchaseModalOpen(false)}
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
