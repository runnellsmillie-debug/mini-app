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

# --- BAZA QISMI ---
def init_db():
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    # Foydalanuvchilar: user_id, balans, phone
    cursor.execute('''CREATE TABLE IF NOT EXISTS users 
                      (user_id INTEGER PRIMARY KEY, balance REAL DEFAULT 0, phone TEXT)''')
    conn.commit()
    conn.close()

def register_user(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 0)", (user_id,))
    conn.commit()
    conn.close()

init_db()

# 3. Flask serveri (Render uchun)
app = Flask(__name__)
@app.route('/')
def health_check(): return "Bot is active!", 200

def run_flask():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# 4. Bot qismi
bot = Bot(token=TOKEN)
dp = Dispatcher()

# Klaviatura sozlamalari
def get_main_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Ilovani ochish", web_app=WebAppInfo(url=WEB_APP_URL))],
            [KeyboardButton(text="📞 Telefon raqamni yuborish", request_contact=True)]
        ],
        resize_keyboard=True
    )

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    register_user(message.from_user.id)
    await message.answer(
        f"Salom, {message.from_user.first_name}! Hisobingiz 0 UZS bilan ochildi.\n"
        "Ilovadan foydalanish uchun avval '📞 Telefon raqamni yuborish' tugmasini bosing.",
        reply_markup=get_main_keyboard()
    )

# Kontakt (nomer) qabul qilish
@dp.message(F.contact)
async def get_contact(message: types.Message):
    phone = message.contact.phone_number
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET phone = ? WHERE user_id = ?", (phone, message.from_user.id))
    conn.commit()
    conn.close()
    await message.answer(f"✅ Rahmat! Raqamingiz ({phone}) tasdiqlandi. Endi ilovani ochishingiz mumkin.", reply_markup=get_main_keyboard())

# Ilovani ochishni ruxsat bilan tekshirish
@dp.message(F.text == "📱 Ilovani ochish")
async def check_phone_before_open(message: types.Message):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT phone FROM users WHERE user_id = ?", (message.from_user.id,))
    result = cursor.fetchone()
    conn.close()
    
    if result and result[0]:
        await message.answer("Ilova ochilmoqda...")
    else:
        await message.answer("❌ Ilovani ochish uchun avval '📞 Telefon raqamni yuborish' tugmasini bosing!")

@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        amount = float(data.get("amount", 0))
        action_type = data.get("type", "minus")
        
        conn = sqlite3.connect('bot_data.db')
        cursor = conn.cursor()
        if action_type == "minus":
            cursor.execute("UPDATE users SET balance = balance - ? WHERE user_id = ?", (amount, message.from_user.id))
        else:
            cursor.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, message.from_user.id))
        
        cursor.execute("SELECT balance FROM users WHERE user_id = ?", (message.from_user.id,))
        new_balance = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        
        await message.answer(f"✅ Amal bajarildi.\n📊 Yangi balans: {new_balance} UZS")
    except Exception as e:
        logger.error(f"Xato: {e}")
        await message.answer("Ma'lumotni qayta ishlashda xatolik!")

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
