import asyncio
import logging
import json
import os
import threading
import sqlite3
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardRemove
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from flask import Flask

# 1. Konfiguratsiya
TOKEN = os.getenv("BOT_TOKEN") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"
ASOSIY_ADMIN_ID = 123456789 # O'ZINGIZNING TELEGRAM ID RAQAMINGIZNI SHU YERGA YOZING

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- HOLATLAR (States) ---
class Setup(StatesGroup):
    waiting_for_name = State()
    waiting_for_partner_phone = State()

class AdminState(StatesGroup):
    waiting_for_broadcast_msg = State()
    waiting_for_new_admin_id = State()
    waiting_for_del_admin_id = State()

# --- BAZA QISMI ---
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

    # ADMINLAR JADVALI
    cursor.execute('''CREATE TABLE IF NOT EXISTS admins (user_id INTEGER PRIMARY KEY)''')
    
    # Asosiy adminni avtomatik bazaga qo'shish
    cursor.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (ASOSIY_ADMIN_ID,))

    try:
        cursor.execute("ALTER TABLE budgets ADD COLUMN name TEXT")
    except sqlite3.OperationalError:
        pass 

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
    cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO budgets (balance, name) VALUES (0, NULL)")
        shaxsiy_budget = cursor.lastrowid
        cursor.execute("INSERT INTO users VALUES (?, NULL, ?, NULL, ?)", (user_id, shaxsiy_budget, shaxsiy_budget))
        conn.commit()
    conn.close()

init_db()

# 3. Flask serveri
app = Flask(__name__)
@app.route('/')
def health_check(): return "Bot is active!", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# 4. Bot qismi
bot = Bot(token=TOKEN)
dp = Dispatcher()

# --- DINAMIK MENYU ---
def get_main_keyboard(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT ozi_yaratgan_budget_id, taklif_budget_id FROM users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return ReplyKeyboardRemove()
        
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
    
    return ReplyKeyboardMarkup(
        keyboard=[
            accounts_row,
            [KeyboardButton(text="👥 Yangi foydalanuvchi bog'lash"), KeyboardButton(text="📋 Guruh a'zolari")]
        ],
        resize_keyboard=True
    )

@dp.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear()
    register_user(message.from_user.id)
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone, ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    user_data = cursor.fetchone()
    
    phone, budget_id = user_data
    
    if not phone:
        kb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]], resize_keyboard=True)
        await message.answer("Assalomu alaykum! Xavfsizlik uchun va botdan foydalanishni boshlash uchun avval telefon raqamingizni tasdiqlang:", reply_markup=kb)
        conn.close()
        return
        
    cursor.execute("SELECT name FROM budgets WHERE budget_id = ?", (budget_id,))
    budget_name = cursor.fetchone()[0]
    conn.close()
    
    if not budget_name:
        await state.set_state(Setup.waiting_for_name)
        await message.answer("Ajoyib! Endi bu hisobingizga nom bering (Masalan: Shaxsiy, Oilaviy byudjet, Mening pulim):", reply_markup=ReplyKeyboardRemove())
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
        await message.answer(f"✅ Raqam saqlandi (+{phone})!\n\nEndi hisobingizga nom bering (Masalan: Oilaviy, Shaxsiy):", reply_markup=ReplyKeyboardRemove())
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
    
    web_app = WebAppInfo(url=WEB_APP_URL)
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
        web_app = WebAppInfo(url=WEB_APP_URL)
        inline_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🚀 Ilovaga kirish", web_app=web_app)]])
        await message.answer(f"{message.text} faollashdi. Ilovani ochish uchun bosing:", reply_markup=inline_kb)
    conn.close()

@dp.message(F.text == "👥 Yangi foydalanuvchi bog'lash")
async def start_binding(message: types.Message, state: FSMContext):
    await state.set_state(Setup.waiting_for_partner_phone)
    await message.answer("Sizning hisobingizga ulanishi kerak bo'lgan insonning telefon raqamini yuboring (+998XXXXXXXXX shaklida):\n\n*(Bekor qilish uchun /start ni bosing)*")

@dp.message(Setup.waiting_for_partner_phone, F.text.regexp(r'^\+?\d{9,13}$'))
async def handle_partner_phone(message: types.Message, state: FSMContext):
    phone = message.text.replace("+", "")
    user_id = message.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone, ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (user_id,))
    my_data = cursor.fetchone()
    my_phone, my_budget = my_data
    
    if phone == my_phone:
        await message.answer("❌ O'z raqamingizni kiritdingiz! Boshqa shaxsning raqamini kiriting:")
        conn.close()
        return

    cursor.execute("SELECT user_id, taklif_budget_id FROM users WHERE phone = ?", (phone,))
    target = cursor.fetchone()
    
    if not target:
        await message.answer("❌ Bu raqam egasi hali botdan ro'yxatdan o'tmagan. Avval u botga kirishi kerak.")
        await state.clear()
        conn.close()
        return
        
    target_user_id, target_taklif = target
    if target_taklif is not None:
        await message.answer("❌ Bu inson allaqachon boshqa birovning hisobiga ulangan!")
        await state.clear()
        conn.close()
        return

    cursor.execute("DELETE FROM invitations WHERE to_phone = ? AND budget_id = ?", (phone, my_budget))
    cursor.execute("INSERT INTO invitations VALUES (?, ?, ?)", (user_id, phone, my_budget))
    conn.commit()
    conn.close()
    
    inline_kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Ha", callback_data=f"accept_{user_id}"),
            InlineKeyboardButton(text="❌ Yo'q", callback_data=f"reject_{user_id}")
        ]
    ])
    
    try:
        await bot.send_message(
            chat_id=target_user_id,
            text=f"🔔 Taklifnoma!\n\nFoydalanuvchi (+{my_phone}) sizni o'zining hisobiga qo'shmoqchi. Rozimisiz?",
            reply_markup=inline_kb
        )
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
            cursor.execute("UPDATE users SET taklif_budget_id = ?, joriy_budget_id = ? WHERE user_id = ?", 
                           (shared_budget_id, shared_budget_id, target_user_id))
            cursor.execute("DELETE FROM invitations WHERE to_phone = ?", (target_phone,))
            conn.commit()
            
            await callback.message.edit_text("✅ Siz taklifni qabul qildingiz!")
            await bot.send_message(from_user_id, f"🎉 +{target_phone} hisobingizga qo'shildi.")
            await bot.send_message(target_user_id, "Menyu yangilandi:", reply_markup=get_main_keyboard(target_user_id))
        else:
            await callback.message.edit_text("❌ Bu taklif eskirgan.")
            
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
    
    if not members:
        await message.answer("Hech kim topilmadi.")
        return
        
    text = f"👥 '{b_name}' hisobi a'zolari:\n\n"
    for idx, (phone, uid) in enumerate(members, 1):
        me = " (Siz)" if uid == message.from_user.id else ""
        text += f"{idx}. +{phone}{me}\n"
        
    await message.answer(text)

@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        
        conn = sqlite3.connect('bot_data.db')
        cursor = conn.cursor()
        
        cursor.execute("SELECT joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
        budget_id = cursor.fetchone()[0]
        
        for item in data:
            amount = float(item.get("amount", 0))
            action_type = item.get("type", "minus")
            
            if action_type == "minus":
                cursor.execute("UPDATE budgets SET balance = balance - ? WHERE budget_id = ?", (amount, budget_id))
            else:
                cursor.execute("UPDATE budgets SET balance = balance + ? WHERE budget_id = ?", (amount, budget_id))
                
        cursor.execute("SELECT balance, name FROM budgets WHERE budget_id = ?", (budget_id,))
        result = cursor.fetchone()
        new_balance, b_name = result
        conn.commit()
        conn.close()
        
        await message.answer(f"✅ Amallar '{b_name}' hisobiga yozildi.\n📊 Yangi balans: {new_balance:,.0f} UZS".replace(",", " "))
    except Exception as e:
        logger.error(f"Xato: {e}")
        await message.answer("Ma'lumotni saqlashda xatolik yuz berdi.")

# ==========================================
# ADMIN PANEL LOGIKASI
# ==========================================

def get_admin_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 Statistika"), KeyboardButton(text="📢 Xabarnoma")],
            [KeyboardButton(text="👮‍♂️ Admin qo'shish"), KeyboardButton(text="🗑 Admin o'chirish")],
            [KeyboardButton(text="🔙 Asosiy menyu")]
        ],
        resize_keyboard=True
    )

@dp.message(Command("admin"))
async def cmd_admin(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return 
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
    
    cursor.execute("SELECT SUM(balance) FROM budgets")
    total_balance = cursor.fetchone()[0] or 0
    
    cursor.execute("SELECT COUNT(*) FROM admins")
    total_admins = cursor.fetchone()[0]
    
    conn.close()
    
    text = (
        f"📊 <b>BOT STATISTIKASI:</b>\n\n"
        f"👥 Umumiy foydalanuvchilar: <b>{total_users} ta</b>\n"
        f"💼 Ochilgan byudjetlar: <b>{total_budgets} ta</b>\n"
        f"💰 Tizimdagi aylanma mablag': <b>{int(total_balance):,} UZS</b>\n"
        f"👮‍♂️ Adminlar soni: <b>{total_admins} ta</b>"
    ).replace(",", " ")
    
    await message.answer(text, parse_mode="HTML")

@dp.message(F.text == "📢 Xabarnoma")
async def start_broadcast(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    await state.set_state(AdminState.waiting_for_broadcast_msg)
    await message.answer("Barcha foydalanuvchilarga yuboriladigan xabarni kiriting:\n<i>(Bekor qilish uchun 'bekor' deb yozing)</i>", parse_mode="HTML", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_broadcast_msg)
async def send_broadcast(message: types.Message, state: FSMContext):
    if message.text.lower() == 'bekor':
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
        except Exception:
            pass 
            
    await state.clear()
    await message.answer(f"✅ Xabar <b>{sent}</b> ta foydalanuvchiga muvaffaqiyatli yuborildi!", parse_mode="HTML", reply_markup=get_admin_keyboard())

@dp.message(F.text == "👮‍♂️ Admin qo'shish")
async def add_admin_start(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    await state.set_state(AdminState.waiting_for_new_admin_id)
    await message.answer("Yangi adminning Telegram ID raqamini yuboring:", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_new_admin_id)
async def add_admin_finish(message: types.Message, state: FSMContext):
    if not message.text.isdigit():
        return await message.answer("Xato! ID faqat raqamlardan iborat bo'ladi.")
        
    new_id = int(message.text)
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (new_id,))
    conn.commit()
    conn.close()
    
    await state.clear()
    await message.answer(f"✅ ID {new_id} adminlar qatoriga qo'shildi!", reply_markup=get_admin_keyboard())

@dp.message(F.text == "🗑 Admin o'chirish")
async def del_admin_start(message: types.Message, state: FSMContext):
    if message.from_user.id != ASOSIY_ADMIN_ID:
        return await message.answer("❌ Bunga faqat Asosiy Admin huquqiga ega!")
        
    await state.set_state(AdminState.waiting_for_del_admin_id)
    await message.answer("O'chirilishi kerak bo'lgan adminning Telegram ID raqamini yuboring:", reply_markup=ReplyKeyboardRemove())

@dp.message(AdminState.waiting_for_del_admin_id)
async def del_admin_finish(message: types.Message, state: FSMContext):
    if not message.text.isdigit():
        return await message.answer("Xato! ID faqat raqamlardan iborat bo'ladi.")
        
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

# ==========================================
# ADMIN QISMI YAKUNI
# ==========================================

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
