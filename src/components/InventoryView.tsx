import React, { useState, useMemo, useEffect } from 'react';
import { Product, User, StockMovement } from '../types';
import { SmartSearchBar } from './SmartSearchBar';
import { searchAndRank, toArabicNumerals } from '../lib/arabicUtils';
import { DeliveryOrderModal, DispatchItem } from './DeliveryOrderModal';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ArrowRight,
  X,
  Sparkles,
  Printer,
  FileText,
  ShoppingCart,
  Minus,
  Check,
  Building,
  User as UserIcon
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  currentUser: User | null;
  movements?: StockMovement[];
  onAddProduct: (product: Partial<Product>) => Promise<{ success: boolean; message?: string }>;
  onBatchAddProducts?: (items: Array<{ code?: string; name: string; stock: number; category?: string; minStock?: number; unit?: string; description?: string }>) => Promise<{ success: boolean; count?: number; message?: string }>;
  onUpdateProduct: (id: string, product: Partial<Product>) => Promise<{ success: boolean; message?: string }>;
  onDeleteProduct: (id: string) => Promise<{ success: boolean; message?: string }>;
  onStockMovement: (movement: {
    productId: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reason: string;
    referenceNo?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  onBack?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  currentUser,
  movements = [],
  onAddProduct,
  onBatchAddProducts,
  onUpdateProduct,
  onDeleteProduct,
  onStockMovement,
  onBack,
}) => {
  const isGeneralManager = currentUser?.role === 'GENERAL_MANAGER';
  const [searchTerm, setSearchTerm] = useState('');

  // Product Add / Edit Modal & Dedicated Standalone Batch Screen
  const [isBatchAddMode, setIsBatchAddMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [stock, setStock] = useState<string>('0');
  const [minStock, setMinStock] = useState<string>('5');

  // Interactive Table Grid State for Excel Copy-Paste & Batch Add
  const [gridRows, setGridRows] = useState<Array<{ id: string; code: string; name: string; stock: string }>>([]);
  const [pasteMessage, setPasteMessage] = useState('');

  // Side Cart for "أمر تسليم مخزن"
  const [cartItems, setCartItems] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientEntity, setRecipientEntity] = useState<string>('');
  const [customOrderNo, setCustomOrderNo] = useState<string>('');
  const [activeDeliveryItems, setActiveDeliveryItems] = useState<DispatchItem[] | null>(null);
  const [activeDeliveryOrderNo, setActiveDeliveryOrderNo] = useState<string>('');
  const [activeRecipientName, setActiveRecipientName] = useState<string>('');
  const [activeRecipientEntity, setActiveRecipientEntity] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Keyboard shortcut Ctrl + P handler to trigger delivery order print with mandatory field validation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        // If the delivery order modal is already open, let the modal handle it
        if (activeDeliveryItems && activeDeliveryItems.length > 0) {
          return;
        }

        e.preventDefault();
        if (cartItems.length === 0) {
          alert('💡 تنبيه: سلة أمر التسليم فارغة حالياً.\n\nخطوات الطباعة:\n1. انقر على الصنف المراد تسليمه لإضافته إلى السلة.\n2. اكتب "اسم المستلم / الجهة المستفيدة".\n3. اضغط على زر "إتمام وطباعة أمر تسليم مخزن" أو اختصار (Ctrl + P).');
          return;
        }
        if (!recipientName.trim()) {
          alert('⚠️ تنبيه هام: يرجى كتابة "اسم المستلم / الجهة المستفيدة" في الحقل المخصص بالسلة قبل طباعة أمر تسليم المخزن.');
          return;
        }
        handleCompleteDeliveryOrder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, recipientName, activeDeliveryItems]);

  // Key Inventory Metrics
  const metrics = useMemo(() => {
    const totalItems = products.length;
    const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
    return { totalItems, totalUnits };
  }, [products]);

  // Filter products using Arabic Smart Search Engine
  const filteredProducts = useMemo(() => {
    return searchAndRank(products, searchTerm, (p: Product) => [p.name, p.code]);
  }, [products, searchTerm]);

  // Direct Click-to-Add to Side Delivery Cart
  const handleToggleProductCart = (product: Product) => {
    const liveProd = products.find(p => p.id === product.id) || product;
    if (liveProd.stock <= 0) {
      alert(`عفواً، الصنف (${liveProd.name}) غير متوفر بالمخزن حالياً (الرصيد المتاح: 0).`);
      return;
    }

    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= liveProd.stock) {
          alert(`تنبيه: الرصيد المتاح من (${liveProd.name}) هو ${liveProd.stock} قطعة فقط. لا يمكن تجاوز هذا الرصيد.`);
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, product: liveProd }
            : item
        );
      } else {
        return [...prev, { product: liveProd, quantity: 1 }];
      }
    });
  };

  const handleUpdateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    const liveProd = products.find(p => p.id === productId);
    const maxStock = liveProd ? liveProd.stock : 0;

    if (newQty > maxStock) {
      alert(`عفواً، الرصيد المتاح بالمخزن للصنف (${liveProd?.name || ''}) هو ${maxStock} قطعة فقط! لا يمكن طلب ${newQty} قطعة.`);
      newQty = maxStock;
    }

    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: newQty, product: liveProd || item.product }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Sequential Delivery Order Number Generator starting from 1 (1, 2, 3, 4...)
  const getNextDeliveryOrderNo = (): string => {
    let maxSeq = 0; // Starts at 0 so first document is 1

    // Check stored sequence counter in localStorage
    try {
      const savedSeq = localStorage.getItem('nasser_last_delivery_order_seq_v2');
      if (savedSeq) {
        const parsedSeq = parseInt(savedSeq, 10);
        if (!isNaN(parsedSeq) && parsedSeq > maxSeq) {
          maxSeq = parsedSeq;
        }
      }
    } catch (e) {
      // ignore
    }

    const allMovements = movements || [];
    let savedMovements: StockMovement[] = [];
    try {
      const raw = localStorage.getItem('nasser_warehouse_movements_v1');
      if (raw) savedMovements = JSON.parse(raw);
    } catch (e) {
      // ignore
    }

    const combined = [...allMovements, ...savedMovements];

    combined.forEach(m => {
      if (m.referenceNo) {
        const match = m.referenceNo.match(/\d+/g);
        if (match) {
          const val = parseInt(match.join(''), 10);
          if (!isNaN(val) && val > maxSeq) {
            maxSeq = val;
          }
        }
      }
    });

    return String(maxSeq + 1);
  };

  // Complete Order & Print Delivery Order Document
  const handleCompleteDeliveryOrder = async () => {
    if (cartItems.length === 0) return;
    if (!recipientName.trim()) {
      alert('تنبيه هام: يرجى كتابة اسم المستلم / الجهة المستفيدة قبل طباعة أمر تسليم المخزن.');
      return;
    }

    // Pre-flight validation: check all cart items against current stock
    for (const item of cartItems) {
      const liveProd = products.find(p => p.id === item.product.id);
      const available = liveProd ? liveProd.stock : item.product.stock;
      if (item.quantity > available) {
        alert(`خطأ في العملية: الكمية المطلوبة للصنف (${item.product.name}) هي ${item.quantity} ولكن الرصيد المتاح هو ${available} فقط! يرجى تعديل الكمية أولاً.`);
        return;
      }
      if (available <= 0) {
        alert(`خطأ في العملية: الصنف (${item.product.name}) غير متوفر بالمخزن (الرصيد: 0). يرجى إزالته من القائمة.`);
        return;
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const dispatchItemsToPrint: DispatchItem[] = [];
      const finalOrderNo = getNextDeliveryOrderNo();

      // Persist generated order sequence number immediately
      const numVal = parseInt(finalOrderNo, 10);
      if (!isNaN(numVal)) {
        try {
          const currentSeq = parseInt(localStorage.getItem('nasser_last_delivery_order_seq_v2') || '0', 10);
          if (numVal >= currentSeq) {
            localStorage.setItem('nasser_last_delivery_order_seq_v2', String(numVal));
          }
        } catch (e) {
          // ignore
        }
      }

      for (const item of cartItems) {
        const res = await onStockMovement({
          productId: item.product.id,
          type: 'OUT',
          quantity: item.quantity,
          reason: `أمر تسليم مخزن - المستلم: ${recipientName.trim()}`,
          referenceNo: finalOrderNo,
        });

        if (res && res.success === false) {
          const errMsg = res.message || `خطأ أثناء صرف الصنف (${item.product.name})`;
          setFormError(errMsg);
          alert(`فشلت العملية: ${errMsg}`);
          return;
        }

        dispatchItemsToPrint.push({
          product: item.product,
          quantity: item.quantity,
        });
      }

      setActiveDeliveryOrderNo(finalOrderNo);
      setActiveRecipientName(recipientName.trim());
      setActiveDeliveryItems(dispatchItemsToPrint);
      setCartItems([]);
      setRecipientName('');
      setCustomOrderNo('');
    } catch (err: any) {
      setFormError('حدث خطأ أثناء توليد أمر تسليم المخزن');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-generate sequential product code
  const generateNextCode = (productsList: Product[]) => {
    if (!productsList || productsList.length === 0) return '101';
    let maxNum = 100;
    productsList.forEach(p => {
      const match = p.code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return String(maxNum + 1);
  };

  const getMaxNumericCode = () => {
    let maxNum = 100;
    products.forEach(p => {
      const match = p.code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return maxNum;
  };

  // Open Add Product Modal
  const openAddModal = () => {
    if (!isGeneralManager) {
      alert('عفواً، خيارات إضافة الأصناف هي صلاحيات حصرية للمدير العام (الحساب الرئيسي) فقط.');
      return;
    }
    setEditingProduct(null);
    setCode(generateNextCode(products));
    setName('');
    setStock('0');
    setMinStock('5');
    setFormError('');
    setPasteMessage('');
    
    // Default 5 empty rows for batch view
    const startNum = getMaxNumericCode();
    setGridRows([
      { id: '1', code: String(startNum + 1), name: '', stock: '1' },
      { id: '2', code: String(startNum + 2), name: '', stock: '1' },
      { id: '3', code: String(startNum + 3), name: '', stock: '1' },
      { id: '4', code: String(startNum + 4), name: '', stock: '1' },
      { id: '5', code: String(startNum + 5), name: '', stock: '1' },
    ]);

    setIsBatchAddMode(true);
  };

  // Process Excel Paste Text
  const processPastedText = (text: string) => {
    if (!text || !text.trim()) return;

    const lines = text.trim().split(/\r\n|\n|\r/);
    if (lines.length === 0) return;

    let currentCodeNum = getMaxNumericCode();
    gridRows.forEach(r => {
      const match = r.code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > currentCodeNum) currentCodeNum = num;
      }
    });

    const parsedRows: Array<{ id: string; code: string; name: string; stock: string }> = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      const columns = line.split('\t').map(c => c.trim());

      let rowName = '';
      let rowStock = '1';
      let rowCode = '';

      if (columns.length >= 2) {
        if (/^\d+$/.test(columns[0]) && columns[1]) {
          rowCode = columns[0];
          rowName = columns[1];
          if (columns[2] && /^\d+$/.test(columns[2])) {
            rowStock = columns[2];
          }
        } else {
          rowName = columns[0];
          if (/^\d+$/.test(columns[1])) {
            rowStock = columns[1];
          } else {
            rowName = `${columns[0]} ${columns[1]}`;
          }
        }
      } else {
        rowName = columns[0];
      }

      if (!rowCode) {
        currentCodeNum += 1;
        rowCode = String(currentCodeNum);
      }

      if (rowName) {
        parsedRows.push({
          id: `paste_${Date.now()}_${Math.random()}`,
          code: rowCode,
          name: rowName,
          stock: rowStock,
        });
      }
    });

    if (parsedRows.length > 0) {
      setGridRows(prev => {
        const existingValid = prev.filter(r => r.name.trim().length > 0);
        return [...existingValid, ...parsedRows];
      });
      setPasteMessage(`تم لصق وتنسيق (${parsedRows.length}) صنف بنجاح من إكسل!`);
      setTimeout(() => setPasteMessage(''), 4000);
    }
  };

  // Add Row to Grid
  const handleAddGridRow = () => {
    setGridRows(prev => {
      let maxNum = getMaxNumericCode();
      prev.forEach(r => {
        const match = r.code.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      return [
        ...prev,
        { id: `row_${Date.now()}`, code: String(maxNum + 1), name: '', stock: '1' }
      ];
    });
  };

  const handleAddFiveGridRows = () => {
    setGridRows(prev => {
      let maxNum = getMaxNumericCode();
      prev.forEach(r => {
        const match = r.code.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const newFive = [];
      for (let i = 1; i <= 5; i++) {
        newFive.push({
          id: `row_${Date.now()}_${Math.random()}_${i}`,
          code: String(maxNum + i),
          name: '',
          stock: '1',
        });
      }
      return [...prev, ...newFive];
    });
  };

  const handleGridCellChange = (id: string, field: 'code' | 'name' | 'stock', value: string) => {
    setGridRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRemoveGridRow = (id: string) => {
    setGridRows(prev => prev.filter(r => r.id !== id));
  };

  // Save Batch Products
  const handleConfirmBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validRows = gridRows.filter(r => r.name.trim().length > 0);
    if (validRows.length === 0) {
      setFormError('يرجى كتابة اسم صنف واحد على الأقل قبل الحفظ');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsToSave = validRows.map(r => ({
        code: r.code.trim() || generateNextCode(products),
        name: r.name.trim(),
        stock: parseInt(r.stock, 10) || 0,
        category: 'عام',
        minStock: 5,
        unit: 'وحدة',
      }));

      if (onBatchAddProducts) {
        const res = await onBatchAddProducts(itemsToSave);
        if (res.success) {
          setIsBatchAddMode(false);
          setIsModalOpen(false);
        } else {
          setFormError(res.message || 'فشلت عملية حفظ الأصناف بالمخزن');
        }
      } else {
        for (const item of itemsToSave) {
          await onAddProduct(item);
        }
        setIsBatchAddMode(false);
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setFormError('حدث خطأ أثناء حفظ الأصناف بالمخزن');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Product Modal
  const openEditModal = (product: Product) => {
    if (!isGeneralManager) {
      alert('عفواً، خيارات تعديل بيانات الأصناف هي صلاحيات حصرية للمدير العام (الحساب الرئيسي) فقط.');
      return;
    }
    setEditingProduct(product);
    setCode(product.code);
    setName(product.name);
    setStock(String(product.stock));
    setMinStock(String(product.minStock || 5));
    setFormError('');
    setIsModalOpen(true);
  };

  // Save Edit Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGeneralManager) {
      setFormError('عفواً، خيارات تعديل الأصناف هي صلاحيات حصرية للمدير العام فقط.');
      return;
    }
    setFormError('');

    if (!name.trim()) {
      setFormError('يرجى كتابة اسم الصنف');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        const res = await onUpdateProduct(editingProduct.id, {
          code: code.trim(),
          name: name.trim(),
          stock: Math.max(0, parseInt(stock, 10) || 0),
          minStock: Math.max(1, parseInt(minStock, 10) || 5),
        });
        if (res.success) {
          setIsModalOpen(false);
        } else {
          setFormError(res.message || 'فشلت عملية تحديث الصنف');
        }
      }
    } catch (err: any) {
      setFormError('حدث خطأ في النظام');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProductConfirm = async (id: string, nameStr: string) => {
    if (!isGeneralManager) {
      alert('عفواً، خيارات حذف الأصناف هي صلاحيات حصرية للمدير العام (الحساب الرئيسي) فقط.');
      return;
    }
    if (window.confirm(`هل أنت تأكد من إزالة الصنف "${nameStr}" نهائياً من المخزن؟`)) {
      await onDeleteProduct(id);
    }
  };

  if (isBatchAddMode) {
    return (
      <div
        className="space-y-6 animate-fadeIn pb-12"
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text && text.trim()) {
            processPastedText(text);
          }
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsBatchAddMode(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-blue-600" />
              <span>العودة إلى جدول الجرد والمخزن</span>
            </button>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />
                <span>شاشة إضافة أصناف وتوريدات جديدة للمخزن</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                إدخال أصناف بدون أسعار - ترقيم الأكواد أوتوماتيكياً - دعم اللصق المباشر من Excel (Ctrl + V)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBatchAddMode(false)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>إلغاء الخروج</span>
          </button>
        </div>

        {formError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-800 font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {pasteMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{pasteMessage}</span>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-extrabold text-blue-950 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span>منطقة اللصق السريع المباشر من إكسل (Ctrl + V)</span>
            </label>
            <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg font-bold">
              نسخ العمود الأول (الاسم) والعمود الثاني (الكمية)
            </span>
          </div>
          <textarea
            rows={3}
            placeholder="اضغط (Ctrl + V) هنا في هذه المنطقة أو في أي مكان بالشاشة لصق بيانات جدول الإكسل المنسوخ وسيقوم النظام بتنسيقها وتوزيع الخانات تلقائياً..."
            onChange={(e) => {
              if (e.target.value) {
                processPastedText(e.target.value);
                e.target.value = '';
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text && text.trim()) {
                e.preventDefault();
                processPastedText(text);
              }
            }}
            className="w-full p-3.5 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner resize-none"
          />
        </div>

        <form onSubmit={handleConfirmBatchAdd} className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0F172A] text-white font-extrabold text-xs sm:text-sm border-b border-slate-800">
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5 w-44 sm:w-52">الكود / Serial Number (تلقائي ومحمي)</th>
                    <th className="p-3.5">اسم الصنف بالكامل</th>
                    <th className="p-3.5 w-32 sm:w-40 text-center">العدد / الكمية</th>
                    <th className="p-3.5 w-16 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {gridRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 font-bold">
                        لا توجد أصناف بالجدول. اضغط إضافة صفوف جديدة أو قم باللصق من Excel.
                      </td>
                    </tr>
                  ) : (
                    gridRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-center text-slate-400 font-extrabold text-xs">{idx + 1}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={row.code}
                            placeholder="1001"
                            title="يتم توليد السيريال نمبر تلقائياً وغير قابل للتعديل اليدوي"
                            className="w-full px-3 py-2 border border-slate-300 bg-slate-100 rounded-xl font-mono font-black text-slate-700 text-center text-xs sm:text-sm cursor-not-allowed select-none shadow-inner"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleGridCellChange(row.id, 'name', e.target.value)}
                            placeholder="اكتب اسم الصنف هنا..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs sm:text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-xs"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            value={row.stock}
                            onChange={(e) => handleGridCellChange(row.id, 'stock', e.target.value)}
                            placeholder="1"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-black text-blue-700 text-center text-xs sm:text-sm focus:border-blue-600 focus:outline-none shadow-xs"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveGridRow(row.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                            title="حذف هذا الصف"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddGridRow}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>إضافة صف جديد (+)</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddFiveGridRows}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>إضافة 5 صفوف جديدة (+5)</span>
                </button>
              </div>

              <div className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                إجمالي الأصناف المعروضة بالجدول: <span className="font-mono text-blue-700 text-sm font-black">{gridRows.length}</span> صنف
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || gridRows.length === 0}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-base font-extrabold shadow-lg shadow-emerald-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>{isSubmitting ? 'جاري حفظ الأصناف بالرصيد...' : 'تأكيد الإضافة إلى المخزن'}</span>
            </button>
          </div>

        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Executive KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي الأصناف المسجلة بالمخزن</span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono">
              {toArabicNumerals(metrics.totalItems)} <span className="text-xs text-slate-500 font-sans">صنف</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي القطع والوحدات بالمخزن</span>
            <span className="text-2xl font-extrabold text-emerald-700 font-mono">
              {toArabicNumerals(metrics.totalUnits)} <span className="text-xs text-slate-500 font-sans">قطعة / وحدة</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Package className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* SPLIT VIEW LAYOUT: Main Table (Right/Center) + Side Delivery Cart Panel (Left) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        
        {/* MAIN SECTION: Product Search & Table (2 cols on Desktop) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Top Header Controls: Smart Search + Add Product */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex-1">
              <SmartSearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                totalResultsCount={filteredProducts.length}
              />
            </div>

            {isGeneralManager && (
              <button
                onClick={openAddModal}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-200 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف جديد</span>
              </button>
            )}
          </div>

          {/* Product List Table with Direct Click-to-Add Behavior */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-400" />
                <span>قائمة أصناف المخزن المتاحة (الضغط على أي صنف يُضيفه مباشرة للسند)</span>
              </span>
              <span className="text-[11px] font-mono text-slate-300">
                {toArabicNumerals(filteredProducts.length)} صنف
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200 text-xs">
                    <th className="p-3.5 w-40 font-mono">الكود / Serial</th>
                    <th className="p-3.5">اسم الصنف</th>
                    <th className="p-3.5 w-32 text-center bg-blue-50/70">عدد الصنف (الكمية)</th>
                    {isGeneralManager && (
                      <th className="p-3.5 w-28 text-center">إجراءات (تعديل / حذف)</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={isGeneralManager ? 4 : 3} className="p-12 text-center text-slate-400">
                        <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-600" />
                        <p className="font-bold text-sm text-slate-700">لا توجد أصناف مخزنية تطابق البحث</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const inCart = cartItems.find(item => item.product.id === product.id);
                      const isOutOfStock = product.stock <= 0;

                      return (
                        <tr
                          key={product.id}
                          onClick={() => handleToggleProductCart(product)}
                          className={`transition-all cursor-pointer select-none ${
                            inCart
                              ? 'bg-emerald-50/90 border-r-4 border-r-emerald-600 font-bold'
                              : 'hover:bg-blue-50/60'
                          }`}
                        >
                          {/* Code / Serial */}
                          <td className="p-3.5 font-mono font-black text-blue-900 text-xs sm:text-sm">
                            {toArabicNumerals(product.code)}
                          </td>

                          {/* Item Name */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              {inCart && (
                                <span className="bg-emerald-600 text-white p-0.5 rounded-full shrink-0">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                              <p className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">
                                {product.name}
                              </p>
                            </div>
                          </td>

                          {/* Item Quantity / Count */}
                          <td className="p-3.5 text-center font-black font-mono text-sm sm:text-base bg-blue-50/30">
                            <span className={isOutOfStock ? 'text-rose-600' : 'text-slate-900'}>
                              {toArabicNumerals(product.stock)} <span className="text-[11px] font-sans text-slate-500">{product.unit || 'وحدة'}</span>
                            </span>
                          </td>

                          {/* Actions: Edit & Delete (General Manager only) */}
                          {isGeneralManager && (
                            <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(product);
                                  }}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer border border-blue-200"
                                  title="تعديل الصنف"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProductConfirm(product.id, product.name);
                                  }}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer border border-rose-200"
                                  title="حذف الصنف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* SIDE PANEL: Delivery Order Cart Preview (1 col on Desktop) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6 flex flex-col min-h-[500px]">
            
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base">معاينة "أمر تسليم مخزن"</h3>
              </div>
              
              {cartItems.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-rose-300 hover:text-rose-100 font-bold transition flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>تفريغ</span>
                </button>
              )}
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-bold border-b border-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Added Items List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 max-h-[420px]">
              {cartItems.length === 0 ? (
                <div className="h-full py-16 text-center space-y-3 flex flex-col items-center justify-center text-slate-400">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <ShoppingCart className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-extrabold text-xs text-slate-700 max-w-xs">
                    لم يتم اختيار أصناف بعد
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    اضغط مباشرة على أي صنف من القائمة لإضافته فوراً إلى السند الجانبي.
                  </p>
                </div>
              ) : (
                cartItems.map(({ product, quantity }, idx) => (
                  <div
                    key={product.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl space-y-2 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-md">
                          كود: {toArabicNumerals(product.code)}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900 leading-snug">
                          {idx + 1}. {product.name}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(product.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="حذف من السند"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Control Input */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] font-bold text-slate-600">العدد (الكمية):</span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, quantity - 1)}
                          className="w-7 h-7 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center justify-center text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={quantity || ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              handleUpdateCartQuantity(product.id, 0);
                            } else {
                              const parsed = parseInt(raw, 10);
                              if (!isNaN(parsed) && parsed > 0) {
                                handleUpdateCartQuantity(product.id, parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (quantity <= 0) {
                              handleUpdateCartQuantity(product.id, 1);
                            }
                          }}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-black text-center text-xs focus:border-blue-600 focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, (quantity || 0) + 1)}
                          className="w-7 h-7 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center justify-center text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Primary Confirm & Print Action Button */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              {/* Recipient Input & Order Serial Number */}
              <div className="space-y-3">
                {/* Document Serial Number Field (Locked Official Sequential Number) */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>رقم المستند التسلسلي (تلقائي غير قابل للتعديل):</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-black">
                      تسلسلي رسمي
                    </span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={getNextDeliveryOrderNo()}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-black text-blue-950 cursor-not-allowed select-none shadow-inner"
                  />
                </div>

                {/* Recipient Name Field */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>اسم المستلم / الجهة المستفيدة (إجباري للطباعة):</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="أدخل اسم الشخص أو الجهة المستفيدة..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>إجمالي الأصناف المحددة:</span>
                <strong className="text-blue-800 font-mono text-sm">{toArabicNumerals(cartItems.length)} صنف</strong>
              </div>

              {!recipientName.trim() && cartItems.length > 0 && (
                <p className="text-[11px] font-extrabold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 text-center">
                  ⚠️ يجب تعبئة اسم المستلم / الجهة المستفيدة لتفعيل زر الطباعة
                </p>
              )}

              <button
                type="button"
                disabled={isSubmitting || cartItems.length === 0 || !recipientName.trim()}
                onClick={handleCompleteDeliveryOrder}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-100 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري التوليد...' : 'طباعة أمر تسليم المخزن'}</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* SINGLE ITEM EDIT PRODUCT MODAL */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <span>تعديل بيانات الصنف المخزني</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">الكود / Serial Number</label>
                  <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    تلقائي ومحمي - غير قابل للتعديل
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={code}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-slate-100 rounded-xl font-mono font-black text-slate-700 cursor-not-allowed select-none shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف بالكامل</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد المتاح بالمخزن</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={stock}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 0) {
                      setStock('0');
                    } else {
                      setStock(String(val));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تحديث بيانات الصنف</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* AUTOMATIC DELIVERY ORDER PRINT PREVIEW MODAL */}
      <DeliveryOrderModal
        movement={null}
        items={activeDeliveryItems || undefined}
        orderNumber={activeDeliveryOrderNo}
        recipientName={activeRecipientName}
        recipientEntity={activeRecipientEntity}
        onClose={() => {
          setActiveDeliveryItems(null);
          setActiveDeliveryOrderNo('');
          setActiveRecipientName('');
          setActiveRecipientEntity('');
        }}
      />

    </div>
  );
};
