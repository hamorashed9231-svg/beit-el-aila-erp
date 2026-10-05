import React, { useState } from 'react';
import {
  Package, Plus, Search, AlertTriangle, Edit3, Trash2, Barcode,
  Truck, Layers, CheckCircle2, Globe, DollarSign, Archive, Box
} from 'lucide-react';

export default function InventoryView({
  state,
  onSaveProduct,
  onDeleteProduct,
  onCreatePurchase,
  onSaveCategory,
  onDeleteCategory,
  onOpenBarcodeModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Add / Manage Categories Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [inlineNewCatName, setInlineNewCatName] = useState('');
  const [showInlineCat, setShowInlineCat] = useState(false);

  // Add / Edit Product Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [entryMode, setEntryMode] = useState('carton'); // 'carton' | 'piece'
  const [cartonsCountInput, setCartonsCountInput] = useState(5);
  const [piecesPerCartonInput, setPiecesPerCartonInput] = useState(24);
  const [extraLoosePiecesInput, setExtraLoosePiecesInput] = useState(0);
  const [cartonCostInput, setCartonCostInput] = useState(192);
  const [cartonSellPriceInput, setCartonSellPriceInput] = useState(225);

  // Purchase / Restock Modal State
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState(state.suppliers[0]?.id || 'SUP-1');
  const [purchaseProductId, setPurchaseProductId] = useState(state.products[0]?.id || 'PRD-1001');
  const [purchaseByCarton, setPurchaseByCarton] = useState(true);
  const [purchaseCartonsCount, setPurchaseCartonsCount] = useState(2);
  const [purchasePiecesPerCarton, setPurchasePiecesPerCarton] = useState(24);
  const [purchaseQty, setPurchaseQty] = useState(48);
  const [purchaseCost, setPurchaseCost] = useState(8.0);
  const [purchasePaid, setPurchasePaid] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  const lowStockProducts = state.products.filter(p => p.stock <= p.minStock);
  const totalCostValue = state.products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const totalRetailValue = state.products.reduce((s, p) => s + p.stock * p.sellPrice, 0);

  const openAddModal = (presetType = 'general') => {
    const generatedBarcode = `622100${Math.floor(100000 + Math.random() * 900000)}`;
    const isSnackOrCarton = presetType === 'carton';
    const defPiecesPerCarton = isSnackOrCarton ? 24 : 12;
    const defCartons = 5;
    const defPieceSell = isSnackOrCarton ? 10 : 8;
    const defPieceCost = isSnackOrCarton ? 8 : 5.5;
    const defCartonSell = defPieceSell * defPiecesPerCarton - 15;

    setEntryMode('carton');
    setCartonsCountInput(defCartons);
    setPiecesPerCartonInput(defPiecesPerCarton);
    setExtraLoosePiecesInput(0);
    setCartonCostInput(defPieceCost * defPiecesPerCarton);
    setCartonSellPriceInput(defCartonSell);

    setEditingProduct({
      id: '',
      name: '',
      barcode: generatedBarcode,
      sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
      category: selectedCategory !== 'ALL' ? selectedCategory : (state.categories[0]?.id || 'GENERAL'),
      costPrice: defPieceCost,
      sellPrice: defPieceSell,
      wholesalePrice: defPieceSell - 1,
      stock: defCartons * defPiecesPerCarton,
      minStock: defPiecesPerCarton,
      baseUnit: isSnackOrCarton ? 'كيس / قطعة' : 'قطعة',
      piecesPerCarton: defPiecesPerCarton,
      location: isSnackOrCarton ? 'ستاند الشيبسي والحلويات' : 'رف A-1',
      showOnline: true,
      featured: false,
      image: isSnackOrCarton
        ? 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80'
        : 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=400&q=80',
      units: [
        { name: isSnackOrCarton ? 'كيس / قطعة' : 'قطعة', factor: 1, price: defPieceSell, barcode: generatedBarcode },
        { name: `كرتونة (${defPiecesPerCarton} قطعة)`, factor: defPiecesPerCarton, price: defCartonSell, barcode: `${generatedBarcode}2` }
      ]
    });
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    const ppc = Number(prod.piecesPerCarton) || (prod.units?.[1]?.factor) || 1;
    setEntryMode(ppc > 1 ? 'carton' : 'piece');
    setPiecesPerCartonInput(ppc);
    setCartonsCountInput(ppc > 1 ? Math.floor((prod.stock || 0) / ppc) : (prod.stock || 0));
    setExtraLoosePiecesInput(ppc > 1 ? (prod.stock || 0) % ppc : 0);
    setCartonCostInput(Number(((prod.costPrice || 0) * ppc).toFixed(2)));
    setCartonSellPriceInput(prod.units?.[1]?.price || Number(((prod.sellPrice || 0) * ppc).toFixed(2)));
    setEditingProduct(structuredClone(prod));
    setModalOpen(true);
  };

  // Sync carton calculator changes into editingProduct automatically
  const recalcFromCartonInputs = (nextCartons, nextPpc, nextLoose, nextCartonCost, nextPieceSell, nextCartonSell) => {
    const ppc = Math.max(1, Number(nextPpc) || 1);
    const cartons = Math.max(0, Number(nextCartons) || 0);
    const loose = Math.max(0, Number(nextLoose) || 0);
    const totalPieces = cartons * ppc + loose;
    const pieceCost = ppc > 0 ? Number((Number(nextCartonCost || 0) / ppc).toFixed(2)) : 0;
    const pieceSell = Number(nextPieceSell || 0);
    const cSell = Number(nextCartonSell || pieceSell * ppc);

    setEditingProduct(prev => {
      if (!prev) return prev;
      const baseUnitName = prev.baseUnit || 'قطعة';
      const existingUnits = [...(prev.units || [])];
      existingUnits[0] = {
        ...(existingUnits[0] || {}),
        name: baseUnitName,
        factor: 1,
        price: pieceSell,
        barcode: prev.barcode
      };
      if (ppc > 1) {
        existingUnits[1] = {
          ...(existingUnits[1] || {}),
          name: `كرتونة / علبة (${ppc} ${baseUnitName})`,
          factor: ppc,
          price: cSell,
          barcode: existingUnits[1]?.barcode || `${prev.barcode}2`
        };
      }
      return {
        ...prev,
        piecesPerCarton: ppc,
        stock: totalPieces,
        costPrice: pieceCost,
        sellPrice: pieceSell,
        units: existingUnits
      };
    });
  };

  const handleAddUnitRow = () => {
    setEditingProduct(prev => ({
      ...prev,
      units: [
        ...(prev.units || []),
        {
          name: 'كرتونة / دستة',
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

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    let productToSave = { ...editingProduct };
    if (showInlineCat && inlineNewCatName.trim() && onSaveCategory) {
      const newId = `CAT-${Date.now().toString().slice(-5)}`;
      await onSaveCategory({ id: newId, name: inlineNewCatName.trim() });
      productToSave.category = newId;
      setInlineNewCatName('');
      setShowInlineCat(false);
    }
    setModalOpen(false);
    if (selectedCategory !== 'ALL' && selectedCategory !== productToSave.category) {
      setSelectedCategory('ALL');
    }
    if (onlyLowStock && productToSave.stock > productToSave.minStock) {
      setOnlyLowStock(false);
    }
    await onSaveProduct(productToSave);
  };

  const handleSubmitPurchase = (e) => {
    e.preventDefault();
    const finalPiecesQty = purchaseByCarton
      ? Number(purchaseCartonsCount) * Number(purchasePiecesPerCarton)
      : Number(purchaseQty);
    const total = finalPiecesQty * Number(purchaseCost);
    const paid = purchasePaid === '' ? total : Number(purchasePaid);
    onCreatePurchase({
      supplierId: purchaseSupplierId,
      items: [{ productId: purchaseProductId, quantity: finalPiecesQty, costPrice: Number(purchaseCost) }],
      paidAmount: paid,
      notes:
        purchaseNotes ||
        (purchaseByCarton
          ? `توريد ${purchaseCartonsCount} كرتونة × ${purchasePiecesPerCarton} قطعة = ${finalPiecesQty} قطعة`
          : `توريد مخزني (${finalPiecesQty} قطعة)`)
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

  // Helper to format stock into Cartons + Loose Pieces
  const formatCartonBreakdown = (prod) => {
    const ppc = Number(prod.piecesPerCarton) || (prod.units?.find(u => u.factor > 1)?.factor) || 1;
    if (ppc <= 1) return null;
    const cartons = Math.floor((prod.stock || 0) / ppc);
    const loose = (prod.stock || 0) % ppc;
    if (cartons > 0 && loose > 0) return `(${cartons} كرتونة و ${loose} ${prod.baseUnit})`;
    if (cartons > 0) return `(${cartons} كرتونة كاملة • الكرتونة ${ppc} ${prod.baseUnit})`;
    return `(أقل من كرتونة: ${loose} من ${ppc})`;
  };

  return (
    <div className="space-y-5">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الأصناف المسجلة</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{state.products.length} صنف</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">يدعم الإضافة بالكرتونة والبيع بالقطعة</p>
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
              placeholder="ابحث بالاسم (قلم، شيبسي، هدية، كتاب) أو الباركود أو رقم الرف..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:border-emerald-600 outline-none"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold bg-white outline-none"
          >
            <option value="ALL">جميع الأقسام ({state.categories.length})</option>
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCatModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Layers className="w-4 h-4" />
            + إضافة / إدارة الأقسام ({state.categories.length})
          </button>
          <button
            onClick={() => {
              const p = state.products[0];
              if (p) {
                const ppc = Number(p.piecesPerCarton) || (p.units?.find(u => u.factor > 1)?.factor) || 24;
                setPurchaseProductId(p.id);
                setPurchaseCost(p.costPrice);
                setPurchasePiecesPerCarton(ppc);
                setPurchaseCartonsCount(2);
                setPurchaseQty(2 * ppc);
              }
              setPurchaseModalOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Truck className="w-4 h-4" />
            توريد بضاعة بالكرتونة / بالقطعة
          </button>
          <button
            onClick={() => openAddModal('carton')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Box className="w-4 h-4" />
            + إضافة منتج جديد (بالكرتونة أو بالقطعة)
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
                <th className="py-3.5 px-3 text-center">الرصيد بالقطعة وبالكرتونة</th>
                <th className="py-3.5 px-3 text-center">تكلفة القطعة</th>
                <th className="py-3.5 px-3 text-center">سعر بيع القطعة</th>
                <th className="py-3.5 px-3">وحدات البيع (قطعة / كرتونة / دستة)</th>
                <th className="py-3.5 px-3 text-center">المتجر</th>
                <th className="py-3.5 px-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <Box className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                    <div className="font-black text-sm text-slate-800">المخزن فارغ حالياً — لا توجد أصناف مسجلة</div>
                    <p className="text-xs text-slate-400 mt-1 mb-3">ابدأ بإضافة أصنافك الجديدة بالكرتونة أو بالقطعة وسيتم حساب الرصيد والتكلفة تلقائياً</p>
                    <button
                      type="button"
                      onClick={() => openAddModal('carton')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow"
                    >
                      <Plus className="w-4 h-4" />
                      + إضافة منتج جديد الآن
                    </button>
                  </td>
                </tr>
              )}
              {filteredProducts.map(prod => {
                const catName = state.categories.find(c => c.id === prod.category)?.name || 'عام';
                const isLow = prod.stock <= prod.minStock;
                const cartonInfo = formatCartonBreakdown(prod);
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
                      {cartonInfo && (
                        <div className="text-[11px] font-bold text-blue-700 mt-1">{cartonInfo}</div>
                      )}
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

      {/* Add / Edit Product Modal with Smart Carton-to-Piece Calculator */}
      {modalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitProduct}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                {editingProduct.id ? 'تعديل بيانات الصنف والكراتين' : 'إضافة منتج جديد للمكتبة (أدوات / شيبسي / هدايا / كتب)'}
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
                  placeholder="مثال: شيبسي عائلي بالجبنة / قلم روتو / بوكس هدايا / كشكول سلك..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">القسم (أدوات / شيبسي / هدايا / ألعاب)</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineCat(!showInlineCat)}
                    className="text-[11px] font-black text-purple-700 hover:underline"
                  >
                    {showInlineCat ? 'إلغاء' : '+ قسم جديد سريع'}
                  </button>
                </div>
                {showInlineCat ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={inlineNewCatName}
                      onChange={e => setInlineNewCatName(e.target.value)}
                      placeholder="اسم القسم الجديد (مثال: مشروبات باردة)..."
                      className="flex-1 rounded-xl border-2 border-purple-400 px-3 py-1.5 font-bold"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!inlineNewCatName.trim()) return;
                        const newId = `CAT-${Date.now().toString().slice(-4)}`;
                        if (onSaveCategory) {
                          await onSaveCategory({ id: newId, name: inlineNewCatName.trim() });
                        }
                        setEditingProduct({ ...editingProduct, category: newId });
                        setInlineNewCatName('');
                        setShowInlineCat(false);
                      }}
                      className="bg-purple-600 text-white font-black px-3 py-1.5 rounded-xl"
                    >
                      حفظ
                    </button>
                  </div>
                ) : (
                  <select
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
                  >
                    {state.categories.length === 0 && (
                      <option value="GENERAL">عام (اضغط + قسم جديد سريع لإضافة قسم)</option>
                    )}
                    {state.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الوحدة الفردية (قطعة / كيس / علبة / كتاب)</label>
                <input
                  type="text"
                  value={editingProduct.baseUnit}
                  onChange={e => setEditingProduct({ ...editingProduct, baseUnit: e.target.value })}
                  placeholder="قطعة / كيس"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            </div>

            {/* SMART CARTON & PIECE CALCULATOR BOX */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border-2 border-emerald-200 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-sm text-emerald-950 flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-emerald-600" />
                    طريقة إدخال الكمية والتسعير (بالكرتونة أم بالقطعة؟)
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    لو الصنف بيجي بالكرتونة (زي الشيبسي، المولتو، الأقلام، الكشاكيل)، اكتب عدد الكراتين وعدد القطع داخل الكرتونة وهيحسب الرصيد الفردي تلقائياً!
                  </p>
                </div>
                <div className="flex bg-white rounded-xl p-1 border border-emerald-200">
                  <button
                    type="button"
                    onClick={() => setEntryMode('carton')}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs transition ${
                      entryMode === 'carton' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'
                    }`}
                  >
                    📦 إدخال بالكرتونة / العلبة
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('piece')}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs transition ${
                      entryMode === 'piece' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
                    }`}
                  >
                    🔢 إدخال بالقطعة الفردية
                  </button>
                </div>
              </div>

              {entryMode === 'carton' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                    <label className="block font-black text-emerald-900 mb-1">عدد الكراتين المضافة</label>
                    <input
                      type="number"
                      min="0"
                      value={cartonsCountInput}
                      onChange={e => {
                        const v = e.target.value;
                        setCartonsCountInput(v);
                        recalcFromCartonInputs(v, piecesPerCartonInput, extraLoosePiecesInput, cartonCostInput, editingProduct.sellPrice, cartonSellPriceInput);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-sm text-emerald-700"
                    />
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                    <label className="block font-black text-emerald-900 mb-1">عدد القطع داخل الكرتونة الواحدة</label>
                    <input
                      type="number"
                      min="1"
                      value={piecesPerCartonInput}
                      onChange={e => {
                        const v = e.target.value;
                        setPiecesPerCartonInput(v);
                        recalcFromCartonInputs(cartonsCountInput, v, extraLoosePiecesInput, cartonCostInput, editingProduct.sellPrice, cartonSellPriceInput);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-sm text-blue-700"
                    />
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                    <label className="block font-bold text-slate-700 mb-1">+ قطع فرط إضافية (اختياري)</label>
                    <input
                      type="number"
                      min="0"
                      value={extraLoosePiecesInput}
                      onChange={e => {
                        const v = e.target.value;
                        setExtraLoosePiecesInput(v);
                        recalcFromCartonInputs(cartonsCountInput, piecesPerCartonInput, v, cartonCostInput, editingProduct.sellPrice, cartonSellPriceInput);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-sm"
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                    <label className="block font-bold text-slate-700 mb-1">سعر شراء الكرتونة جملة (التكلفة)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={cartonCostInput}
                      onChange={e => {
                        const v = e.target.value;
                        setCartonCostInput(v);
                        recalcFromCartonInputs(cartonsCountInput, piecesPerCartonInput, extraLoosePiecesInput, v, editingProduct.sellPrice, cartonSellPriceInput);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-sm"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      تكلفة الـ {editingProduct.baseUnit} الواحد = <strong>{editingProduct.costPrice} ج.م</strong>
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                    <label className="block font-black text-emerald-800 mb-1">سعر بيع القطعة / الكيس للعميل</label>
                    <input
                      type="number"
                      step="0.25"
                      value={editingProduct.sellPrice}
                      onChange={e => {
                        const v = e.target.value;
                        recalcFromCartonInputs(cartonsCountInput, piecesPerCartonInput, extraLoosePiecesInput, cartonCostInput, v, cartonSellPriceInput);
                      }}
                      className="w-full rounded-lg border border-emerald-400 px-2.5 py-1.5 font-black text-sm text-emerald-700"
                    />
                    <span className="text-[10px] text-emerald-700 font-bold mt-1 block">
                      ربح القطعة: +{(Number(editingProduct.sellPrice) - Number(editingProduct.costPrice)).toFixed(2)} ج
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                    <label className="block font-bold text-slate-700 mb-1">سعر بيع الكرتونة كاملة</label>
                    <input
                      type="number"
                      step="0.5"
                      value={cartonSellPriceInput}
                      onChange={e => {
                        const v = e.target.value;
                        setCartonSellPriceInput(v);
                        recalcFromCartonInputs(cartonsCountInput, piecesPerCartonInput, extraLoosePiecesInput, cartonCostInput, editingProduct.sellPrice, v);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-sm text-amber-700"
                    />
                  </div>

                  <div className="sm:col-span-3 bg-slate-900 text-white p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
                    <span>
                      إجمالي الرصيد الذي سيُضاف للمخزن (ويُخصم منه تلقائياً عند كل بيعة):
                    </span>
                    <span className="text-base font-black text-emerald-400">
                      {editingProduct.stock} {editingProduct.baseUnit} ({cartonsCountInput} كرتونة × {piecesPerCartonInput})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <label className="block font-bold text-slate-700 mb-1">الكمية بالمخزن (بالقطعة)</label>
                    <input
                      type="number"
                      value={editingProduct.stock}
                      onChange={e => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-black text-sm"
                    />
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <label className="block font-bold text-slate-700 mb-1">سعر تكلفة القطعة</label>
                    <input
                      type="number"
                      step="0.25"
                      value={editingProduct.costPrice}
                      onChange={e => setEditingProduct({ ...editingProduct, costPrice: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-sm"
                    />
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <label className="block font-black text-emerald-800 mb-1">سعر بيع القطعة</label>
                    <input
                      type="number"
                      step="0.25"
                      value={editingProduct.sellPrice}
                      onChange={e => {
                        const val = Number(e.target.value);
                        const updatedUnits = [...(editingProduct.units || [])];
                        if (updatedUnits[0]) updatedUnits[0].price = val;
                        setEditingProduct({ ...editingProduct, sellPrice: val, units: updatedUnits });
                      }}
                      className="w-full rounded-lg border border-emerald-400 px-2.5 py-1.5 font-black text-sm text-emerald-700"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
                <label className="block font-bold text-slate-700 mb-1">حد التنبيه بالنواقص (Min Stock)</label>
                <input
                  type="number"
                  value={editingProduct.minStock}
                  onChange={e => setEditingProduct({ ...editingProduct, minStock: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مكان الرف / الاستاند</label>
                <input
                  type="text"
                  value={editingProduct.location}
                  onChange={e => setEditingProduct({ ...editingProduct, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">رابط صورة المنتج (أو اتركه للصورة الافتراضية)</label>
                <input
                  type="text"
                  value={editingProduct.image}
                  onChange={e => setEditingProduct({ ...editingProduct, image: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-[11px]"
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
                  عرض في المتجر الإلكتروني
                </label>
              </div>
            </div>

            {/* Multi-Units Builder Section */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs text-slate-900">وحدات البيع في الكاشير (قطعة / دستة / كرتونة)</h4>
                  <p className="text-[11px] text-slate-500">عند بيع كيس يخصم 1 من المخزن، وعند بيع كرتونة يخصم عدد قطع الكرتونة تلقائياً</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddUnitRow}
                  className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة وحدة بيع أخرى
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
                      <label className="text-[10px] text-slate-400 block">تخصم كم قطعة؟</label>
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
                حفظ الصنف في المخزن والكاشير والمتجر
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

      {/* Purchase / Supplier Restock Modal (Supports Restocking by Carton or Piece) */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPurchase}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4 text-xs"
          >
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" />
              توريد بضاعة للمخزن (بالكرتونة أو بالقطعة)
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
                  if (found) {
                    const ppc = Number(found.piecesPerCarton) || (found.units?.find(u => u.factor > 1)?.factor) || 24;
                    setPurchaseCost(found.costPrice);
                    setPurchasePiecesPerCarton(ppc);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold bg-white"
              >
                {state.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (الرصيد الحالي: {p.stock} {p.baseUnit})</option>
                ))}
              </select>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPurchaseByCarton(true)}
                className={`flex-1 py-1.5 rounded-lg font-black transition ${
                  purchaseByCarton ? 'bg-amber-500 text-white shadow' : 'text-slate-600'
                }`}
              >
                📦 توريد بالكرتونة
              </button>
              <button
                type="button"
                onClick={() => setPurchaseByCarton(false)}
                className={`flex-1 py-1.5 rounded-lg font-black transition ${
                  !purchaseByCarton ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
                }`}
              >
                🔢 توريد بالقطعة
              </button>
            </div>

            {purchaseByCarton ? (
              <div className="grid grid-cols-2 gap-3 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="block font-black text-amber-900 mb-1">عدد الكراتين الواردة</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseCartonsCount}
                    onChange={e => setPurchaseCartonsCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-black bg-white"
                  />
                </div>
                <div>
                  <label className="block font-black text-amber-900 mb-1">عدد القطع في الكرتونة</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchasePiecesPerCarton}
                    onChange={e => setPurchasePiecesPerCarton(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-black bg-white"
                  />
                </div>
                <div className="col-span-2 text-amber-900 font-bold">
                  سيتم إضافة: <strong>{Number(purchaseCartonsCount) * Number(purchasePiecesPerCarton)} قطعة</strong> لرصيد المخزن
                </div>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية الواردة (بالقطعة)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={purchaseQty}
                  onChange={e => setPurchaseQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">سعر شراء القطعة الواحدة (التكلفة)</label>
              <input
                type="number"
                step="0.25"
                required
                value={purchaseCost}
                onChange={e => setPurchaseCost(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
              />
            </div>

            {(() => {
              const effQty = purchaseByCarton
                ? Number(purchaseCartonsCount) * Number(purchasePiecesPerCarton)
                : Number(purchaseQty);
              const totalPurchase = effQty * Number(purchaseCost);
              return (
                <>
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex justify-between items-center font-bold text-amber-900">
                    <span>إجمالي فاتورة المشتريات ({effQty} قطعة):</span>
                    <span className="text-base font-black">{totalPurchase.toFixed(2)} ج.م</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">المبلغ المدفوع للمورد الآن (اتركه فارغاً لو مدفوع بالكامل)</label>
                    <input
                      type="number"
                      placeholder={`${totalPurchase.toFixed(2)}`}
                      value={purchasePaid}
                      onChange={e => setPurchasePaid(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                    />
                  </div>
                </>
              );
            })()}

            <div>
              <label className="block font-bold text-slate-700 mb-1">ملاحظات الفاتورة</label>
              <input
                type="text"
                value={purchaseNotes}
                onChange={e => setPurchaseNotes(e.target.value)}
                placeholder="مثال: توريد كراتين شيبسي وبضاعة جديدة"
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

      {/* Categories Management Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                إدارة وإضافة أقسام المكتبة والسوبر ماركت
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="text-slate-500 font-bold"
              >
                إغلاق ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                onSaveCategory?.({ name: newCatName.trim() });
                setNewCatName('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                required
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="اسم القسم الجديد (مثال: مشروبات، عطور، شيكولاتة، خردوات)..."
                className="flex-1 rounded-xl border-2 border-purple-300 focus:border-purple-600 px-3 py-2 font-bold outline-none"
              />
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white font-black px-4 py-2 rounded-xl flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                إضافة قسم
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
              {state.categories.map(cat => {
                const count = state.products.filter(p => p.category === cat.id).length;
                return (
                  <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-black text-slate-900 text-sm">{cat.name}</span>
                      <span className="text-[11px] text-slate-400 mr-2">({count} صنف)</span>
                    </div>
                    {count === 0 && (
                      <button
                        type="button"
                        onClick={() => onDeleteCategory?.(cat.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50"
                        title="حذف القسم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
