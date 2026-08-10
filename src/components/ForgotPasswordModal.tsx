import React, { useState } from 'react';
import { Mail, KeyRound, Lock, AlertTriangle, CheckCircle2, Wifi, WifiOff, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  isOffline: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  isOffline,
  onClose,
}) => {
  const [resetMode, setResetMode] = useState<'OFFLINE' | 'ONLINE'>(isOffline ? 'OFFLINE' : 'OFFLINE');
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1 = username, 2 = verify OTP, 3 = new password
  
  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [maskedGmail, setMaskedGmail] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // OFFLINE PASSWORD RESET HANDLER
  const handleOfflineResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('يرجى كتابة اسم المستخدم');
      return;
    }
    if (!oldPassword.trim()) {
      setErrorMessage('يرجى كتابة كلمة المرور القديمة / الحالية للتحقق أولاً');
      return;
    }
    if (newPassword.length < 4) {
      setErrorMessage('كلمة السر الجديد يجب أن تحتوي على 4 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('كلمتا السر الجديدتان غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/reset-password-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          oldPassword: oldPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'فشلت عملية تغيير كلمة السر، تأكد من صحة كلمة المرور القديمة');
        return;
      }

      setSuccessMessage(data.message || 'تم التحقق من كلمة المرور القديمة وتحديث كلمة السر بنجاح وإلغاء القديمة تماماً!');
      setTimeout(() => {
        onClose();
        setUsername('');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('');
        setErrorMessage('');
      }, 1800);
    } catch (err: any) {
      setErrorMessage('حدث خطأ أثناء تغيير كلمة السر أوفلاين');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ONLINE STEP 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('يرجى كتابة اسم المستخدم');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          simulateOffline: isOffline,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'عفوًا، يلزم توفر اتصال بالإنترنت لإرسال رمز OTP عبر Gmail');
        return;
      }

      setMaskedGmail(data.gmail || '');
      setDemoCode(data.demoOtpCode || '');
      setSuccessMessage(data.message);
      setStep(2);
    } catch (err: any) {
      setErrorMessage('عفوًا، تعذر الاتصال بالسيرفر. يمكنك استخدام خيار تغيير كلمة السر أوفلاين المتاح.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ONLINE STEP 2: Verify OTP Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage('يرجى إدخال الرمز المكون من 6 أرقام');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          otpCode: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'رمز OTP غير صحيح');
        return;
      }

      setSuccessMessage('تم التحقق من الرمز بنجاح. أدخل كلمة السر الجديدة.');
      setStep(3);
    } catch (err: any) {
      setErrorMessage('حدث خطأ أثناء التحقق من الرمز');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ONLINE STEP 3: Set New Password via OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setErrorMessage('كلمة السر يجب أن تحتوي على 4 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('كلمتا السر غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          otpCode: otpCode.trim(),
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'فشلت عملية تحديث كلمة السر');
        return;
      }

      setSuccessMessage('تم تحديث كلمة السر بنجاح!');
      setTimeout(() => {
        onClose();
        setStep(1);
        setUsername('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('');
        setErrorMessage('');
      }, 1500);
    } catch (err: any) {
      setErrorMessage('حدث خطأ أثناء تحديث كلمة السر');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">تغيير / إعادة تعيين كلمة السر</h3>
              <p className="text-[10px] text-slate-500">خاصية تعمل 100% بدون إنترنت ومتاحة أونلاين</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>زر رجوع</span>
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setResetMode('OFFLINE');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              resetMode === 'OFFLINE'
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>تغيير أوفلاين (بدون إنترنت)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setResetMode('ONLINE');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              resetMode === 'ONLINE'
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>استعادة عبر Gmail (OTP)</span>
          </button>
        </div>

        {/* Network status indicator */}
        <div className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
          isOffline ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          <div className="flex items-center gap-1.5">
            {isOffline ? <WifiOff className="w-4 h-4 text-amber-600" /> : <Wifi className="w-4 h-4 text-emerald-600" />}
            <span>{isOffline ? 'وضع التشغيل: أوفلاين محلي (بدون إنترنت)' : 'وضع التشغيل: متصل (Online)'}</span>
          </div>
          <span className="text-[10px] bg-white px-2 py-0.5 rounded border text-slate-600 font-mono">
            {resetMode === 'OFFLINE' ? 'وضع أوفلاين نشط' : 'وضع أونلاين'}
          </span>
        </div>

        {/* Error Message Display */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-start gap-2 shadow-sm animate-shake">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Message Display */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* MODE 1: OFFLINE PASSWORD RESET (WITHOUT INTERNET) */}
        {resetMode === 'OFFLINE' && (
          <form onSubmit={handleOfflineResetPassword} className="space-y-3">
            <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-100 text-xs text-blue-900">
              <p className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>تغيير كلمة السر أوفلاين بدون إنترنت</span>
              </p>
              <p className="text-[11px] text-blue-800 mt-0.5">
                يمكنك كتابة اسم حسابك وتحديد كلمة السر الجديدة مباشرة وسيتم التحديث في قاعدة البيانات المحلية.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: admin أو cashier1"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور القديمة / الحالية (مطلوبة للتحقق)</label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية"
                  className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showOldPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر الجديدة</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showNewPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة السر الجديدة</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showConfirmPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التحديث محلياً...' : 'تحديث كلمة السر أوفلاين (بدون إنترنت)'}</span>
            </button>
          </form>
        )}

        {/* MODE 2: ONLINE OTP PASSWORD RESET */}
        {resetMode === 'ONLINE' && (
          <>
            {/* STEP 1: Enter Username */}
            {step === 1 && (
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم المسجل بالنظام</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: admin أو cashier1"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    سيتم البحث عن بريد Gmail المسجل باسم هذا المستخدم وإرسال رمز OTP المكون من 6 أرقام.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? 'جاري التحقق من الاتصال وطلب OTP...' : 'إرسال رمز OTP عبر Gmail'}
                </button>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs text-blue-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>تم إرسال الرمز للبريد الإلكتروني</span>
                  </p>
                  {demoCode && (
                    <div className="pt-1 text-[11px] font-mono text-blue-800 border-t border-blue-200">
                      💡 رمز الاختيار السريع للتجربة: <strong className="text-emerald-700 text-sm">{demoCode}</strong>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">أدخل رمز OTP المكون من 6 أرقام</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 text-center text-lg font-mono font-bold border border-slate-300 rounded-lg tracking-widest focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    تغيير المستخدم
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm cursor-pointer"
                  >
                    {isSubmitting ? 'جاري التثبت...' : 'تأكيد الرمز المكون من 6 أرقام'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Enter New Password */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر الجديدة</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showNewPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة السر الجديدة</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showConfirmPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200 cursor-pointer"
                >
                  {isSubmitting ? 'جاري حفظ كلمة السر الجديدة...' : 'حفظ كلمة السر وتحديث الحساب'}
                </button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
};
