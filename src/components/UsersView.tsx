import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { toArabicNumerals } from '../lib/arabicUtils';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  Key,
  CheckCircle,
  UserCheck,
  ArrowRight,
  Eye,
  EyeOff,
  Warehouse
} from 'lucide-react';

interface UsersViewProps {
  users: User[];
  currentUser: User | null;
  onCreateUser: (user: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    gmail: string;
  }) => Promise<{ success: boolean; message?: string }>;
  onBack?: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUser,
  onCreateUser,
  onBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('WAREHOUSE_MANAGER');
  const [gmail, setGmail] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isGeneralManager = currentUser?.role === 'GENERAL_MANAGER';

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !name.trim() || !gmail.trim()) {
      setFormError('يرجى تعبئة كافة الحقول المطلوبة');
      return;
    }

    if (!gmail.toLowerCase().includes('@gmail.com')) {
      setFormError('البريد الإلكتروني يجب أن يكون عنوان Gmail صحيح ومفعل (@gmail.com)');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    setSuccessMsg('');

    try {
      const res = await onCreateUser({
        username,
        password,
        name,
        role,
        gmail: gmail.toLowerCase().trim(),
      });

      if (res.success) {
        setSuccessMsg(`تم إنشاء حساب أمين المخزن (${name}) بنجاح وربطه بالبريد ${gmail}`);
        setUsername('');
        setPassword('');
        setName('');
        setGmail('');
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg('');
        }, 1500);
      } else {
        setFormError(res.message || 'فشلت عملية إضافة المستخدم');
      }
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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

          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>إدارة أمناء المخازن وصلاحيات الوصول الإداري</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديد الأدوار (المدير العام / أمين المخزن) والربط الإجباري بعناوين Gmail لاستعادة كلمة السر أوفلاين/أونلاين
            </p>
          </div>
        </div>

        {isGeneralManager && (
          <button
            onClick={() => {
              setFormError('');
              setSuccessMsg('');
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-200 flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة أمين مخزن جديد</span>
          </button>
        )}
      </div>

      {/* Users List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-base shadow-inner">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{user.name}</h4>
                  <p className="text-[11px] font-mono text-slate-500">@{user.username}</p>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  user.role === 'GENERAL_MANAGER'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {user.role === 'GENERAL_MANAGER' ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    <span>المدير العام</span>
                  </>
                ) : (
                  <>
                    <Warehouse className="w-3 h-3 text-emerald-600" />
                    <span>أمين المخزن</span>
                  </>
                )}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1 font-medium">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-mono text-[11px] truncate">{user.gmail}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                <Key className="w-3 h-3 text-slate-400 shrink-0" />
                <span>تاريخ التسجيل: {toArabicNumerals(new Date(user.createdAt).toLocaleDateString('ar-EG'))}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 font-bold">
              {user.role === 'GENERAL_MANAGER' ? (
                <span className="text-blue-700">✓ صلاحيات كاملة: إضافة وتعديل المخزون، الأسعار، والمستخدمين</span>
              ) : (
                <span className="text-emerald-800">✓ صلاحيات مخزنية: تسجيل التوريد، الصرف، والجرد والمتابعة</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CREATE USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>إضافة حساب أمين مخزن جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                <span>زر رجوع</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-bold">
                {formError}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل للموظف</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد مصطفى"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (للتسجيل)</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: warehouse_1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان Gmail إجباري (لاستعادة كلمة السر)</label>
                <input
                  type="email"
                  required
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  placeholder="user@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الدور والصلاحيات بالمخزن</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-bold"
                >
                  <option value="WAREHOUSE_MANAGER">أمين المخزن (تسجيل التوريد والصرف والجرد)</option>
                  <option value="GENERAL_MANAGER">المدير العام (إضافة وحذف كامل للأصناف والمستخدمين)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'حفظ وإنشاء الحساب'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
