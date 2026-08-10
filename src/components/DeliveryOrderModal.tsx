import React, { useEffect } from 'react';
import { StockMovement, Product } from '../types';
import { toArabicNumerals } from '../lib/arabicUtils';
import { Printer, X, FileText } from 'lucide-react';

export interface DispatchItem {
  product: Product;
  quantity: number;
}

interface DeliveryOrderModalProps {
  movement?: StockMovement | null;
  items?: DispatchItem[];
  orderNumber?: string;
  recipientName?: string;
  recipientEntity?: string;
  onClose: () => void;
}

export const DeliveryOrderModal: React.FC<DeliveryOrderModalProps> = ({ movement, items = [], orderNumber, recipientName, recipientEntity, onClose }) => {
  if (!movement && (!items || items.length === 0)) return null;

  const handlePrint = () => {
    try {
      window.focus();
      setTimeout(() => {
        window.print();
      }, 50);
    } catch (e) {
      console.error('Print trigger error:', e);
      window.print();
    }
  };

  // Keyboard shortcut Ctrl + P handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formattedDate = toArabicNumerals(
    new Date(movement ? movement.timestamp : Date.now()).toLocaleString('ar-EG', {
      dateStyle: 'full',
      timeStyle: 'short',
    })
  );

  const displayItems: DispatchItem[] = items.length > 0
    ? items
    : movement
    ? [{
        product: {
          id: movement.productId,
          code: movement.productCode,
          name: movement.productName,
          stock: movement.newStock,
          unit: 'وحدة',
          minStock: 5,
        },
        quantity: movement.quantity,
      }]
    : [];

  const docNo = orderNumber
    ? orderNumber
    : movement?.referenceNo
    ? movement.referenceNo
    : '0001';

  // Recipient info resolution (unified single field "اسم المستلم / الجهة المستفيدة")
  const recipientInfo = recipientName || recipientEntity || (movement?.reason?.startsWith('أمر تسليم مخزن - المستلم:') ? movement.reason.replace('أمر تسليم مخزن - المستلم:', '').trim() : '') || movement?.operatorName || '..........................';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto space-y-6">
        
        {/* Controls Bar (no-print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900">معاينة وطباعة أمر تسليم مخزن</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة أمر تسليم المخزن</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE AREA */}
        <div className="printable print-area p-8 bg-white border-2 border-slate-900 rounded-xl text-[#0F172A] space-y-6" dir="rtl">
          
          {/* Document Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
            <div className="space-y-1">
              <h1 className="text-xl font-black text-slate-900 font-['Tajawal'] tracking-tight">شركة ناصر - أم درمان</h1>
              <h2 className="text-base font-bold text-slate-800 font-['Tajawal']">إدارة المخازن والمستودعات</h2>
              <p className="text-xs font-bold text-slate-600 font-mono flex items-center gap-1">
                <span>هاتف:</span>
                <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block', unicodeBidi: 'embed' }} className="font-sans font-bold">
                  &#x202A;0913247564&#x202C;
                </span>
              </p>
            </div>
            
            <div className="text-center bg-slate-900 text-white px-6 py-3 rounded-xl">
              <h2 className="text-xl font-black tracking-wide font-['Tajawal']">أمر تسليم مخزن</h2>
              <p className="text-xs font-mono text-blue-300 font-bold mt-0.5">رقم المستند التسلسلي: {toArabicNumerals(docNo)}</p>
            </div>
          </div>

          {/* Recipient & Date Meta Banner */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-extrabold">اسم المستلم / الجهة المستفيدة:</span>
              <strong className="text-slate-950 font-black text-sm border-b-2 border-slate-900 px-3 py-0.5 min-w-[200px] inline-block">
                {recipientInfo}
              </strong>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div>
                <span className="text-slate-500">تاريخ المستند: </span>
                <strong className="text-slate-900">{formattedDate}</strong>
              </div>
              <div>
                <span className="text-slate-500">إجمالي الأصناف: </span>
                <strong className="text-blue-700 font-mono text-sm">{toArabicNumerals(displayItems.length)} صنف</strong>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-2 border-slate-900 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-3 border-b border-slate-900 w-12 text-center">م</th>
                  <th className="p-3 border-b border-slate-900 w-40">الكود / Serial</th>
                  <th className="p-3 border-b border-slate-900">اسم الصنف</th>
                  <th className="p-3 border-b border-slate-900 text-center w-36 bg-blue-900 text-white">عدد الصنف (الكمية)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-bold text-slate-900">
                {displayItems.map((item, index) => (
                  <tr key={item.product.id || index}>
                    <td className="p-3 text-center font-mono">{index + 1}</td>
                    <td className="p-3 font-mono font-extrabold text-blue-900">{toArabicNumerals(item.product.code)}</td>
                    <td className="p-3 font-extrabold text-sm">{item.product.name}</td>
                    <td className="p-3 text-center font-mono font-black text-base bg-blue-50 text-blue-950">
                      {toArabicNumerals(item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures and Official Stamp Section */}
          <div className="pt-8 mt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-center text-xs">
            
            {/* 1. Recipient Signature */}
            <div className="space-y-2 flex flex-col justify-between">
              <span className="font-extrabold text-slate-900 block text-sm">توقيع المستلم / الجهة المستفيدة</span>
              <div className="text-[11px] font-extrabold text-slate-900 space-y-1">
                <div>الاسم / الجهة: <span className="font-black text-blue-950 underline underline-offset-4">{recipientInfo}</span></div>
              </div>
              <div className="border-b-2 border-dashed border-slate-400 w-4/5 mx-auto pb-1 text-slate-400 text-[11px] pt-2">
                ..........................................
              </div>
            </div>

            {/* 2. Storekeeper Signature */}
            <div className="space-y-3 flex flex-col justify-between">
              <span className="font-extrabold text-slate-900 block text-sm">توقيع أمين المخزن</span>
              <div className="text-[11px] font-extrabold text-slate-900">
                المسؤول: <span className="font-black text-slate-800">{movement?.operatorName || 'أمين المخزن المختص'}</span>
              </div>
              <div className="border-b-2 border-dashed border-slate-400 w-4/5 mx-auto pb-1 text-slate-400 text-[11px] pt-4">
                ..........................................
              </div>
            </div>

            {/* 3. Official Stamp Square */}
            <div className="flex flex-col items-center space-y-2">
              <span className="font-extrabold text-slate-900 block text-sm">الختم الرسمي لشركة ناصر</span>
              <div className="w-36 h-24 border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center text-[11px] text-slate-500 font-bold bg-slate-50 text-center p-2 leading-snug">
                الختم الرسمي لشركة ناصر
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Controls Bar (no-print) */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-100 flex items-center gap-2 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة أمر تسليم المخزن (إرسال للطابعة)</span>
          </button>
        </div>

      </div>
    </div>
  );
};

