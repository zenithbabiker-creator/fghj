/**
 * Standalone Native Python PySide6 Launcher Generator for شركة NASSER Desktop (.exe)
 * Uses pure PySide6 QWebEngineView + PySide6.QtPrintSupport (QPrinter, QPrintDialog, QPrintPreviewDialog)
 * with SQLite LocalAppData engine for 100% offline native Windows execution and native direct printing.
 * Strictly eliminates all external program/browser invocations.
 */

export function generatePySideScript(): string {
  return `"""
====================================================================
شركة NASSER - نظام إدارة المخازن والمخزون
تطبيق سطح المكتب الاحترافي لشركة ناصر (PySide6 Native Engine)
طباعة داخلية أصلية 100% عبر PySide6.QtPrintSupport بدون برامج خارجية
حفظ دائم وفوري في قاعدة بيانات SQLite محلياً في AppData.
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

# --- PERMANENT STORAGE DIRECTORY & DATABASE CONFIGURATION ---
def get_app_dir():
    """الحصول على المسار الدائم للتطبيق في AppData"""
    app_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'NasserCompanyApp')
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

def get_db_path():
    """المسار الثابت لقاعدة بيانات SQLite"""
    return os.path.join(get_app_dir(), 'nasser_store.db')

def init_sqlite_db():
    """تهيئة قاعدة البيانات وإنشاء الجداول تلقائياً إن لم تكن موجودة"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
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
    
    # تعبئة المنتجات الافتراضية إذا كانت القاعدة فارغة
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        default_products = [
            ('1', 'PRD-101', 'ماكينة إعداد القهوة المتقدمة NASSER-Pro', 'عام', 50, 5, 'وحدة', '', now_iso),
            ('2', 'PRD-102', 'طاحونة حبوب القهوة الصناعية 1500W', 'عام', 25, 5, 'وحدة', '', now_iso),
            ('3', 'PRD-103', 'فلتر مياه نقي خماسي المراحل', 'عام', 100, 5, 'وحدة', '', now_iso),
            ('4', 'PRD-104', 'ميزان حرارة ورطوبة ديجيتال دقيق', 'عام', 4, 5, 'وحدة', '', now_iso),
            ('5', 'PRD-105', 'طابعة فواتير حرارية عالية السرعة 80mm', 'عام', 15, 5, 'وحدة', '', now_iso),
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
            ('usr_2', 'cashier1', 'sales123', 'مدير المبيعات - أحمد مصطفى', 'SALES_MANAGER', 'cashier.nasser@gmail.com', now_iso)
        )
        conn.commit()

    conn.close()

# --- NETWORK & PATH UTILITIES ---
def find_free_port():
    """البحث عن منفذ شبكة محلي متاح تلقائياً"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def get_base_dir():
    """الحصول على المسار الرئيسي عند التشغيل من ملف تنفيذي .exe أو مثبّت"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def get_dist_path():
    """تحديد المسار الفعلي لمجلد الويب المجمّع dist عند تشغيل الملف التنفيذي .exe والمثبّت"""
    base_dir = get_base_dir()
    meipass = getattr(sys, '_MEIPASS', None)
    
    candidates = []
    if meipass:
        candidates.append(os.path.join(meipass, 'dist'))
        candidates.append(meipass)
    
    candidates.extend([
        os.path.join(base_dir, 'dist'),
        base_dir,
        os.path.abspath('dist'),
        os.path.abspath('.')
    ])
    
    for cand in candidates:
        if cand and os.path.exists(os.path.join(cand, 'index.html')):
            return cand
            
    return os.path.join(base_dir, 'dist')

def get_html_file_path():
    """تحديد المسار المباشر لملف index.html"""
    dist_dir = get_dist_path()
    html_path = os.path.join(dist_dir, 'index.html')
    if not os.path.exists(html_path):
        base_dir = get_base_dir()
        html_path = os.path.join(base_dir, 'index.html')
    return html_path

# --- HTTP HANDLER WITH SQLITE API BRIDGE ---
class SPAHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """خادم محلي ذكي يربط واجهة الويب بقاعدة بيانات SQLite المحفوظة في AppData"""
    
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

        # 2. Add Sale Invoice (With Automatic Stock Deduction)
        if parsed_path == '/api/sales':
            data = self._read_json_body()
            items = data.get('items', [])
            
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            
            # توليد رقم تسلسلي للفاتورة
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
            
            # خصم الكميات من المخزن فوراً مع ضمان تحويل أعداد الكميات بدقة
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
            
            # COMMIT فوري على القرص الصلب لتجنب فقدان البيانات
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

        # 3. Movement Endpoint (For Warehouse Delivery Orders & Adjustments)
        if parsed_path == '/api/movements':
            data = self._read_json_body()
            p_id = data.get('productId')
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

            # Insert into movements table
            cursor.execute('''
                INSERT INTO movements (id, reference_no, product_id, type, quantity, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (mov_id, ref_no, p_id, m_type, qty, reason_str, now_iso))

            cursor.execute("SELECT stock FROM products WHERE id=?", (p_id,))
            p_row = cursor.fetchone()
            if p_row:
                curr_stock = p_row[0]
                new_stock = curr_stock + qty if m_type == 'IN' else max(0, curr_stock - qty)
                cursor.execute("UPDATE products SET stock=? WHERE id=?", (new_stock, p_id))
            
            conn.commit()
            conn.close()
            return self._send_json({"success": True, "message": "تم تسجيل حركة المخزون بنجاح بجدول الحركة وقاعدة البيانات المحلية"})

        # 4. Add Product (With Immediate Commit)
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

def main():
    # 1. تهيئة قاعدة بيانات SQLite الدائمة في AppData عند التشغيل
    init_sqlite_db()

    port = find_free_port()
    
    # 2. تشغيل خادم التطبيق المحلي في خيط منفصل (Background Thread)
    server_thread = threading.Thread(target=start_local_server, args=(port,), daemon=True)
    server_thread.start()
    
    app_url = f"http://127.0.0.1:{port}"
    app_title = "شركة NASSER - نظام إدارة المخازن والمخزون"

    # 3. محرك PySide6 الأصلي الحصري مع مكتبة الطباعة المباشرة PySide6.QtPrintSupport
    try:
        from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtWebEngineCore import QWebEngineSettings
        from PySide6.QtPrintSupport import QPrinter, QPrintDialog, QPrintPreviewDialog
        from PySide6.QtGui import QKeySequence, QShortcut, QIcon
        from PySide6.QtCore import QUrl, Qt
        
        app = QApplication(sys.argv)
        app.setApplicationName(app_title)
        
        window = QMainWindow()
        window.setWindowTitle(app_title)
        window.resize(1366, 850)
        
        web_view = QWebEngineView(window)
        
        # تفعيل إعدادات الطباعة الأصلية بدقة تامة والخلفيات
        web_settings = web_view.settings()
        web_settings.setAttribute(QWebEngineSettings.WebAttribute.PrintElementBackgrounds, True)
        web_settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True)
        web_settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        web_settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        web_settings.setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars, True)
        
        # دالة الطباعة الأصلية المباشرة (Qt Native Print Dialog)
        def trigger_native_print_dialog():
            try:
                printer = QPrinter(QPrinter.PrinterMode.HighResolution)
                printer.setFullPage(True)
                
                # فتح حوار طباعة ويندوز الأصلي مباشرة من داخل PySide6
                print_dialog = QPrintDialog(printer, window)
                print_dialog.setWindowTitle("طباعة أمر تسليم مخزن - شركة ناصر")
                if print_dialog.exec() == QPrintDialog.DialogCode.Accepted:
                    web_view.page().print(printer, lambda success: None)
            except Exception as pe:
                print("Native Print Error:", pe)

        # ربط إشارة الطباعة الداخلية الخاصة بمحرك QWebEnginePage مباشرة
        web_view.page().printRequested.connect(trigger_native_print_dialog)
        
        # ربط اختصار لوحة المفاتيح Ctrl + P في نافذة التطبيق الأصلية
        shortcut_print = QShortcut(QKeySequence("Ctrl+P"), window)
        shortcut_print.activated.connect(trigger_native_print_dialog)

        # تحميل تطبيق React عبر العنوان المحلي
        html_path = get_html_file_path()
        if os.path.exists(html_path):
            web_view.setUrl(QUrl.fromLocalFile(html_path))
        else:
            web_view.setUrl(QUrl(app_url))
            
        window.setCentralWidget(web_view)
        window.showMaximized()
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
