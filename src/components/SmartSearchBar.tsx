import React from 'react';
import { Search, X } from 'lucide-react';
import { toArabicNumerals } from '../lib/arabicUtils';

interface SmartSearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  placeholder?: string;
  totalResultsCount?: number;
}

export const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  placeholder = 'ابحث بكود أو اسم المنتج بالبحث المباشر...',
  totalResultsCount,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4 mb-4 no-print transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
      <div className="flex items-center gap-3">
        
        {/* Main Smart Search Input Field - Sole Primary Entry Point */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-blue-600">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="w-full pr-11 pl-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 font-medium transition-all shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
              title="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Count Badge */}
        {totalResultsCount !== undefined && (
          <div className="bg-blue-50 text-blue-800 border border-blue-200 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shrink-0 shadow-xs">
            <span>عدد النتائج:</span>
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md font-mono text-xs font-extrabold">
              {toArabicNumerals(totalResultsCount)}
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

