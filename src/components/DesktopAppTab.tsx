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
            <span className="font-extrabold text-blue-700 block mb-1">2. تجربة وتشغيل السكريبت:</span>
            <code className="bg-slate-900 text-emerald-400 p-2 rounded block font-mono text-[11px] select-all">
              python nasser_company_app.py
            </code>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-extrabold text-blue-700 block mb-1">3. أمر التغليف المعتمد (مع تضمين ملفات dist):</span>
            <code className="bg-slate-900 text-emerald-400 p-2 rounded block font-mono text-[10px] select-all leading-tight">
              pyinstaller --noconsole --onefile --add-data "dist;dist" nasser_company_app.py
            </code>
          </div>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-start gap-2.5 text-emerald-950">
          <div className="p-1 bg-emerald-600 text-white rounded-md mt-0.5 shrink-0 font-mono text-[10px] font-bold">CI/CD</div>
          <div className="space-y-0.5">
            <span className="font-bold block text-emerald-900">تجميع وتغليف تلقائي عبر GitHub Actions:</span>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              تم إعداد ملف العمل <code>.github/workflows/window.yml</code> تلقائياً ليقوم عند كل Push أو تشغيل يدوي ببناء مثبت الويندوز الكامل (<code>Nasser_Company_Setup.exe</code>) والنسخة المحمولة (<code>Portable .exe</code>) ورفعها كـ Artifacts جاهزة للتحميل المباشر.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1.5 text-slate-700">
          <span className="font-bold text-blue-900 block">⚙️ حلول التغليف المطبقة برمجياً (Production Packaging Engine):</span>
          <p className="text-[11px] leading-relaxed text-slate-600">
            • <strong>معالجة الارتجاف والرسومات (Flickering & GPU Fix):</strong> تم تعطيل تسريع GPU لـ OpenGL عبر <code>Qt.AA_UseSoftwareOpenGL</code> وإيقاف تسريع Chromium المزدوج لضمان ثبات النوافذ المنبثقة وحوارات الطباعة 100% دون أي اهتزاز.
            <br />
            • <strong>معالجة الشاشة البيضاء (Asset Path Resolution):</strong> تم اعتماد دالة <code>get_resource_path</code> المزودة بـ <code>sys._MEIPASS</code> لاستخراج ملفات الواجهة والـ Assets بدقة عند تشغيل الـ EXE في أي جهاز غريب.
            <br />
            • <strong>قاعدة البيانات الديناميكية (Dynamic SQLite):</strong> تهيئة وتخزين دائم بـ <code>AppData</code> ومقاومة انقطاع التيار بـ WAL Mode مع تعبئة تلقائية لكافة أصناف ومستخدمي الشركة عند التثبيت لأول مرة.
            <br />
            • <strong>الطباعة الأصلية (Native Qt Printing):</strong> ربط كلاس <code>QPrinter</code> و <code>QPrintDialog</code> الداخلي مع التقاط اختصار <code>Ctrl + P</code> الفوري لعرض حوار طباعة ويندوز دون الحاجة لبرامج خارجية.
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
