import React, { useState, useEffect } from 'react';
import { User, Product, StockMovement, AuditLog, RateLimiterState, SystemSettings } from './types';
import { InventoryView } from './components/InventoryView';
import { UsersView } from './components/UsersView';
import { LogsView } from './components/LogsView';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { DEFAULT_CATALOG_PRODUCTS } from './data/defaultCatalog';
import {
  Boxes,
  Users,
  FileText,
  Building2,
  Lock,
  UserCheck,
  ShieldCheck,
  Warehouse,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  PackageCheck
} from 'lucide-react';

export default function App() {
  // Authentication & Users
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active View Tab Navigation
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'LOGS' | 'USERS'>('INVENTORY');
  const [previousTab, setPreviousTab] = useState<'INVENTORY' | 'LOGS' | 'USERS'>('INVENTORY');

  const handleTabChange = (newTab: 'INVENTORY' | 'LOGS' | 'USERS') => {
    if (newTab !== activeTab) {
      setPreviousTab(activeTab);
      setActiveTab(newTab);
    }
  };

  const handleGoBack = () => {
    if (activeTab !== 'INVENTORY') {
      setActiveTab(previousTab !== activeTab ? previousTab : 'INVENTORY');
    }
  };

  // Safe JSON Fetch Helper
  const safeJsonFetch = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        return { isJson: true, ok: res.ok, data };
      }
      return { isJson: false, ok: res.ok, data: null };
    } catch (e) {
      return { isJson: false, ok: false, data: null };
    }
  };

  // Application State
  const DEFAULT_PRODUCTS: Product[] = DEFAULT_CATALOG_PRODUCTS;

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('nasser_warehouse_products_v4');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return DEFAULT_PRODUCTS;
  });

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem('nasser_warehouse_movements_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isOffline] = useState(false);

  // Modals
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Data Sync Handlers
  const fetchProducts = async () => {
    try {
      const res = await safeJsonFetch('/api/products');
      if (res.isJson && res.data && res.data.success && Array.isArray(res.data.products)) {
        setProducts(res.data.products);
        try {
          localStorage.setItem('nasser_warehouse_products_v4', JSON.stringify(res.data.products));
        } catch (e) {
          console.warn('Failed saving to localStorage', e);
        }
      } else {
        const saved = localStorage.getItem('nasser_warehouse_products_v4');
        if (saved) setProducts(JSON.parse(saved));
      }
    } catch (e) {
      const saved = localStorage.getItem('nasser_warehouse_products_v4');
      if (saved) setProducts(JSON.parse(saved));
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await safeJsonFetch('/api/movements');
      if (res.isJson && res.data && res.data.success && Array.isArray(res.data.movements)) {
        setMovements(res.data.movements);
        try {
          localStorage.setItem('nasser_warehouse_movements_v2', JSON.stringify(res.data.movements));
        } catch (e) {
          console.warn('Failed saving to localStorage', e);
        }
      } else {
        const saved = localStorage.getItem('nasser_warehouse_movements_v2');
        if (saved) setMovements(JSON.parse(saved));
      }
    } catch (e) {
      const saved = localStorage.getItem('nasser_warehouse_movements_v2');
      if (saved) setMovements(JSON.parse(saved));
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await safeJsonFetch('/api/users');
      if (res.isJson && res.data && res.data.success) {
        setUsersList(res.data.users);
      }
    } catch (e) {
      console.warn('Using client fallback for users');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await safeJsonFetch('/api/logs');
      if (res.isJson && res.data && res.data.success) {
        setLogs(res.data.logs);
      }
    } catch (e) {
      console.warn('Using client fallback for logs');
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchMovements();
    fetchUsers();
    fetchLogs();
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await safeJsonFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      if (res.isJson && res.ok && res.data && res.data.success) {
        setCurrentUser(res.data.user);
        setIsLoggingIn(false);
        return;
      }
    } catch (err) {
      console.warn('Server offline, fallback login');
    }

    if (loginUsername === 'admin' && loginPassword === 'admin123') {
      setCurrentUser({
        id: 'usr_1',
        username: 'admin',
        name: 'المدير العام - ناصر',
        role: 'GENERAL_MANAGER',
        gmail: 'zenithbabiker@gmail.com',
        createdAt: new Date().toISOString(),
      });
    } else if (loginUsername === 'wh_manager' && loginPassword === 'wh123') {
      setCurrentUser({
        id: 'usr_2',
        username: 'wh_manager',
        name: 'أمين المخزن الرئيسي - أحمد مصطفى',
        role: 'WAREHOUSE_MANAGER',
        gmail: 'warehouse.nasser@gmail.com',
        createdAt: new Date().toISOString(),
      });
    } else {
      setLoginError('اسم المستخدم أو كلمة السر غير صحيحة');
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Stock Movement Action Handler (IN / OUT / ADJUSTMENT)
  const handleStockMovement = async (movementData: {
    productId: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reason: string;
    referenceNo?: string;
  }) => {
    try {
      const res = await safeJsonFetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...movementData,
          operatorName: currentUser?.name || 'أمين المخزن',
          role: currentUser?.role,
        }),
      });

      if (res.isJson && res.data) {
        if (res.data.success) {
          await fetchProducts();
          await fetchMovements();
          await fetchLogs();
          return { success: true, message: res.data.message, movement: res.data.movement };
        } else {
          return { success: false, message: res.data.message };
        }
      }
    } catch (err) {
      console.warn('Server offline, completing stock movement locally');
    }

    // OFFLINE FALLBACK
    const targetProduct = products.find(p => p.id === movementData.productId);
    if (!targetProduct) return { success: false, message: 'الصنف غير موجود' };

    const previousStock = targetProduct.stock;
    const qty = Number(movementData.quantity);
    let newStock = previousStock;

    if (movementData.type === 'IN') newStock += qty;
    else if (movementData.type === 'OUT') {
      if (previousStock < qty) {
        return { success: false, message: `عفواً، الرصيد المتاح من (${targetProduct.name}) هو ${previousStock} فقط، ولا يكفي لصرف كمية ${qty}` };
      }
      newStock -= qty;
    } else if (movementData.type === 'ADJUSTMENT') {
      newStock = Math.max(0, qty);
    }

    if (newStock < 0) {
      return { success: false, message: `عفواً، لا يمكن أن يكون رصيد (${targetProduct.name}) أقل من صفر` };
    }

    const newMovement: StockMovement = {
      id: 'mvt_' + Date.now(),
      productId: targetProduct.id,
      productCode: targetProduct.code,
      productName: targetProduct.name,
      type: movementData.type,
      quantity: qty,
      previousStock,
      newStock,
      reason: movementData.reason,
      referenceNo: movementData.referenceNo || '',
      operatorName: currentUser?.name || 'أمين المخزن',
      timestamp: new Date().toISOString(),
    };

    setProducts(prev => {
      const updated = prev.map(p => (p.id === targetProduct.id ? { ...p, stock: newStock } : p));
      localStorage.setItem('nasser_warehouse_products_v3', JSON.stringify(updated));
      return updated;
    });

    setMovements(prev => {
      const updated = [newMovement, ...prev];
      localStorage.setItem('nasser_warehouse_movements_v1', JSON.stringify(updated));
      return updated;
    });

    return { success: true, message: 'تم تسجل الحركة المخزنية محلياً بنجاح', movement: newMovement };
  };

  // Batch Stock Movements Handler (Delivery Orders - Atomic Execution)
  const handleBatchStockMovement = async (batchData: {
    items: Array<{ productId: string; quantity: number }>;
    reason: string;
    referenceNo: string;
  }) => {
    try {
      const res = await safeJsonFetch('/api/movements/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...batchData,
          operatorName: currentUser?.name || 'أمين المخزن',
          role: currentUser?.role,
        }),
      });

      if (res.isJson && res.data) {
        if (res.data.success) {
          await fetchProducts();
          await fetchMovements();
          await fetchLogs();
          return { success: true, message: res.data.message, movements: res.data.movements };
        } else {
          return { success: false, message: res.data.message };
        }
      }
    } catch (err) {
      console.warn('Server offline, completing batch delivery order locally');
    }

    // OFFLINE FALLBACK FOR BATCH
    const createdMovements: StockMovement[] = [];
    let updatedProducts = [...products];

    // Pre-check stock
    for (const itm of batchData.items) {
      const p = updatedProducts.find(prod => prod.id === itm.productId);
      if (!p) return { success: false, message: 'صنف غير موجود' };
      if (p.stock < itm.quantity) {
        return { success: false, message: `الرصيد المتاح من (${p.name}) هو ${p.stock} فقط، ولا يكفي لصرف ${itm.quantity}` };
      }
    }

    // Deduct & create logs
    for (const itm of batchData.items) {
      const pIndex = updatedProducts.findIndex(prod => prod.id === itm.productId);
      const prod = updatedProducts[pIndex];
      const prevStock = prod.stock;
      const newStock = Math.max(0, prevStock - itm.quantity);
      updatedProducts[pIndex] = { ...prod, stock: newStock };

      const mov: StockMovement = {
        id: 'mvt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        type: 'OUT',
        quantity: itm.quantity,
        previousStock: prevStock,
        newStock: newStock,
        reason: batchData.reason,
        referenceNo: batchData.referenceNo,
        operatorName: currentUser?.name || 'أمين المخزن',
        timestamp: new Date().toISOString(),
      };
      createdMovements.push(mov);
    }

    setProducts(updatedProducts);
    localStorage.setItem('nasser_warehouse_products_v3', JSON.stringify(updatedProducts));

    setMovements(prev => {
      const updated = [...createdMovements, ...prev];
      localStorage.setItem('nasser_warehouse_movements_v1', JSON.stringify(updated));
      return updated;
    });

    return { success: true, message: 'تم صرف أمر التسليم محلياً بنجاح', movements: createdMovements };
  };

  // Add Product
  const handleAddProduct = async (productData: Partial<Product>) => {
    try {
      const res = await safeJsonFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productData,
          username: currentUser?.username,
          role: currentUser?.role,
        }),
      });

      if (res.isJson && res.data) {
        if (res.data.success) {
          await fetchProducts();
          await fetchMovements();
          await fetchLogs();
          return { success: true };
        } else {
          return { success: false, message: res.data.message };
        }
      }
    } catch (e) {
      console.warn('Adding product locally');
    }

    const newProd: Product = {
      id: 'prd_' + Date.now(),
      code: productData.code || 'NASSER-' + (products.length + 101),
      name: productData.name || 'صنف جديد',
      category: productData.category || 'عام',
      stock: Number(productData.stock) || 0,
      minStock: Number(productData.minStock) || 5,
      unit: productData.unit || 'وحدة',
      description: productData.description || '',
      updatedAt: new Date().toISOString(),
    };

    setProducts(prev => {
      const updated = [newProd, ...prev];
      localStorage.setItem('nasser_warehouse_products_v3', JSON.stringify(updated));
      return updated;
    });

    return { success: true };
  };

  // Batch Add Products
  const handleBatchAddProducts = async (items: Array<{ code?: string; name: string; stock: number; category?: string; minStock?: number; unit?: string; description?: string }>) => {
    try {
      const res = await safeJsonFetch('/api/products/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          username: currentUser?.username,
          role: currentUser?.role,
        }),
      });

      if (res.isJson && res.data && res.data.success) {
        await fetchProducts();
        await fetchMovements();
        await fetchLogs();
        return { success: true, count: res.data.count };
      }
    } catch (e) {
      console.warn('Batch adding products locally');
    }

    // Local fallback
    let maxNum = 1000;
    products.forEach(p => {
      const match = p.code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    const newProds: Product[] = [];
    const now = new Date().toISOString();

    items.forEach((item, index) => {
      if (!item.name || !item.name.trim()) return;
      maxNum += 1;
      const finalCode = (item.code && item.code.trim()) ? item.code.trim() : `${maxNum}`;
      const stockVal = Math.max(0, Number(item.stock) || 0);

      newProds.push({
        id: `prd_${Date.now()}_${index}`,
        code: finalCode,
        name: item.name.trim(),
        category: item.category || 'عام',
        stock: stockVal,
        minStock: Number(item.minStock) || 5,
        unit: item.unit || 'وحدة',
        description: item.description || '',
        updatedAt: now,
      });
    });

    setProducts(prev => {
      const updated = [...newProds, ...prev];
      localStorage.setItem('nasser_warehouse_products_v3', JSON.stringify(updated));
      return updated;
    });

    return { success: true, count: newProds.length };
  };

  // Update Product
  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const res = await safeJsonFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productData,
          username: currentUser?.username,
          role: currentUser?.role,
        }),
      });

      if (res.isJson && res.data) {
        if (res.data.success) {
          await fetchProducts();
          await fetchMovements();
          await fetchLogs();
          return { success: true };
        } else {
          return { success: false, message: res.data.message };
        }
      }
    } catch (e) {
      console.warn('Updating product locally');
    }

    setProducts(prev => {
      const updated = prev.map(p => (p.id === id ? { ...p, ...productData } : p));
      localStorage.setItem('nasser_warehouse_products_v3', JSON.stringify(updated));
      return updated;
    });

    return { success: true };
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await safeJsonFetch(`/api/products/${id}?username=${currentUser?.username}&role=${currentUser?.role}`, {
        method: 'DELETE',
      });

      if (res.isJson && res.data) {
        if (res.data.success) {
          await fetchProducts();
          await fetchLogs();
          return { success: true };
        } else {
          return { success: false, message: res.data.message };
        }
      }
    } catch (e) {
      console.warn('Deleting product locally');
    }

    setProducts(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('nasser_warehouse_products_v3', JSON.stringify(updated));
      return updated;
    });

    return { success: true };
  };

  // Create User
  const handleCreateUser = async (userData: any) => {
    try {
      const res = await safeJsonFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          requesterRole: currentUser?.role,
        }),
      });

      if (res.isJson && res.data) {
        if (res.data.success) {
          await fetchUsers();
          await fetchLogs();
          return { success: true };
        }
        return { success: false, message: res.data.message };
      }
    } catch (e) {
      console.warn('Creating user locally');
    }

    const newUser: User = {
      id: 'usr_' + Date.now(),
      username: userData.username,
      name: userData.name,
      role: userData.role,
      gmail: userData.gmail || '',
      createdAt: new Date().toISOString(),
    };

    setUsersList(prev => [...prev, newUser]);
    return { success: true };
  };

  // IF NOT LOGGED IN -> SHOW EXECUTIVE LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4 font-['Cairo',sans-serif] relative overflow-hidden">
        
        {/* Background Ambient Glow */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-900/30 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
          
          {/* Logo Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 mx-auto flex items-center justify-center shadow-lg shadow-blue-900/50">
              <Warehouse className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-wide text-white font-['Tajawal']">
              شركة <span className="text-blue-400">NASSER</span>
            </h1>
            <p className="text-xs text-slate-300 font-bold">نظام إدارة المخازن والمخزون والتوريد والتصريف</p>
          </div>

          {/* Error Banner */}
          {loginError && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Quick Demo Login Buttons */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <span className="text-slate-400 font-bold block text-[11px]">اختر حساب لتسجيل الدخول السريع:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('admin');
                  setLoginPassword('admin123');
                }}
                className={`p-2 rounded-lg border text-right transition flex items-center gap-2 cursor-pointer ${
                  loginUsername === 'admin'
                    ? 'bg-blue-950 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold block text-white text-[11px]">المدير العام</span>
                  <span className="text-[10px] text-slate-400 font-mono">admin / admin123</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginUsername('wh_manager');
                  setLoginPassword('wh123');
                }}
                className={`p-2 rounded-lg border text-right transition flex items-center gap-2 cursor-pointer ${
                  loginUsername === 'wh_manager'
                    ? 'bg-blue-950 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Warehouse className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold block text-white text-[11px]">أمين المخزن</span>
                  <span className="text-[10px] text-slate-400 font-mono">wh_manager / wh123</span>
                </div>
              </button>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستخدم</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">كلمة السر</label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] text-blue-400 hover:underline font-bold"
                >
                  نسيت كلمة السر؟ (استعادة/OTP)
                </button>
              </div>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={showLoginPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? 'جاري التحقق والتسجيل...' : 'تسجيل الدخول للنظام المخزني'}</span>
            </button>
          </form>

          {/* Footer Info */}
          <div className="pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
            شركة NASSER - نظام إدارة المخازن والمخزون مع دعم الجرد المباشر والتنبيه بالنواقص 100% Offline Mode.
          </div>

        </div>

        {/* Forgot Password OTP Modal */}
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          isOffline={isOffline}
          onClose={() => setIsForgotPasswordOpen(false)}
        />
      </div>
    );
  }

  // MAIN WAREHOUSE SYSTEM LAYOUT
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-['Cairo',sans-serif] flex flex-row overflow-x-hidden select-none" dir="rtl">
      
      {/* Immersive Sidebar Navigation */}
      <aside className="w-64 sm:w-72 bg-[#1E293B] border-l border-slate-700 flex flex-col shadow-2xl shrink-0 min-h-screen sticky top-0 no-print">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-900/40">
              <Warehouse className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight font-['Tajawal',sans-serif]">
                شركة <span className="text-blue-400">NASSER</span>
              </h1>
              <p className="text-[10px] text-blue-400 mt-0.5 font-bold tracking-widest uppercase">
                نظام إدارة المخازن والمخزون
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => handleTabChange('INVENTORY')}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer text-xs font-bold ${
              activeTab === 'INVENTORY'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-5 h-5 ml-3 text-blue-400 shrink-0" />
            <span>إدارة المخزن والأصناف</span>
          </button>

          <button
            onClick={() => handleTabChange('LOGS')}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer text-xs font-bold ${
              activeTab === 'LOGS'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileText className="w-5 h-5 ml-3 text-emerald-400 shrink-0" />
            <span>حركات التوريد والتصريف والسجل</span>
          </button>

          {currentUser.role === 'GENERAL_MANAGER' && (
            <button
              onClick={() => handleTabChange('USERS')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer text-xs font-bold ${
                activeTab === 'USERS'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Users className="w-5 h-5 ml-3 text-purple-400 shrink-0" />
              <span>إدارة أمناء وحسابات المخزن</span>
            </button>
          )}
        </nav>

        {/* User Profile Badge Footer in Sidebar */}
        <div className="p-4 border-t border-slate-700 bg-[#0F172A]/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 space-x-reverse min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold border-2 border-blue-400/50 text-sm shadow-md shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white leading-tight flex items-center gap-1 truncate">
                  <span className="truncate">{currentUser.name}</span>
                  {currentUser.role === 'GENERAL_MANAGER' && (
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" title="المدير العام" />
                  )}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {currentUser.role === 'GENERAL_MANAGER' ? 'المدير العام' : 'أمين المخزن'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsForgotPasswordOpen(true)}
                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition"
                title="نسيت كلمة السر (إرسال OTP)"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="تسجيل الخروج"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </aside>

      {/* Main Area Container */}
      <main className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] text-[#0F172A] overflow-y-auto">
        
        {/* Top Header Navigation Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between no-print shadow-2xs sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {activeTab !== 'INVENTORY' && (
              <button
                onClick={handleGoBack}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-blue-500/50 shrink-0"
                title="زر رجوع للنافذة السابقة"
              >
                <ArrowRight className="w-4 h-4" />
                <span>زر رجوع</span>
              </button>
            )}
            <div className="bg-slate-900 text-white p-2 rounded-xl shadow-xs">
              <Warehouse className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                {activeTab === 'INVENTORY' && '📦 إدارة أصناف المخزون والتوريد والتصريف'}
                {activeTab === 'LOGS' && '📜 سجل حركة التوريد والتصريف والمراجعة'}
                {activeTab === 'USERS' && '👥 إدارة أمناء المخازن وحسابات المستخدمين'}
              </h2>
              <p className="text-[11px] text-slate-500 font-semibold">
                شركة NASSER - نظام إدارة المخازن والمخزون
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active User Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-right">
                <p className="font-extrabold text-slate-800 leading-tight text-xs flex items-center gap-1">
                  <span>{currentUser.name}</span>
                  {currentUser.role === 'GENERAL_MANAGER' ? (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">مدير عام</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">أمين مخزن</span>
                  )}
                </p>
              </div>
            </div>

            {/* Switch User / Logout Button */}
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              title="تسجيل الخروج والعودة لشاشة الدخول للتبديل بين الحسابات"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج / تبديل الحساب</span>
            </button>
          </div>
        </header>

        {/* Main Work View Canvas */}
        <div className="flex-1 p-6 sm:p-8 space-y-6">
          {activeTab === 'INVENTORY' && (
            <InventoryView
              products={products}
              currentUser={currentUser}
              movements={movements}
              onAddProduct={handleAddProduct}
              onBatchAddProducts={handleBatchAddProducts}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onStockMovement={handleStockMovement}
              onBatchStockMovement={handleBatchStockMovement}
              onBack={handleGoBack}
            />
          )}

          {activeTab === 'LOGS' && (
            <LogsView
              movements={movements}
              logs={logs}
              onBack={handleGoBack}
            />
          )}

          {activeTab === 'USERS' && (
            <UsersView
              users={usersList}
              currentUser={currentUser}
              onCreateUser={handleCreateUser}
              onBack={handleGoBack}
            />
          )}
        </div>

        {/* Footer Bar */}
        <footer className="h-9 bg-slate-100 border-t border-slate-200 px-6 sm:px-8 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest no-print mt-auto">
          <div>الموقع: أمدرمان | قسم إدارة المخازن</div>
          <div className="flex gap-6 items-center">
            <span>تحديث أوفلاين تلقائي</span>
            <span className="text-emerald-600 font-extrabold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              قاعدة البيانات المحلية متصلة (100% Warehouse Offline Mode)
            </span>
          </div>
        </footer>

      </main>

      {/* Modals */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        isOffline={isOffline}
        onClose={() => setIsForgotPasswordOpen(false)}
      />

    </div>
  );
}
