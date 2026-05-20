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
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- BAZA QISMI (YANGI) ---
def init_db():
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    # Foydalanuvchilar va ularning balansini saqlash
    cursor.execute('''CREATE TABLE IF NOT EXISTS users 
                      (user_id INTEGER PRIMARY KEY, balance REAL DEFAULT 0)''')
    conn.commit()
    conn.close()

def register_user(user_id):
    conn = sqlite3.connect('bot_data.db')
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (user_id,))
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

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    # Foydalanuvchini bazaga qo'shamiz
    register_user(message.from_user.id)
    
    web_app = WebAppInfo(url=WEB_APP_URL)
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Ilovani ochish", web_app=web_app)]],
        resize_keyboard=True
    )
    await message.answer(
        f"Salom, {message.from_user.first_name}! Hisobingiz yaratildi. Ilovadan foydalaning.",
        reply_markup=keyboard
    )

@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    data = json.loads(message.web_app_data.data)
    amount = float(data.get("amount", 0))
    action_type = data.get("type", "minus")
    
    # Bazada balansni yangilash
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

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    asyncio.run(main())
