import asyncio
import logging
import json
import os
import threading
import sqlite3
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton
from flask import Flask

# 1. Konfiguratsiya
TOKEN = os.getenv("BOT_TOKEN") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"

# 2. Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- BAZA QISMI (Oilaviy va Shaxsiy hisoblar uchun) ---
def init_db():
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    # Foydalanuvchilar jadvali
    # ozi_yaratgan_budget_id: foydalanuvchining shaxsiy hisob kodi
    # taklif_budget_id: boshqa odam guruhiga qo'shilganidagi hisob kodi
    # joriy_budget_id: foydalanuvchi hozir qaysi hisobda turgani (shaxsiy yoki oilaviy)
    cursor.execute('''CREATE TABLE IF NOT EXISTS users 
                      (user_id INTEGER PRIMARY KEY, 
                       phone TEXT, 
                       ozi_yaratgan_budget_id INTEGER, 
                       taklif_budget_id INTEGER, 
                       joriy_budget_id INTEGER)''')
    
    # Balanslar (Budjetlar) jadvali
    cursor.execute('''CREATE TABLE IF NOT EXISTS budgets 
                      (budget_id INTEGER PRIMARY KEY AUTOINCREMENT, balance REAL DEFAULT 0)''')
    
    # Takliflar (Kutish rejimi) jadvali
    cursor.execute('''CREATE TABLE IF NOT EXISTS invitations 
                      (from_user_id INTEGER, to_phone TEXT, budget_id INTEGER)''')
                      
    conn.commit()
    conn.close()

def register_user(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
    if not cursor.fetchone():
        # Yangi shaxsiy budjet ochamiz
        cursor.execute("INSERT INTO budgets (balance) VALUES (0)")
        shaxsiy_budget = cursor.lastrowid
        
        # Foydalanuvchini ro'yxatdan o'tkazamiz
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

# Bosh menyu klaviaturasi
def get_main_menu():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Ilovani ochish")],
            [KeyboardButton(text="👥 Yangi foydalanuvchi bog'lash")],
            [KeyboardButton(text="🔄 Hisobni almashtirish")] # 2 ta hisob bo'lsa o'tish uchun
        ],
        resize_keyboard=True
    )

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    register_user(message.from_user.id)
    await message.answer(
        f"Salom {message.from_user.first_name} o'zingiz va oilangiz uchun hisob kitob botiga xush kelibsiz !!!",
        reply_markup=get_main_menu()
    )

# 1. Yangi foydalanuvchi bog'lash bosilganda
@dp.message(F.text == "👥 Yangi foydalanuvchi bog'lash")
async def start_binding(message: types.Message):
    # Birinchi foydalanuvchining o'z nomeri borligini tekshirish (bog'lash uchun kerak)
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (message.from_user.id,))
    my_phone = cursor.fetchone()[0]
    conn.close()
    
    if not my_phone:
        await message.answer("Ulanish uchun avval o'z telefon raqamingizni yuboring (Masalan: +998901234567):")
    else:
        await message.answer("Sizning hisobingizga ulanishi kerak bo'lgan oila a'zongizning telefon raqamini yuboring (+998XXXXXXXXX shaklida):")

# Nomer kiritilganda qayta ishlash
@dp.message(F.text.regexp(r'^\+?\d{9,13}$'))
async def handle_phone_input(message: types.Message):
    phone = message.text.replace("+", "")
    user_id = message.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    # Agar foydalanuvchi o'z nomerini kiritayotgan bo'lsa
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (user_id,))
    my_phone = cursor.fetchone()[0]
    
    if not my_phone:
        cursor.execute("UPDATE users SET phone = ? WHERE user_id = ?", (phone, user_id))
        conn.commit()
        conn.close()
        await message.answer(f"✅ Nomeringiz saqlandi! Endi sherigingizni ulash uchun qaytadan '👥 Yangi foydalanuvchi bog'lash' tugmasini bosing.")
        return

    # Sherigining raqamini tekshirish
    cursor.execute("SELECT user_id, taklif_budget_id FROM users WHERE phone = ?", (phone,))
    target = cursor.fetchone()
    
    if not target:
        conn.close()
        await message.answer("❌ Bu raqam egasi hali botdan ro'yxatdan o'tmagan. Avval u botga kirib /start bosishi kerak.")
        return
        
    target_user_id, target_taklif = target
    if target_taklif is not None:
        conn.close()
        await message.answer("❌ Bu foydalanuvchida allaqachon taklif orqali bog'langan ikkinchi hisob bor (Maksimum 2 ta hisob)!")
        return

    # O'zimizning shaxsiy budjet ID ni olamiz va taklif yuboramiz
    cursor.execute("SELECT ozi_yaratgan_budget_id FROM users WHERE user_id = ?", (user_id,))
    my_budget = cursor.fetchone()[0]
    
    cursor.execute("INSERT INTO invitations VALUES (?, ?, ?)", (user_id, phone, my_budget))
    conn.commit()
    conn.close()
    
    # Sherikka tasdiqlash tugmalarini yuborish
    inline_kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [
            types.InlineKeyboardButton(text="✅ Ha, tasdiqlayman", callback_data=f"accept_{user_id}"),
            types.InlineKeyboardButton(text="❌ Yo'q", callback_data=f"reject_{user_id}")
        ]
    ])
    
    try:
        await bot.send_message(
            chat_id=target_user_id,
            text=f"🔔 Foydalanuvchi (+{my_phone}) sizni o'zining moliya hisob-kitobiga qo'shmoqchi. Birgalikda yuritishni tasdiqlaysizmi?",
            reply_markup=inline_kb
        )
        await message.answer("⏳ Taklif muvaffaqiyatli yuborildi. Sherigingiz tasdiqlashini kuting.")
    except Exception as e:
        await message.answer("❌ Sherikka xabar yuborishda xatolik yuz berdi.")

# Taklifni tasdiqlash (Ha / Yo'q)
@dp.callback_query(F.data.startswith("accept_") | F.data.startswith("reject_"))
async def handle_callback(callback: types.CallbackQuery):
    action, from_user_id = callback.data.split("_")
    from_user_id = int(from_user_id)
    target_user_id = callback.from_user.id
    
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    
    if action == "accept":
        # Taklif qilingan budjet ID ni topamiz
        cursor.execute("SELECT phone FROM users WHERE user_id = ?", (target_user_id,))
        my_phone = cursor.fetchone()[0]
        
        cursor.execute("SELECT budget_id FROM invitations WHERE from_user_id = ? AND to_phone = ?", (from_user_id, my_phone))
        inv = cursor.fetchone()
        
        if inv:
            shared_budget_id = inv[0]
            # Sherikning bazasiga taklif etilgan budjetni yozamiz
            cursor.execute("UPDATE users SET taklif_budget_id = ?, joriy_budget_id = ? WHERE user_id = ?", 
                           (shared_budget_id, shared_budget_id, target_user_id))
            cursor.execute("DELETE FROM invitations WHERE from_user_id = ? AND to_phone = ?", (from_user_id, my_phone))
            conn.commit()
            
            await callback.message.answer("🎉 Tabriklaymiz! Endi siz sherigingiz bilan bitta hisob-kitobni yuritasiz. Ilovani ochib tekshirishingiz mumkin.")
            await bot.send_message(from_user_id, "✅ Sherigingiz taklifni qabul qildi. Endi hisobingiz umumiy!")
        else:
            await callback.message.answer("Xatolik: Taklif topilmadi.")
            
    elif action == "reject":
        await callback.message.answer("Siz taklifni rad etdingiz. Yolg'iz o'zingiz foydalanishda davom etasiz.")
        await bot.send_message(from_user_id, "❌ Sherigingiz taklifni rad etdi.")
        
    conn.close()
    await callback.answer()

# Hisobni almashtirish (Shaxsiy <-> Oilaviy)
@dp.message(F.text == "🔄 Hisobni almashtirish")
async def switch_account(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT ozi_yaratgan_budget_id, taklif_budget_id, joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
    ozi, taklif, joriy = cursor.fetchone()
    
    if not taklif:
        await message.answer("Sizda ikkinchi (oilaviy) hisob mavjud emas. Buning uchun '👥 Yangi foydalanuvchi bog'lash' orqali ulanishingiz kerak.")
        conn.close()
        return
        
    yangi_joriy = taklif if joriy == ozi else ozi
    cursor.execute("UPDATE users SET joriy_budget_id = ? WHERE user_id = ?", (yangi_joriy, message.from_user.id))
    conn.commit()
    conn.close()
    
    turi = "Oilaviy (Umumiy)" if yangi_joriy == taklif else "Shaxsiy"
    await message.answer(f"🔄 Hisob almashtirildi! Joriy rejim: **{turi}**")

# Web App'ni ochish tugmasini bosganda URL generatsiya qilish
@dp.message(F.text == "📱 Ilovani ochish")
async def open_app_button(message: types.Message):
    web_app = WebAppInfo(url=WEB_APP_URL)
    inline_kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [types.InlineKeyboardButton(text="🚀 Ilovaga kirish", web_app=web_app)]
    ])
    await message.answer("Ilovani ochish uchun quyidagi tugmani bosing:", reply_markup=inline_kb)

# Web App'dan kelgan ma'lumotni qayta ishlash
@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        amount = float(data.get("amount", 0))
        action_type = data.get("type", "minus")
        
        conn = sqlite3.connect('bot_data.db')
        cursor = conn.cursor()
        
        # Foydalanuvchining aynan hozirgi faol budjet ID sini olamiz
        cursor.execute("SELECT joriy_budget_id FROM users WHERE user_id = ?", (message.from_user.id,))
        budget_id = cursor.fetchone()[0]
        
        # O'sha budjet balansini o'zgartiramiz
        if action_type == "minus":
            cursor.execute("UPDATE budgets SET balance = balance - ? WHERE budget_id = ?", (amount, budget_id))
        else:
            cursor.execute("UPDATE budgets SET balance = balance + ? WHERE budget_id = ?", (amount, budget_id))
            
        cursor.execute("SELECT balance FROM budgets WHERE budget_id = ?", (budget_id,))
        new_balance = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        await message.answer(f"✅ Amal bajarildi.\n📊 Guruh/Hisob balansi: {new_balance} UZS")
    except Exception as e:
        logger.error(f"Xato: {e}")
        await message.answer("Ma'lumotni saqlashda xatolik yuz berdi.")

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
