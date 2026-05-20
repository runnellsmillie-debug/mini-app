import asyncio
import logging
import json
import os
import threading
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton
from flask import Flask

# 1. Konfiguratsiya
TOKEN = os.getenv("BOT_TOKEN") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"

# 2. Logging'ni professional sozlash
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 3. Flask serveri (Render "Web Service" sifatida ko'rishi uchun)
app = Flask(__name__)

@app.route('/')
def health_check():
    return "Bot is active!", 200

def run_flask():
    # Render avtomatik tayinlaydigan PORT ni olamiz
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# 4. Bot qismi
bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    web_app = WebAppInfo(url=WEB_APP_URL)
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Ilovani ochish", web_app=web_app)]],
        resize_keyboard=True
    )
    await message.answer(
        "Salom! Moliyaviy yordamchingiz ishga tushdi 💸",
        reply_markup=keyboard
    )

@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        amount = data.get("amount", "0")
        category = data.get("category", "Noma'lum")
        action_type = data.get("type", "minus")
        
        text = f"📉 Chiqim: {amount} UZS\n📂 Kategoriya: {category}" if action_type == "minus" \
               else f"📈 Kirim: {amount} UZS\n📂 Kategoriya: {category}"
        
        await message.answer(text)
    except Exception as e:
        logger.error(f"Ma'lumotni qayta ishlashda xato: {e}")
        await message.answer("Ma'lumot formatida xatolik yuz berdi.")

async def main():
    # Eski so'rovlarni tozalash (Conflict xatosini yo'qotadi)
    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("Bot polling ishga tushdi...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    # Flask serverini fon rejimida (daemon) ishga tushiramiz
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # Botni ishga tushiramiz
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot to'xtatildi.")
