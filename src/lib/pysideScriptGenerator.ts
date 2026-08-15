/**
 * Standalone Native Python PySide6 Launcher Generator for شركة NASSER Desktop (.exe)
 * Uses pure PySide6 QWebEngineView + PySide6.QtPrintSupport (QPrinter, QPrintDialog)
 * with SQLite LocalAppData/Portable engine for 100% offline native Windows execution and native direct printing.
 * Zero external browser/app dependencies.
 */

export function generatePySideScript(): string {
  return `"""
====================================================================
شركة NASSER - نظام إدارة المخازن والمخزون
تطبيق سطح المكتب الاحترافي لشركة ناصر (PySide6 Native Desktop App)
- حل مشكلة المسارات والشاشة البيضاء عبر sys._MEIPASS و get_resource_path
- قاعدة بيانات SQLite ديناميكية دائمة تحفظ البيانات أوفلاين مدى الحياة
- طباعة داخلية أصلية 100% عبر PySide6.QtPrintSupport (QPrinter, QPrintDialog)
- التقاط فوري لاختصار لوحة المفاتيح (Ctrl + P) لطباعة المستند مباشرة
====================================================================
"""

import sys
import os
import time
import json
import sqlite3
import threading
import socket
import http.server
import socketserver

# --- 1. RESOURCE PATH RESOLVER FOR PYINSTALLER (Fix White Screen) ---
def get_resource_path(relative_path):
    """
    تحديد المسار الدقيق لملفات الواجهة (HTML/JS/CSS/Assets) المدمجة
    سواء كان التطبيق يعمل في بيئة التطوير أو مجمّعاً داخل ملف .exe مستقل بواسطة PyInstaller.
    """
    if hasattr(sys, '_MEIPASS'):
        # المسار المؤقت الداخلي الذي يستخرجه PyInstaller
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

    # 3. البحث بجانب ملف السكريبت أو ملف الـ EXE
    exe_dir = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
    candidates = [
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
    """الحصول على المجلد الدائم لقاعدة البيانات في LocalAppData لضمان حفظ التعديلات مدى الحياة"""
    app_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'NasserCompanyApp')
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

def get_db_path():
    """المسار الثابت لقاعدة بيانات SQLite على القرص الصلب"""
    # 1. التحقق أولاً إذا كان المستخدم وضع ملف database.db مخصص بجانب الـ EXE
    exe_dir = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
    local_side_db = os.path.join(exe_dir, 'nasser_store.db')
    if os.path.exists(local_side_db):
        return local_side_db

    # 2. المسار الدائم الرئيسي في AppData
    return os.path.join(get_app_dir(), 'nasser_store.db')

def init_sqlite_db():
    """تهيئة قاعدة البيانات وإنشاء الجداول وتفعيل وضع الحفظ الدائم WAL على القرص الصلب"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # تفعيل وضع WAL لضمان الحفظ الفوري المقاوم لانقطاع التيار وإغلاق الجهاز لسنوات
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=FULL;")
    
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
            gmail TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    # جدول حركات المخزون وأوامر التسليم
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movements (
            id TEXT PRIMARY KEY,
            reference_no TEXT,
            product_id TEXT NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reason TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    ''')
    
    # تعبئة المنتجات الافتراضية فقط إذا كانت القاعدة جديدة وفارغة تماماً (0 أصناف)
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        default_products = [
            ('1', 'NASSER-101', 'ماكينة إعداد القهوة الإسبيرسو الاحترافية NASSER Pro 3', 'أجهزة ومعدات', 45, 5, 'وحدة', '', now_iso),
            ('2', 'NASSER-102', 'طاحونة حبوب القهوة الصناعية 1500W دقيقة التنعيم', 'أجهزة ومعدات', 22, 5, 'وحدة', '', now_iso),
            ('3', 'NASSER-103', 'طابعة فواتير حرارية عالية السرعة 80mm USB/LAN', 'إلكترونيات ومعدات', 18, 5, 'وحدة', '', now_iso),
            ('4', 'NASSER-104', 'ميزان إلكتروني ديجيتال دقيق للوزن والجرعات 0.1g', 'أجهزة قياس', 4, 5, 'وحدة', '', now_iso),
            ('5', 'NASSER-105', 'فلتر تنقية وتقطير المياه خماسي المراحل للمقاهي', 'مستلزمات ومستهلكات', 60, 5, 'وحدة', '', now_iso),
            ('6', 'NASSER-106', 'مقبض ضغط القهوة اليدوي (Tamper) استانلس ستيل 58mm', 'ملحقات ومستلزمات', 85, 5, 'وحدة', '', now_iso),
        ]
        cursor.executemany(
            "INSERT INTO products (id, code, name, category, stock, min_stock, unit, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            default_products
        )
        conn.commit()
        
    # تعبئة المستخدمين الافتراضيين إذا كانت القاعدة فارغة
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

    conn.close()

# --- 3. EMBEDDED HTTP SERVER WITH SQLITE API BRIDGE ---
def find_free_port():
    """البحث عن منفذ شبكة محلي متاح تلقائياً"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class SPAHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """خادم محلي يخدم ملفات الويب ويربط الواجهة بقاعدة بيانات SQLite المحلية"""
    
    def __init__(self, *args, **kwargs):
        directory = get_dist_path()
        super().__init__(*args, directory=directory, **kwargs)
    
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length)
            return json.loads(body.decode('utf-8'))
        return {}

    def do_GET(self):
        parsed_path = self.path.split('?')[0]
        
        # 1. API GET Products
        if parsed_path == '/api/products':
            try:
                conn = sqlite3.connect(get_db_path())
                cursor = conn.cursor()
                cursor.execute("SELECT id, code, name, category, stock, min_stock, unit, description, updated_at FROM products")
                rows = cursor.fetchall()
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
                conn = sqlite3.connect(get_db_path())
                cursor = conn.cursor()
                cursor.execute("SELECT id, invoice_number, created_at, customer_name, customer_phone, cashier_id, cashier_name, subtotal, discount, tax, total, payment_method, items_json, notes FROM sales ORDER BY created_at DESC")
                rows = cursor.fetchall()
                conn.close()
                sales = [{
                    "id": r[0], "invoiceNumber": r[1], "createdAt": r[2],
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
                conn = sqlite3.connect(get_db_path())
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT m.id, m.reference_no, m.product_id, p.code, p.name, m.type, m.quantity, m.reason, m.created_at
                    FROM movements m
                    LEFT JOIN products p ON m.product_id = p.id
                    ORDER BY m.created_at DESC
                ''')
                rows = cursor.fetchall()
                conn.close()
                movements = [{
                    "id": r[0],
                    "referenceNo": r[1] or "",
                    "productId": r[2],
                    "productCode": r[3] or "",
                    "productName": r[4] or "صنف مخزني",
                    "type": r[5],
                    "quantity": r[6],
                    "previousStock": 0,
                    "newStock": 0,
                    "reason": r[7] or "",
                    "timestamp": r[8] or "",
                    "operatorName": "أمين المخزن"
                } for r in rows]
                return self._send_json({"success": True, "movements": movements})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 4. API GET Users
        if parsed_path == '/api/users':
            try:
                conn = sqlite3.connect(get_db_path())
                cursor = conn.cursor()
                cursor.execute("SELECT id, username, name, role, gmail, created_at FROM users")
                rows = cursor.fetchall()
                conn.close()
                users = [{
                    "id": r[0], "username": r[1], "name": r[2],
                    "role": r[3], "gmail": r[4], "createdAt": r[5]
                } for r in rows]
                return self._send_json({"success": True, "users": users})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # 5. SPA Fallback
        req_path = self.translate_path(self.path)
        if not os.path.exists(req_path) or os.path.isdir(req_path):
            self.path = '/index.html'
            
        return super().do_GET()

    def do_POST(self):
        parsed_path = self.path.split('?')[0]

        # 1. User Authentication (Login)
        if parsed_path == '/api/auth/login':
            data = self._read_json_body()
            username = data.get('username', '').strip()
            password = data.get('password', '').strip()
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, name, role, gmail FROM users WHERE username=? AND password=?", (username, password))
            row = cursor.fetchone()
            conn.close()
            if row:
                user = {"id": row[0], "username": row[1], "name": row[2], "role": row[3], "gmail": row[4]}
                return self._send_json({"success": True, "user": user, "message": "تم تسجيل الدخول بنجاح"})
            else:
                return self._send_json({"success": False, "message": "اسم المستخدم أو كلمة المرور غير صحيحة"}, 401)

        # 2. Add Sale Invoice
        if parsed_path == '/api/sales':
            data = self._read_json_body()
            items = data.get('items', [])
            
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM sales")
            count = cursor.fetchone()[0] + 1
            invoice_num = f"INV-{time.strftime('%Y%m')}-{count:04d}"
            
            sale_id = "sale_" + str(int(time.time() * 1000))
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
            
            for item in items:
                p_code = item.get('productCode')
                p_id = item.get('productId')
                try:
                    qty = int(item.get('quantity', 1))
                except Exception:
                    qty = 1
                if p_code:
                    cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE code = ?", (qty, p_code))
                elif p_id:
                    cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (qty, p_id))
            
            conn.commit()
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

        # 3. Movement Endpoint (Delivery Orders & Stock Adjustments)
        if parsed_path == '/api/movements':
            data = self._read_json_body()
            p_id = str(data.get('productId', ''))
            m_type = data.get('type', 'OUT')
            ref_no = data.get('referenceNo', '')
            reason_str = data.get('reason', '')
            try:
                qty = int(data.get('quantity', 1))
            except Exception:
                qty = 1
            
            mov_id = "mov_" + str(int(time.time() * 1000))
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')

            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()

            cursor.execute("SELECT id, code, name, stock FROM products WHERE id=? OR code=?", (p_id, p_id))
            p_row = cursor.fetchone()
            
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
                INSERT INTO movements (id, reference_no, product_id, type, quantity, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (mov_id, ref_no, actual_id, m_type, qty, reason_str, now_iso))

            conn.commit()
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
                "operatorName": data.get('operatorName', 'أمين المخزن'),
                "timestamp": now_iso
            }
            return self._send_json({"success": True, "movement": movement_obj, "message": "تم حفظ تحديث الكمية في قاعدة البيانات الدائمة SQLite بنجاح"})

        # 4. Add Product
        if parsed_path == '/api/products':
            data = self._read_json_body()
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            p_id = "prd_" + str(int(time.time() * 1000))
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
            cursor.execute('''
                INSERT INTO products (id, code, name, category, stock, min_stock, unit, description, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                p_id, data.get('code'), data.get('name'), data.get('category', 'عام'),
                int(data.get('stock', 0)),
                int(data.get('minStock', 5)), data.get('unit', 'وحدة'),
                data.get('description', ''), now_iso
            ))
            conn.commit()
            conn.close()
            return self._send_json({"success": True, "message": "تم إضافة الصنف بنجاح وحفظه فوراً"})

        return self._send_json({"success": False, "message": "المسار غير موجود"}, 404)

    def do_PUT(self):
        parsed_path = self.path.split('?')[0]
        if parsed_path.startswith('/api/products/'):
            p_id = parsed_path.replace('/api/products/', '')
            data = self._read_json_body()
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
            cursor.execute('''
                UPDATE products SET code=?, name=?, category=?, stock=?, min_stock=?, unit=?, description=?, updated_at=?
                WHERE id=?
            ''', (
                data.get('code'), data.get('name'), data.get('category', 'عام'),
                int(data.get('stock', 0)),
                int(data.get('minStock', 5)), data.get('unit', 'وحدة'),
                data.get('description', ''), now_iso, p_id
            ))
            conn.commit()
            conn.close()
            return self._send_json({"success": True, "message": "تم تحديث الصنف بنجاح"})
        return self._send_json({"success": False}, 404)

    def do_DELETE(self):
        parsed_path = self.path.split('?')[0]
        if parsed_path.startswith('/api/products/'):
            p_id = parsed_path.replace('/api/products/', '')
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            cursor.execute("DELETE FROM products WHERE id=?", (p_id,))
            conn.commit()
            conn.close()
            return self._send_json({"success": True, "message": "تم حذف الصنف بنجاح"})
        return self._send_json({"success": False}, 404)

    def log_message(self, format, *args):
        pass

def start_local_server(port):
    """تشغيل خادم محلي خفي في الخلفية"""
    handler = SPAHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        httpd.serve_forever()

# --- 4. NATIVE PYSIDE6 MAIN APPLICATION WINDOW CLASS & GPU FLICKER FIX ---
# إيقاف التسريع البرمجي لـ GPU لمنع ارتجاف وتداخل النوافذ المنبثقة (Modal & Dialog Flickering Fix)
os.environ["QT_WEBENGINE_DISABLE_GPU"] = "1"
os.environ["QT_QUICK_BACKEND"] = "software"
os.environ["QSG_RENDER_LOOP"] = "basic"

try:
    from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox, QFileDialog, QDialog
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebEngineCore import QWebEngineSettings
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
            
            # تهيئة محرك عرض الويب الداخلي
            self.web_view = QWebEngineView(self)
            self.web_view.setAttribute(Qt.WA_NativeWindow, True)
            
            # تفعيل إعدادات الطباعة الأصلية وخلفيات الألوان بدقة
            settings = self.web_view.settings()
            settings.setAttribute(QWebEngineSettings.WebAttribute.PrintElementBackgrounds, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
            settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
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
                            msg.setText(f"تم حفظ أمر التسليم كملف PDF في المسار:\\n{pdf_path}")
                            msg.setIcon(QMessageBox.Information)
                            msg.exec()
                except Exception as save_err:
                    err_msg = QMessageBox(self)
                    err_msg.setAttribute(Qt.WA_NativeWindow, True)
                    err_msg.setWindowModality(Qt.ApplicationModal)
                    err_msg.setWindowTitle("تنبيه الطباعة")
                    err_msg.setText(f"تعذر الاتصال بالطابعة:\\n{pe}")
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
`;
}

