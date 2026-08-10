"""
====================================================================
شركة NASSER - نظام المبيعات (نسخة مبيعات فقط)
تطبيق سطح المكتب الاحترافي لشركة ناصر
يضمن حفظ البيانات الدائم في قاعدة بيانات SQLite محلياً في AppData
مع Commit فوري لضمان الاستقرار وعدم فقدان البيانات عند انقطاع الكهرباء.
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
            unit_price REAL NOT NULL,
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
    
    # تعبئة المنتجات الافتراضية إذا كانت القاعدة فارغة
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        default_products = [
            ('1', 'PRD-101', 'ماكينة إعداد القهوة المتقدمة NASSER-Pro', 'عام', 4500.0, 50, 5, 'وحدة', '', now_iso),
            ('2', 'PRD-102', 'طاحونة حبوب القهوة الصناعية 1500W', 'عام', 1850.0, 25, 5, 'وحدة', '', now_iso),
            ('3', 'PRD-103', 'فلتر مياه نقي خماسي المراحل', 'عام', 320.0, 100, 5, 'وحدة', '', now_iso),
            ('4', 'PRD-104', 'ميزان حرارة ورطوبة ديجيتال دقيق', 'عام', 150.0, 4, 5, 'وحدة', '', now_iso),
            ('5', 'PRD-105', 'طابعة فواتير حرارية عالية السرعة 80mm', 'عام', 980.0, 15, 5, 'وحدة', '', now_iso),
        ]
        cursor.executemany(
            "INSERT INTO products (id, code, name, category, unit_price, stock, min_stock, unit, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
def create_desktop_shortcut_if_missing():
    """إنشاء اختصار تلقائي على سطح المكتب على نظام ويندوز عند التشغيل"""
    try:
        import subprocess
        if sys.platform != 'win32':
            return
        
        desktop_dir = os.path.join(os.path.expanduser('~'), 'Desktop')
        if not os.path.exists(desktop_dir):
            return
            
        shortcut_path = os.path.join(desktop_dir, 'شركة ناصر - نسخة مبيعات فقط.lnk')
        if os.path.exists(shortcut_path):
            return

        target_exe = sys.executable if getattr(sys, 'frozen', False) else os.path.abspath(sys.argv[0])
        work_dir = os.path.dirname(target_exe)
        icon_path = os.path.join(work_dir, 'assets', 'icon.ico')
        if not os.path.exists(icon_path):
            icon_path = target_exe

        ps_script = f'''
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
        $Shortcut.TargetPath = "{target_exe}"
        $Shortcut.WorkingDirectory = "{work_dir}"
        $Shortcut.IconLocation = "{icon_path}"
        $Shortcut.Description = "شركة ناصر - نسخة مبيعات فقط"
        $Shortcut.Save()
        '''
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, creationflags=0x08000000)
    except Exception:
        pass

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
                cursor.execute("SELECT id, code, name, category, unit_price, stock, min_stock, unit, description, updated_at FROM products")
                rows = cursor.fetchall()
                conn.close()
                products = [{
                    "id": r[0], "code": r[1], "name": r[2], "category": r[3],
                    "unitPrice": r[4], "stock": r[5], "minStock": r[6], "unit": r[7],
                    "description": r[8] or "", "updatedAt": r[9] or ""
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

        # 3. API GET Users
        if parsed_path == '/api/users':
            try:
                conn = sqlite3.connect(get_db_path())
                cursor = conn.cursor()
                cursor.execute("SELECT id, username, name, role, gmail, created_at FROM users")
                rows = cursor.fetchall()
                conn.close()
                users = [{
                    "id": r[0], "username": r[1], "name": r[2], "role": r[3], "gmail": r[4], "createdAt": r[5]
                } for r in rows]
                return self._send_json({"success": True, "users": users})
            except Exception as e:
                return self._send_json({"success": False, "error": str(e)}, 500)

        # Static assets serving
        dist_dir = get_dist_path()
        req_path = parsed_path.lstrip('/')
        full_path = os.path.join(dist_dir, req_path)
        if not os.path.exists(full_path) and not req_path.startswith('assets/'):
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        parsed_path = self.path.split('?')[0]

        # 1. Login Endpoint
        if parsed_path == '/api/auth/login':
            data = self._read_json_body()
            username = data.get('username')
            password = data.get('password')
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, name, role, gmail, created_at FROM users WHERE username=? AND password=?", (username, password))
            row = cursor.fetchone()
            conn.close()
            if row:
                user = {"id": row[0], "username": row[1], "name": row[2], "role": row[3], "gmail": row[4], "createdAt": row[5]}
                return self._send_json({"success": True, "user": user})
            return self._send_json({"success": False, "message": "اسم المستخدم أو كلمة السر غير صحيحة"}, 401)

        # 1b. Reset Password Offline Endpoint
        if parsed_path in ['/api/auth/reset-password-offline', '/api/auth/reset-password']:
            data = self._read_json_body()
            username = data.get('username')
            old_pass = data.get('oldPassword')
            new_pass = data.get('newPassword')
            if not username or not old_pass or not new_pass:
                return self._send_json({"success": False, "message": "بيانات غير مكتملة، يرجى تقديم اسم المستخدم، كلمة المرور القديمة، وكلمة المرور الجديدة"}, 400)
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            cursor.execute("SELECT password FROM users WHERE username=?", (username,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return self._send_json({"success": False, "message": "اسم المستخدم غير موجود بالنظام"}, 404)
            if row[0] != old_pass:
                conn.close()
                return self._send_json({"success": False, "message": "كلمة المرور القديمة / الحالية غير صحيحة"}, 400)
            cursor.execute("UPDATE users SET password=? WHERE username=?", (new_pass, username))
            updated_count = cursor.rowcount
            conn.commit()
            conn.close()
            if updated_count > 0:
                return self._send_json({"success": True, "message": "تم التحقق من كلمة المرور القديمة وتحديث كلمة السر بنجاح في التطبيق المحلي وإلغاء القديمة تماماً"})
            return self._send_json({"success": False, "message": "حدث خطأ أثناء تحديث كلمة المرور"}, 500)

        # 2. Add Sale (With Immediate Atomic Commit & Sequential Numbering)
        if parsed_path == '/api/sales':
            data = self._read_json_body()
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            
            # Query max sequence number from SQLite sales table
            cursor.execute("SELECT invoice_number FROM sales")
            existing_rows = cursor.fetchall()
            max_seq = 0
            import re
            for r in existing_rows:
                if r[0]:
                    nums = re.findall(r'd+', r[0])
                    if nums:
                        val = int(nums[-1])
                        if val > max_seq:
                            max_seq = val
            next_seq = max_seq + 1
            invoice_num = f"ناصر-{next_seq:04d}"
            sale_id = "sale_" + str(int(time.time() * 1000))
            created_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
            items = data.get('items', [])
            
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
            
            # خصم الكميات من المخزن فوراً
            for item in items:
                p_code = item.get('productCode')
                qty = item.get('quantity', 1)
                cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE code = ?", (qty, p_code))
            
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

        # 3. Add Product (With Immediate Commit)
        if parsed_path == '/api/products':
            data = self._read_json_body()
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            p_id = "prd_" + str(int(time.time() * 1000))
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ')
            cursor.execute('''
                INSERT INTO products (id, code, name, category, unit_price, stock, min_stock, unit, description, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                p_id, data.get('code'), data.get('name'), data.get('category', 'عام'),
                float(data.get('unitPrice', 0)), int(data.get('stock', 0)),
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
                UPDATE products SET code=?, name=?, category=?, unit_price=?, stock=?, min_stock=?, unit=?, description=?, updated_at=?
                WHERE id=?
            ''', (
                data.get('code'), data.get('name'), data.get('category', 'عام'),
                float(data.get('unitPrice', 0)), int(data.get('stock', 0)),
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

    # 2. إنشاء اختصار سطح المكتب تلقائياً إذا لم يكن موجوداً
    create_desktop_shortcut_if_missing()

    port = find_free_port()
    
    # 2. تشغيل خادم المبيعات والخادم المحلي في خيط منفصل (Background Thread)
    server_thread = threading.Thread(target=start_local_server, args=(port,), daemon=True)
    server_thread.start()
    
    app_url = f"http://127.0.0.1:{port}"
    app_title = "شركة NASSER - نظام المبيعات (نسخة مبيعات فقط)"

    # المحرك الأول: pywebview مع تحديد مجلد البيانات الدائم في AppData
    try:
        import webview
        app_data_dir = get_app_dir()
        window = webview.create_window(
            title=app_title,
            url=app_url,
            width=1366,
            height=850,
            resizable=True,
            min_size=(1024, 600),
            confirm_close=False
        )
        webview.start(private_mode=False, storage_path=app_data_dir)
        return
    except Exception as e:
        print(f"Notice: pywebview not initialized ({e}), switching to PySide6 QWebEngineView fallback...")

    # المحرك الثاني: PySide6 QWebEngineView (محرك Chromium المدمج)
    try:
        from PySide6.QtWidgets import QApplication, QMainWindow
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtCore import QUrl
        
        app = QApplication(sys.argv)
        app.setApplicationName(app_title)
        
        window = QMainWindow()
        window.setWindowTitle(app_title)
        window.resize(1366, 850)
        
        web_view = QWebEngineView()
        
        # تحديد مسار index.html وتحميله عبر QUrl
        html_path = get_html_file_path()
        if os.path.exists(html_path):
            web_view.setUrl(QUrl.fromLocalFile(html_path))
        else:
            web_view.setUrl(QUrl(app_url))
            
        window.setCentralWidget(web_view)
        
        window.showMaximized()
        sys.exit(app.exec())
    except Exception as e:
        print(f"Notice: PySide6 QWebEngineView not available ({e}), opening default system browser...")

    # المحرك الثالث: متصفح النظام العادي
    import webbrowser
    webbrowser.open(app_url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    main()
