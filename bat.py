import asyncio
import logging
import json
import os
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton
from flask import Flask
from threading import Thread

# 1. Tokenni Environment Variable'dan o'qiymiz
TOKEN = os.getenv("8619700756:AAHFrcQYILDeM8_ELs5sFNguL9WfDZhL3VQ") 
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"

# Logging'ni sozlash
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Render uchun Flask (Port 10000)
app = Flask(__name__)

@app.route('/')
def home():
    return "Bot is active!", 200

def run_flask():
    # Render 10000 portni kutadi
    app.run(host='0.0.0.0', port=10000)

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
        logging.error(f"Ma'lumotni qayta ishlashda xato: {e}")
        await message.answer("Ma'lumot qabul qilindi, lekin formatda xatolik bor.")

async def main():
    logging.info("Bot polling boshlandi...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    # Flask serverini fon rejimida boshlaymiz
    Thread(target=run_flask, daemon=True).start()
    # Botni ishga tushiramiz
    asyncio.run(main())
