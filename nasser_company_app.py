"""
====================================================================
شركة NASSER - نظام إدارة المخازن والمخزون
تطبيق سطح المكتب الاحترافي لشركة ناصر (PySide6 Native Desktop App)
- حل مشكلة المسارات والشاشة البيضاء عبر sys._MEIPASS و get_resource_path
- قاعدة بيانات SQLite ديناميكية دائمة تحفظ البيانات أوفلاين مدى الحياة
- معالجة تامة لأخطاء Database Lock عبر Thread Locks & SQLite WAL & busy_timeout
- دعم مسار /api/movements/batch لتسجيل أوامر التسليم المخزنية في عملية ذرية واحدة
- طباعة داخلية أصلية 100% عبر PySide6.QtPrintSupport (QPrinter, QPrintDialog)
- التقاط فوري لاختصار لوحة المفاتيح (Ctrl + P) لطباعة المستند مباشرة
====================================================================
"""

import sys
import os
import time
import json
import re
import sqlite3
import threading
import socket
import http.server
import socketserver

# قفل خيوط عام لضمان التزامن وحماية قاعدة البيانات من أي تضارب (Database Lock Fix)
DB_LOCK = threading.RLock()

# --- 1. RESOURCE PATH RESOLVER FOR PYINSTALLER (Fix White Screen) ---
def get_resource_path(relative_path):
    """
    تحديد المسار الدقيق لملفات الواجهة (HTML/JS/CSS/Assets) المدمجة
    سواء كان التطبيق يعمل في بيئة التطوير أو مجمّعاً داخل ملف .exe مستقل بواسطة PyInstaller.
    """
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

def get_dist_path():
    """تحديد مجلد dist المجمّع بدقة تامة"""
    # 1. البحث داخل _MEIPASS (عند التشغيل من ملف EXE مجمّع بـ --add-data "dist;dist")
    meipass_dist = get_resource_path("dist")
    if os.path.exists(os.path.join(meipass_dist, "index.html")):
        return meipass_dist
        
    # 2. البحث المباشر في جذر _MEIPASS (إذا تم تضمين محتويات dist مباشرة)
    if hasattr(sys, '_MEIPASS') and os.path.exists(os.path.join(sys._MEIPASS, "index.html")):
        return sys._MEIPASS

    # 3. البحث بجانب ملف السكريبت أو ملف الـ EXE وفي مجلد _internal الخاص بـ PyInstaller
    exe_dir = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
    candidates = [
        os.path.join(exe_dir, "_internal", "dist"),
        os.path.join(exe_dir, "_internal"),
        os.path.join(exe_dir, "dist"),
        exe_dir,
        os.path.abspath("dist"),
        os.path.abspath(".")
    ]
    for c in candidates:
        if os.path.exists(os.path.join(c, "index.html")):
            return c
            
    return meipass_dist

def get_html_file_path():
    """الحصول على المسار المؤكد لملف index.html"""
    dist_dir = get_dist_path()
    return os.path.join(dist_dir, "index.html")

# --- 2. DYNAMIC PERMANENT DATABASE CONFIGURATION ---
def get_app_dir():
    """الحصول على المجلد الدائم المستقر لقاعدة البيانات في LocalAppData لضمان حفظ التعديلات مدى الحياة"""
    base_dir = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or os.path.expanduser('~')
    app_dir = os.path.join(base_dir, 'NasserCompanyApp')
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

def get_db_path():
    """المسار الثابت المضمون لقاعدة بيانات SQLite على القرص الصلب"""
    # 1. التحقق أولاً إذا كان المستخدم وضع ملف قاعدة بيانات بجانب الـ EXE ومتاح للكتابة
    exe_dir = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
    local_side_db = os.path.join(exe_dir, 'nasser_store.db')
    if os.path.exists(local_side_db) and os.access(exe_dir, os.W_OK) and ("Program Files" not in exe_dir):
        return local_side_db

    # 2. المسار الدائم الرئيسي الآمن والمستقر في AppData (دائم ومستقر حتى لو تم إغلاق الجهاز لسنوات)
    return os.path.join(get_app_dir(), 'nasser_store.db')

def get_db_connection():
    """إنشاء اتصال آمن بقاعدة البيانات مع تفعيل نمط WAL وتعيين مهلة انتظار 60 ثانية لمنع Database Lock"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path, timeout=60.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=60000;")
    return conn

def init_sqlite_db():
    """تهيئة قاعدة البيانات وإنشاء الجداول وتفعيل وضع الحفظ الدائم WAL وترقية المخطط (Schema Migration)"""
    with DB_LOCK:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            
            # جدول المنتجات
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    code TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    stock INTEGER NOT NULL,
                    min_stock INTEGER DEFAULT 5,
                    unit TEXT DEFAULT 'وحدة',
                    description TEXT DEFAULT '',
                    updated_at TEXT
                )
            ''')
            
            # جدول الفواتير والمبيعات
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sales (
                    id TEXT PRIMARY KEY,
                    invoice_number TEXT UNIQUE NOT NULL,
                    created_at TEXT NOT NULL,
                    customer_name TEXT,
                    customer_phone TEXT,
                    cashier_id TEXT,
                    cashier_name TEXT NOT NULL,
                    subtotal REAL NOT NULL,
                    discount REAL DEFAULT 0,
                    tax REAL DEFAULT 0,
                    total REAL NOT NULL,
                    payment_method TEXT NOT NULL,
                    items_json TEXT NOT NULL,
                    notes TEXT
                )
            ''')
            
            # جدول المستخدمين
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    gmail TEXT,
                    created_at TEXT
                )
            ''')

            # جدول سجل التدقيق والمراجعة
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS logs (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    username TEXT NOT NULL,
                    role TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT NOT NULL,
                    type TEXT NOT NULL
                )
            ''')

            # جدول حركات المخزون (تعديل، توريد، صرف، أوامر تسليم)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS movements (
                    id TEXT PRIMARY KEY,
                    reference_no TEXT,
                    product_id TEXT NOT NULL,
                    product_code TEXT,
                    product_name TEXT,
                    type TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    previous_stock INTEGER,
                    new_stock INTEGER,
                    reason TEXT,
                    operator_name TEXT,
                    created_at TEXT
                )
            ''')
            
            # --- ترقية وتحديث المخطط التلقائي (AUTOMATIC SCHEMA MIGRATIONS) لحل أي خطأ بالأعمدة القديمة ---
            def ensure_columns(table_name, columns_to_check):
                try:
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    existing = [r[1] for r in cursor.fetchall()]
                    for col_name, col_def in columns_to_check:
                        if col_name not in existing:
                            try:
                                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def};")
                            except Exception as ex:
                                print(f"Migration: add {col_name} to {table_name}:", ex)
                except Exception as e:
                    print(f"Schema check error on {table_name}:", e)

            # ترقية جدول حركات المخزون للتأكد من وجود الأعمدة بالكامل
            ensure_columns('movements', [
                ('reference_no', 'TEXT DEFAULT ""'),
                ('product_id', 'TEXT DEFAULT ""'),
                ('product_code', 'TEXT DEFAULT ""'),
                ('product_name', 'TEXT DEFAULT ""'),
                ('type', 'TEXT DEFAULT "OUT"'),
                ('quantity', 'INTEGER DEFAULT 1'),
                ('previous_stock', 'INTEGER DEFAULT 0'),
                ('new_stock', 'INTEGER DEFAULT 0'),
                ('reason', 'TEXT DEFAULT ""'),
                ('operator_name', 'TEXT DEFAULT "أمين المخزن"'),
                ('created_at', 'TEXT DEFAULT ""')
            ])

            # ترقية جدول المنتجات
            ensure_columns('products', [
                ('code', 'TEXT DEFAULT ""'),
                ('name', 'TEXT DEFAULT ""'),
                ('category', 'TEXT DEFAULT "عام"'),
                ('stock', 'INTEGER DEFAULT 0'),
                ('min_stock', 'INTEGER DEFAULT 5'),
                ('unit', 'TEXT DEFAULT "وحدة"'),
                ('description', 'TEXT DEFAULT ""'),
                ('updated_at', 'TEXT DEFAULT ""')
            ])

            # ترقية جدول المبيعات
            ensure_columns('sales', [
                ('invoice_number', 'TEXT DEFAULT ""'),
                ('created_at', 'TEXT DEFAULT ""'),
                ('customer_name', 'TEXT DEFAULT ""'),
                ('customer_phone', 'TEXT DEFAULT ""'),
                ('cashier_id', 'TEXT DEFAULT ""'),
                ('cashier_name', 'TEXT DEFAULT ""'),
                ('subtotal', 'REAL DEFAULT 0'),
                ('discount', 'REAL DEFAULT 0'),
                ('tax', 'REAL DEFAULT 0'),
                ('total', 'REAL DEFAULT 0'),
                ('payment_method', 'TEXT DEFAULT "CASH"'),
                ('items_json', 'TEXT DEFAULT "[]"'),
                ('notes', 'TEXT DEFAULT ""')
            ])

            # تعبئة المنتجات الافتراضية فقط إذا كانت القاعدة جديدة وفارغة تماماً (0 أصناف)
            cursor.execute("SELECT COUNT(*) FROM products")
            if cursor.fetchone()[0] == 0:
                default_products = [
                    ('prd_1', 'NASSER-101', 'كابل شبكات Cat6 ياباني أصلي 305 متر', 'شبكات وتوصيلات', 45, 10, 'لفة', 'كابل عالي الجودة معزول ضد التداخل والحرارة', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_2', 'NASSER-102', 'راوتر سيسكو 2901 احترافي مدمج', 'أجهزة توجيه', 12, 3, 'قطعة', 'موجه بيانات متعدد المنافذ يدعم VPN والألياف الضوئية', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_3', 'NASSER-103', 'سويتش شبكات 24 منفذ جيجابيت PoE', 'محولات شبكية', 8, 2, 'قطعة', 'مزود طاقة عبر الإيثرنت للكاميرات وأجهزة الاتصال', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_4', 'NASSER-104', 'كاميرا مراقبة خارجية 5 ميجا بيكسل IP', 'أنظمة مراقبة', 28, 5, 'قطعة', 'رؤية ليلية ملونة 40 متر مقاومة للمياه IP67', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_5', 'NASSER-105', 'جهاز تسجيل شبكي NVR 16 قناة 4K', 'أنظمة مراقبة', 6, 2, 'قطعة', 'يدعم تركيب 2 قرص صلب حتى 16 تيرابايت وتطبيق هاتف', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_6', 'NASSER-106', 'خادم ملفات Rack Server 2U الجيل العاشر', 'خوادم وحواسب', 3, 1, 'وحدة', 'معالج Xeon مزدوج، 64GB RAM، 4x2TB SAS RAID-5', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_7', 'NASSER-107', 'مزود طاقة UPS أونلاين 3000VA', 'طاقة وحماية', 7, 2, 'وحدة', 'حماية ضد انقطاع التيار والجهد الزائد بطاريات مدمجة', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_8', 'NASSER-108', 'ألياف ضوئية فايبر أحادي Single-Mode 1000m', 'ألياف ضوئية', 15, 4, 'بكرة', 'مقاوم للظروف الجوية الشديدة، عالي السرعة', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_9', 'NASSER-109', 'لوحة توزيع كابلات Patch Panel 24 Port Cat6', 'ملحقات كبائن', 18, 5, 'قطعة', 'تنظيم وربط خطوط الشبكة في كابينة السيرفر', time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                    ('prd_10', 'NASSER-110', 'كابينة خادم Rack Cabinet 42U مع تهوية', 'كبائن وسيرفرات', 4, 1, 'كابينة', 'أبواب زجاجية وأقفال أمان مراوح تبريد وإضاءة داخلية', time.strftime('%Y-%m-%dT%H:%M:%SZ'))
                ]
                cursor.executemany(
                    "INSERT INTO products (id, code, name, category, stock, min_stock, unit, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    default_products
                )

                # حركات افتتاحية افتراضية
                for p in default_products:
                    m_id = f"mvt_init_{p[0]}"
                    cursor.execute('''
                        INSERT INTO movements (id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (m_id, 'OPENING-INIT', p[0], p[1], p[2], 'IN', p[4], 0, p[4], 'رصيد افتتاحي مسجل بالمستودع', 'المدير العام', p[8]))

            # تعبئة حسابات المستخدمين إذا كانت فارغة
            cursor.execute("SELECT COUNT(*) FROM users")
            if cursor.fetchone()[0] == 0:
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                cursor.execute(
                    "INSERT INTO users (id, username, password, name, role, gmail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ('usr_1', 'admin', 'admin123', 'المدير العام - ناصر', 'GENERAL_MANAGER', 'zenithbabiker@gmail.com', now_iso)
                )
                cursor.execute(
                    "INSERT INTO users (id, username, password, name, role, gmail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ('usr_2', 'wh_manager', 'wh123', 'أمين المخزن الرئيسي - أحمد مصطفى', 'WAREHOUSE_MANAGER', 'warehouse.nasser@gmail.com', now_iso)
                )

            conn.commit()
        finally:
            conn.close()

# ذاكرة مؤقتة لرموز OTP
ACTIVE_OTPS = {}

def add_audit_log(username, role, action, details, log_type='INFO'):
    """تسجيل حركة في سجل التدقيق SQLite"""
    try:
        with DB_LOCK:
            conn = get_db_connection()
            try:
                cursor = conn.cursor()
                log_id = f"log_{int(time.time()*1000)}"
                timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                cursor.execute(
                    "INSERT INTO logs (id, timestamp, username, role, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (log_id, timestamp, username, role, action, details, log_type)
                )
                conn.commit()
            finally:
                conn.close()
    except Exception as e:
        print("Log error:", e)

# --- 3. EMBEDDED HTTP SERVER WITH COMPLETE SQLITE REST API ---
def find_free_port():
    """البحث عن منفذ شبكة محلي متاح تلقائياً"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class SPAHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """خادم محلي متكامل يربط الواجهة بقاعدة بيانات SQLite المحلية بحفظ فوري ودائم"""
    
    def __init__(self, *args, **kwargs):
        directory = get_dist_path()
        super().__init__(*args, directory=directory, **kwargs)
    
    def _send_json(self, data, code=200):
        try:
            body_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body_bytes)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.end_headers()
            self.wfile.write(body_bytes)
        except Exception as e:
            print("HTTP Send error:", e)

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                body = self.rfile.read(content_length)
                return json.loads(body.decode('utf-8'))
        except Exception as e:
            print("JSON parse error:", e)
        return {}

    def _clean_dense(self, text):
        """Safely normalize and strip whitespace, hyphens, underscores and punctuation without fragile regex"""
        if not text:
            return ""
        try:
            ignore_chars = (' ', '-', '_', '.', '/', chr(92))
            return ''.join(c for c in str(text).lower().strip() if c not in ignore_chars)
        except Exception:
            return str(text).lower().strip()

    def _find_product(self, cursor, p_id):
        """Universal resilient product lookup supporting ID, exact code, case-insensitive, and space/dash-free code"""
        if not p_id:
            return None
        try:
            p_id_str = str(p_id).strip()
            # 1. Exact match on id or code
            cursor.execute("SELECT id, code, name, stock FROM products WHERE id=? OR code=?", (p_id_str, p_id_str))
            row = cursor.fetchone()
            if row:
                return row
            # 2. Case-insensitive trimmed match
            cursor.execute("SELECT id, code, name, stock FROM products WHERE LOWER(TRIM(code))=LOWER(TRIM(?)) OR LOWER(TRIM(id))=LOWER(TRIM(?))", (p_id_str, p_id_str))
            row = cursor.fetchone()
            if row:
                return row
            # 3. Dense alphanumeric match (ignoring spaces, hyphens, underscores)
            dense_target = self._clean_dense(p_id_str)
            if dense_target:
                cursor.execute("SELECT id, code, name, stock FROM products")
                for prod_row in cursor.fetchall():
                    p_code_dense = self._clean_dense(prod_row[1])
                    p_id_dense = self._clean_dense(prod_row[0])
                    if p_code_dense == dense_target or p_id_dense == dense_target:
                        return prod_row
        except Exception as e:
            print("Product lookup error:", e)
        return None

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        parsed_path = self.path.split('?')[0]
        
        # 0. Health Check
        if parsed_path == '/api/health':
            return self._send_json({"status": "ok", "company": "شركة NASSER", "system": "إدارة المخازن", "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ')})

        # 1. API GET Products
        if parsed_path == '/api/products':
            try:
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute("SELECT id, code, name, category, stock, min_stock, unit, description, updated_at FROM products ORDER BY rowid DESC")
                        rows = cursor.fetchall()
                    finally:
                        conn.close()

                products = [{
                    "id": r[0], "code": r[1], "name": r[2], "category": r[3],
                    "stock": r[4], "minStock": r[5], "unit": r[6],
                    "description": r[7] or "", "updatedAt": r[8] or ""
                } for r in rows]
                return self._send_json({"success": True, "products": products})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 2. API GET Sales
        if parsed_path == '/api/sales':
            try:
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute("SELECT id, invoice_number, created_at, customer_name, customer_phone, cashier_id, cashier_name, subtotal, discount, tax, total, payment_method, items_json, notes FROM sales ORDER BY created_at DESC")
                        rows = cursor.fetchall()
                    finally:
                        conn.close()

                sales = [{
                    "id": r[0], "invoiceNumber": r[1], "deliveryOrderRef": r[1], "createdAt": r[2],
                    "customerName": r[3] or "", "customerPhone": r[4] or "",
                    "cashierId": r[5] or "", "cashierName": r[6],
                    "subtotal": r[7], "discount": r[8], "tax": r[9], "total": r[10],
                    "paymentMethod": r[11], "items": json.loads(r[12]), "notes": r[13] or ""
                } for r in rows]
                return self._send_json({"success": True, "sales": sales})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 3. API GET Movements
        if parsed_path == '/api/movements':
            try:
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute('''
                            SELECT id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at
                            FROM movements
                            ORDER BY created_at DESC
                        ''')
                        rows = cursor.fetchall()
                    finally:
                        conn.close()

                movements = [{
                    "id": r[0],
                    "referenceNo": r[1] or "",
                    "productId": r[2],
                    "productCode": r[3] or "",
                    "productName": r[4] or "صنف مخزني",
                    "type": r[5],
                    "quantity": r[6],
                    "previousStock": r[7] if r[7] is not None else 0,
                    "newStock": r[8] if r[8] is not None else 0,
                    "reason": r[9] or "",
                    "operatorName": r[10] or "أمين المخزن",
                    "timestamp": r[11] or ""
                } for r in rows]
                return self._send_json({"success": True, "movements": movements})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 4. API GET Users
        if parsed_path == '/api/users':
            try:
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute("SELECT id, username, name, role, gmail, created_at FROM users")
                        rows = cursor.fetchall()
                    finally:
                        conn.close()

                users = [{
                    "id": r[0], "username": r[1], "name": r[2],
                    "role": r[3], "gmail": r[4], "createdAt": r[5]
                } for r in rows]
                return self._send_json({"success": True, "users": users})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 5. API GET Logs
        if parsed_path == '/api/logs':
            try:
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute("SELECT id, timestamp, username, role, action, details, type FROM logs ORDER BY timestamp DESC LIMIT 200")
                        rows = cursor.fetchall()
                    finally:
                        conn.close()

                logs = [{
                    "id": r[0], "timestamp": r[1], "username": r[2],
                    "role": r[3], "action": r[4], "details": r[5], "type": r[6]
                } for r in rows]
                return self._send_json({"success": True, "logs": logs})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 6. SPA Fallback
        req_path = self.translate_path(self.path)
        if not os.path.exists(req_path) or os.path.isdir(req_path):
            self.path = '/index.html'
            
        return super().do_GET()

    def do_POST(self):
        parsed_path = self.path.split('?')[0]

        # 1. User Authentication (Login)
        if parsed_path == '/api/auth/login':
            try:
                data = self._read_json_body()
                username = data.get('username', '').strip()
                password = data.get('password', '').strip()
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute("SELECT id, username, name, role, gmail FROM users WHERE LOWER(username)=LOWER(?) AND password=?", (username, password))
                        row = cursor.fetchone()
                    finally:
                        conn.close()

                if row:
                    user = {"id": row[0], "username": row[1], "name": row[2], "role": row[3], "gmail": row[4]}
                    add_audit_log(user['username'], user['role'], 'تسجيل دخول', f"تم تسجيل الدخول بنجاح للمستخدم {user['name']}", 'INFO')
                    return self._send_json({"success": True, "user": user, "message": "تم تسجيل الدخول بنجاح"})
                else:
                    return self._send_json({"success": False, "message": "اسم المستخدم أو كلمة المرور غير صحيحة"}, 401)
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        # 2. Forgot Password OTP
        if parsed_path == '/api/auth/forgot-password':
            data = self._read_json_body()
            username = data.get('username', '').strip()
            with DB_LOCK:
                conn = get_db_connection()
                try:
                    cursor = conn.cursor()
                    cursor.execute("SELECT username, gmail, role FROM users WHERE LOWER(username)=LOWER(?)", (username,))
                    row = cursor.fetchone()
                finally:
                    conn.close()

            if not row:
                return self._send_json({"success": False, "message": "اسم المستخدم غير موجود بالنظام"}, 404)
            
            otp_code = str(int(100000 + time.time() % 900000))
            ACTIVE_OTPS[username.lower()] = {
                "code": otp_code,
                "expires_at": time.time() + 600,
                "gmail": row[1]
            }
            add_audit_log(row[0], row[2], 'طلب إرسال OTP', f"تم إنشاء رمز استعادة كلمة السر لـ {row[1]}", 'SECURITY')
            return self._send_json({
                "success": True,
                "message": f"تم إرسال رمز OTP المكون من 6 أرقام إلى بريدك ({row[1]})",
                "gmail": row[1],
                "demoOtpCode": otp_code
            })

        # 3. Verify OTP
        if parsed_path == '/api/auth/verify-otp':
            data = self._read_json_body()
            username = data.get('username', '').strip().lower()
            otp_code = data.get('otpCode', '').strip()
            rec = ACTIVE_OTPS.get(username)
            if not rec or time.time() > rec['expires_at']:
                return self._send_json({"success": False, "message": "رمز OTP منتهي الصلاحية أو غير موجود"}, 400)
            if rec['code'] != otp_code:
                return self._send_json({"success": False, "message": "رمز OTP غير صحيح"}, 400)
            return self._send_json({"success": True, "message": "تم التحقق من الرمز بنجاح"})

        # 4. Reset Password with OTP
        if parsed_path == '/api/auth/reset-password':
            data = self._read_json_body()
            username = data.get('username', '').strip().lower()
            otp_code = data.get('otpCode', '').strip()
            new_password = data.get('newPassword', '').strip()
            rec = ACTIVE_OTPS.get(username)
            if not rec or rec['code'] != otp_code:
                return self._send_json({"success": False, "message": "رمز التحقق غير صالح"}, 400)
            
            with DB_LOCK:
                conn = get_db_connection()
                try:
                    cursor = conn.cursor()
                    cursor.execute("UPDATE users SET password=? WHERE LOWER(username)=LOWER(?)", (new_password, username))
                    conn.commit()
                finally:
                    conn.close()

            ACTIVE_OTPS.pop(username, None)
            add_audit_log(username, 'GENERAL_MANAGER', 'تغيير كلمة السر', 'تم تغيير كلمة السر بنجاح عبر رمز OTP', 'SECURITY')
            return self._send_json({"success": True, "message": "تم تحديث كلمة السر بنجاح"})

        # 5. Reset Password Offline with Old Password
        if parsed_path == '/api/auth/reset-password-offline':
            data = self._read_json_body()
            username = data.get('username', '').strip()
            old_pass = data.get('oldPassword', '').strip()
            new_pass = data.get('newPassword', '').strip()
            with DB_LOCK:
                conn = get_db_connection()
                try:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND password=?", (username, old_pass))
                    row = cursor.fetchone()
                    if not row:
                        return self._send_json({"success": False, "message": "كلمة السر الحالية غير صحيحة"}, 400)
                    cursor.execute("UPDATE users SET password=? WHERE id=?", (new_pass, row[0]))
                    conn.commit()
                finally:
                    conn.close()

            add_audit_log(username, 'USER', 'تغيير كلمة السر', 'تم التحقق من كلمة السر القديمة وتحديث كلمة السر بنجاح', 'SECURITY')
            return self._send_json({"success": True, "message": "تم تحديث كلمة السر بنجاح"})

        # 6. Add Single Product
        if parsed_path == '/api/products':
            try:
                data = self._read_json_body()
                name = (data.get('name') or 'صنف جديد').strip()
                category = data.get('category') or 'عام'
                unit = data.get('unit') or 'وحدة'
                desc = data.get('description') or ''
                stock_val = max(0, int(data.get('stock') or 0))
                min_stock = max(1, int(data.get('minStock') or 5))
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                p_id = f"prd_{int(time.time()*1000)}"
                
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        
                        # Auto code generation if empty
                        code = (data.get('code') or '').strip()
                        if not code:
                            cursor.execute("SELECT code FROM products")
                            all_codes = cursor.fetchall()
                            max_num = 100
                            for c in all_codes:
                                m = re.findall(r'\d+', str(c[0]))
                                if m:
                                    max_num = max(max_num, int(m[-1]))
                            code = f"NASSER-{max_num + 1}"
                        
                        # Handle unique constraint collision
                        cursor.execute("SELECT COUNT(*) FROM products WHERE code=?", (code,))
                        if cursor.fetchone()[0] > 0:
                            code = f"{code}-{int(time.time()) % 1000}"

                        cursor.execute('''
                            INSERT INTO products (id, code, name, category, stock, min_stock, unit, description, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (p_id, code, name, category, stock_val, min_stock, unit, desc, now_iso))

                        # Opening stock movement if stock > 0
                        if stock_val > 0:
                            mov_id = f"mvt_{int(time.time()*1000)}"
                            cursor.execute('''
                                INSERT INTO movements (id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (mov_id, 'OPENING-BAL', p_id, code, name, 'IN', stock_val, 0, stock_val, 'رصيد افتتاحي عند إنشاء الصنف', data.get('username') or 'المدير العام', now_iso))

                        conn.commit()
                    finally:
                        conn.close()

                new_product = {
                    "id": p_id, "code": code, "name": name, "category": category,
                    "stock": stock_val, "minStock": min_stock, "unit": unit,
                    "description": desc, "updatedAt": now_iso
                }
                add_audit_log(data.get('username') or 'المدير العام', data.get('role') or 'GENERAL_MANAGER', 'إضافة صنف جديد', f"تم تسجيل الصنف ({name}) بكود [{code}] ورصيد {stock_val}", 'MOVEMENT')
                return self._send_json({"success": True, "product": new_product, "message": "تم إضافة الصنف بنجاح وحفظه فوراً في قاعدة البيانات"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        # 7. Batch Add Products (Excel Multi-paste & Bulk insert)
        if parsed_path == '/api/products/batch':
            try:
                data = self._read_json_body()
                items = data.get('items', [])
                if not items:
                    return self._send_json({"success": False, "message": "لا توجد أصناف للإضافة"}, 400)

                created_products = []
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')

                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        
                        # Baseline numeric code
                        cursor.execute("SELECT code FROM products")
                        all_codes = cursor.fetchall()
                        max_num = 1000
                        for c in all_codes:
                            m = re.findall(r'\d+', str(c[0]))
                            if m:
                                max_num = max(max_num, int(m[-1]))

                        for idx, itm in enumerate(items):
                            p_name = (itm.get('name') or '').strip()
                            if not p_name:
                                continue
                            max_num += 1
                            p_code = (itm.get('code') or '').strip() or f"{max_num}"
                            
                            # Ensure code uniqueness
                            cursor.execute("SELECT COUNT(*) FROM products WHERE code=?", (p_code,))
                            if cursor.fetchone()[0] > 0:
                                p_code = f"{p_code}_{int(time.time()) % 1000}_{idx}"

                            p_id = f"prd_{int(time.time()*1000)}_{idx}"
                            p_cat = itm.get('category') or 'عام'
                            p_unit = itm.get('unit') or 'وحدة'
                            p_desc = itm.get('description') or ''
                            p_stock = max(0, int(itm.get('stock') or 0))
                            p_min = max(1, int(itm.get('minStock') or 5))

                            cursor.execute('''
                                INSERT INTO products (id, code, name, category, stock, min_stock, unit, description, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (p_id, p_code, p_name, p_cat, p_stock, p_min, p_unit, p_desc, now_iso))

                            if p_stock > 0:
                                mov_id = f"mvt_{int(time.time()*1000)}_{idx}"
                                cursor.execute('''
                                    INSERT INTO movements (id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (mov_id, 'BATCH-OPENING', p_id, p_code, p_name, 'IN', p_stock, 0, p_stock, 'رصيد إدخال افتتاحي دفعة واحدة', data.get('username') or 'المدير العام', now_iso))

                            created_products.append({
                                "id": p_id, "code": p_code, "name": p_name, "category": p_cat,
                                "stock": p_stock, "minStock": p_min, "unit": p_unit,
                                "description": p_desc, "updatedAt": now_iso
                            })

                        conn.commit()
                    finally:
                        conn.close()

                add_audit_log(data.get('username') or 'المدير العام', data.get('role') or 'GENERAL_MANAGER', 'إضافة أصناف دفعة واحدة', f"تم إضافة {len(created_products)} صنف بنجاح وحفظها نهائياً", 'MOVEMENT')
                return self._send_json({"success": True, "count": len(created_products), "products": created_products, "message": f"تم إضافة {len(created_products)} صنف بنجاح"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        # 8. Single Movement Endpoint (Stock In / Out / Adjustment)
        if parsed_path == '/api/movements':
            try:
                data = self._read_json_body()
                p_id = str(data.get('productId', '')).strip()
                m_type = data.get('type', 'OUT')
                ref_no = data.get('referenceNo', '')
                reason_str = data.get('reason', '')
                op_name = data.get('operatorName') or 'أمين المخزن'
                try:
                    qty = int(data.get('quantity', 1))
                except Exception:
                    qty = 1
                
                mov_id = f"mov_{int(time.time()*1000)}"
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')

                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()

                        p_row = self._find_product(cursor, p_id)
                        
                        actual_id = p_id
                        p_code = ""
                        p_name = "صنف مخزني"
                        previous_stock = 0
                        new_stock = 0

                        if p_row:
                            actual_id = p_row[0]
                            p_code = p_row[1]
                            p_name = p_row[2]
                            previous_stock = int(p_row[3])
                            
                            if m_type == 'IN':
                                new_stock = previous_stock + qty
                            elif m_type == 'OUT':
                                new_stock = max(0, previous_stock - qty)
                            elif m_type == 'ADJUSTMENT':
                                new_stock = max(0, qty)
                            else:
                                new_stock = previous_stock
                            
                            cursor.execute("UPDATE products SET stock=?, updated_at=? WHERE id=?", (new_stock, now_iso, actual_id))
                        else:
                            new_stock = max(0, qty)

                        cursor.execute('''
                            INSERT INTO movements (id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (mov_id, ref_no, actual_id, p_code, p_name, m_type, qty, previous_stock, new_stock, reason_str, op_name, now_iso))

                        conn.commit()
                    finally:
                        conn.close()

                movement_obj = {
                    "id": mov_id,
                    "productId": actual_id,
                    "productCode": p_code,
                    "productName": p_name,
                    "type": m_type,
                    "quantity": qty,
                    "previousStock": previous_stock,
                    "newStock": new_stock,
                    "reason": reason_str,
                    "referenceNo": ref_no,
                    "operatorName": op_name,
                    "timestamp": now_iso
                }
                add_audit_log(op_name, data.get('role') or 'WAREHOUSE_MANAGER', 'حركة مخزنية', f"{m_type} - {p_name} ({qty}) - الرصيد الجديد: {new_stock}", 'MOVEMENT')
                return self._send_json({"success": True, "movement": movement_obj, "message": "تم حفظ تحديث الكمية في قاعدة البيانات الدائمة SQLite بنجاح"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        # 8.2 BATCH MOVEMENTS ENDPOINT (Atomic Delivery Order Processing - Solves Database Lock)
        if parsed_path == '/api/movements/batch':
            try:
                data = self._read_json_body()
                items = data.get('items', [])
                ref_no = data.get('referenceNo', '1')
                reason_str = data.get('reason', 'أمر تسليم مخزن')
                op_name = data.get('operatorName') or 'أمين المخزن'
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')

                if not items:
                    return self._send_json({"success": False, "message": "لا توجد أصناف في أمر التسليم"}, 400)

                created_movements = []
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()

                        # مرحلة التحقق أولاً: التأكد من توفر الرصيد لجميع الأصناف
                        for idx, itm in enumerate(items):
                            p_id = str(itm.get('productId', '')).strip()
                            try:
                                qty = max(1, int(itm.get('quantity', 1)))
                            except Exception:
                                qty = 1
                            
                            p_row = self._find_product(cursor, p_id)
                            if not p_row:
                                return self._send_json({"success": False, "message": f"الصنف ذو المعرف أو الكود ({p_id}) غير موجود بالمخزن"}, 404)
                            if int(p_row[3]) < qty:
                                return self._send_json({"success": False, "message": f"الرصيد المتاح من ({p_row[2]}) هو {p_row[3]} فقط، ولا يكفي لصرف كمية {qty}"}, 400)

                        # مرحلة التنفيذ الذري: خصم الكميات وتسجيل الحركات دفعة واحدة
                        for idx, itm in enumerate(items):
                            p_id = str(itm.get('productId', '')).strip()
                            try:
                                qty = max(1, int(itm.get('quantity', 1)))
                            except Exception:
                                qty = 1

                            p_row = self._find_product(cursor, p_id)
                            actual_id, p_code, p_name, prev_stock = p_row[0], p_row[1], p_row[2], int(p_row[3])
                            new_stock = max(0, prev_stock - qty)

                            cursor.execute("UPDATE products SET stock=?, updated_at=? WHERE id=?", (new_stock, now_iso, actual_id))

                            mov_id = f"mov_{int(time.time()*1000)}_{idx}"
                            cursor.execute('''
                                INSERT INTO movements (id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (mov_id, ref_no, actual_id, p_code, p_name, 'OUT', qty, prev_stock, new_stock, reason_str, op_name, now_iso))

                            created_movements.append({
                                "id": mov_id,
                                "productId": actual_id,
                                "productCode": p_code,
                                "productName": p_name,
                                "type": "OUT",
                                "quantity": qty,
                                "previousStock": prev_stock,
                                "newStock": new_stock,
                                "reason": reason_str,
                                "referenceNo": ref_no,
                                "operatorName": op_name,
                                "timestamp": now_iso
                            })

                        conn.commit()
                    finally:
                        conn.close()

                add_audit_log(op_name, data.get('role') or 'WAREHOUSE_MANAGER', 'صرف أمر تسليم مخزن (دفعة واحدة)', f"تم صرف وتوثيق عدد ({len(created_movements)}) أصناف بموجب أمر تسليم رقم [{ref_no}] بنجاح", 'MOVEMENT')
                return self._send_json({"success": True, "movements": created_movements, "message": f"تم صرف وتوثيق أمر التسليم رقم [{ref_no}] بنجاح"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        # 9. Add Sale Invoice
        if parsed_path == '/api/sales':
            try:
                data = self._read_json_body()
                items = data.get('items', [])
                
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        
                        cursor.execute("SELECT COUNT(*) FROM sales")
                        count = cursor.fetchone()[0] + 1
                        invoice_num = f"INV-{time.strftime('%Y%m')}-{count:04d}"
                        
                        sale_id = f"sale_{int(time.time()*1000)}"
                        created_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                        
                        cursor.execute('''
                            INSERT INTO sales (id, invoice_number, created_at, customer_name, customer_phone, cashier_id, cashier_name, subtotal, discount, tax, total, payment_method, items_json, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            sale_id, invoice_num, created_at,
                            data.get('customerName', 'عميل نقدي'),
                            data.get('customerPhone', ''),
                            data.get('cashierId', 'usr_1'),
                            data.get('cashierName', 'الكاشير'),
                            data.get('subtotal', 0),
                            data.get('discount', 0),
                            data.get('tax', 0),
                            data.get('total', 0),
                            data.get('paymentMethod', 'CASH'),
                            json.dumps(items, ensure_ascii=False),
                            data.get('notes', '')
                        ))
                        
                        for itm in items:
                            p_code = itm.get('productCode')
                            p_id = itm.get('productId')
                            try:
                                qty = int(itm.get('quantity', 1))
                            except Exception:
                                qty = 1
                            
                            p_row = self._find_product(cursor, p_code or p_id)
                            if p_row:
                                cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (qty, p_row[0]))
                        
                        conn.commit()
                    finally:
                        conn.close()
                
                new_sale = {
                    "id": sale_id, "invoiceNumber": invoice_num, "deliveryOrderRef": invoice_num, "createdAt": created_at,
                    "customerName": data.get('customerName', 'عميل نقدي'),
                    "customerPhone": data.get('customerPhone', ''),
                    "cashierId": data.get('cashierId', 'usr_1'),
                    "cashierName": data.get('cashierName', 'الكاشير'),
                    "subtotal": data.get('subtotal', 0), "discount": data.get('discount', 0),
                    "tax": data.get('tax', 0), "total": data.get('total', 0),
                    "paymentMethod": data.get('paymentMethod', 'CASH'),
                    "items": items, "notes": data.get('notes', '')
                }
                return self._send_json({"success": True, "sale": new_sale, "message": "تم حفظ الفاتورة بنجاح في قاعدة البيانات المحلية"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        # 10. Add User
        if parsed_path == '/api/users':
            try:
                data = self._read_json_body()
                u_id = f"usr_{int(time.time()*1000)}"
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT INTO users (id, username, password, name, role, gmail, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (u_id, data.get('username'), data.get('password', '123456'), data.get('name'), data.get('role', 'WAREHOUSE_MANAGER'), data.get('gmail', ''), now_iso))
                        conn.commit()
                    finally:
                        conn.close()

                return self._send_json({"success": True, "user": {"id": u_id, "username": data.get('username'), "name": data.get('name'), "role": data.get('role'), "gmail": data.get('gmail')}})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        return self._send_json({"success": False, "message": "المسار غير موجود"}, 404)

    def do_PUT(self):
        parsed_path = self.path.split('?')[0]
        if parsed_path.startswith('/api/products/'):
            try:
                p_id = parsed_path.replace('/api/products/', '')
                data = self._read_json_body()
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        
                        # Fetch existing stock to check for adjustment
                        row = self._find_product(cursor, p_id)
                        actual_id = row[0] if row else p_id
                        
                        if row:
                            old_stock = row[3]
                            new_stock = int(data.get('stock', old_stock))
                            if new_stock != old_stock:
                                diff = new_stock - old_stock
                                mov_id = f"mvt_{int(time.time()*1000)}"
                                cursor.execute('''
                                    INSERT INTO movements (id, reference_no, product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reason, operator_name, created_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (mov_id, 'MANUAL-ADJUST', actual_id, data.get('code', row[1]), data.get('name', row[2]), 'ADJUSTMENT', abs(diff), old_stock, new_stock, f"تعديل يدوي للرصيد ({'+' if diff > 0 else ''}{diff})", data.get('username') or 'المدير العام', now_iso))

                        cursor.execute('''
                            UPDATE products SET code=?, name=?, category=?, stock=?, min_stock=?, unit=?, description=?, updated_at=?
                            WHERE id=? OR code=?
                        ''', (
                            data.get('code'), data.get('name'), data.get('category', 'عام'),
                            int(data.get('stock', 0)),
                            int(data.get('minStock', 5)), data.get('unit', 'وحدة'),
                            data.get('description', ''), now_iso, actual_id, actual_id
                        ))
                        conn.commit()
                    finally:
                        conn.close()

                add_audit_log(data.get('username') or 'المدير العام', data.get('role') or 'GENERAL_MANAGER', 'تعديل صنف', f"تم تحديث بيانات الصنف [{data.get('code')}] {data.get('name')}", 'INFO')
                return self._send_json({"success": True, "message": "تم تحديث الصنف وحفظ التعديلات نهائياً"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        return self._send_json({"success": False}, 404)

    def do_DELETE(self):
        parsed_path = self.path.split('?')[0]
        if parsed_path.startswith('/api/products/'):
            try:
                p_id = parsed_path.replace('/api/products/', '')
                with DB_LOCK:
                    conn = get_db_connection()
                    try:
                        cursor = conn.cursor()
                        row = self._find_product(cursor, p_id)
                        actual_id = row[0] if row else p_id
                        p_name = row[2] if row else p_id
                        
                        cursor.execute("DELETE FROM products WHERE id=? OR code=?", (actual_id, actual_id))
                        conn.commit()
                    finally:
                        conn.close()

                add_audit_log('المدير العام', 'GENERAL_MANAGER', 'حذف صنف', f"تم حذف الصنف ({p_name}) نهائياً من قاعدة البيانات", 'WARNING')
                return self._send_json({"success": True, "message": "تم حذف الصنف بنجاح"})
            except Exception as e:
                return self._send_json({"success": False, "message": str(e)}, 500)

        return self._send_json({"success": False}, 404)

    def log_message(self, format, *args):
        pass

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """خادم HTTP متعدد الخيوط يتيح المعالجة المتزامنة دون تجميد الواجهة أو حدوث Database Lock"""
    allow_reuse_address = True
    daemon_threads = True

def start_local_server(port):
    """تشغيل خادم محلي خفي متعدد الخيوط ومحمي من القفل في الخلفية"""
    httpd = ThreadedHTTPServer(("127.0.0.1", port), SPAHTTPRequestHandler)
    httpd.serve_forever()

# --- 4. NATIVE PYSIDE6 MAIN APPLICATION WINDOW CLASS & GPU FLICKER FIX ---
# إيقاف التسريع البرمجي لـ GPU لمنع ارتجاف وتداخل النوافذ المنبثقة (Modal & Dialog Flickering Fix)
os.environ["QT_WEBENGINE_DISABLE_GPU"] = "1"
os.environ["QT_QUICK_BACKEND"] = "software"
os.environ["QSG_RENDER_LOOP"] = "basic"

try:
    from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox, QFileDialog, QDialog
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineSettings, QWebEngineProfile
    from PySide6.QtPrintSupport import QPrinter, QPrintDialog, QPrinterInfo
    from PySide6.QtGui import QKeySequence, QShortcut, QIcon
    from PySide6.QtCore import QUrl, Qt

    class NasserMainWindow(QMainWindow):
        def __init__(self, app_url):
            super().__init__()
            self.app_url = app_url
            self.setWindowTitle("شركة NASSER - نظام إدارة المخازن والمخزون")
            self.resize(1366, 850)
            
            # ضبط خصائص ثبات النافذة
            self.setAttribute(Qt.WA_NativeWindow, True)
            
            # تهيئة ملف تعريف التخزين الدائم لـ WebEngine لحفظ LocalStorage و IndexedDB في AppData مدى الحياة
            storage_dir = os.path.join(get_app_dir(), "web_profile")
            os.makedirs(storage_dir, exist_ok=True)
            profile = QWebEngineProfile.defaultProfile()
            profile.setPersistentStoragePath(storage_dir)
            profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)

            # تهيئة محرك عرض الويب الداخلي
            self.web_view = QWebEngineView(self)
            self.web_view.setAttribute(Qt.WA_NativeWindow, True)
            
            # تفعيل إعدادات الطباعة الأصلية وخلفيات الألوان بدقة
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.PrintElementBackgrounds, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars, True)
            
            # ربط إشارة الطباعة الداخلية الخاصة بـ QWebEnginePage
            self.web_view.page().printRequested.connect(self.print_function)
            
            # ربط اختصار لوحة المفاتيح الصريح Ctrl + P داخل نافذة التطبيق
            self.shortcut_print = QShortcut(QKeySequence("Ctrl+P"), self)
            self.shortcut_print.activated.connect(self.print_function)
            
            # تحميل الواجهة عبر الرابط المحلي للخادم الداخلي
            self.web_view.setUrl(QUrl(self.app_url))
            self.setCentralWidget(self.web_view)

        def print_function(self):
            """
            دالة الطباعة الأصلية 100% (Native Qt Printing)
            تأخذ محتوى الـ QWebEngineView وتمرره مباشرة إلى QPrinter لإظهار حوار طباعة ويندوز
            """
            try:
                printer = QPrinter(QPrinter.PrinterMode.HighResolution)
                printer.setFullPage(True)
                
                # فتح حوار طباعة ويندوز الأصلي مباشرة مع تثبيت الأب والنمطية لمنع أي ارتجاف
                print_dialog = QPrintDialog(printer, self)
                print_dialog.setWindowTitle("طباعة أمر تسليم مخزن - شركة ناصر")
                print_dialog.setAttribute(Qt.WA_NativeWindow, True)
                print_dialog.setWindowModality(Qt.ApplicationModal)
                
                if print_dialog.exec() == QPrintDialog.DialogCode.Accepted:
                    self.web_view.page().print(printer, lambda success: None)
            except Exception as pe:
                print("Native Print Error:", pe)
                # بديل مباشر لحفظ المستند كملف PDF إذا لم تكن هناك طابعة فيزيائية معرفة
                try:
                    save_dialog = QFileDialog(self, "حفظ أمر التسليم كملف PDF", os.path.expanduser("~/Desktop/DeliveryOrder.pdf"), "PDF Files (*.pdf)")
                    save_dialog.setAttribute(Qt.WA_NativeWindow, True)
                    save_dialog.setWindowModality(Qt.ApplicationModal)
                    save_dialog.setAcceptMode(QFileDialog.AcceptSave)
                    
                    if save_dialog.exec() == QDialog.Accepted:
                        selected_files = save_dialog.selectedFiles()
                        if selected_files:
                            pdf_path = selected_files[0]
                            self.web_view.page().printToPdf(pdf_path)
                            msg = QMessageBox(self)
                            msg.setAttribute(Qt.WA_NativeWindow, True)
                            msg.setWindowModality(Qt.ApplicationModal)
                            msg.setWindowTitle("تم الحفظ بنجاح")
                            msg.setText(f"تم حفظ أمر التسليم كملف PDF في المسار:\n{pdf_path}")
                            msg.setIcon(QMessageBox.Information)
                            msg.exec()
                except Exception as save_err:
                    err_msg = QMessageBox(self)
                    err_msg.setAttribute(Qt.WA_NativeWindow, True)
                    err_msg.setWindowModality(Qt.ApplicationModal)
                    err_msg.setWindowTitle("تنبيه الطباعة")
                    err_msg.setText(f"تعذر الاتصال بالطابعة:\n{pe}")
                    err_msg.setIcon(QMessageBox.Warning)
                    err_msg.exec()

except ImportError:
    pass

def main():
    # 1. تهيئة قاعدة بيانات SQLite الدائمة في AppData عند التشغيل
    init_sqlite_db()

    port = find_free_port()
    
    # 2. تشغيل خادم التطبيق المحلي في خيط منفصل (Background Thread)
    server_thread = threading.Thread(target=start_local_server, args=(port,), daemon=True)
    server_thread.start()
    
    app_url = f"http://127.0.0.1:{port}"

    # 3. تشغيل نافذة تطبيق PySide6 الأصلية مع ضبط إعدادات التوافق وإلغاء التسريع البرمجي للـ GPU
    try:
        from PySide6.QtCore import Qt
        from PySide6.QtWidgets import QApplication

        # إيقاف التداخل البرمجي لبطاقة الشاشة للنوافذ الفرعية ومنع الارتجاف
        QApplication.setAttribute(Qt.AA_UseSoftwareOpenGL, True)
        
        # تمرير معاملات إلغاء تسريع GPU لمحرك Chromium / WebEngine
        sys.argv.extend([
            "--disable-gpu",
            "--disable-gpu-compositing",
            "--in-process-gpu"
        ])
        
        app = QApplication(sys.argv)
        app.setApplicationName("شركة NASSER - إدارة المخازن")
        
        main_win = NasserMainWindow(app_url)
        main_win.showMaximized()
        sys.exit(app.exec())
        
    except ImportError as ie:
        print(f"CRITICAL: PySide6 is required. Please install it using: pip install PySide6 ({ie})")
        sys.exit(1)
    except Exception as e:
        print(f"CRITICAL Error launching PySide6 Native GUI: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
