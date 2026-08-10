import React, { useState, useMemo } from 'react';
import { AuditLog, StockMovement } from '../types';
import { toArabicNumerals } from '../lib/arabicUtils';
import { DeliveryOrderModal } from './DeliveryOrderModal';
import {
  FileText,
  Boxes,
  ArrowDownRight,
  ArrowUpLeft,
  Search,
  CheckCircle,
  Calendar,
  User,
  ShieldCheck,
  Activity,
  ArrowRight,
  RefreshCw,
  Filter,
  Printer
} from 'lucide-react';

interface LogsViewProps {
  movements?: StockMovement[];
  logs?: AuditLog[];
  onBack?: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({
  movements = [],
  logs = [],
  onBack,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'MOVEMENTS' | 'AUDIT'>('MOVEMENTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [selectedDeliveryOrder, setSelectedDeliveryOrder] = useState<StockMovement | null>(null);

  // Metrics for movements
  const totalInCount = useMemo(() => {
    return movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0);
  }, [movements]);

  const totalOutCount = useMemo(() => {
    return movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0);
  }, [movements]);

  // Filtered Stock Movements
  const filteredMovements = useMemo(() => {
    let list = movements;
    if (movementTypeFilter !== 'ALL') {
      list = list.filter(m => m.type === movementTypeFilter);
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      m =>
        m.productName.toLowerCase().includes(term) ||
        m.productCode.toLowerCase().includes(term) ||
        (m.reason && m.reason.toLowerCase().includes(term)) ||
        (m.operatorName && m.operatorName.toLowerCase().includes(term)) ||
        (m.referenceNo && m.referenceNo.toLowerCase().includes(term))
    );
  }, [movements, searchTerm, movementTypeFilter]);

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(
      l =>
        l.username.toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term) ||
        l.details.toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* Top Metrics Cards for Movements */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي حركات التوريد (+)</span>
            <span className="text-2xl font-black text-emerald-700 font-mono">
              +{toArabicNumerals(totalInCount)} <span className="text-xs text-slate-500 font-sans">وحدة</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي حركات الصرف (-)</span>
            <span className="text-2xl font-black text-rose-700 font-mono">
              -{toArabicNumerals(totalOutCount)} <span className="text-xs text-slate-500 font-sans">وحدة</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowUpLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">إجمالي حركات المخزن المسجلة</span>
            <span className="text-2xl font-black text-blue-700 font-mono">
              {toArabicNumerals(movements.length)} <span className="text-xs text-slate-500 font-sans">حركة</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Header & Tabs Toggle */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Toggle View Mode */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
              title="زر رجوع للنافذة السابقة"
            >
              <ArrowRight className="w-4 h-4" />
              <span>زر رجوع</span>
            </button>
          )}

          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setActiveSubTab('MOVEMENTS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'MOVEMENTS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>سجل التوريد والتصريف</span>
            </button>

            <button
              onClick={() => setActiveSubTab('AUDIT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'AUDIT'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>سجل الأمان والنظام</span>
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {activeSubTab === 'MOVEMENTS' && (
            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 shrink-0"
            >
              <option value="ALL">جميع الحركات</option>
              <option value="IN">التوريد (+)</option>
              <option value="OUT">الصرف (-)</option>
            </select>
          )}

          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeSubTab === 'MOVEMENTS' ? 'بحث برقم الإذن، اسم الصنف، السبب، أو مسؤول المخزن...' : 'بحث بمسؤول الحركة أو البيان...'}
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600 font-bold"
            />
          </div>
        </div>

      </div>

      {/* Content Table based on Active Tab */}
      {activeSubTab === 'MOVEMENTS' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-[#0F172A] text-white flex items-center justify-between">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-400" />
              <span>سجل حركات التوريد والتصريف المخزنية التفصيلي</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              عرض {toArabicNumerals(filteredMovements.length)} من إجمالي {toArabicNumerals(movements.length)} حركة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">نوع الحركة</th>
                  <th className="p-3.5">اسم الصنف بالمخزن</th>
                  <th className="p-3.5">عدد الوحدات</th>
                  <th className="p-3.5 font-mono">الرصيد (سابق → جديد)</th>
                  <th className="p-3.5">البيان / السبب</th>
                  <th className="p-3.5">رقم المستند</th>
                  <th className="p-3.5">مسؤول المخزن</th>
                  <th className="p-3.5 text-center">أمر التسليم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <Boxes className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm text-slate-600">لا توجد حركات مخزنية مسجلة تطابق البحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mvt) => {
                    const isIn = mvt.type === 'IN';
                    return (
                      <tr key={mvt.id} className="hover:bg-slate-50 transition-colors">
                        
                        {/* Timestamp */}
                        <td className="p-3.5 text-slate-600 text-[11px]">
                          {toArabicNumerals(
                            new Date(mvt.timestamp).toLocaleString('ar-EG', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          )}
                        </td>

                        {/* Movement Badge */}
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {isIn ? (
                              <>
                                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>توريد (+)</span>
                              </>
                            ) : (
                              <>
                                <ArrowUpLeft className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>صرف (-)</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* Product Name */}
                        <td className="p-3.5">
                          <p className="font-extrabold text-slate-900 text-sm">{mvt.productName}</p>
                          <span className="text-[10px] font-mono text-slate-500">كود: {toArabicNumerals(mvt.productCode)}</span>
                        </td>

                        {/* Quantity */}
                        <td className="p-3.5 font-black font-mono text-sm">
                          <span className={isIn ? 'text-emerald-700' : 'text-rose-700'}>
                            {isIn ? '+' : '-'}{toArabicNumerals(mvt.quantity)} وحدة
                          </span>
                        </td>

                        {/* Stock Change */}
                        <td className="p-3.5 font-mono text-xs text-slate-700">
                          <span className="text-slate-500">{toArabicNumerals(mvt.previousStock)}</span>
                          <span className="mx-1 text-slate-400">←</span>
                          <strong className="text-slate-900 font-extrabold">{toArabicNumerals(mvt.newStock)}</strong>
                        </td>

                        {/* Reason */}
                        <td className="p-3.5 font-bold text-slate-800 max-w-xs">
                          {mvt.reason || 'إجراء مخزني'}
                        </td>

                        {/* Document Reference */}
                        <td className="p-3.5 font-mono text-slate-600 font-bold">
                          {mvt.referenceNo ? toArabicNumerals(mvt.referenceNo) : '—'}
                        </td>

                        {/* Operator Name */}
                        <td className="p-3.5 text-slate-700 font-bold">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                            {mvt.operatorName}
                          </span>
                        </td>

                        {/* Delivery Order Print Action */}
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedDeliveryOrder(mvt)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer shadow-xs"
                            title="معاينة وطباعة أمر التسليم الرسمي المكتوب عليه عدد الوحدات"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>أمر التسليم</span>
                          </button>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* AUDIT LOGS TABLE */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-[#0F172A] text-white flex items-center justify-between">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>سجل الحركة الإدارية والأمان للنظام</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              عرض {toArabicNumerals(filteredLogs.length)} من إجمالي {toArabicNumerals(logs.length)} سجل
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">اسم الموظف / الحساب</th>
                  <th className="p-3.5">الإجراء المتخذ</th>
                  <th className="p-3.5">التفاصيل الكاملة</th>
                  <th className="p-3.5 text-center">نوع السجل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm text-slate-600">لا توجد سجلات أمان مطابقة للبحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 text-slate-600 text-[11px] font-mono">
                        {toArabicNumerals(
                          new Date(log.timestamp).toLocaleString('ar-EG', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">{log.username}</td>
                      <td className="p-3.5 font-extrabold text-blue-800">{log.action}</td>
                      <td className="p-3.5 text-slate-700">{log.details}</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.type === 'SECURITY'
                              ? 'bg-rose-100 text-rose-800'
                              : log.type === 'MOVEMENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DELIVERY ORDER PRINT MODAL */}
      <DeliveryOrderModal
        movement={selectedDeliveryOrder}
        onClose={() => setSelectedDeliveryOrder(null)}
      />

    </div>
  );
};
