import React, { useState } from 'react';
import { generatePySideScript } from '../lib/pysideScriptGenerator';
import { Download, Copy, Check, Monitor, Terminal, FileCode, HardDrive } from 'lucide-react';

export const DesktopAppTab: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const pythonScript = generatePySideScript();

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([pythonScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nasser_company_app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-950 text-white p-6 rounded-2xl shadow-lg border border-blue-900 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-extrabold font-['Tajawal']">
              تطبيق سطح المكتب المباشر لنظام الويندوز (Windows .exe)
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            كود برمجية بايثون المتكامل بـ PySide6 وقاعدة بيانات SQLite المستقلة تماماً يعمل أوفلاين 100%. يمكنك تنزيله وبنائه إلى ملف .exe لتشغيله مباشرة على أجهزة الشركة بدون إنترنت.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم النسخ!' : 'نسخ الكود الكامل'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-900 transition"
          >
            <Download className="w-4 h-4" />
            <span>تحميل سكريبت (nasser_app.py)</span>
          </button>
        </div>
      </div>

      {/* Instructions Steps */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-600" />
          <span>خطوات تحويل الكود إلى ملف تنفيذي (.exe) يعمل أوفلاين بمعالجة خلفية صامتة:</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-extrabold text-blue-700 block mb-1">1. تثبيت الحزم المطلوبة:</span>
            <code className="bg-slate-900 text-emerald-400 p-2 rounded block font-mono text-[11px] select-all">
              pip install PySide6 pyinstaller
            </code>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-extrabold text-blue-700 block mb-1">2. تشغيل السكريبت للاختبار:</span>
            <code className="bg-slate-900 text-emerald-400 p-2 rounded block font-mono text-[11px] select-all">
              python nasser_company_app.py
            </code>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-extrabold text-blue-700 block mb-1">3. البناء إلى ملف .exe مستقل:</span>
            <code className="bg-slate-900 text-emerald-400 p-2 rounded block font-mono text-[11px] select-all">
              pyinstaller --noconsole --onefile nasser_company_app.py
            </code>
          </div>
        </div>

        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1 text-slate-700">
          <span className="font-bold text-blue-900 block">⚙️ قواعد المعالجة والتجميع الصامت في تطبيق سطح المكتب (.exe):</span>
          <p className="text-[11px] leading-relaxed text-slate-600">
            • <strong>إزالة شاشات التهيئة (UI Removal):</strong> تم إلغاء كافة نوافذ الإعداد والتهيئة البصرية من واجهة المستخدم نهائياً.
            <br />
            • <strong>التنفيذ التلقائي في الخلفية (Internal Logic Execution):</strong> تتم تهيئة قاعدة البيانات SQLite وإنشاء الجداول وتجهيز بيئة التشغيل تلقائياً بدون الحاجة لتدخل المستخدم.
            <br />
            • <strong>التوافق مع PyInstaller:</strong> يتم بناء الملف كنسخة مستقلة 100% بحزمة واحدة <code>--onefile</code> وأوامر تشغيل صامتة <code>--noconsole</code>.
          </p>
        </div>
      </div>

      {/* Code Editor View */}
      <div className="bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
        <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800 text-xs">
          <span className="flex items-center gap-2 font-mono text-blue-400">
            <FileCode className="w-4 h-4" />
            <span>nasser_company_app.py</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Python 3.10+ / PySide6 / SQLite3</span>
        </div>

        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[450px] leading-relaxed">
          {pythonScript}
        </pre>
      </div>

    </div>
  );
};
