import asyncio
import logging
import json
import os
import threading
import sqlite3
import datetime
import re
from aiogram import Bot, Dispatcher, types, F, BaseMiddleware
from aiogram.filters import CommandStart, Command
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardRemove, FSInputFile
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

# ==========================================
# 1. KONFIGURATSIYA VA SOZLAMALAR
# ==========================================
TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise RuntimeError("BOT_TOKEN topilmadi. .env faylida BOT_TOKEN=... qo'shing yoki muhit o'zgaruvchisini o'rnating.") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"
ASOSIY_ADMIN_ID = 279410924 # SIZNING TELEGRAM ID RAQAMINGIZ

# O'zbekiston vaqti (GMT+5) uchun o'zgaruvchi
UZB_TZ = datetime.timezone(datetime.timedelta(hours=5))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def default_profiles():
    return [
        {"id": "general", "name": "Umumiy", "icon": "🏠", "role": "home", "age": None, "gender": "", "monthlyLimit": 0, "pinEnabled": True, "pinHash": "", "permissions": ["admin_all"], "linked_phone": "", "linked_uid": None},
        {"id": "home_profile", "name": "Uy/Ro'zg'or", "icon": "🏡", "role": "home", "age": None, "gender": "", "monthlyLimit": 0, "pinEnabled": True, "pinHash": "", "permissions": [], "linked_phone": "", "linked_uid": None},
    ]

def load_state_json(raw):
    base = {"profiles": default_profiles(), "txs": [], "incs": [], "debts": [], "sched": [], "plan": [], "deps": [], "credits": [], "audit": [], "theme": "auto", "lang": "uz"}
    if raw and raw != "{}":
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                for k, v in data.items():
                    base[k] = v
                if not base.get("profiles"):
                    base["profiles"] = default_profiles()
        except json.JSONDecodeError:
            pass
    return base

def save_budget_state(cursor, budget_id, state_data):
    cursor.execute("UPDATE budgets SET state_json = ? WHERE budget_id = ?", (json.dumps(state_data, ensure_ascii=False), budget_id))

def ensure_creator_profile(state_data, user_id, display_name, phone=None):
    cid = f"creator_{user_id}"
    profiles = state_data.setdefault("profiles", default_profiles())
    if any(p.get("id") == cid for p in profiles):
        for p in profiles:
            if p.get("id") == cid:
                p["name"] = display_name or p.get("name", "Yaratuvchi")
                if phone:
                    p["linked_phone"] = phone
                p["linked_uid"] = user_id
        return state_data
    profiles.append({
        "id": cid,
        "name": display_name or "Yaratuvchi",
        "icon": "👑",
        "role": "parent_m",
        "age": None,
        "gender": "m",
        "monthlyLimit": 0,
        "pinEnabled": False,
        "pinHash": "",
        "permissions": ["admin_all"],
        "linked_phone": phone or "",
        "linked_uid": user_id,
    })
    return state_data

def ensure_invited_profile(state_data, user_id, display_name, phone):
    pid = f"user_{user_id}"
    profiles = state_data.setdefault("profiles", default_profiles())
    norm_phone = (phone or "").replace("+", "").replace(" ", "")

    for p in profiles:
        p_phone = (p.get("linked_phone") or "").replace("+", "").replace(" ", "")
        if norm_phone and p_phone and p_phone == norm_phone:
            p["linked_uid"] = user_id
            if display_name and not p.get("name"):
                p["name"] = display_name
            return state_data
        if p.get("id") == pid:
            p["linked_uid"] = user_id
            p["linked_phone"] = phone or p.get("linked_phone", "")
            if display_name:
                p["name"] = display_name
            return state_data

    if any(p.get("id") == pid for p in profiles):
        return state_data
    profiles.append({
        "id": pid,
        "name": display_name or f"Foydalanuvchi (+{phone})",
        "icon": "👤",
        "role": "guest",
        "age": None,
        "gender": "",
        "monthlyLimit": 0,
        "pinEnabled": False,
        "pinHash": "",
        "permissions": ["mod_plan", "shop_food"],
        "linked_phone": phone or "",
        "linked_uid": user_id,
    })
    return state_data

def webapp_url(budget_id, user_id, is_admin, first_name=""):
    fn = quote((first_name or "")[:40])
    adm = "true" if is_admin else "false"
    return f"{WEB_APP_URL}?bid={budget_id}&uid={user_id}&isadmin={adm}&fname={fn}"

class Setup(StatesGroup):
    waiting_for_name = State()
    waiting_for_partner_phone = State()

class AdminState(StatesGroup):
    waiting_for_broadcast_msg = State()
    waiting_for_new_admin_id = State()
    waiting_for_del_admin_id = State()
    waiting_for_search_query = State()
    waiting_for_ban_id = State()

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

    cursor.execute('''CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, val TEXT)''')
    cursor.execute("INSERT OR IGNORE INTO settings (key, val) VALUES ('maintenance', '0')")

    try: cursor.execute("ALTER TABLE budgets ADD COLUMN name TEXT")
    except sqlite3.OperationalError: pass 
    
    try: cursor.execute("ALTER TABLE users ADD COLUMN registered_at TEXT")
    except sqlite3.OperationalError: pass 
    
    try: cursor.execute("ALTER TABLE users ADD COLUMN last_active TEXT")
    except sqlite3.OperationalError: pass 

    try: cursor.execute("ALTER TABLE budgets ADD COLUMN state_json TEXT DEFAULT '{}'")
    except sqlite3.OperationalError: pass 

    try: cursor.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0")
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

def is_user_banned(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT is_banned FROM users WHERE user_id = ?", (user_id,))
    res = cursor.fetchone()
    conn.close()
    return res and res[0] == 1

def is_maintenance_mode():
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT val FROM settings WHERE key = 'maintenance'")
    res = cursor.fetchone()
    conn.close()
    return res and res[0] == '1'

def register_user(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    now = datetime.datetime.now(UZB_TZ).strftime("%d.%m.%Y %H:%M")
    
    cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO budgets (balance, name) VALUES (0, NULL)")
        shaxsiy_budget = cursor.lastrowid
        cursor.execute("INSERT INTO users (user_id, ozi_yaratgan_budget_id, joriy_budget_id, registered_at, last_active, is_banned) VALUES (?, ?, ?, ?, ?, 0)", 
                       (user_id, shaxsiy_budget, shaxsiy_budget, now, now))
        conn.commit()
    conn.close()

def update_last_active(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    now = datetime.datetime.now(UZB_TZ).strftime("%d.%m.%Y %H:%M")
    cursor.execute("UPDATE users SET last_active = ? WHERE user_id = ?", (now, user_id))
    conn.commit()
    conn.close()

init_db()

# ==========================================
# YORDAMCHI FUNKSIYALAR (LOG VA ZAXIRA)
# ==========================================
async def log_admin_action(bot_instance, admin_id, action_text):
    if admin_id != ASOSIY_ADMIN_ID:
        try:
            msg = f"🚨 <b>ADMIN HARAKATI:</b>\n👮‍♂️ Admin ID: <code>{admin_id}</code>\n📝 Harakat: {action_text}"
            await bot_instance.send_message(ASOSIY_ADMIN_ID, msg, parse_mode="HTML")
        except Exception: pass

async def auto_backup_scheduler():
    while True:
        now = datetime.datetime.now(UZB_TZ)
        target = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if now >= target:
            target += datetime.timedelta(days=1)
        wait_seconds = (target - now).total_seconds()
        
        await asyncio.sleep(wait_seconds)
        try:
            db_file = FSInputFile("bot_data.db")
            await bot.send_document(ASOSIY_ADMIN_ID, db_file, caption="🤖 Avtomatik tungi zaxira (03:00 UZB).\n1Money Family ERP")
        except Exception as e:
            logger.error(f"Auto-backup xatosi: {e}")

# ==========================================
# 3. MIDDLEWARE (Aktivlik va Xavfsizlik nazorati)
# ==========================================
class SecurityMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        if event.from_user:
            uid = event.from_user.id
            if is_user_banned(uid): return 
            if is_maintenance_mode() and not is_admin(uid):
                if isinstance(event, types.Message):
                    await event.answer("🛠 <b>Hozirgi vaqtda tizimda yangilanish ishlari ketyapti.</b>\n\nIltimos, birozdan so'ng qayta urinib ko'ring.", parse_mode="HTML")
                return 
            update_last_active(uid)
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
    if row and row[0] and row[0] != '{}': return jsonify({"status": "ok", "data": json.loads(row[0])})
    return jsonify({"status": "empty", "data": {}})

@app.route('/api/state/<int:budget_id>', methods=['POST', 'OPTIONS'])
def save_state(budget_id):
    if request.method == 'OPTIONS': return jsonify({"status": "ok"})
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
dp.message.middleware(SecurityMiddleware()) 

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
    
    accounts_row = [KeyboardButton(text=f"👑 {own_name} (Men)")]
    if taklif_id:
        cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (taklif_id,))
        taklif_name_res = cursor.fetchone()
        if taklif_name_res and taklif_name_res[0]:
            accounts_row.append(KeyboardButton(text=f"🤝 {taklif_name_res[0]} (Taklif)"))
            
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
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (message.from_user.id,))
    phone_row = cursor.fetchone()
    phone = phone_row[0] if phone_row else ""
    cursor.execute("SELECT state_json FROM budgets WHERE budget_id = ?", (budget_id,))
    st_row = cursor.fetchone()
    state_data = load_state_json(st_row[0] if st_row and st_row[0] else None)
    state_data = ensure_creator_profile(state_data, message.from_user.id, message.from_user.first_name or new_name, phone)
    save_budget_state(cursor, budget_id, state_data)
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
    
    url_with_params = webapp_url(own_id, message.from_user.id, True, message.from_user.first_name)
    
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
        
        # Taklif qilingan foydalanuvchi ekanligini bildiramiz (admin emas)
        url_with_params = webapp_url(taklif_id, message.from_user.id, False, message.from_user.first_name)
        
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
            
            cursor.execute("SELECT state_json FROM budgets WHERE budget_id = ?", (shared_budget_id,))
            state_row = cursor.fetchone()
            state_data = load_state_json(state_row[0] if state_row and state_row[0] else None)
            inv_name = callback.from_user.full_name or callback.from_user.first_name or f"+{target_phone}"
            state_data = ensure_invited_profile(state_data, target_user_id, inv_name, target_phone)
            save_budget_state(cursor, shared_budget_id, state_data)

            conn.commit()
            await callback.message.edit_text("✅ Siz taklifni qabul qildingiz!\n\n⚠️ Endi ilovaga kirish uchun pastdagi «🤝 ... (Taklif)» tugmasini bosing — «👑 Mening hisobim» emas!")
            await bot.send_message(from_user_id, f"🎉 +{target_phone} hisobingizga qo'shildi va unga avtomatik profil yaratildi.")
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
    await message.answer("✅ O'zgarishlar bulutga saqlandi!")

# ==========================================
# 6. MUKAMMAL ADMIN PANEL LOGIKASI
# ==========================================
def get_admin_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 Statistika"), KeyboardButton(text="🏆 Top Reyting")],
            [KeyboardButton(text="🔍 Qidiruv"), KeyboardButton(text="🔗 Aloqalar")],
            [KeyboardButton(text="🚫 Ban qilish"), KeyboardButton(text="🛠 Tanaffus rejimi")],
            [KeyboardButton(text="📥 Bazani yuklash"), KeyboardButton(text="📢 Xabarnoma")],
            [KeyboardButton(text="👮‍♂️ Admin qo'shish"), KeyboardButton(text="🗑 Admin o'chirish")],
            [KeyboardButton(text="🧹 Tozalash"), KeyboardButton(text="🔙 Asosiy menyu")]
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
    cursor.execute("SELECT val FROM settings WHERE key = 'maintenance'")
    m_mode = cursor.fetchone()[0]
    conn.close()
    
    status = "🔴 YONIQ (Tizim muzlatilgan)" if m_mode == '1' else "🟢 O'CHIQ (Oddiy rejim)"
    text = (f"📊 <b>BOT STATISTIKASI:</b>\n\n👥 Umumiy foydalanuvchilar: <b>{total_users} ta</b>\n"
            f"💼 Ochilgan byudjetlar: <b>{total_budgets} ta</b>\n"
            f"👮‍♂️ Adminlar soni: <b>{total_admins} ta</b>\n\n"
            f"🛠 Texnik tanaffus holati: <b>{status}</b>").replace(",", " ")
    await message.answer(text, parse_mode="HTML")

@dp.message(F.text == "🏆 Top Reyting")
async def show_top_users(message: types.Message):
    if not is_admin(message.from_user.id): return
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT u.phone, b.name, b.balance FROM users u JOIN budgets b ON u.ozi_yaratgan_budget_id = b.budget_id ORDER BY b.balance DESC LIMIT 5")
    top_users = cursor.fetchall()
    conn.close()
    
    text = "🏆 <b>Eng yuqori balansga ega 5 ta hisob:</b>\n\n"
    for idx, (phone, name, bal) in enumerate(top_users, 1):
        phone_disp = f"+{phone}" if phone else "Raqamsiz"
        name_disp = name if name else "Nomsiz"
        text += f"{idx}. <b>{name_disp}</b> ({phone_disp}) — {bal:,.0f} UZS\n".replace(",", " ")
        
    await message.answer(text, parse_mode="HTML")

@dp.message(F.text == "🛠 Tanaffus rejimi")
async def toggle_maintenance(message: types.Message):
    if not is_admin(message.from_user.id): return
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT val FROM settings WHERE key = 'maintenance'")
    curr = cursor.fetchone()[0]
    new_val = '0' if curr == '1' else '1'
    cursor.execute("UPDATE settings SET val = ? WHERE key = 'maintenance'", (new_val,))
    conn.commit()
    conn.close()
    
    status = "🔴 YONIQ (Endi oddiy foydalanuvchilar botga kira olmaydi)" if new_val == '1' else "🟢 O'CHIQ (Tizim hammaga ochiq)"
    await message.answer(f"🛠 Texnik tanaffus holati o'zgardi:\n\n{status}")
    await log_admin_action(bot, message.from_user.id, f"Tanaffus rejimini o'zgartirdi: {new_val}")

@dp.message(F.text == "🚫 Ban qilish")
async def start_ban(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    await state.set_state(AdminState.waiting_for_ban_id)
    await message.answer("🚫 Bloklash yoki Bandan chiqarish uchun foydalanuvchi ID raqamini yuboring:", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_ban_id)
async def finish_ban(message: types.Message, state: FSMContext):
    if not message.text.isdigit(): return await message.answer("Xato! ID faqat raqamlardan iborat bo'ladi.")
    target_id = int(message.text)
    
    if target_id == ASOSIY_ADMIN_ID:
        await state.clear()
        return await message.answer("❌ O'zingizni ban qila olmaysiz!", reply_markup=get_admin_keyboard())
        
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT is_banned FROM users WHERE user_id = ?", (target_id,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        await state.clear()
        return await message.answer("❌ Bunday foydalanuvchi topilmadi.", reply_markup=get_admin_keyboard())
        
    new_status = 0 if user[0] == 1 else 1
    cursor.execute("UPDATE users SET is_banned = ? WHERE user_id = ?", (new_status, target_id))
    conn.commit()
    conn.close()
    
    action_text = "🚫 Bloklandi (Ban)" if new_status == 1 else "✅ Bandan chiqarildi"
    await state.clear()
    await message.answer(f"Foydalanuvchi {target_id} holati yangilandi:\n<b>{action_text}</b>", parse_mode="HTML", reply_markup=get_admin_keyboard())
    await log_admin_action(bot, message.from_user.id, f"Foydalanuvchi {target_id} -> {action_text}")

@dp.message(F.text == "🔗 Aloqalar")
async def show_network(message: types.Message):
    if not is_admin(message.from_user.id): return
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT budget_id, name, balance FROM budgets")
    budgets = cursor.fetchall()
    
    text = "🔗 <b>Tizimdagi Guruhlar va Aloqalar:</b>\n\n"
    for b_id, b_name, b_bal in budgets:
        cursor.execute("SELECT phone, registered_at, last_active, user_id, is_banned FROM users WHERE ozi_yaratgan_budget_id = ? OR taklif_budget_id = ?", (b_id, b_id))
        members = cursor.fetchall()
        if not members: continue
        
        b_name_disp = b_name if b_name else "Nomsiz byudjet"
        text += f"💼 <b>{b_name_disp}</b> (ID: {b_id})\n"
        for phone, reg_at, last_act, uid, is_banned in members:
            cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (uid,))
            own_b = cursor.fetchone()[0]
            role = "👑 Asosiy" if own_b == b_id else "🤝 Ulangan"
            phone_disp = f"+{phone}" if phone else "Raqamsiz"
            ban_str = " (🚫 BANNED)" if is_banned else ""
            
            text += f" ├ {role}: {phone_disp}{ban_str}\n"
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
        cursor.execute("SELECT user_id, phone, registered_at, last_active, ozi_yaratgan_budget_id, taklif_budget_id, is_banned FROM users WHERE user_id = ?", (query,))
    else:
        cursor.execute("SELECT user_id, phone, registered_at, last_active, ozi_yaratgan_budget_id, taklif_budget_id, is_banned FROM users WHERE phone = ?", (query,))
        
    user = cursor.fetchone()
    if not user:
        conn.close()
        await state.clear()
        return await message.answer("❌ Bunday foydalanuvchi topilmadi.", reply_markup=get_admin_keyboard())
        
    uid, phone, reg_at, last_act, own_id, taklif_id, is_banned = user
    cursor.execute("SELECT name, balance FROM budgets WHERE budget_id = ?", (own_id,))
    own_b = cursor.fetchone()
    
    ban_txt = "🚫 BANNED" if is_banned else "🟢 Faol"
    text = f"🔍 <b>Qidiruv Natijasi:</b>\n\n🆔 ID: <code>{uid}</code>\n📱 Raqam: +{phone if phone else 'Kiritilmagan'}\n🎯 Holati: {ban_txt}\n📅 Ro'yxatdan o'tgan: {reg_at if reg_at else 'Noma`lum'}\n⏱ Oxirgi faollik: {last_act if last_act else 'Noma`lum'}\n\n💼 <b>O'zining byudjeti:</b> {own_b[0] if own_b[0] else 'Nomsiz'}"
    
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
    cursor.execute("SELECT user_id FROM users WHERE is_banned = 0")
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
    await message.answer(f"✅ Media-xabar <b>{sent}</b> ta faol foydalanuvchiga muvaffaqiyatli tarqatildi!", parse_mode="HTML", reply_markup=get_admin_keyboard())
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
# 7. JONLI YORDAM (SUPPORT CHAT)
# ==========================================
@dp.message(F.reply_to_message)
async def support_reply(message: types.Message):
    if is_admin(message.from_user.id) and message.reply_to_message.text and "ID:" in message.reply_to_message.text:
        uid_match = re.search(r"ID:\s*(\d+)", message.reply_to_message.text)
        if uid_match:
            target_id = int(uid_match.group(1))
            try:
                await bot.send_message(target_id, f"👨‍💻 <b>Admindan javob:</b>\n\n{message.text}", parse_mode="HTML")
                await message.answer("✅ Javobingiz foydalanuvchiga yetkazildi.")
            except Exception:
                await message.answer("❌ Xatolik! Foydalanuvchi botni bloklagan bo'lishi mumkin.")
        return

@dp.message(F.text)
async def catch_all_text(message: types.Message):
    if not is_admin(message.from_user.id):
        try:
            msg = f"📩 <b>Yangi murojaat:</b>\n👤 ID: <code>{message.from_user.id}</code>\n\n{message.text}"
            await bot.send_message(ASOSIY_ADMIN_ID, msg, parse_mode="HTML")
            await message.answer("📨 Xabaringiz Adminga yetkazildi. Tez orada javob beramiz.")
        except Exception: pass

# ==========================================
# 8. BOTNI ISHGA TUSHIRISH
# ==========================================
async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    asyncio.create_task(auto_backup_scheduler()) 
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
