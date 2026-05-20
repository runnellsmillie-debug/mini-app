import asyncio
import logging
import json
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import WebAppInfo, ReplyKeyboardMarkup, KeyboardButton

# 1. TEPADAGI COPY QILGAN TOKENINGIZNI SHU YERGA QO'YING
TOKEN = "8619700756:AAFXbmz6TB-cdwrJsDKQw-bVFxrXYmBtYP4" 

# 2. GITHUB'DAGI SAYTINGIZ MANZILI
WEB_APP_URL = "https://runnellsmillie-debug.github.io/mini-app/"

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    # Web App uchun pastki (Reply) klaviatura yaratamiz
    web_app = WebAppInfo(url=WEB_APP_URL)
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Ilovani ochish", web_app=web_app)]
        ],
        resize_keyboard=True
    )
    await message.answer(
        "Salom! Men sizning shaxsiy moliyaviy yordamchingizman 💸\n\n"
        "Xarajatlarni kiritish uchun pastdagi «📱 Ilovani ochish» tugmasini bosing!",
        reply_markup=keyboard
    )

# Web App'dan kelgan ma'lumotni ushlab olish
@dp.message(F.web_app_data)
async def web_app_handler(message: types.Message):
    # Saytimizdan yuborilgan JSON formatdagi ma'lumotni o'qiymiz
    data = json.loads(message.web_app_data.data)
    amount = data.get("amount")
    category = data.get("category")
    action_type = data.get("type")
    
    # Kelgan ma'lumotga qarab javob qaytaramiz
    if action_type == "minus":
        text = f"📉 Chiqim saqlandi:\n💰 Summa: {amount} UZS\n📂 Kategoriya: {category}"
    else:
        text = f"📈 Kirim saqlandi:\n💰 Summa: {amount} UZS\n📂 Kategoriya: {category}"
        
    await message.answer(text)

async def main():
    logging.basicConfig(level=logging.INFO)
    print("Bot ishga tushdi! Telegramga kirib /start bosing.")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
