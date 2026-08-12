import React, { useEffect } from 'react';
import { StockMovement, Product } from '../types';
import { toArabicNumerals } from '../lib/arabicUtils';
import { X, FileText } from 'lucide-react';

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
      window.print();
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

  // Recipient info resolution
  const recipientInfo = recipientName || recipientEntity || (movement?.reason?.startsWith('أمر تسليم مخزن - المستلم:') ? movement.reason.replace('أمر تسليم مخزن - المستلم:', '').trim() : '') || movement?.operatorName || '..........................';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border-2 border-black max-h-[95vh] overflow-y-auto space-y-6 text-black">
        
        {/* Controls Bar (no-print) */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black no-print">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-5 h-5 text-black" />
            <h3 className="text-base font-black text-black">معاينة وطباعة أمر تسليم مخزن</h3>
            <span className="text-xs bg-black text-white px-2.5 py-1 rounded-md font-mono font-bold mr-2">الطباعة عبر الاختصار (Ctrl + P)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-black hover:bg-slate-100 rounded-xl border border-black transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE AREA - STRICTLY PURE BLACK TEXT ON PURE WHITE BACKGROUND */}
        <div className="printable print-area p-8 bg-white border-2 border-black rounded-xl text-black space-y-6" dir="rtl" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          
          {/* Document Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-black">
            <div className="space-y-1">
              <h1 className="text-xl font-black text-black font-['Tajawal'] tracking-tight">شركة ناصر - أم درمان</h1>
              <h2 className="text-base font-black text-black font-['Tajawal']">إدارة المخازن والمستودعات</h2>
              <p className="text-xs font-black text-black font-mono flex items-center gap-1">
                <span>هاتف:</span>
                <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block', unicodeBidi: 'embed' }} className="font-sans font-black text-black">
                  &#x202A;0913247564&#x202C;
                </span>
              </p>
            </div>
            
            <div className="text-center bg-white text-black border-2 border-black px-6 py-3 rounded-xl">
              <h2 className="text-xl font-black tracking-wide font-['Tajawal'] text-black">أمر تسليم مخزن</h2>
              <p className="text-xs font-mono text-black font-black mt-0.5">رقم المستند التسلسلي: {toArabicNumerals(docNo)}</p>
            </div>
          </div>

          {/* Recipient & Date Meta Banner */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs font-black text-black">
            <div className="flex items-center gap-2">
              <span className="text-black font-black">اسم المستلم / الجهة المستفيدة:</span>
              <strong className="text-black font-black text-sm border-b-2 border-black px-3 py-0.5 min-w-[200px] inline-block">
                {recipientInfo}
              </strong>
            </div>
            <div className="flex items-center gap-4 text-xs font-black">
              <div>
                <span className="text-black">تاريخ المستند: </span>
                <strong className="text-black">{formattedDate}</strong>
              </div>
              <div>
                <span className="text-black">إجمالي الأصناف: </span>
                <strong className="text-black font-mono text-sm">{toArabicNumerals(displayItems.length)} صنف</strong>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-2 border-black rounded-xl overflow-hidden bg-white">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-white text-black font-black border-b-2 border-black">
                  <th className="p-3 border-l-2 border-b-2 border-black w-12 text-center text-black font-black">م</th>
                  <th className="p-3 border-l-2 border-b-2 border-black w-40 text-black font-black">الكود / Serial</th>
                  <th className="p-3 border-l-2 border-b-2 border-black text-black font-black">اسم الصنف</th>
                  <th className="p-3 border-b-2 border-black text-center w-36 text-black font-black">عدد الصنف (الكمية)</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black font-black text-black bg-white">
                {displayItems.map((item, index) => (
                  <tr key={item.product.id || index} className="border-b-2 border-black bg-white">
                    <td className="p-3 text-center font-mono border-l-2 border-black text-black font-black">{index + 1}</td>
                    <td className="p-3 font-mono font-black text-black border-l-2 border-black">{toArabicNumerals(item.product.code)}</td>
                    <td className="p-3 font-black text-sm text-black border-l-2 border-black">{item.product.name}</td>
                    <td className="p-3 text-center font-mono font-black text-base text-black bg-white">
                      {toArabicNumerals(item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures and Official Stamp Section */}
          <div className="pt-8 mt-6 border-t-2 border-black grid grid-cols-3 gap-6 text-center text-xs text-black">
            
            {/* 1. Recipient Signature */}
            <div className="space-y-2 flex flex-col justify-between">
              <span className="font-black text-black block text-sm">توقيع المستلم / الجهة المستفيدة</span>
              <div className="text-[11px] font-black text-black space-y-1">
                <div>الاسم / الجهة: <span className="font-black text-black underline underline-offset-4">{recipientInfo}</span></div>
              </div>
              <div className="border-b-2 border-dashed border-black w-4/5 mx-auto pb-1 text-black text-[11px] pt-2">
                ..........................................
              </div>
            </div>

            {/* 2. Storekeeper Signature */}
            <div className="space-y-3 flex flex-col justify-between">
              <span className="font-black text-black block text-sm">توقيع أمين المخزن</span>
              <div className="text-[11px] font-black text-black">
                المسؤول: <span className="font-black text-black">{movement?.operatorName || 'أمين المخزن المختص'}</span>
              </div>
              <div className="border-b-2 border-dashed border-black w-4/5 mx-auto pb-1 text-black text-[11px] pt-4">
                ..........................................
              </div>
            </div>

            {/* 3. Official Stamp Square */}
            <div className="flex flex-col items-center space-y-2">
              <span className="font-black text-black block text-sm">الختم الرسمي لشركة ناصر</span>
              <div className="w-36 h-24 border-2 border-dashed border-black rounded-xl flex items-center justify-center text-[11px] text-black font-black bg-white text-center p-2 leading-snug">
                الختم الرسمي لشركة ناصر
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Controls Bar (no-print) */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-black no-print">
          <span className="text-xs text-black font-bold font-mono">اضغط على (Ctrl + P) لإرسال المستند إلى الطابعة مباشرة</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-black border-2 border-black rounded-xl text-xs font-black transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};

