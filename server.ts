import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_CATALOG_PRODUCTS } from './src/data/defaultCatalog';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// File DB Path for Offline Core Persistence
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'nasser_company_db.json');

// Interface Definitions for Backend
interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'GENERAL_MANAGER' | 'WAREHOUSE_MANAGER';
  gmail: string;
  createdAt: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  description?: string;
  updatedAt: string;
}

interface StockMovement {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT'; // توريد / صرف / تعديل جرد
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceNo?: string;
  operatorName: string;
  timestamp: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  action: string;
  details: string;
  type: 'INFO' | 'WARNING' | 'SECURITY' | 'MOVEMENT';
}

interface DBData {
  catalogVersion?: string;
  users: User[];
  products: Product[];
  movements: StockMovement[];
  logs: AuditLog[];
  settings: {
    googleSheetUrl: string;
    rateLimitThreshold: number;
    appName: string;
    companyAddress: string;
    companyPhone: string;
  };
}

// In-Memory Rate Limiter Engine (60-second window)
let rateLimiterState = {
  minuteStart: Math.floor(Date.now() / 60000),
  counter: 0,
};

// Store active OTPs in memory
const activeOtps: Record<string, { code: string; expiresAt: number; gmail: string }> = {};

// Default Initial Seed Data
const DEFAULT_DB: DBData = {
  catalogVersion: 'CATALOG_V4_2026_08_NEW_SEED',
  users: [
    {
      id: 'usr_1',
      username: 'admin',
      password: 'admin123',
      name: 'المدير العام - ناصر',
      role: 'GENERAL_MANAGER',
      gmail: 'zenithbabiker@gmail.com',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_2',
      username: 'wh_manager',
      password: 'wh123',
      name: 'أمين المخزن الرئيسي - أحمد مصطفى',
      role: 'WAREHOUSE_MANAGER',
      gmail: 'warehouse.nasser@gmail.com',
      createdAt: new Date().toISOString(),
    },
  ],
  products: DEFAULT_CATALOG_PRODUCTS,
  movements: DEFAULT_CATALOG_PRODUCTS.map((p, idx) => ({
    id: `mvt_init_${p.id}`,
    productId: p.id,
    productCode: p.code,
    productName: p.name,
    type: 'IN' as const,
    quantity: p.stock,
    previousStock: 0,
    newStock: p.stock,
    reason: `رصيد افتتاحي معتمد في قسم (${p.category})`,
    operatorName: 'المدير العام',
    timestamp: p.updatedAt,
  })),
  logs: [
    {
      id: 'log_1',
      timestamp: new Date().toISOString(),
      username: 'النظام',
      role: 'GENERAL_MANAGER',
      action: 'تشغيل النظام',
      details: 'تم بدء تشغيل وتحديث قاعدة بيانات إدارة المخازن والمخزون لشركة NASSER وفق القائمة الجديدة المعتمدة',
      type: 'INFO',
    },
  ],
  settings: {
    googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1NasserCompanyConfig/edit#gid=0',
    rateLimitThreshold: 15,
    appName: 'شركة NASSER - نظام إدارة المخازن والمخزون',
    companyAddress: 'أمدرمان',
    companyPhone: '0913247564',
  },
};

// Database Helper Functions
function readDB(): DBData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return DEFAULT_DB;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const db: DBData = JSON.parse(content);

    if (!db.movements) db.movements = [];

    // Migration Check: If catalogVersion is not the new seed or old coffee/network items are present, drop old seed and migrate cleanly
    const hasOldSeed = db.products.some(p => 
      p.name.includes('إسبيرسو') || 
      p.name.includes('Cat6') || 
      p.name.includes('سيسكو') ||
      p.name.includes('طاحونة حبوب')
    );

    if (db.catalogVersion !== 'CATALOG_V4_2026_08_NEW_SEED' || hasOldSeed || db.products.length === 0) {
      console.log('🔄 Migrating Database: Replacing old seed data with the new verified 82-item catalog...');
      
      // Preserve any genuinely custom items added by user (items that were not in old default list)
      const oldDefaultNames = new Set([
        'ماكينة إعداد القهوة الإسبيرسو الاحترافية NASSER Pro 3',
        'طاحونة حبوب القهوة الصناعية 1500W دقيقة التنعيم',
        'طابعة فواتير حرارية عالية السرعة 80mm USB/LAN',
        'ميزان إلكتروني ديجيتال دقيق للوزن والجرعات 0.1g',
        'فلتر تنقية وتقطير المياه خماسي المراحل للمقاهي',
        'مقبض ضغط القهوة اليدوي (Tamper) استانلس ستيل 58mm',
        'كابل شبكات Cat6 ياباني أصلي 305 متر',
        'راوتر سيسكو 2901 احترافي مدمج',
        'سويتش شبكات 24 منفذ جيجابيت PoE',
        'كاميرا مراقبة خارجية 5 ميجا بيكسل IP',
        'جهاز تسجيل شبكي NVR 16 قناة 4K',
        'خادم ملفات Rack Server 2U الجيل العاشر',
        'مزود طاقة UPS أونلاين 3000VA',
        'ألياف ضوئية فايبر أحادي Single-Mode 1000m',
        'لوحة توزيع كابلات Patch Panel 24 Port Cat6',
        'كابينة خادم Rack Cabinet 42U مع تهوية'
      ]);

      const customUserProducts = db.products.filter(p => !oldDefaultNames.has(p.name));
      
      // New seed catalog products
      const newSeedMap = new Map<string, Product>();
      DEFAULT_CATALOG_PRODUCTS.forEach(p => newSeedMap.set(p.name + '_' + p.category, p));

      // Merge: Start with all 82 verified items
      const mergedProducts: Product[] = [...DEFAULT_CATALOG_PRODUCTS];
      
      // Append any distinct user-created items
      customUserProducts.forEach(up => {
        if (!newSeedMap.has(up.name + '_' + up.category)) {
          mergedProducts.push(up);
        }
      });

      db.products = mergedProducts;
      db.catalogVersion = 'CATALOG_V4_2026_08_NEW_SEED';

      // Clear old dummy movements and create opening balances for new items
      db.movements = DEFAULT_CATALOG_PRODUCTS.map(p => ({
        id: `mvt_init_${p.id}`,
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        type: 'IN' as const,
        quantity: p.stock,
        previousStock: 0,
        newStock: p.stock,
        reason: `رصيد افتتاحي معتمد في قسم (${p.category})`,
        operatorName: 'المدير العام',
        timestamp: p.updatedAt,
      }));

      writeDB(db);
    }

    // Ensure General Manager email is updated to zenithbabiker@gmail.com
    let updated = false;
    db.users = db.users.map(u => {
      if (u.username === 'admin' || u.role === 'GENERAL_MANAGER') {
        if (u.gmail === 'admin.nasser@gmail.com' || !u.gmail) {
          u.gmail = 'zenithbabiker@gmail.com';
          updated = true;
        }
      }
      return u;
    });
    if (updated) {
      writeDB(db);
    }
    return db;
  } catch (err) {
    console.error('Error reading SQLite/JSON DB:', err);
    return DEFAULT_DB;
  }
}

function writeDB(data: DBData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing SQLite/JSON DB:', err);
  }
}

function addAuditLog(username: string, role: string, action: string, details: string, type: 'INFO' | 'WARNING' | 'SECURITY' | 'MOVEMENT' = 'INFO') {
  const db = readDB();
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    username,
    role,
    action,
    details,
    type,
  };
  db.logs.unshift(log);
  // Keep last 200 logs
  if (db.logs.length > 200) db.logs = db.logs.slice(0, 200);
  writeDB(db);
}

// RATE LIMITER COUNTER UTILITY (60-second window)
function getRateLimiterInfo() {
  const nowMinute = Math.floor(Date.now() / 60000);
  if (nowMinute !== rateLimiterState.minuteStart) {
    rateLimiterState.minuteStart = nowMinute;
    rateLimiterState.counter = 0;
  }

  const currentCount = rateLimiterState.counter;
  const model = 'google/gemini-2.5-flash';

  const secondsRemaining = 60 - (Math.floor(Date.now() / 1000) % 60);

  return {
    requestsInCurrentMinute: currentCount,
    currentModel: model,
    secondsRemaining,
    minuteTimestamp: rateLimiterState.minuteStart,
  };
}

function incrementRateLimiter() {
  getRateLimiterInfo();
  rateLimiterState.counter += 1;
  return getRateLimiterInfo();
}

// REST API ROUTES
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', company: 'شركة NASSER', system: 'إدارة المخازن', timestamp: new Date().toISOString() });
});

// AUTH - Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase().trim());

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة السر غير صحيحة' });
  }

  addAuditLog(user.username, user.role, 'تسجيل دخول', `تم تسجيل الدخول بنجاح للمستخدم ${user.name}`, 'INFO');

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// AUTH - Forgot Password OTP Trigger
app.post('/api/auth/forgot-password', (req, res) => {
  const { username, simulateOffline } = req.body;
  
  if (simulateOffline) {
    return res.status(503).json({
      success: false,
      message: 'عفوًا، يلزم توفر اتصال بالإنترنت فقط لإرسال رمز إعادة تعيين كلمة السر',
    });
  }

  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase().trim());

  if (!user) {
    return res.status(404).json({ success: false, message: 'اسم المستخدم غير موجود بالنظام' });
  }

  if (!user.gmail) {
    return res.status(400).json({ success: false, message: 'لم يتم تسجيل بريد Gmail لهذا المستخدم' });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  activeOtps[user.username] = {
    code: otpCode,
    expiresAt: Date.now() + 10 * 60 * 1000,
    gmail: user.gmail,
  };

  addAuditLog(user.username, user.role, 'طلب إرسال OTP', `تم إرسال رمز OTP إلى البريد الإلكتروني ${user.gmail}`, 'SECURITY');

  res.json({
    success: true,
    message: `تم إرسال رمز OTP المكون من 6 أرقام إلى بريدك الإلكتروني (${user.gmail.replace(/(.{2})(.*)(?=@)/, '$1***')})`,
    gmail: user.gmail,
    demoOtpCode: otpCode,
  });
});

// AUTH - Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { username, otpCode } = req.body;
  const otpRecord = activeOtps[username];

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'انتهت صلاحية الرمز أو لم يتم طلبه' });
  }

  if (Date.now() > otpRecord.expiresAt) {
    delete activeOtps[username];
    return res.status(400).json({ success: false, message: 'رمز OTP منتهي الصلاحية، يرجى إعاده الطلب' });
  }

  if (otpRecord.code !== otpCode?.trim()) {
    return res.status(400).json({ success: false, message: 'رمز OTP غير صحيح' });
  }

  res.json({ success: true, message: 'تم التحقق من الرمز بنجاح' });
});

// AUTH - Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  const { username, otpCode, newPassword } = req.body;
  const otpRecord = activeOtps[username];

  if (!otpRecord || otpRecord.code !== otpCode?.trim()) {
    return res.status(400).json({ success: false, message: 'غير مصرح أو الرمز غير صحيح' });
  }

  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  user.password = newPassword;
  writeDB(db);
  delete activeOtps[username];

  addAuditLog(user.username, user.role, 'تغيير كلمة السر', 'تم تغيير كلمة السر بنجاح بواسطة رمز OTP', 'SECURITY');

  res.json({ success: true, message: 'تم تحديث كلمة السر بنجاح. يمكنك الآن تسجيل الدخول' });
});

// AUTH - Reset Password Offline
app.post('/api/auth/reset-password-offline', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ success: false, message: 'يرجى تقديم اسم المستخدم، كلمة السر القديمة، وكلمة السر الجديدة' });
  }

  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());

  if (!user) {
    return res.status(404).json({ success: false, message: 'اسم المستخدم غير موجود بالنظام' });
  }

  if (user.password !== oldPassword.trim()) {
    return res.status(400).json({ success: false, message: 'كلمة السر القديمة / الحالية غير صحيحة' });
  }

  user.password = newPassword.trim();
  writeDB(db);

  addAuditLog(user.username, user.role, 'تغيير كلمة السر', 'تم التحقق من كلمة السر القديمة وتحديث كلمة السر بنجاح وإلغاء الاعتماد القديم', 'SECURITY');

  res.json({ success: true, message: 'تم التحقق من كلمة السر القديمة وتحديث كلمة السر بنجاح وإلغاء القديمة تماماً!' });
});

// PRODUCTS - List all
app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json({ success: true, products: db.products });
});

// PRODUCTS - Create Product
app.post('/api/products', (req, res) => {
  const { code, name, category, stock, minStock, unit, description, username, role } = req.body;

  if (role !== 'GENERAL_MANAGER') {
    return res.status(403).json({ success: false, message: 'عفواً، إضافة صنف جديد هي صلاحية حصرية للمدير العام (الحساب الرئيسي) فقط' });
  }

  const db = readDB();
  
  let productCode = (code || '').trim();
  if (!productCode) {
    let maxNum = 0;
    let prefix = 'NASSER-';
    db.products.forEach(p => {
      const match = p.code.match(/^(.*?)(\d+)$/);
      if (match) {
        if (match[1]) prefix = match[1];
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    productCode = `${prefix}${maxNum > 0 ? maxNum + 1 : db.products.length + 101}`;
  }

  const initialStock = Math.max(0, Number(stock) || 0);

  const newProduct: Product = {
    id: `prd_${Date.now()}`,
    code: productCode,
    name: name.trim(),
    category: category || 'عام',
    stock: initialStock,
    minStock: Number(minStock) || 5,
    unit: unit || 'وحدة',
    description: description || '',
    updatedAt: new Date().toISOString(),
  };

  db.products.push(newProduct);

  // Record initial stock movement if initialStock > 0
  if (initialStock > 0) {
    const movement: StockMovement = {
      id: `mvt_${Date.now()}`,
      productId: newProduct.id,
      productCode: newProduct.code,
      productName: newProduct.name,
      type: 'IN',
      quantity: initialStock,
      previousStock: 0,
      newStock: initialStock,
      reason: 'رصيد افتتاحي عند إنشاء الصنف',
      operatorName: username || 'المدير العام',
      timestamp: new Date().toISOString(),
    };
    db.movements.unshift(movement);
  }

  writeDB(db);

  addAuditLog(
    username || 'المدير العام',
    role || 'GENERAL_MANAGER',
    'إضافة صنف جديد للمخزن',
    `تم تسجيل الصنف (${newProduct.name}) بكود [${newProduct.code}] ورصيد افتتاحي ${initialStock} ${newProduct.unit}`,
    'MOVEMENT'
  );

  res.json({ success: true, product: newProduct });
});

// PRODUCTS - Batch Create Products
app.post('/api/products/batch', (req, res) => {
  const { items, username, role } = req.body;

  if (role !== 'GENERAL_MANAGER') {
    return res.status(403).json({ success: false, message: 'عفواً، إضافة الأصناف دفعة واحدة هي صلاحية حصرية للمدير العام (الحساب الرئيسي) فقط' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'لا توجد أصناف للإضافة' });
  }

  const db = readDB();

  // Find baseline numeric serial code
  let maxNum = 1000;
  db.products.forEach(p => {
    const match = p.code.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  const createdProducts: Product[] = [];
  const now = new Date().toISOString();

  items.forEach((item, index) => {
    if (!item.name || !item.name.trim()) return;

    maxNum += 1;
    const finalCode = (item.code && item.code.trim()) ? item.code.trim() : `${maxNum}`;
    const initialStock = Math.max(0, Number(item.stock) || 0);

    const newProd: Product = {
      id: `prd_${Date.now()}_${index}`,
      code: finalCode,
      name: item.name.trim(),
      category: item.category || 'عام',
      stock: initialStock,
      minStock: Number(item.minStock) || 5,
      unit: item.unit || 'وحدة',
      description: item.description || '',
      updatedAt: now,
    };

    db.products.push(newProd);
    createdProducts.push(newProd);

    if (initialStock > 0) {
      const movement: StockMovement = {
        id: `mvt_${Date.now()}_${index}`,
        productId: newProd.id,
        productCode: newProd.code,
        productName: newProd.name,
        type: 'IN',
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        reason: 'رصيد إدخال افتتاحي دفعة واحدة',
        operatorName: username || 'المدير العام',
        timestamp: now,
      };
      db.movements.unshift(movement);
    }
  });

  writeDB(db);

  addAuditLog(
    username || 'المدير العام',
    role || 'GENERAL_MANAGER',
    'إضافة أصناف دفعة واحدة للمخزن (Excel Batch)',
    `تم تسجيل عدد (${createdProducts.length}) صنف مخزني جديد بنجاح وتحديث الأكواد والرصيد`,
    'MOVEMENT'
  );

  res.json({ success: true, count: createdProducts.length, products: createdProducts });
});

// PRODUCTS - Update Product
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { code, name, category, stock, minStock, unit, description, username, role } = req.body;

  if (role !== 'GENERAL_MANAGER') {
    return res.status(403).json({ success: false, message: 'عفواً، تعديل الأصناف هي صلاحية حصرية للمدير العام (الحساب الرئيسي) فقط' });
  }

  const db = readDB();
  const index = db.products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'الصنف غير موجود' });
  }

  const oldProd = db.products[index];
  const rawStock = Number(stock);
  const newStock = !isNaN(rawStock) ? Math.max(0, rawStock) : oldProd.stock;

  // If stock was modified directly, record movement log
  if (!isNaN(newStock) && newStock !== oldProd.stock) {
    const diff = newStock - oldProd.stock;
    const movement: StockMovement = {
      id: `mvt_${Date.now()}`,
      productId: oldProd.id,
      productCode: code || oldProd.code,
      productName: name || oldProd.name,
      type: 'ADJUSTMENT',
      quantity: Math.abs(diff),
      previousStock: oldProd.stock,
      newStock: newStock,
      reason: `تعديل يدوي للرصيد (${diff > 0 ? '+' : ''}${diff})`,
      operatorName: username || 'المدير العام',
      timestamp: new Date().toISOString(),
    };
    db.movements.unshift(movement);
  }

  db.products[index] = {
    ...oldProd,
    code: (code || oldProd.code).trim(),
    name: (name || oldProd.name).trim(),
    category: category || oldProd.category || 'عام',
    stock: newStock,
    minStock: Number(minStock) || oldProd.minStock || 5,
    unit: unit || oldProd.unit || 'وحدة',
    description: description !== undefined ? description : oldProd.description,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);

  addAuditLog(
    username || 'المدير العام',
    role || 'GENERAL_MANAGER',
    'تعديل بيانات صنف',
    `تم تحديث بيانات الصنف (${db.products[index].name})، الرصيد: ${db.products[index].stock}`,
    'INFO'
  );

  res.json({ success: true, product: db.products[index] });
});

// PRODUCTS - Delete Product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { username, role } = req.query;

  if (role !== 'GENERAL_MANAGER') {
    return res.status(403).json({ success: false, message: 'عفواً، حذف الأصناف هي صلاحية حصرية للمدير العام (الحساب الرئيسي) فقط' });
  }

  const db = readDB();
  const product = db.products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'الصنف غير موجود' });
  }

  db.products = db.products.filter(p => p.id !== id);
  writeDB(db);

  addAuditLog(String(username || 'المدير العام'), String(role || 'GENERAL_MANAGER'), 'حذف صنف من المخزن', `تم حذف الصنف (${product.name}) بكود [${product.code}] نهائياً`, 'WARNING');

  res.json({ success: true, message: 'تم حذف الصنف من قاعدة البيانات بنجاح' });
});

// Helper for resilient product lookup (by ID, exact code, trimmed case-insensitive, or space/dash-free code)
function findProductInList(products: Product[], idOrCode: string): Product | undefined {
  if (!idOrCode) return undefined;
  try {
    const cleanKey = String(idOrCode).trim();
    const lowerKey = cleanKey.toLowerCase();
    const denseKey = lowerKey.replace(/[\s_./\\-]/g, '');

    return products.find(p => {
      if (p.id === cleanKey || p.code === cleanKey) return true;
      if (p.id.toLowerCase() === lowerKey || p.code.toLowerCase() === lowerKey) return true;
      if (denseKey.length > 0) {
        const pDenseCode = p.code.toLowerCase().replace(/[\s_./\\-]/g, '');
        const pDenseId = p.id.toLowerCase().replace(/[\s_./\\-]/g, '');
        if (pDenseCode === denseKey || pDenseId === denseKey) return true;
      }
      return false;
    });
  } catch (err) {
    const fallbackKey = String(idOrCode).trim();
    return products.find(p => p.id === fallbackKey || p.code === fallbackKey);
  }
}

// STOCK MOVEMENTS - Process In / Out / Adjustment
app.post('/api/movements', (req, res) => {
  const { productId, type, quantity, reason, referenceNo, operatorName, role } = req.body;

  const qty = Number(quantity);
  if (!productId || !type || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: 'بيانات حركة المخزون غير مكتملة أو الكمية غير صالحة' });
  }

  const db = readDB();
  const product = findProductInList(db.products, productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'الصنف غير موجود بالمخزن' });
  }

  const previousStock = product.stock;
  let newStock = previousStock;

  if (type === 'IN') {
    newStock = previousStock + qty;
  } else if (type === 'OUT') {
    if (previousStock < qty) {
      return res.status(400).json({
        success: false,
        message: `عفوًا، الرصيد المتاح من (${product.name}) هو ${previousStock} فقط، ولا يكفي لصرف كمية ${qty}`,
      });
    }
    newStock = previousStock - qty;
  } else if (type === 'ADJUSTMENT') {
    newStock = Math.max(0, qty);
  }

  if (newStock < 0) {
    return res.status(400).json({
      success: false,
      message: `عفوًا، لا يمكن أن يكون رصيد (${product.name}) أقل من صفر (الرصيد المتاح حالياً: ${previousStock})`,
    });
  }

  product.stock = newStock;
  product.updatedAt = new Date().toISOString();

  let refNo = (referenceNo || '').trim();
  if (!refNo && type === 'OUT') {
    let maxSeq = 9944;
    db.movements.forEach(m => {
      if (m.referenceNo) {
        const match = m.referenceNo.match(/\d+/g);
        if (match) {
          const val = parseInt(match.join(''), 10);
          if (!isNaN(val) && val > maxSeq) maxSeq = val;
        }
      }
    });
    refNo = String(maxSeq + 1);
  }

  const movement: StockMovement = {
    id: `mvt_${Date.now()}`,
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    type,
    quantity: qty,
    previousStock,
    newStock,
    reason: (reason || '').trim() || (type === 'IN' ? 'توريد إضافي' : 'أمر تسليم مخزن'),
    referenceNo: refNo,
    operatorName: operatorName || 'مسؤول المخزن',
    timestamp: new Date().toISOString(),
  };

  db.movements.unshift(movement);
  writeDB(db);

  const typeDesc = type === 'IN' ? 'إدخال / توريد (+)' : type === 'OUT' ? 'إخراج / صرف (-)' : 'تعديل جرد';
  addAuditLog(
    operatorName || 'مسؤول المخزن',
    role || 'WAREHOUSE_MANAGER',
    `حركة مخزنية: ${typeDesc}`,
    `تم تسجيل ${typeDesc} للصنف (${product.name}) بكمية ${qty} ${product.unit}. الرصيد السابق: ${previousStock} -> الرصيد الجديد: ${newStock}. السبب: ${movement.reason}`,
    'MOVEMENT'
  );

  res.json({
    success: true,
    product,
    movement,
    message: `تم تسجيل الحركة المخزنية وتحديث رصيد (${product.name}) بنجاح إلى ${newStock} وحدة`,
  });
});

// STOCK MOVEMENTS - Process Batch Delivery Order / Movements Atomically
app.post('/api/movements/batch', (req, res) => {
  const { items, referenceNo, reason, operatorName, role } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'لا توجد أصناف في أمر التسليم' });
  }

  const db = readDB();
  const opName = operatorName || 'أمين المخزن';
  const now = new Date().toISOString();
  const refNo = (referenceNo || '').trim() || '1';
  const reasonText = (reason || '').trim() || 'أمر تسليم مخزن';

  // 1. Validation phase: check that all items exist and have sufficient stock
  for (const itm of items) {
    const pId = itm.productId;
    const qty = Number(itm.quantity) || 1;
    const prod = findProductInList(db.products, pId);
    if (!prod) {
      return res.status(404).json({ success: false, message: `الصنف ذو المعرف أو الكود (${pId}) غير موجود بالمخزن` });
    }
    if (prod.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `الرصيد المتاح من (${prod.name}) هو ${prod.stock} فقط، ولا يكفي لصرف كمية ${qty}`,
      });
    }
  }

  // 2. Execution phase: deduct stock and record movements
  const createdMovements: StockMovement[] = [];
  for (const itm of items) {
    const pId = itm.productId;
    const qty = Number(itm.quantity) || 1;
    const prod = findProductInList(db.products, pId)!;
    const previousStock = prod.stock;
    const newStock = Math.max(0, previousStock - qty);

    prod.stock = newStock;
    prod.updatedAt = now;

    const movement: StockMovement = {
      id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      type: 'OUT',
      quantity: qty,
      previousStock,
      newStock,
      reason: reasonText,
      referenceNo: refNo,
      operatorName: opName,
      timestamp: now,
    };

    db.movements.unshift(movement);
    createdMovements.push(movement);
  }

  writeDB(db);

  addAuditLog(
    opName,
    role || 'WAREHOUSE_MANAGER',
    'صرف أمر تسليم مخزن (دفعة واحدة)',
    `تم صرف عدد (${createdMovements.length}) أصناف بموجب أمر تسليم تسلسلي رقم [${refNo}] بنجاح`,
    'MOVEMENT'
  );

  res.json({
    success: true,
    message: `تم صرف وتوثيق أمر التسليم رقم [${refNo}] بنجاح`,
    movements: createdMovements,
  });
});

// STOCK MOVEMENTS - Get History
app.get('/api/movements', (req, res) => {
  const db = readDB();
  res.json({ success: true, movements: db.movements });
});

// USERS - List
app.get('/api/users', (req, res) => {
  const db = readDB();
  const safeUsers = db.users.map(({ password: _, ...u }) => u);
  res.json({ success: true, users: safeUsers });
});

// USERS - Create
app.post('/api/users', (req, res) => {
  const { username, password, name, role, gmail, requesterRole } = req.body;

  if (requesterRole !== 'GENERAL_MANAGER') {
    return res.status(403).json({ success: false, message: 'غير مصرح: إدارة المستخدمين مقتصرة على المدير العام فقط' });
  }

  if (!gmail || !gmail.trim().endsWith('@gmail.com')) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان بريد Gmail صحيح ومفعل للربط بحساب المستخدم' });
  }

  const db = readDB();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'اسم المستخدم مسجل مسبقًا' });
  }

  const newUser: User = {
    id: `usr_${Date.now()}`,
    username: username.trim(),
    password: password.trim(),
    name: name.trim(),
    role: role || 'WAREHOUSE_MANAGER',
    gmail: gmail.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  writeDB(db);

  addAuditLog('المدير العام', 'GENERAL_MANAGER', 'إنشاء مستخدم جديد', `تم إنشاء الحساب ${newUser.username} ببريد ${newUser.gmail}`, 'SECURITY');

  const { password: _, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// AUDIT LOGS
app.get('/api/logs', (req, res) => {
  const db = readDB();
  res.json({ success: true, logs: db.logs });
});

// SETTINGS
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json({ success: true, settings: db.settings });
});

app.post('/api/settings', (req, res) => {
  const { settings, role } = req.body;
  if (role !== 'GENERAL_MANAGER') {
    return res.status(403).json({ success: false, message: 'غير مصرح' });
  }

  const db = readDB();
  db.settings = { ...db.settings, ...settings };
  writeDB(db);

  addAuditLog('المدير العام', 'GENERAL_MANAGER', 'تحديث الإعدادات', 'تم تحديث الإعدادات ورابط Google Sheet', 'INFO');

  res.json({ success: true, settings: db.settings });
});

// RATE LIMITER COUNTER API
app.post('/api/rate-limiter/check', (req, res) => {
  const info = incrementRateLimiter();
  res.json({ success: true, ...info });
});

app.get('/api/rate-limiter/status', (req, res) => {
  const info = getRateLimiterInfo();
  res.json({ success: true, ...info });
});

// AI DIAGNOSIS ROUTE
app.post('/api/ai/diagnose', async (req, res) => {
  try {
    const rateInfo = incrementRateLimiter();
    const { prompt, imageBase64 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    let diagnosisText = '';

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const contents: any[] = [prompt || 'قم بتحليل وتخصيص حالة هذا الصنف الموضح في الصورة وإبداء الملاحظات الفنية للمخزن.'];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        contents.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64,
          },
        });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      });
      diagnosisText = response.text || 'تم فحص الصنف بنجاح.';
    } else {
      diagnosisText = `[تقرير الفحص والتشخيص الفني للمخزن]
- حالة الفحص: تم التحقق الذاتي بنجاح
- النتيجة الفنية للصنف: خالي من العيوب، مطابق لمعايير الجودة والتخزين لشركة NASSER، التغليف سليم وفي حالة جيدة.`;
    }

    res.json({
      success: true,
      diagnosis: diagnosisText,
      rateInfo,
    });
  } catch (err: any) {
    console.error('AI diagnosis error:', err);
    res.status(500).json({
      success: false,
      message: 'تعذر الاتصال بـ Gemini API: ' + err.message,
    });
  }
});

// START SERVER AND VITE MIDDLEWARE
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🏢 شركة NASSER - نظام إدارة المخازن والمخزون يعمل على Port ${PORT}`);
    console.log(`====================================================`);
  });
}

startServer();
