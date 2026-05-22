import asyncio
import logging
import json
import os
import threading
import sqlite3
import datetime
from aiogram import Bot, Dispatcher, types, F, BaseMiddleware
from aiogram.filters import CommandStart, Command
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardRemove, FSInputFile
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from flask import Flask, request, jsonify

# ==========================================
# 1. KONFIGURATSIYA VA SOZLAMALAR
# ==========================================
TOKEN = os.getenv("BOT_TOKEN") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"
ASOSIY_ADMIN_ID = 279410924 # SIZNING TELEGRAM ID RAQAMINGIZ

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Setup(StatesGroup):
    waiting_for_name = State()
    waiting_for_partner_phone = State()

class AdminState(StatesGroup):
    waiting_for_broadcast_msg = State()
    waiting_for_new_admin_id = State()
    waiting_for_del_admin_id = State()
    waiting_for_search_query = State()

# ==========================================
# 2. BAZA (DATABASE) QISMI
# ==========================================
def init_db():
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users 
                      (user_id INTEGER PRIMARY KEY, 
                       phone TEXT, 
                       ozi_yaratgan_budget_id INTEGER, 
                       taklif_budget_id INTEGER, 
                       joriy_budget_id INTEGER)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS budgets 
                      (budget_id INTEGER PRIMARY KEY AUTOINCREMENT, balance REAL DEFAULT 0, name TEXT)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS invitations 
                      (from_user_id INTEGER, to_phone TEXT, budget_id INTEGER)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS admins (user_id INTEGER PRIMARY KEY)''')
    cursor.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (ASOSIY_ADMIN_ID,))

    try: cursor.execute("ALTER TABLE budgets ADD COLUMN name TEXT")
    except sqlite3.OperationalError: pass 
    
    try: cursor.execute("ALTER TABLE users ADD COLUMN registered_at TEXT")
    except sqlite3.OperationalError: pass 
    
    try: cursor.execute("ALTER TABLE users ADD COLUMN last_active TEXT")
    except sqlite3.OperationalError: pass 

    # Bulutli sinxronizatsiya uchun JSON ustuni
    try: cursor.execute("ALTER TABLE budgets ADD COLUMN state_json TEXT DEFAULT '{}'")
    except sqlite3.OperationalError: pass 

    conn.commit()
    conn.close()

def is_admin(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM admins WHERE user_id = ?", (user_id,))
    res = cursor.fetchone()
    conn.close()
    return bool(res)

def register_user(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    
    cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO budgets (balance, name) VALUES (0, NULL)")
        shaxsiy_budget = cursor.lastrowid
        cursor.execute("INSERT INTO users (user_id, ozi_yaratgan_budget_id, joriy_budget_id, registered_at, last_active) VALUES (?, ?, ?, ?, ?)", 
                       (user_id, shaxsiy_budget, shaxsiy_budget, now, now))
        conn.commit()
    conn.close()

def update_last_active(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    cursor.execute("UPDATE users SET last_active = ? WHERE user_id = ?", (now, user_id))
    conn.commit()
    conn.close()

init_db()

# ==========================================
# YORDAMCHI FUNKSIYALAR
# ==========================================
async def log_admin_action(bot_instance, admin_id, action_text):
    if admin_id != ASOSIY_ADMIN_ID:
        try:
            msg = f"🚨 <b>ADMIN HARAKATI:</b>\n👮‍♂️ Admin ID: <code>{admin_id}</code>\n📝 Harakat: {action_text}"
            await bot_instance.send_message(ASOSIY_ADMIN_ID, msg, parse_mode="HTML")
        except Exception: pass

async def auto_backup_scheduler():
    while True:
        now = datetime.datetime.now()
        target = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if now >= target:
            target += datetime.timedelta(days=1)
        wait_seconds = (target - now).total_seconds()
        
        await asyncio.sleep(wait_seconds)
        try:
            db_file = FSInputFile("bot_data.db")
            await bot.send_document(ASOSIY_ADMIN_ID, db_file, caption="🤖 Avtomatik tungi zaxira (03:00).\n1Money Family ERP")
        except Exception as e:
            logger.error(f"Auto-backup xatosi: {e}")

# ==========================================
# 3. MIDDLEWARE (Aktivlikni avtomat kuzatuvchi)
# ==========================================
class ActivityMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        if event.from_user:
            update_last_active(event.from_user.id)
        return await handler(event, data)

# ==========================================
# 4. FLASK SERVER VA BULUTLI API
# ==========================================
app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/')
def health_check(): return "Bot is active!", 200

@app.route('/api/state/<int:budget_id>', methods=['GET'])
def get_state(budget_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT state_json FROM budgets WHERE budget_id = ?", (budget_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row[0] and row[0] != '{}':
        return jsonify({"status": "ok", "data": json.loads(row[0])})
    return jsonify({"status": "empty", "data": {}})

@app.route('/api/state/<int:budget_id>', methods=['POST', 'OPTIONS'])
def save_state(budget_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"})
        
    new_state = request.json
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE budgets SET state_json = ? WHERE budget_id = ?", (json.dumps(new_state), budget_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# ==========================================
# 5. BOT MANTIG'I (Oddiy foydalanuvchilar)
# ==========================================
bot = Bot(token=TOKEN)
dp = Dispatcher()
dp.message.middleware(ActivityMiddleware()) 

def get_main_keyboard(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT ozi_yaratgan_budget_id, taklif_budget_id FROM users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    if not row: return ReplyKeyboardRemove()
        
    own_id, taklif_id = row
    cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (own_id,))
    own_name_res = cursor.fetchone()
    own_name = own_name_res[0] if own_name_res and own_name_res[0] else "Mening hisobim"
    
    accounts_row = [KeyboardButton(text=f"👑 {own_name} (Admin)")]
    
    if taklif_id:
        cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (taklif_id,))
        taklif_name_res = cursor.fetchone()
        if taklif_name_res and taklif_name_res[0]:
            taklif_name = taklif_name_res[0]
            accounts_row.append(KeyboardButton(text=f"🤝 {taklif_name} (Taklif)"))
            
    conn.close()
    return ReplyKeyboardMarkup(keyboard=[accounts_row, [KeyboardButton(text="👥 Yangi foydalanuvchi bog'lash"), KeyboardButton(text="📋 Guruh a'zolari")]], resize_keyboard=True)

@dp.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear()
    register_user(message.from_user.id)
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone, ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    phone, budget_id = cursor.fetchone()
    
    if not phone:
        kb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]], resize_keyboard=True)
        await message.answer("Assalomu alaykum! Botdan foydalanishni boshlash uchun telefon raqamingizni tasdiqlang:", reply_markup=kb)
        conn.close()
        return
        
    cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (budget_id,))
    budget_name = cursor.fetchone()[0]
    conn.close()
    
    if not budget_name:
        await state.set_state(Setup.waiting_for_name)
        await message.answer("Endi bu hisobingizga nom bering (Masalan: Shaxsiy, Oilaviy byudjet):", reply_markup=ReplyKeyboardRemove())
        return

    await message.answer("Sizning hisob-kitob bo'limingiz:", reply_markup=get_main_keyboard(message.from_user.id))

@dp.message(F.contact)
async def get_contact(message: types.Message, state: FSMContext):
    phone = message.contact.phone_number.replace("+", "")
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET phone = ? WHERE user_id = ?", (phone, message.from_user.id))
    cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    budget_id = cursor.fetchone()[0]
    cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (budget_id,))
    budget_name = cursor.fetchone()[0]
    conn.commit()
    conn.close()
    
    if not budget_name:
        await state.set_state(Setup.waiting_for_name)
        await message.answer(f"✅ Raqam saqlandi!\n\nEndi hisobingizga nom bering:", reply_markup=ReplyKeyboardRemove())
    else:
        await message.answer("Asosiy menyu:", reply_markup=get_main_keyboard(message.from_user.id))

@dp.message(Setup.waiting_for_name, F.text)
async def save_budget_name(message: types.Message, state: FSMContext):
    new_name = message.text[:20] 
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    budget_id = cursor.fetchone()[0]
    cursor.execute("UPDATE budgets SET name = ? WHERE budget_id = ?", (new_name, budget_id))
    conn.commit()
    conn.close()
    
    await state.clear()
    await message.answer(f"✅ Hisobingiz nomi '{new_name}' etib belgilandi!", reply_markup=get_main_keyboard(message.from_user.id))

@dp.message(F.text.startswith("👑"))
async def open_admin_app(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    own_id = cursor.fetchone()[0]
    cursor.execute("UPDATE users SET joriy_budget_id = ? WHERE user_id = ?", (own_id, message.from_user.id))
    conn.commit()
    conn.close()
    
    url_with_params = f"{WEB_APP_URL}?bid={own_id}"
    web_app = WebAppInfo(url=url_with_params)
    inline_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🚀 Ilovaga kirish", web_app=web_app)]])
    await message.answer(f"{message.text} faollashdi. Ilovani ochish uchun bosing:", reply_markup=inline_kb)

@dp.message(F.text.startswith("🤝"))
async def open_invited_app(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT taklif_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    taklif_id = cursor.fetchone()[0]
    
    if taklif_id:
        cursor.execute("UPDATE users SET joriy_budget_id = ? WHERE user_id = ?", (taklif_id, message.from_user.id))
        conn.commit()
        url_with_params = f"{WEB_APP_URL}?bid={taklif_id}"
        web_app = WebAppInfo(url=url_with_params)
        inline_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🚀 Ilovaga kirish", web_app=web_app)]])
        await message.answer(f"{message.text} faollashdi. Ilovani ochish uchun bosing:", reply_markup=inline_kb)
    conn.close()

@dp.message(F.text == "👥 Yangi foydalanuvchi bog'lash")
async def start_binding(message: types.Message, state: FSMContext):
    await state.set_state(Setup.waiting_for_partner_phone)
    await message.answer("Sizning hisobingizga ulanishi kerak bo'lgan insonning telefon raqamini yuboring (+998XXXXXXXXX shaklida):")

@dp.message(Setup.waiting_for_partner_phone, F.text.regexp(r'^\+?\d{9,13}$'))
async def handle_partner_phone(message: types.Message, state: FSMContext):
    phone = message.text.replace("+", "")
    user_id = message.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone, ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (user_id,))
    my_phone, my_budget = cursor.fetchone()
    
    if phone == my_phone:
        await message.answer("❌ O'z raqamingizni kiritdingiz! Boshqa shaxsning raqamini kiriting:")
        conn.close(); return

    cursor.execute("SELECT user_id, taklif_budget_id FROM users WHERE phone = ?", (phone,))
    target = cursor.fetchone()
    
    if not target:
        await message.answer("❌ Bu raqam egasi hali botdan ro'yxatdan o'tmagan.")
        await state.clear(); conn.close(); return
        
    target_user_id, target_taklif = target
    if target_taklif is not None:
        await message.answer("❌ Bu inson allaqachon boshqa birovning hisobiga ulangan!")
        await state.clear(); conn.close(); return

    cursor.execute("DELETE FROM invitations WHERE to_phone = ? AND budget_id = ?", (phone, my_budget))
    cursor.execute("INSERT INTO invitations VALUES (?, ?, ?)", (user_id, phone, my_budget))
    conn.commit()
    conn.close()
    
    inline_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✅ Ha", callback_data=f"accept_{user_id}"), InlineKeyboardButton(text="❌ Yo'q", callback_data=f"reject_{user_id}")]])
    
    try:
        await bot.send_message(target_user_id, f"🔔 Taklifnoma!\n\nFoydalanuvchi (+{my_phone}) sizni o'zining hisobiga qo'shmoqchi. Rozimisiz?", reply_markup=inline_kb)
        await message.answer(f"⏳ Taklif (+{phone}) raqamiga yuborildi.")
    except Exception:
        await message.answer("❌ Xatolik yuz berdi. Balki u inson botni bloklagan bo'lishi mumkin.")
    await state.clear()

@dp.callback_query(F.data.startswith("accept_") | F.data.startswith("reject_"))
async def handle_callback(callback: types.CallbackQuery):
    action, from_user_id = callback.data.split("_")
    from_user_id = int(from_user_id)
    target_user_id = callback.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (target_user_id,))
    target_phone = cursor.fetchone()[0]
    
    if action == "accept":
        cursor.execute("SELECT budget_id FROM invitations WHERE from_user_id = ? AND to_phone = ?", (from_user_id, target_phone))
        inv = cursor.fetchone()
        if inv:
            shared_budget_id = inv[0]
            cursor.execute("UPDATE users SET taklif_budget_id = ?, joriy_budget_id = ? WHERE user_id = ?", (shared_budget_id, shared_budget_id, target_user_id))
            cursor.execute("DELETE FROM invitations WHERE to_phone = ?", (target_phone,))
            conn.commit()
            await callback.message.edit_text("✅ Siz taklifni qabul qildingiz!")
            await bot.send_message(from_user_id, f"🎉 +{target_phone} hisobingizga qo'shildi.")
            await bot.send_message(target_user_id, "Menyu yangilandi:", reply_markup=get_main_keyboard(target_user_id))
    elif action == "reject":
        await callback.message.edit_text("❌ Siz taklifni rad etdingiz.")
        cursor.execute("DELETE FROM invitations WHERE from_user_id = ? AND to_phone = ?", (from_user_id, target_phone))
        conn.commit()
        await bot.send_message(from_user_id, f"❌ +{target_phone} taklifni rad etdi.")
        
    conn.close()
    await callback.answer()

@dp.message(F.text == "📋 Guruh a'zolari")
async def show_group_members(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    joriy = cursor.fetchone()[0]
    cursor.execute("SELECT phone, user_id FROM users WHERE ozi_yaratgan_budget_id = ? OR taklif_budget_id = ?", (joriy, joriy))
    members = cursor.fetchall()
    cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (joriy,))
    b_name = cursor.fetchone()[0]
    conn.close()
    
    if not members: return await message.answer("Hech kim topilmadi.")
        
    text = f"👥 '{b_name}' hisobi a'zolari:\n\n"
    for idx, (phone, uid) in enumerate(members, 1):
        me = " (Siz)" if uid == message.from_user.id else ""
        text += f"{idx}. +{phone}{me}\n"
    await message.answer(text)

@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    # WebApp yopilganda qisqacha log yozib qo'yish
    await message.answer("✅ O'zgarishlar bulutga saqlandi!")

# ==========================================
# 6. MUKAMMAL ADMIN PANEL LOGIKASI
# ==========================================
def get_admin_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 Statistika"), KeyboardButton(text="🔗 Aloqalar")],
            [KeyboardButton(text="🔍 Qidiruv"), KeyboardButton(text="🧹 Tozalash")],
            [KeyboardButton(text="📥 Bazani yuklash"), KeyboardButton(text="📢 Xabarnoma")],
            [KeyboardButton(text="👮‍♂️ Admin qo'shish"), KeyboardButton(text="🗑 Admin o'chirish")],
            [KeyboardButton(text="🔙 Asosiy menyu")]
        ],
        resize_keyboard=True
    )

@dp.message(Command("admin"))
async def cmd_admin(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return 
    await state.clear()
    await message.answer("👑 Admin panelga xush kelibsiz!", reply_markup=get_admin_keyboard())

@dp.message(F.text == "🔙 Asosiy menyu")
async def back_to_main(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("Asosiy menyuga qaytdingiz.", reply_markup=get_main_keyboard(message.from_user.id))

@dp.message(F.text == "📊 Statistika")
async def show_stats(message: types.Message):
    if not is_admin(message.from_user.id): return
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM budgets")
    total_budgets = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM admins")
    total_admins = cursor.fetchone()[0]
    conn.close()
    
    text = (f"📊 <b>BOT STATISTIKASI:</b>\n\n👥 Umumiy foydalanuvchilar: <b>{total_users} ta</b>\n"
            f"💼 Ochilgan byudjetlar: <b>{total_budgets} ta</b>\n"
            f"👮‍♂️ Adminlar soni: <b>{total_admins} ta</b>").replace(",", " ")
    await message.answer(text, parse_mode="HTML")

@dp.message(F.text == "🔗 Aloqalar")
async def show_network(message: types.Message):
    if not is_admin(message.from_user.id): return
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT budget_id, name, balance FROM budgets")
    budgets = cursor.fetchall()
    
    text = "🔗 <b>Tizimdagi Guruhlar va Aloqalar:</b>\n\n"
    for b_id, b_name, b_bal in budgets:
        cursor.execute("SELECT phone, registered_at, last_active, user_id FROM users WHERE ozi_yaratgan_budget_id = ? OR taklif_budget_id = ?", (b_id, b_id))
        members = cursor.fetchall()
        if not members: continue
        
        b_name_disp = b_name if b_name else "Nomsiz byudjet"
        text += f"💼 <b>{b_name_disp}</b> (ID: {b_id})\n"
        for phone, reg_at, last_act, uid in members:
            cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (uid,))
            own_b = cursor.fetchone()[0]
            role = "👑 Asosiy" if own_b == b_id else "🤝 Ulangan"
            phone_disp = f"+{phone}" if phone else "Raqamsiz"
            
            text += f" ├ {role}: {phone_disp}\n"
            text += f" │  └ Kirgan: {reg_at if reg_at else 'Noma`lum'}\n"
            text += f" │  └ Faollik: {last_act if last_act else 'Noma`lum'}\n"
        text += "\n"
    conn.close()
    
    if len(text) > 4000: text = text[:4000] + "\n... (davomi bor)"
    await message.answer(text, parse_mode="HTML")

@dp.message(F.text == "📥 Bazani yuklash")
async def download_db(message: types.Message):
    if not is_admin(message.from_user.id): return
    db_file = FSInputFile("bot_data.db")
    await message.answer_document(db_file, caption="📂 Ma'lumotlar bazasi (SQLite) zaxirasi.\n\nXavfsiz joyda saqlang!")
    await log_admin_action(bot, message.from_user.id, "Baza yuklab olindi.")

@dp.message(F.text == "🧹 Tozalash")
async def clean_db(message: types.Message):
    if not is_admin(message.from_user.id): return
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE phone IS NULL")
    count = cursor.fetchone()[0]
    
    if count > 0:
        cursor.execute("DELETE FROM users WHERE phone IS NULL")
        conn.commit()
        await message.answer(f"🧹 <b>{count} ta</b> to'liq ro'yxatdan o'tmagan ('o'lik') profil bazadan o'chirildi!", parse_mode="HTML")
        await log_admin_action(bot, message.from_user.id, f"{count} ta o'lik profilni tozaladi.")
    else:
        await message.answer("✅ Baza toza. O'chiriladigan profillar topilmadi.")
    conn.close()

@dp.message(F.text == "🔍 Qidiruv")
async def search_start(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    await state.set_state(AdminState.waiting_for_search_query)
    await message.answer("Qidirilayotgan shaxsning <b>Telefon raqamini</b> (masalan: 998901234567) yoki <b>Telegram ID</b> sini yozing:", parse_mode="HTML", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_search_query)
async def search_finish(message: types.Message, state: FSMContext):
    query = message.text.replace("+", "").strip()
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    if query.isdigit() and len(query) < 11:
        cursor.execute("SELECT user_id, phone, registered_at, last_active, ozi_yaratgan_budget_id, taklif_budget_id FROM users WHERE user_id = ?", (query,))
    else:
        cursor.execute("SELECT user_id, phone, registered_at, last_active, ozi_yaratgan_budget_id, taklif_budget_id FROM users WHERE phone = ?", (query,))
        
    user = cursor.fetchone()
    if not user:
        conn.close()
        await state.clear()
        return await message.answer("❌ Bunday foydalanuvchi topilmadi.", reply_markup=get_admin_keyboard())
        
    uid, phone, reg_at, last_act, own_id, taklif_id = user
    cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (own_id,))
    own_b = cursor.fetchone()
    
    text = f"🔍 <b>Qidiruv Natijasi:</b>\n\n🆔 ID: <code>{uid}</code>\n📱 Raqam: +{phone if phone else 'Kiritilmagan'}\n📅 Ro'yxatdan o'tgan: {reg_at if reg_at else 'Noma`lum'}\n⏱ Oxirgi faollik: {last_act if last_act else 'Noma`lum'}\n\n💼 <b>O'zining byudjeti:</b> {own_b[0] if own_b[0] else 'Nomsiz'}"
    
    if taklif_id:
        cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (taklif_id,))
        taklif_b = cursor.fetchone()
        text += f"\n🤝 <b>Taklif etilgan byudjet:</b> {taklif_b[0]}"
        
    conn.close()
    await state.clear()
    await message.answer(text, parse_mode="HTML", reply_markup=get_admin_keyboard())

@dp.message(F.text == "📢 Xabarnoma")
async def start_broadcast(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    await state.set_state(AdminState.waiting_for_broadcast_msg)
    await message.answer("Barchaga tarqatiladigan xabarni yuboring.\n<i>(Matn, rasm, video yoki ovozli xabar bo'lishi mumkin. Bekor qilish uchun 'bekor' deng)</i>", parse_mode="HTML", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_broadcast_msg)
async def send_broadcast(message: types.Message, state: FSMContext):
    if message.text and message.text.lower() == 'bekor':
        await state.clear()
        return await message.answer("Yuborish bekor qilindi.", reply_markup=get_admin_keyboard())
        
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users")
    users = cursor.fetchall()
    conn.close()
    
    sent = 0
    for (uid,) in users:
        try:
            await bot.copy_message(chat_id=uid, from_chat_id=message.chat.id, message_id=message.message_id)
            sent += 1
            await asyncio.sleep(0.05) 
        except Exception: pass 
            
    await state.clear()
    await message.answer(f"✅ Media-xabar <b>{sent}</b> ta foydalanuvchiga muvaffaqiyatli tarqatildi!", parse_mode="HTML", reply_markup=get_admin_keyboard())
    await log_admin_action(bot, message.from_user.id, f"Media xabarnoma tarqatdi ({sent} kishiga).")

@dp.message(F.text == "👮‍♂️ Admin qo'shish")
async def add_admin_start(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    await state.set_state(AdminState.waiting_for_new_admin_id)
    await message.answer("Yangi adminning Telegram ID raqamini yuboring:", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_new_admin_id)
async def add_admin_finish(message: types.Message, state: FSMContext):
    if not message.text.isdigit(): return await message.answer("Xato! ID faqat raqamlardan iborat bo'ladi.")
    new_id = int(message.text)
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (new_id,))
    conn.commit()
    conn.close()
    await state.clear()
    await message.answer(f"✅ ID {new_id} adminlar qatoriga qo'shildi!", reply_markup=get_admin_keyboard())
    await log_admin_action(bot, message.from_user.id, f"Yangi admin qo'shdi: {new_id}")

@dp.message(F.text == "🗑 Admin o'chirish")
async def del_admin_start(message: types.Message, state: FSMContext):
    if message.from_user.id != ASOSIY_ADMIN_ID: return await message.answer("❌ Bunga faqat Asosiy Admin huquqiga ega!")
    await state.set_state(AdminState.waiting_for_del_admin_id)
    await message.answer("O'chirilishi kerak bo'lgan adminning Telegram ID raqamini yuboring:", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_del_admin_id)
async def del_admin_finish(message: types.Message, state: FSMContext):
    if not message.text.isdigit(): return await message.answer("Xato! ID faqat raqamlardan iborat bo'ladi.")
    del_id = int(message.text)
    if del_id == ASOSIY_ADMIN_ID:
        await state.clear()
        return await message.answer("❌ O'zingizni o'chira olmaysiz!", reply_markup=get_admin_keyboard())
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM admins WHERE user_id = ?", (del_id,))
    conn.commit()
    conn.close()
    await state.clear()
    await message.answer(f"🗑 ID {del_id} adminlikdan olib tashlandi!", reply_markup=get_admin_keyboard())
    await log_admin_action(bot, message.from_user.id, f"Adminni o'chirdi: {del_id}")

# ==========================================
# 7. BOTNI ISHGA TUSHIRISH
# ==========================================
async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    asyncio.create_task(auto_backup_scheduler()) 
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
